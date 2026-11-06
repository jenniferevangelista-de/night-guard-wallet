#!/usr/bin/env bash
# Runs a command in the official Playwright image (Chromium + ffmpeg-ready Ubuntu 22.04), repo at /work.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p /tmp/ngw/pw-npm
docker run --rm --network host --ipc=host -e OWNER="$(id -u):$(id -g)" -v "$PWD":/work -v /tmp/ngw/pw-npm:/pwnpm -w /work \
  mcr.microsoft.com/playwright:v1.49.1-jammy bash -c '
    [ -d /pwnpm/node_modules/playwright ] || (cd /pwnpm && npm init -y >/dev/null && npm i playwright@1.49.1 >/dev/null 2>&1)
    export NODE_PATH=/pwnpm/node_modules
    ln -sf /pwnpm/node_modules /work/video/node_modules 2>/dev/null || true
    bash -c "$1"; rc=$?; rm -f /work/video/node_modules; chown -R "$OWNER" /work/docs /work/video 2>/dev/null; exit $rc' _ "$*"
