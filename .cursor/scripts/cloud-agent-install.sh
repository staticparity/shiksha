#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

corepack enable
pnpm approve-builds sharp unrs-resolver supabase || true
pnpm install --frozen-lockfile
pnpm exec playwright install chromium

# Ensure Docker is available for local Supabase (nested Cloud Agent VMs).
if ! command -v dockerd >/dev/null 2>&1; then
  sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    docker.io docker-compose-v2 fuse3 fuse-overlayfs iptables
fi

# Prefer legacy iptables for nested Docker networking.
if command -v update-alternatives >/dev/null 2>&1; then
  sudo update-alternatives --set iptables /usr/sbin/iptables-legacy 2>/dev/null || true
  sudo update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy 2>/dev/null || true
fi

sudo mkdir -p /etc/docker
if [[ ! -f /etc/docker/daemon.json ]]; then
  cat <<'EOF' | sudo tee /etc/docker/daemon.json >/dev/null
{
  "storage-driver": "fuse-overlayfs",
  "iptables": true,
  "ip-forward": true
}
EOF
fi
