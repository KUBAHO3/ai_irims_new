# AI document review with n8n: step-by-step guide

This guide sets up an n8n service that:

1. **Learns your material.** You upload guidelines, templates and reference documents. It extracts the text, splits it into chunks, embeds them with a local model (`bge-m3`) and stores them in a vector database (Postgres + pgvector).
2. **Keeps an explicit list of rules.** The checks are rules you write and approve. The LLM can *propose* rules from a guideline or template, but nothing is used until a person approves it.
3. **Reviews a submission on an API call.** The portal sends the application's documents. For every applicable rule, n8n finds the relevant passages in the submission and in the knowledge base, asks the LLM (**OpenAI gpt-4o-mini**) for a verdict, verifies every quote, and returns one JSON result.

n8n, Postgres, the embedding model and Apache Tika run on your own server. **Only the excerpts sent to the LLM leave it**: for each rule, the few most relevant passages of the submission and of the knowledge base go to OpenAI. To keep everything on your server, set `llmProvider: 'ollama'` (step 10). That needs a GPU to be usable; on a CPU one call took over 15 minutes in testing.

> **Before using OpenAI with real dossiers**, confirm with Rwanda FDA's data protection officer that sending these excerpts to a provider outside Rwanda is allowed under Law No 058/2021 on the protection of personal data and privacy and under your confidentiality commitments to applicants. Use an OpenAI organization set up so API data is not used for training, and ask OpenAI about zero data retention for the API.

It builds on the prototype in `../n8n-poc` (which used a local Ollama model) and keeps what worked there: one LLM call per rule, quotes checked word for word, "unclear" instead of guessing. It adds the improvements below.

| Improvement | Why it matters |
|---|---|
| Rules are tied to **product types** and to the portal's **document requirements** (`rra-gmp`, `m3`, `artwork` …) | A GMP-certificate rule is only checked against the GMP certificate, for human medicines only. Results map straight onto the portal's documents. |
| **Templates** are a document kind in the knowledge base | The LLM sees the expected structure when it checks a document, and can propose "must contain section X" rules from a template. |
| **Rule proposals with human approval** | Turning a 60-page guideline into rules is slow by hand. The LLM drafts, a reviewer approves, and every proposal cites the sentence it came from. |
| **Asynchronous API** (`202` + analysis ID, then callback or polling) | An analysis makes one LLM call per rule; dozens of rules take longer than a portal request should wait. |
| **Switchable LLM** (`openai` or `ollama`) and strict JSON output | gpt-4o-mini with OpenAI's strict JSON schema always answers in the expected format; the local option remains for sensitive cases. |
| **API key** on every endpoint, **audit record** of every analysis | Who asked, which documents, which rule versions and models, and the full result are kept. |
| **Failure reporting** | If an analysis crashes, it is marked `failed` and the portal is told, instead of waiting forever. |
| A **suggestion** for each failed or unclear rule | The assessor gets a ready-made sentence for the query to the applicant. |

---

## How it fits together

```
 Portal (NestJS)                         n8n                                   Storage
 ───────────────                         ───                                   ───────
 Admin uploads guideline ──► POST /ai/kb/documents ─► Tika ─► chunks ─► bge-m3 ─► kb_documents + kb_chunks (pgvector)
 Admin manages rules     ──► POST /ai/rules, GET /ai/rules                     ─► guideline_rules
 Admin asks for drafts   ──► POST /ai/rules/propose ─► gpt-4o-mini ─► quote check ─► guideline_rules (status "proposed")

 Assessor: "Request AI   ──► POST /ai/analyses ─► 202 {analysisId}             ─► analyses (status "running")
 analysis"                    │ Tika ─► chunks ─► embed ─► rules for this product type
                              │ per rule: best submission excerpts + knowledge-base excerpts ─► gpt-4o-mini ─► verify quotes
                              └► report ─────────────────────────────────────► analyses (status "completed", result)
 Portal callback endpoint ◄── POST {callbackUrl}  (or the portal polls GET /ai/analyses?id=…)
```

The six workflows (in `workflows/`):

