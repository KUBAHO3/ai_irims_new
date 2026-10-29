#!/usr/bin/env bash
# Loads the sample knowledge base and runs one analysis on the sample submission, then waits for the result.
# Usage: N8N=http://localhost:5678/webhook KEY=<API key> tools/try-samples.sh
set -euo pipefail
: "${N8N:?Set N8N, e.g. http://localhost:5678/webhook}"
: "${KEY:?Set KEY to the API key}"
cd "$(dirname "$0")/../samples"
H="X-API-Key: $KEY"

echo "1/3 Loading the sample knowledge base"
curl -fsS -H "$H" "$N8N/ai/kb/documents" -F sourceKey=sample-labelling-guideline -F 'title=Guidelines on labelling (sample)' \
  -F kind=guideline -F requirementIds=artwork -F file=@knowledge-base/labelling-guideline.txt; echo
curl -fsS -H "$H" "$N8N/ai/kb/documents" -F sourceKey=sample-reliance-guideline -F 'title=Reliance pathway guidelines (sample)' \
  -F kind=guideline -F productTypes=HM -F requirementIds=sameness,rra-gmp,rra-auth -F file=@knowledge-base/reliance-guideline.txt; echo
curl -fsS -H "$H" "$N8N/ai/kb/documents" -F sourceKey=sample-sameness-template -F 'title=Declaration of sameness template (sample)' \
  -F kind=template -F productTypes=HM -F requirementIds=sameness -F file=@knowledge-base/declaration-of-sameness-template.txt; echo

echo "2/3 Starting the analysis"
RESP=$(curl -fsS -H "$H" "$N8N/ai/analyses" \
  -F applicationRef=SAMPLE/HM/0001 -F productType=HM \
  -F 'fields={"brand":"Paracet-IP","generic":"Paracetamol","size":"500 mg","form":"Tablet","storage":"Store below 30°C"}' \
  -F 'labelText=PARACET-IP Paracetamol 500 mg tablets. Keep out of reach of children. Store in a cool, dry place.' \
  -F sameness=@submission/declaration-of-sameness.txt \
  -F rra-gmp=@submission/gmp-certificate.pdf \
  -F rra-auth=@submission/authorization-letter.txt)
echo "$RESP"
ID=$(echo "$RESP" | sed -E 's/.*"analysisId":"([^"]+)".*/\1/')

echo "3/3 Waiting for the result (minutes on a CPU)"
while :; do
  OUT=$(curl -fsS -H "$H" "$N8N/ai/analyses?id=$ID")
  case "$OUT" in *'"status":"running"'*) printf '.'; sleep 20 ;; *) echo; echo "$OUT"; break ;; esac
done
