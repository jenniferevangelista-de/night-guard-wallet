#!/usr/bin/env bash
# Restarts the demo server in the Codespace (port 8787).
cd "$(dirname "$0")/../app"
for p in $(pgrep -f "tsx.*server\.ts"); do kill $p 2>/dev/null; done
sleep 1
setsid nohup npx tsx src/server.ts > /tmp/ngw/server.log 2>&1 < /dev/null &
sleep 8; tail -1 /tmp/ngw/server.log