| File | Endpoints | What it does |
|---|---|---|
| `01-kb.json` | `POST /ai/kb/documents`, `GET /ai/kb/documents` | Upload a guideline, template or reference into the vector store; list what is stored |
| `02-rules.json` | `POST /ai/rules`, `GET /ai/rules` | Add, change, approve or retire rules; list them |
| `03-propose.json` | `POST /ai/rules/propose` | The LLM reads a stored document and proposes rules |
| `04-analyze.json` | `POST /ai/analyses` | Analyse an application's documents against the rules |
| `05-get.json` | `GET /ai/analyses?id={id}` | Status and result of an analysis |
| `06-errors.json` | (error trigger) | Marks a crashed analysis as failed and tells the portal |

Every URL starts with `http://<n8n-host>:5678/webhook/`.

---

## Step 1. Start the stack

You need Docker and about 10 GB of free disk. The stack in `../docker-compose.yml` already has everything: n8n, Postgres with pgvector, Ollama and Tika.

1. **Fix the database init folder.** The root `docker-compose.yml` mounts `./init`, which is empty, so no tables were ever created. You'll create the tables by hand in step 2, so this is optional, but for a clean future start point it at the new schema:

   ```yaml
   # docker-compose.yml, service postgres
   volumes:
     - pgdata:/var/lib/postgresql/data
     - ./ai-review/sql:/docker-entrypoint-initdb.d:ro
   ```

2. **Pin the image versions.** `latest` moves. Tika's `latest-full` is now Tika 4.1, which no longer accepts the request the old prototype makes (`PUT /tika` with `Accept: text/html` returns `406`). These workflows use `PUT /tika/html`, which works on 4.1. Pin what you have tested:

   ```yaml
   tika:
     image: apache/tika:4.1.0-full
   n8n:
     image: docker.n8n.io/n8nio/n8n:2.45.5
   ```

3. **Start it and pull the models** (the models are a few GB, first time only):

   ```bash
   cd ~/Documents/irimsnew
   docker compose up -d
   docker compose exec ollama ollama pull bge-m3       # embeddings, 1024 dimensions (needed)
   # Only if you will use the local LLM option instead of OpenAI:
   # docker compose exec ollama ollama pull qwen2.5:7b
   ```

4. **Check each service:**

   ```bash
   curl -s http://localhost:5678/healthz                         # n8n: {"status":"ok"}
   curl -s http://localhost:11434/api/tags | grep -o '"name":"[^"]*"'  # bge-m3 listed
   docker compose exec postgres psql -U aipoc -d aipoc -c 'select 1'
   ```

   Tika has no published port; n8n reaches it inside Docker as `http://tika:9998`.

---

## Step 2. Create the database tables

```bash
docker compose exec -T postgres psql -U aipoc -d aipoc < ai-review/sql/01-schema.sql
```

This creates:

| Table | Holds |
|---|---|
| `kb_documents` | One row per uploaded guideline, template or reference, with its product types, requirement ids and version |
| `kb_chunks` | The text chunks and their embeddings (`vector(1024)`, HNSW index): the vector database |
| `guideline_rules` | The rules: text, severity, guidance, product types, requirement ids, status (`proposed`/`active`/`retired`), version |
| `analyses` | One row per analysis: request, status, result, error, callback URL, n8n execution id |

It also inserts nine **illustrative** rules so you can test straight away. Replace them with approved rules (step 7).

If you ran the old prototype's schema in this database, drop its `kb_chunks` and `guideline_rules` first; the columns differ.

---

## Step 3. Create the secrets

**Your OpenAI API key** goes in the `.env` file next to `docker-compose.yml` (git-ignored), not in n8n:

```bash
# ~/Documents/irimsnew/.env
OPENAI_API_KEY=sk-...
```

`docker-compose.yml` passes it to n8n as `CREDENTIALS_OVERWRITE_DATA`, which fills in the **OpenAI account** credential, whose own API Key field stays **empty**. (Tested on n8n 2.45: the environment value is used only while the stored field is empty.) After changing the key, run `docker compose up -d n8n`. Use a project key limited to the models you need.

Then two shared secrets, one for each direction:

```bash
openssl rand -hex 32   # API key: the portal sends it to n8n in the X-API-Key header
openssl rand -hex 32   # callback key: n8n sends it to the portal in the X-Callback-Key header
```

Keep them in your password manager and in the portal's `.env` (step 9). Never commit them.

