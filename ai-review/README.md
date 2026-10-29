# AI review service (n8n)

Checks Rwanda FDA application documents against approved rules, using a knowledge base of guidelines and templates, a local LLM (Ollama) and a vector database (Postgres + pgvector). Triggered by API calls from the portal; returns JSON.

**Start with [GUIDE.md](GUIDE.md)**: step-by-step setup, the API, the result format and how to connect the portal.

| Path | Contents |
|---|---|
| `GUIDE.md` | The step-by-step guide |
| `sql/01-schema.sql` | Tables, plus illustrative starter rules |
| `workflows/` | The six n8n workflows to import (generated, do not edit by hand) |
| `src/` | JavaScript of the Code nodes (edit here) |
| `tools/build_workflows.py` | Rebuilds `workflows/` from `src/` |
| `tools/try-samples.sh` | Loads the samples and runs one analysis end to end |
| `setup/credentials.example.json` | Template for importing the three n8n credentials |
| `samples/` | Illustrative guidelines, template and a small submission (not official documents) |
