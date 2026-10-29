#!/usr/bin/env bash
# Uploads every document in knowledge-base/manifest.json, then loads rules/rfda-rules.json and retires
# active rules that are not in that file.
# Usage: N8N=http://localhost:5678/webhook KEY=<API key> tools/load-knowledge-base.sh
set -euo pipefail
: "${N8N:?Set N8N, e.g. http://localhost:5678/webhook}"
: "${KEY:?Set KEY to the API key}"
cd "$(dirname "$0")/.."

# "|" separated, because read would merge empty tab-separated fields.
python3 - <<'PY' | while IFS='|' read -r key title kind types reqs version file; do
import json
for d in json.load(open('knowledge-base/manifest.json')):
    print('|'.join([d['sourceKey'], d['title'], d['kind'], ','.join(d['productTypes']), ','.join(d['requirementIds']), d['version'], d['file']]))
PY
  printf '%-36s ' "$key"
  args=(-F "sourceKey=$key" -F "title=$title" -F "kind=$kind" -F "version=$version" -F "file=@knowledge-base/$file")
  [ -n "$types" ] && args+=(-F "productTypes=$types")
  [ -n "$reqs" ] && args+=(-F "requirementIds=$reqs")
  curl -sS -H "X-API-Key: $KEY" "$N8N/ai/kb/documents" "${args[@]}" | python3 -c '
import sys, json
raw = sys.stdin.read()
try: d = json.loads(raw)
except ValueError: sys.exit("failed: " + raw[:300])
if d.get("status") != "stored": sys.exit("failed: " + raw[:300])
print(d["status"], d["chunksStored"], "chunks", "(replaced)" if d["replacedPreviousVersion"] else "")'
done

echo "Rules:"
curl -fsS -H "X-API-Key: $KEY" -H 'Content-Type: application/json' "$N8N/ai/rules" --data @rules/rfda-rules.json \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print(" ", len(d["saved"]), "saved")'
RETIRE=$(curl -fsS -H "X-API-Key: $KEY" "$N8N/ai/rules?status=active" | python3 -c '
import sys, json
keep = {r["code"] for r in json.load(open("rules/rfda-rules.json"))["rules"]}
old = [r["code"] for r in json.load(sys.stdin) if r["code"] not in keep]
print(json.dumps([{"code": c, "status": "retired"} for c in old]) if old else "")')
if [ -n "$RETIRE" ]; then
  curl -fsS -H "X-API-Key: $KEY" -H 'Content-Type: application/json' "$N8N/ai/rules" -d "$RETIRE" >/dev/null
  echo "  retired: $(echo "$RETIRE" | python3 -c 'import sys,json; print(", ".join(r["code"] for r in json.load(sys.stdin)))')"
fi