---

## Step 4. Import the credentials and workflows

The command line keeps the workflow IDs, so the workflows find their credentials and the error workflow automatically. It is the recommended route.

1. Copy `setup/credentials.example.json` to a temporary file and fill in:
   - the Postgres password (`change-me` in the prototype compose file);
   - the two secrets from step 3.

   Leave the OpenAI credential's `apiKey` empty; it comes from `.env`.

2. Import, then delete the filled-in file:

   ```bash
   docker compose cp /tmp/credentials.json n8n:/tmp/credentials.json
   docker compose exec n8n n8n import:credentials --input=/tmp/credentials.json
   docker compose exec n8n rm /tmp/credentials.json && rm /tmp/credentials.json

   docker compose cp ai-review/workflows n8n:/tmp/ai-review-workflows
   docker compose exec n8n n8n import:workflow --separate --input=/tmp/ai-review-workflows
   ```

   Both commands print `Successfully imported …`.

**If you prefer the n8n editor instead:**

1. **Credentials → Add credential**, four times:

   | Name | Type | Settings |
   |---|---|---|
   | `AI review database` | Postgres | Host `postgres`, port `5432`, database `aipoc`, user `aipoc`, password, SSL disabled |
   | `AI review API key` | Header Auth | Name `X-API-Key`, value = API key |
   | `Portal callback key` | Header Auth | Name `X-Callback-Key`, value = callback key |
   | `OpenAI account` | OpenAI | Leave API Key empty (it comes from `.env`) |

2. **Workflows → Import from file** for each of the six files.
3. Open every node with a warning triangle and select the credential:
   - Webhook nodes → `AI review API key`
   - Postgres nodes → `AI review database`
   - **Send result to portal** and **Tell the portal** → `Portal callback key`
   - **Evaluate rule (OpenAI)** and **Propose rules (OpenAI)** → `OpenAI account`
4. Open **AI review - 4. Analyze submission → Settings → Error workflow** and choose **AI review - 6. Analysis failures**. The editor import gives workflows new IDs, so this link has to be set by hand.

---

## Step 5. Publish the workflows

Open each of the six workflows in the editor and switch it on with the **Publish** (active) toggle at the top right. The `/webhook/...` URLs only exist while a workflow is published. While editing, use **Execute workflow** and the `/webhook-test/...` URLs instead.

> The CLI command `n8n publish:workflow` exists, but on a running single-instance n8n 2.45 it did not exit and published unreliably in testing. Use the editor.

Check that it works (expect a JSON list of the nine starter rules):

```bash
export N8N=http://localhost:5678/webhook
export KEY=<your API key>
curl -s -H "X-API-Key: $KEY" "$N8N/ai/rules?status=active"
curl -s -o /dev/null -w '%{http_code}\n' "$N8N/ai/rules"     # 403: the key is required
```

---

## Step 6. Feed the knowledge base

Upload each guideline, template or reference document once. Use a stable `sourceKey`: uploading the same key again **replaces** the document and all its chunks, which is how you load a new version.

```bash
curl -s -H "X-API-Key: $KEY" $N8N/ai/kb/documents \
  -F sourceKey=rfda-reliance-guideline \
  -F 'title=Guidelines on the reliance registration pathway' \
  -F kind=guideline \
  -F productTypes=HM \
  -F requirementIds=sameness,rra-gmp,rra-auth \
  -F version=2025-01 \
  -F file=@reliance-guideline.pdf
```

| Field | Required | Meaning |
|---|---|---|
| `sourceKey` | yes | Your stable id: lower case, digits, `. _ -` |
| `title` | yes | Shown to the LLM and in results |
| `kind` | yes | `guideline` (requirements), `template` (structure a document must follow) or `reference` (background, e.g. pharmacopoeia extracts) |
| `productTypes` | no | `HM,VM,PF,CO,MD`; empty = all product types |
| `requirementIds` | no | Which portal documents it is about; empty = any. Used to find the right excerpts and to target rule proposals |
| `version` | no | Your version label, kept for the record |
| `file` or `text` | yes | One PDF, Word, text … file (anything Tika reads), or plain text |

The response gives `documentId`, `pages`, `chunksStored` and `replacedPreviousVersion`. List everything stored with `curl -s -H "X-API-Key: $KEY" $N8N/ai/kb/documents`.

