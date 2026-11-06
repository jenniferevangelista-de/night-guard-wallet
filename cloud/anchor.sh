#!/usr/bin/env bash
# Runs an anchor/solana command inside the official Anchor image (the Codespace's own Linux is too old).
# Keys live in ~/.config/ngw, outside the repo.  Usage: cloud/anchor.sh "anchor build"
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p ~/.config/ngw /tmp/ngw/cargo-registry /tmp/ngw/cargo-git /tmp/ngw/anchor-target
OWNER="$(id -u):$(id -g)"
docker run --rm --network host \
  -e OWNER="$OWNER" \
  -v "$PWD":/work -v ~/.config/ngw:/keys \
  -v /tmp/ngw/cargo-registry:/root/.cargo/registry -v /tmp/ngw/cargo-git:/root/.cargo/git \
  -v /tmp/ngw/anchor-target:/work/target \
  -w /work solanafoundation/anchor:v0.31.1 bash -lc '
    solana config set --url https://api.devnet.solana.com --keypair /keys/deployer.json >/dev/null
    bash -c "$1"; rc=$?
    chown -R "$OWNER" /work/target /work/Cargo.lock /keys 2>/dev/null
    exit $rc' _ "$*"
