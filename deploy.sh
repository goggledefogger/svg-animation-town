#!/bin/bash

# Deployment Script for SVG Animation Town
# Usage: ./deploy.sh
# Requires sudo privileges for systemctl restart

set -e # Exit immediately if a command exits with a non-zero status

# Resolve absolute path to the script directory
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Ensure NVM/Node is available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

log() {
  echo -e "${GREEN}[DEPLOY]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Ensure Swap Space
log "Checking swap space..."
if ! sudo /sbin/swapon --show | grep -q "/swapfile"; then
  log "Swap not active. Creating 1G swap file..."
  if [ -f /swapfile ]; then
    sudo /sbin/swapoff /swapfile || true
    sudo rm -f /swapfile
  fi
  sudo fallocate -l 1G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=1024
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo /sbin/swapon /swapfile
  if ! grep -q "/swapfile" /etc/fstab; then
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  fi
  log "Swap space created and enabled."
else
  log "Swap space is already active."
fi

# Tune swappiness to reduce aggressive disk thrashing on low memory VM
log "Tuning vm.swappiness to 10..."
sudo sysctl vm.swappiness=10
if ! grep -q "vm.swappiness" /etc/sysctl.conf; then
  echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
fi


# 1. Update Codebase
log "Updating codebase..."
cd "$APP_DIR"
git fetch origin

# Check for local changes
if [[ -n $(git status -s) ]]; then
  warn "Local changes detected. Stashing them..."
  git stash save "Auto-stash before deploy $(date)"
fi

git reset --hard origin/main
log "Codebase updated to latest main."

# 2. Update Backend
log "Updating backend dependencies..."
cd "$BACKEND_DIR"
# Only install if package.json/lock changed or node_modules missing, but for safety usually just install (fast with cache)
npm install
log "Backend dependencies updated."

# 3. Update Frontend
log "Updating frontend dependencies..."
cd "$FRONTEND_DIR"
npm install --include=dev
log "Frontend dependencies updated."

log "Building frontend static assets..."
npm run build
log "Frontend built successfully."

# 4. Configure Nginx timeouts for long-running reasoning models & Serve Frontend Statically
log "Applying Nginx frontend configuration..."
sudo cp "$APP_DIR/deployment/svg-frontend.nginx" /etc/nginx/sites-available/svg-frontend
if [ ! -f /etc/nginx/sites-enabled/svg-frontend ]; then
  sudo ln -s /etc/nginx/sites-available/svg-frontend /etc/nginx/sites-enabled/
fi

log "Configuring Nginx timeouts..."
for conf in /etc/nginx/sites-available/*; do
    if [ -f "$conf" ]; then
        if sudo grep -q "proxy_pass" "$conf" && ! sudo grep -q "proxy_read_timeout 300s;" "$conf"; then
            sudo sed -i '/proxy_pass/a \        proxy_read_timeout 300s;\n        proxy_connect_timeout 300s;\n        proxy_send_timeout 300s;' "$conf"
            log "Patched timeouts in $conf"
        fi
    fi
done
sudo nginx -t && sudo systemctl reload nginx
log "Nginx updated successfully."

# 5. Restart Services
log "Restarting systemd services..."
sudo systemctl stop svg-frontend || true
sudo systemctl disable svg-frontend || true

# Secure environment files with private API keys
if [ -f "$BACKEND_DIR/.env" ]; then
  chmod 600 "$BACKEND_DIR/.env"
  log "Secured backend environment file permissions."
fi

sudo systemctl restart svg-backend


log "Services restarted."

# 6. Verification
log "Verifying services status..."
sleep 2
sudo systemctl status svg-backend --no-pager

log "Deployment complete!"
