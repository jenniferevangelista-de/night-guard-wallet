#!/usr/bin/env bash
# Clean vault -> restart server -> record the real app -> build the video.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/app"; npx tsx src/setup.ts 2>&1 | grep -E "topped|cancelled|elder wallet"
bash "$ROOT/cloud/restart_server.sh"
cd "$ROOT"
rm -rf video/work/raw; cloud/pw.sh "node video/record_demo.mjs" 2>&1 | tail -12
rm -rf /tmp/ngw/frames; FONT_DIR=/tmp/ngw/fonts /tmp/ngw/venv/bin/python video/build.py 2>&1 | tail -3
echo "== VIDEO_DONE"
