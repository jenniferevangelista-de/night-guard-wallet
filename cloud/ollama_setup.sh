#!/usr/bin/env bash
# Ollama (CPU only) under /tmp/ngw, then Gemma. Free and local, like the Night Guard app.
set -euo pipefail
B=/tmp/ngw; mkdir -p $B/ollama $B/models
if [ ! -x $B/ollama/bin/ollama ]; then
  curl -sSL https://ollama.com/download/ollama-linux-amd64.tar.zst -o $B/ollama.tar.zst
  command -v zstd >/dev/null || sudo apt-get install -y -qq zstd >/dev/null
  zstd -dc $B/ollama.tar.zst | tar -x -C $B/ollama --exclude='lib/ollama/cuda*' --exclude='lib/ollama/rocm*' --exclude='lib/ollama/vulkan*'
  rm -f $B/ollama.tar.zst
fi
export OLLAMA_MODELS=$B/models OLLAMA_KEEP_ALIVE=60m
pgrep -f "ollama serve" >/dev/null || (setsid nohup $B/ollama/bin/ollama serve > $B/ollama.log 2>&1 < /dev/null &)
sleep 5
$B/ollama/bin/ollama --version
for m in ${MODELS:-gemma4:e2b gemma3:4b}; do $B/ollama/bin/ollama pull $m || echo "PULL_FAIL $m"; done
$B/ollama/bin/ollama list
echo OLLAMA_OK