**The requirement ids are the portal's** (from `rfda-portal/packages/shared/src/reference.ts`), plus two virtual ones:

| Id | Document |
|---|---|
| `application-form` | The application form fields (sent as JSON, not a file) |
| `artwork` | Label artwork and label text |
| `cover`, `poa`, `ltrletter`, `tm` | Cover letter, power of attorney, local technical representative letter, trademark agreement |
| `sameness`, `rra-gmp`, `rra-auth` | Declaration of sameness; GMP certificate issued by the reference authority; letter of authorization to share information with Rwanda FDA |
| `m1` … `m5`, `other` | CTD Modules 1–5; other documents |
| `gmp`, `coa`, `spc`, `wd`, `fsc`, `comp`, `fsale`, `inci`, `safety`, `iso`, `doc`, `tech`, `ifu` | Documents for veterinary medicines, food, cosmetics and medical devices |

To take a document out of use without deleting it:

```bash
docker compose exec postgres psql -U aipoc -d aipoc -c "UPDATE kb_documents SET active = false WHERE source_key = 'rfda-reliance-guideline';"
```

**Scanned PDFs** have no text layer, so nothing is extracted and the upload fails with "No text could be extracted". The `-full` Tika image includes Tesseract OCR. To use it, add the header `X-Tika-PDFOcrStrategy: auto` to the **Extract text (Tika)** node in workflows 1 and 4. Expect it to be much slower.

---

## Step 7. Write and approve the rules

The rules are the checklist. The LLM never decides *what* to check, only *whether* each rule is met, so no requirement can be silently skipped.

### Add or change rules

```bash
curl -s -H "X-API-Key: $KEY" -H 'Content-Type: application/json' $N8N/ai/rules -d '{
  "rules": [
    { "code": "REL-002",
      "text": "The GMP certificate is issued by the reference regulatory authority, names the manufacturing site, and is valid on the analysis date.",
      "severity": "critical",
      "guidance": "Compare the expiry date with the analysis date. An expired certificate is a fail.",
      "productTypes": ["HM"],
      "requirementIds": ["rra-gmp"] }
  ]}'
```

- `code`: your id, e.g. `REL-002`. Sending an existing code updates that rule. When its text or guidance changes, its `version` goes up, and every analysis records the version it used.
- `severity`: `critical`, `major` or `minor`. A failed critical or major rule makes the verdict `non_compliant`.
- `requirementIds`: the documents to look in. Empty means every document sent.

**Writing good rules:**
- **One checkable statement per rule.** "Storage temperature stated" and "expiry format shown" are two rules, not one. A model checking five things at once misses some.
- **Use the guidance field.** Say what is acceptable and what is not, with an example. This is the biggest lever on accuracy.
- **Keep date and number comparisons simple.** Small models are weak at arithmetic. The prompt gives the model today's date, but treat an expiry "pass" on a 7B model as a hint, not a fact.

### Let the LLM propose rules from a document

```bash
curl -s -H "X-API-Key: $KEY" -H 'Content-Type: application/json' $N8N/ai/rules/propose \
  -d '{"sourceKey":"rfda-reliance-guideline","maxChunks":40}'
```

It answers `202` straight away and works in the background. For a `template` it lists the sections and fields a completed document must contain; for a `guideline`, the requirements.

Proposals are dropped automatically unless the model quotes, word for word, the sentence the rule comes from. Kept proposals are saved with status `proposed` and a code like `P2-1X9K4M`; the quote and page go in their guidance. Running it again does not create duplicates. The default is 40 chunks per request (`maxChunks` up to 500).

### Review the proposals, then approve or retire them

```bash
curl -s -H "X-API-Key: $KEY" "$N8N/ai/rules?status=proposed"
```

Edit a proposal's wording by sending it again in full with `"status": "active"`. To approve or retire without changes, send only the status:

```bash
curl -s -H "X-API-Key: $KEY" -H 'Content-Type: application/json' $N8N/ai/rules \
  -d '[{"code":"P2-1X9K4M","status":"active"},{"code":"P2-0C3QZA","status":"retired"}]'
```

