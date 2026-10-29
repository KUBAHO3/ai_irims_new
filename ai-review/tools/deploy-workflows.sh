#!/usr/bin/env bash
# Rebuilds the workflows from src/, imports them into the n8n of ../docker-compose.yml, publishes them,
# then restarts n8n so the published versions are the ones that run.
# Usage: tools/deploy-workflows.sh [04-analyze 03-propose ...]   (default: all six)
set -euo pipefail
cd "$(dirname "$0")/.."
python3 tools/build_workflows.py >/dev/null
names=("$@"); [ ${#names[@]} -eq 0 ] && names=(01-kb 02-rules 03-propose 04-analyze 05-get 06-errors)
workflow_id() {  # bash 3.2 (macOS) has no associative arrays
  case "$1" in
    01-kb) echo aiRevKnowledge01 ;; 02-rules) echo aiRevRulesApi001 ;; 03-propose) echo aiRevPropose0001 ;;
    04-analyze) echo aiRevAnalyze0001 ;; 05-get) echo aiRevGetResult01 ;; 06-errors) echo aiRevErrors00001 ;;
    *) echo "Unknown workflow: $1" >&2; exit 1 ;;
  esac
}
cd ..
for n in "${names[@]}"; do
  docker compose cp "ai-review/workflows/$n.json" "n8n:/tmp/$n.json" >/dev/null
  docker compose exec -T n8n n8n import:workflow --input="/tmp/$n.json" | tail -1
  # The publish command finishes its work but may not exit on a running instance, hence the timeout.
  docker compose exec -T n8n timeout 150 n8n publish:workflow --id="$(workflow_id "$n")" | grep -i publish || true
done
# Restart only after every publish has finished, or n8n keeps running the previous versions.
docker compose restart n8n >/dev/null
until curl -s http://localhost:5678/healthz >/dev/null 2>&1 && curl -s http://localhost:5678/rest/settings | grep -q settingsMode; do sleep 2; done
echo "n8n restarted with the new versions."
