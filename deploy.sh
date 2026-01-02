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
# Assuming 'npm start' in the service runs 'vite --host', we might just need dependencies.
# If a build step is needed for prod, add it here. BUT the service file runs 'npm start' which is usually dev server.
# If prod should build, we'd do 'npm run build' and serve dist.
# Given service file: "ExecStart=... npm start", sticking to install.
npm install
log "Frontend dependencies updated."

# 4. Restart Services
log "Restarting systemd services..."
# Using sudo - user will be prompted for password if not NOPASSWD configured
sudo systemctl restart svg-backend
sudo systemctl restart svg-frontend

log "Services restarted."

# 5. Verification
log "Verifying services status..."
sleep 2
sudo systemctl status svg-backend --no-pager
sudo systemctl status svg-frontend --no-pager

log "Deployment complete!"