Codes that don't exist come back in `notFound`, with HTTP `207`. Filters for listing: `status`, `productType`, `requirementId`.

> Approval should be a named person's decision, recorded outside n8n too (e.g. in the portal), because the rules are effectively regulatory policy.

---

## Step 8. Run an analysis

### Request

`POST /webhook/ai/analyses` as `multipart/form-data`, with the `X-API-Key` header:

| Field | Required | Content |
|---|---|---|
| `applicationRef` | yes | Tracking number, e.g. `RFDA26/HM/0207` |
| `productType` | yes | `HM`, `VM`, `PF`, `CO` or `MD`: selects the rules and knowledge-base documents |
| `fields` | no | JSON object of the application form fields. Checked as document `application-form` |
| `labelText` | no | The label text. Checked as document `artwork` |
| `callbackUrl` | no | Where to POST the result when done |
| *one field per file* | at least one input | **The field name is the requirement id**: `rra-gmp`, `m3`, `artwork`. For more files under one requirement use `m3__2`, `m3__3` … |

```bash
curl -s -H "X-API-Key: $KEY" $N8N/ai/analyses \
  -F applicationRef=RFDA26/HM/0207 \
  -F productType=HM \
  -F 'fields={"brand":"Paracet-IP","generic":"Paracetamol","size":"500 mg","form":"Tablet","storage":"Store below 30°C"}' \
  -F 'labelText=PARACET-IP Paracetamol 500 mg tablets. Store in a cool, dry place. EXP: MM/YYYY' \
  -F sameness=@declaration-of-sameness.pdf \
  -F rra-gmp=@gmp-certificate.pdf \
  -F rra-auth=@authorization-letter.pdf \
  -F callbackUrl=https://portal.example/api/ai/callback
```

It answers at once with **`202`**:

```json
{ "analysisId": "1b0d…", "status": "running", "statusUrl": "/webhook/ai/analyses?id=1b0d…" }
```

A bad request answers `400` with a list of `errors`.

### Getting the result

- **Callback (recommended):** when finished, n8n POSTs the result JSON to `callbackUrl` with the header `X-Callback-Key: <callback key>`. It retries 3 times, 5 seconds apart. If the analysis crashes, the callback gets `{"analysisId", "status": "failed", "error"}`.
- **Polling:** `GET /webhook/ai/analyses?id={analysisId}` returns `status` (`running`, `completed`, `failed`) and, when completed, the full result. Unknown IDs give `404`.

### Result

```json
{
  "analysisId": "1b0d…",
  "status": "completed",
  "applicationRef": "RFDA26/HM/0207",
  "productType": "HM",
  "overall": { "verdict": "non_compliant",
               "counts": { "pass": 3, "fail": 2, "unclear": 1, "not_applicable": 0, "evaluated": 6, "skipped": 2 } },
  "summary": "2 of 6 rules failed; 1 unclear; 3 passed; 2 not evaluated.",
  "findings": [
    { "ruleCode": "REL-002", "rule": "The GMP certificate is issued by …", "severity": "critical",
      "requirementIds": ["rra-gmp"], "ruleVersion": 1,
      "status": "fail", "confidence": 0.9,
      "explanation": "The certificate states it is valid until 31 March 2025, before the analysis date.",
      "suggestion": "Provide a GMP certificate from the reference authority that is valid on the submission date.",
      "evidence": [ { "chunkId": "S4", "requirementId": "rra-gmp", "document": "gmp-certificate.pdf", "page": 1,
                      "quote": "This certificate is valid until 31 March 2025.", "verified": true } ],
      "kbReferences": [ { "id": "K2", "title": "Guidelines on the reliance registration pathway", "sourceKey": "rfda-reliance-guideline",
                          "kind": "guideline", "page": null } ],
      "checks": { "parsed": true, "notes": [] } }
  ],
  "skipped": [ { "ruleCode": "CTD-003", "rule": "Module 3 includes stability data …", "severity": "major",
                 "requirementIds": ["m3"], "version": 1, "reason": "Not evaluated: no m3 document was sent" } ],
  "documents": [ { "requirementId": "rra-gmp", "fileName": "gmp-certificate.pdf", "pages": 1, "characters": 412,
                   "chunks": 1, "truncated": false, "noText": false } ],
  "trace": { "embedModel": "bge-m3", "llmProvider": "openai", "llmModel": "gpt-4o-mini", "llmTokens": 9840,
             "ruleVersions": { "REL-002": 1 }, "analyzedAt": "…" }
}
```

