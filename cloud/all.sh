#!/usr/bin/env bash
# Everything after a code change: measured demo + on-chain proofs, then the video (record + build).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
MODELS="gemma4:e2b" bash cloud/ollama_setup.sh > /dev/null 2>&1
cd app
npx tsx src/reclaim.ts 2>&1 | grep deployer
npx tsx src/setup.ts 2>&1 | grep -E "topped|cancelled|limits|elder wallet"
echo "== demo"; RUNS=${RUNS:-3} npx tsx src/demo_run.ts > /workspaces/ngw_demo.log 2>&1; grep -vE "^\[explain\]" /workspaces/ngw_demo.log | tail -45
cp out/results.json /workspaces/ngw_results.json; sync
cd "$ROOT"; rm -f video/work/narration.json
echo "== video"; bash cloud/video_pipeline.sh
echo "== ALL_DONE"
