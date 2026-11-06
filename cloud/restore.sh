#!/usr/bin/env bash
# After a Codespace restart (/tmp is wiped): Docker on the big disk, the two images, Ollama + Gemma.
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p /tmp/ngw
bash cloud/docker_tmp.sh 2>&1 | tail -2
docker pull -q mcr.microsoft.com/playwright:v1.49.1-jammy
MODELS="gemma4:e2b" bash cloud/ollama_setup.sh 2>&1 | tail -3
echo RESTORE_DONE
