#!/usr/bin/env bash
# Installs Rust, Solana CLI, Anchor and Ollama under /tmp/ngw (the big disk of the Codespace).
set -euo pipefail
B=/tmp/ngw; mkdir -p $B
export RUSTUP_HOME=$B/rustup CARGO_HOME=$B/cargo
if [ ! -x $CARGO_HOME/bin/cargo ]; then
  curl -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path --profile minimal --default-toolchain stable
fi
export PATH=$CARGO_HOME/bin:$PATH
mkdir -p ~/.local/share $B/solana-data
[ -L ~/.local/share/solana ] || { rm -rf ~/.local/share/solana; ln -s $B/solana-data ~/.local/share/solana; }
if [ ! -x ~/.local/share/solana/install/active_release/bin/solana ]; then
  sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
fi
export PATH=~/.local/share/solana/install/active_release/bin:$PATH
solana --version
if ! command -v avm >/dev/null; then
  cargo install --git https://github.com/coral-xyz/anchor avm --locked
fi
mkdir -p $B/avm; [ -L ~/.avm ] || { rm -rf ~/.avm; ln -s $B/avm ~/.avm; }
avm install 0.31.1 || true
avm use 0.31.1
anchor --version
# Ollama, CPU only, no GPU libraries
if [ ! -x $B/ollama/bin/ollama ]; then
  mkdir -p $B/ollama
  curl -sSL https://ollama.com/download/ollama-linux-amd64.tgz -o $B/ollama.tgz
  tar -xzf $B/ollama.tgz -C $B/ollama --exclude='lib/ollama/cuda*' --exclude='lib/ollama/rocm*'
  rm -f $B/ollama.tgz
fi
echo TOOLCHAIN_OK
