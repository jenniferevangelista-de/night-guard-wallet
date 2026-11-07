#!/usr/bin/env bash
# Stops a running recording/render, gives the "new number" scammer a fresh (unreported) wallet, records again.
cd "$(dirname "$0")/.."
for p in $(pgrep -f "video_pipeline.sh|all.sh|record_demo.mjs|video/build.py"); do kill "$p" 2>/dev/null; done
docker ps -q | xargs -r docker kill >/dev/null
[ -f ~/.config/ngw/demo/fakeRelative.json ] && mv ~/.config/ngw/demo/fakeRelative.json ~/.config/ngw/demo/fakeRelative_reported_$(date +%s).json
[ -f /workspaces/ngw_results.json ] && cp /workspaces/ngw_results.json app/out/results.json
setsid nohup bash cloud/video_pipeline.sh > /workspaces/ngw_video.log 2>&1 < /dev/null &
echo restarted
