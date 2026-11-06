#!/usr/bin/env bash
# Narration -> proof data -> clean vault -> restart server -> record the real app -> build the video.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export FONT_DIR=/tmp/ngw/fonts
cd "$ROOT"
MODELS="gemma4:e2b" bash cloud/ollama_setup.sh > /dev/null 2>&1   # Gemma back up (the render step stops it)
[ -f video/work/narration.json ] || /tmp/ngw/venv/bin/python video/script.py | tail -2
cd "$ROOT/app"
npx tsx src/reclaim.ts 2>&1 | grep deployer
npx tsx src/proof_card.ts 2>&1 | tail -1
npx tsx src/setup.ts 2>&1 | grep -E "topped|cancelled|elder wallet"
bash "$ROOT/cloud/restart_server.sh"
cd "$ROOT"
rm -rf video/work/raw; cloud/pw.sh "node video/record_demo.mjs" 2>&1 | tail -12
sync
for p in $(pgrep -f "ollama serve"); do kill $p; done      # free memory for the render
rm -rf /tmp/ngw/frames; /tmp/ngw/venv/bin/python video/build.py 2>&1 | tail -3
sync
echo "== VIDEO_DONE"
