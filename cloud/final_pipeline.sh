#!/usr/bin/env bash
# Final run in the Codespace: measured demo -> clean vault -> proof data -> recording -> video.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/app"
echo "== demo"; RUNS=${RUNS:-3} npx tsx src/demo_run.ts 2>&1 | grep -v "^\[explain\]" | tail -25 || exit 1
echo "== setup"; npx tsx src/setup.ts 2>&1 | grep -E "topped|cancelled|elder wallet"
echo "== proof"; npx tsx src/proof_card.ts 2>&1 | tail -6
echo "== server"; bash "$ROOT/cloud/restart_server.sh"
cd "$ROOT"
echo "== record"; rm -rf video/work/raw; cloud/pw.sh "node video/record_demo.mjs" 2>&1 | tail -12
echo "== build"; rm -rf /tmp/ngw/frames; FONT_DIR=/tmp/ngw/fonts /tmp/ngw/venv/bin/python video/build.py --stills 2>&1 | tail -2
FONT_DIR=/tmp/ngw/fonts /tmp/ngw/venv/bin/python video/build.py 2>&1 | tail -3
echo "== PIPELINE_DONE"
