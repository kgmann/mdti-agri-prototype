#!/usr/bin/env bash
# One-time preparation of a fresh Ubuntu VPS: Docker + Compose plugin and a basic firewall (SSH, HTTP, HTTPS).
# Safe to re-run. Usage: sudo deployments/vps-setup.sh [ssh_port]
set -euo pipefail
SSH_PORT="${1:-22}"
[[ $EUID -eq 0 ]] || { echo "Run as root (sudo)." >&2; exit 1; }

apt-get update
apt-get install -y ca-certificates curl git ufw

if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker
if [[ -n "${SUDO_USER:-}" ]]; then usermod -aG docker "$SUDO_USER"; fi

ufw default deny incoming
ufw default allow outgoing
ufw allow "$SSH_PORT"/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "Done. Log out and back in for docker group membership to apply."
