#!/usr/bin/env bash
# Moves Docker's data to /tmp (big disk) and pulls the official Anchor image.
set -euo pipefail
if ! docker info 2>/dev/null | grep -q "/tmp/ngw/docker"; then
  sudo pkill dockerd || true; sleep 3
  sudo mkdir -p /tmp/ngw/docker
  sudo bash -c 'setsid nohup dockerd --data-root /tmp/ngw/docker > /tmp/ngw/dockerd.log 2>&1 < /dev/null &'
  for i in $(seq 1 30); do docker info >/dev/null 2>&1 && break; sleep 2; done
fi
docker info | grep "Docker Root Dir"
docker pull solanafoundation/anchor:v0.31.1
docker run --rm solanafoundation/anchor:v0.31.1 bash -lc 'solana --version; anchor --version; cargo --version; ldd --version | head -1'
echo DOCKER_OK