How to read it:
- **`status` per rule:**
  - `pass` / `fail`: backed by at least one verified quote.
  - `unclear`: the excerpts did not settle it. A pass or fail whose quote can't be found in the document is downgraded to `unclear` automatically.
  - `not_applicable`: the rule doesn't apply to this product.
- **`verdict`:**
  - `non_compliant`: any critical or major rule failed.
  - `needs_review`: any other failure, anything unclear, or nothing evaluated.
  - `compliant`: everything evaluated passed.
- **A failed LLM call** (after 3 tries) makes that one rule `unclear`, with the error in `checks.notes`. The rest of the analysis still completes.
- **`skipped`:** rules whose documents were not sent, so the portal can show what was not checked.
- **`documents[].noText` / `truncated`:** a scanned file with no text, or a file longer than `maxChunksPerDocument` (400 chunks, about 400 pages), of which only the start was analysed.
- **Order:** findings are sorted fails first, then by severity.

**It advises; it does not decide.** Show every finding to the assessor with its quotes, and let them confirm or override it.

---

## Step 9. Connect the portal

What the NestJS API needs, as a new `ai` module (`rfda-portal/apps/api/src/ai`):

1. **Settings** in `apps/api/.env`:
   ```
   AI_N8N_URL=http://localhost:5678/webhook
   AI_API_KEY=<API key>
   AI_CALLBACK_KEY=<callback key>
   AI_CALLBACK_URL=http://<portal-api-host>:4100/ai/callback
   ```
   n8n runs in Docker, so `localhost` in the callback URL would mean the n8n container itself. Use `http://host.docker.internal:4100/ai/callback` when the portal runs on the same Mac, or the portal API's internal hostname on a server.
2. **Table** `AiAnalysis` (id, applicationId, n8n analysisId, status, verdict, result JSON, requestedBy, createdAt, finishedAt).
3. **"Request AI analysis"** (assessor, `POST /review/applications/:id/ai-analysis`):
   - Build the multipart request from the application. Each `StoredFile` becomes a file field named after its `requirementId`, with `__2`, `__3` for extra files. Add `labelText` and `fields` from the application record.
   - Send it to `$AI_N8N_URL/ai/analyses` with the `X-API-Key` header.
   - Store the returned `analysisId` as `running`.
4. **Callback endpoint** `POST /ai/callback`. Mark it `@Public()`, accept it only when `X-Callback-Key` matches `AI_CALLBACK_KEY`, then store the result and verdict.
5. **Review workspace:** replace the "AI assist" placeholder with the findings for the selected document: status badge, explanation, verified quotes (linking to the file), and the suggestion as a one-click start for a query. Let the assessor mark each finding agreed or overridden, and keep that, because it is your accuracy data.

---

## Step 10. Run it day to day

**Speed and cost.** With gpt-4o-mini, measured on this Mac:

| Operation | Time |
|---|---|
| Embedding call (local `bge-m3`, CPU) | 12–22 s each; up to 80 s for the first call after idle, while the model loads |
| One gpt-4o-mini call (one rule evaluation or one proposal batch) | 2–7 s |
| Sample analysis: 3 documents (form fields, label text, 1-page GMP PDF), 3 rules evaluated, 4 skipped | 16 s in total, 2,850 tokens |

- **Rules run in parallel**, 4 at a time with a 0.5 s pause between groups, to stay within OpenAI rate limits. Change `batchSize` in the **Evaluate rule (OpenAI)** node's options if your account allows more.
- **Cost:** each analysis records the tokens used in `trace.llmTokens`. Multiply by OpenAI's current gpt-4o-mini price to see the cost per application.
- **The local option** (`llmProvider: 'ollama'`, `llmModel: 'qwen2.5:7b'`) needs a GPU. On this Mac's CPU a single call took over 15 minutes and n8n's timeout ended it. With only 7.7 GB for Docker, the model was also killed for lack of memory while other containers were running. For a local setup, use a GPU server, give Ollama about 8 GB of its own, and set `OLLAMA_NUM_PARALLEL=1` on small machines.

