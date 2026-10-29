# AI analysis prototype on n8n

Prototype of the "analyze a submission against guidelines and a knowledge base" flow:

```
POST /webhook/analyze (text, fields, files)
  -> Tika extracts text (page-aware for PDFs, OCR available)
  -> chunk + embed submission (Ollama, bge-m3)
  -> load ALL active rules for the guideline set (Postgres)
  -> per rule: pick top submission chunks + top knowledge-base chunks (pgvector)
  -> per rule: LLM evaluation with a JSON schema (Ollama, temperature 0)
  -> verify every quote really exists in the cited chunk; otherwise downgrade to "unclear"
  -> aggregate verdict -> JSON or text response
```

Everything runs locally; no data leaves the server.

## Files

| Path | Purpose |
|---|---|
| `docker-compose.yml` | n8n, Postgres + pgvector, Ollama, Apache Tika |
| `init/01-schema.sql` | Tables + **illustrative** sample rules (replace with real ones) |
| `workflows/01-kb-ingest.json` | Upload reference documents into the knowledge base |
| `workflows/02-analyze-submission.json` | The analysis API |
| `samples/` | A sample guidance document and a sample submission to test with |
| `src/` | Source of the JavaScript inside the Code nodes (for reading / porting to NestJS) |

## 1. Start the stack

```bash
docker compose up -d

# Pull the models (first time only; several GB)
docker compose exec ollama ollama pull bge-m3
docker compose exec ollama ollama pull qwen2.5:7b
```

The schema and sample rules are created automatically on the first start of Postgres.
If you change `init/01-schema.sql` later, either run it manually with psql or
`docker compose down -v` (this deletes all data) and start again.

## 2. Set up n8n

1. Open http://localhost:5678 and create the owner account.
2. **Credentials -> Add credential -> Postgres**: host `postgres`, port `5432`,
   database `aipoc`, user `aipoc`, password `change-me`. Save it.
3. **Workflows -> Import from file**: import both files from `workflows/`.
4. In each workflow, open every **Postgres** node (red warning icon) and select the credential.
5. Save, then activate/publish each workflow (toggle at the top right).

## 3. Load the knowledge base

```bash
curl -X POST http://localhost:5678/webhook/kb-ingest \
  -F source="Labelling guidance (sample)" \
  -F file1=@samples/kb-labelling-guidance.txt
```

Response: `{"status":"ok","sources":["Labelling guidance (sample)"],"deleted":0,"inserted":2}`.
Sending the same `source` again replaces its old chunks. PDF and DOCX work the same way.

## 4. Analyze a submission

JSON result:

```bash
curl -X POST http://localhost:5678/webhook/analyze \
  -F guidelineSet=product-registration \
  -F output=json \
  -F 'fields={"applicationType":"new","country":"RW"}' \
  -F file1=@samples/submission-dossier.txt
```

Readable text report: same call with `-F output=text`.

Text only (no files), as JSON body:

```bash
curl -X POST http://localhost:5678/webhook/analyze \
  -H 'Content-Type: application/json' \
  -d '{"guidelineSet":"product-registration","output":"text","text":"Applicant: ... full text here ..."}'
```

With the sample files you should see failures or "unclear" for the P.O. Box address (GEN-001),
the expired GMP certificate (MFG-001) and the storage statement without a temperature (LBL-001),
and passes for the product description and the certificate of analysis. Exact results vary by model.

Use distinct multipart field names for several files (`file1`, `file2`, ...).

## 5. Response shape (JSON)

```json
{
  "status": "completed",
  "guidelineSet": "product-registration",
  "overall": { "verdict": "non_compliant", "counts": { "pass": 2, "fail": 2, "unclear": 2, "not_applicable": 0, "total": 6 } },
  "summary": "2 of 6 rules failed; 2 unclear; 2 passed.",
  "findings": [
    {
      "ruleCode": "LBL-001",
      "rule": "The proposed label states the storage conditions, including a temperature range.",
      "severity": "major",
      "status": "fail",
      "confidence": 0.85,
      "explanation": "The label says 'Store in a cool, dry place' with no temperature.",
      "evidence": [{ "chunkId": "S2", "document": "submission-dossier.txt", "page": null,
                     "quote": "Store in a cool, dry place.", "verified": true }],
      "kbReferences": [{ "id": "K1", "source": "Labelling guidance (sample)", "page": null }],
      "checks": { "parsed": true, "notes": [] }
    }
  ],
  "trace": { "documents": ["submission-dossier.txt"], "embedModel": "bge-m3", "llmModel": "qwen2.5:7b", "analyzedAt": "..." }
}
```

Verdict logic: any `fail` on a critical/major rule -> `non_compliant`; otherwise any `fail` or
`unclear` -> `needs_review`; otherwise `compliant`.

## Adding your own rules

```sql
INSERT INTO guideline_rules (set_code, rule_code, rule_text, severity, guidance)
VALUES ('product-registration', 'LBL-003', 'Rule text...', 'major', 'Optional reviewer guidance');
-- deactivate instead of deleting, to keep history:
UPDATE guideline_rules SET active = false WHERE set_code = 'product-registration' AND rule_code = 'LBL-003';
```

Write each rule as one checkable statement. Split compound rules: one evaluation per rule
works much better than asking the model to check five things at once.

## Settings

Model names, Ollama URL, top-k and chunk size are in the `CONFIG` block at the top of the
**Prepare request** node (and **Prepare upload** for ingestion). If you change the embedding
model, change `vector(1024)` in the schema to its dimension and re-ingest the knowledge base.

## Troubleshooting

- **Webhook URLs**: `/webhook/...` works only when the workflow is active.
  While editing, click "Listen for test event" and call `/webhook-test/...` instead.
- **Slow or timing out**: each rule is one LLM call, run one at a time. A 7B model on CPU can
  take 30 to 120 s per rule. Use a GPU (see `docker-compose.yml`), a smaller model, or fewer rules
  while testing. Requests are synchronous in this prototype, so the curl call waits for the end.
- **Scanned PDFs return no text**: the `tika` image includes Tesseract. Add the header
  `X-Tika-PDFOcrStrategy: ocr_and_text` (or `auto`) to the **Extract text (Tika)** node.
- **"No active rules found"**: check `guidelineSet` matches `set_code` in `guideline_rules`.
- **Postgres node errors after import**: the credential is not selected in that node.
- **Many "unclear" results**: inspect the **Select evidence** node output to see whether the right
  chunks are being retrieved; increase `topKEvidence` or reduce `chunkSize`.

## Prototype limits (address these in the NestJS version)

- Synchronous HTTP; real system should return `202` + job ID and process in a queue.
- No authentication on the webhooks: keep n8n on an internal network or add Header Auth to
  the Webhook nodes before exposing it.
- Results are not stored; add a table for analyses (inputs, rule versions, prompts, outputs) for audit.
- Submission embeddings live only in memory for the run, which keeps submissions out of the knowledge base.