**Settings.** Each workflow's first Code node has a `CONFIG` block:
- `llmProvider` (`openai` or `ollama`) and `llmModel` (`gpt-4o-mini`);
- `embedModel` (`bge-m3`, local);
- `topKEvidence` and `topKKb` (excerpts given to the LLM per rule; more means better context, more tokens);
- `chunkSize`, `maxChunksPerDocument`.

To change the model for all analyses, edit `CONFIG` in **Validate request** of workflows 3 and 4. If you change `embedModel` to one with a different dimension, change `vector(1024)` in the schema and re-upload every document.

**Monitoring.** In n8n, **Overview → Executions** shows every run with each node's input and output. Analyses still `running` after an hour have stalled:

```sql
SELECT id, application_ref, created_at FROM analyses WHERE status = 'running' AND created_at < now() - interval '1 hour';
```

**Keep these private:**
- **n8n's port.** Expose it only to the portal's network, not the internet. Put HTTPS in front if it crosses machines.
- **The API key.** Rotate it by editing the credential.
- **The data.** Analyses contain dossier content. Back up the `aipoc` database along with the portal's.
- **The LLM.** If you ever replace Ollama with a hosted model, dossier text leaves your server. Check that against Rwanda's data protection law (Law No 058/2021) and your contracts first.

**Change the code.** The JavaScript in the Code nodes is kept in `src/` and assembled into `workflows/` by `python3 tools/build_workflows.py`. Edit `src/`, rebuild, re-import. If you edit nodes in the n8n editor instead, export the workflow back to `workflows/` so the files stay the source of truth.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `403` | Missing or wrong `X-API-Key`. |
| `404 … webhook is not registered` | The workflow isn't published (step 5), or you used `/webhook/` while testing in the editor (use `/webhook-test/`). |
| `{"message":"Error in workflow"}` from an upload | Open **Executions**, find the red run and its failing node. Usual causes: Tika can't read the file, Ollama is down, or a credential is not selected. |
| Upload says "No text could be extracted" | Scanned PDF: enable OCR (step 6) or upload a text-based PDF. |
| Tika answers `406` | An old `/tika` + `Accept: text/html` request on Tika 4. These workflows use `/tika/html`. |
| Analysis stays `running` | Check its execution in n8n. If the error workflow link is missing (editor import), set it (step 4) so crashes are marked `failed`. |
| Many `unclear` results | Look at **Select evidence** in the execution: are the right excerpts chosen? Make sure files are named with the right requirement id. Sharpen the rule's guidance. Raise `topKEvidence`. |
| Proposals list is empty after `/ai/rules/propose` | Wait for the execution to finish. If it finished, the model's quotes didn't match the text. The dropped proposals and reasons are in the **Check proposals** node output. |
| Analysis `failed` with "Every LLM call failed … Authorization failed" | `OPENAI_API_KEY` in `.env` is missing or wrong, n8n wasn't recreated after changing it (`docker compose up -d n8n`), or someone typed a key into the **OpenAI account** credential (the stored value wins; clear it). |
| Findings `unclear` with "429" in `checks.notes` | 429: rate limit or no credit on the OpenAI account; lower `batchSize` in **Evaluate rule (OpenAI)** or add credit. |
| Callback never arrives | The portal URL must be reachable *from the n8n container* (see step 9). The **Send result to portal** node shows the HTTP error. The result is still in `GET /ai/analyses?id=…`. |

---

## Next improvements worth making

1. **Measure accuracy before relying on it.** Build a test set of 20–30 past applications with the assessors' real findings. Re-run it whenever you change a model, a prompt or a rule, and track agreement per rule.
2. **Check dates in code, not in the LLM.** Have the LLM extract the expiry date as a field, then compare it with the submission date in a Code node. This is exact where a 7B model guesses.
3. **Check the document is what it claims.** Add a first pass per file: "is this a GMP certificate / Module 3?" It catches files uploaded under the wrong requirement, a frequent screening query.
4. **Hybrid search.** Add Postgres full-text search next to the vector search, so exact terms such as batch numbers and INN names are always found.
5. **Parallel runs.** n8n "queue mode" with workers lets several analyses run at once. Today they queue behind each other on Ollama.
