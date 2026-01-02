# Deployment Guide

This guide describes how to deploy the Gotham Animation Studio to a Linux server (Ubuntu/Debian recommended) using systemd.

## Prerequisites

- **Node.js (v20+)**: Installed via NVM (recommended).
- **Git**: To fetch the repository.
- **PM2 or Systemd**: This guide uses **systemd** for process management.

## Initial Setup (On Server)

1.  **Clone the Repository**
    ```bash
    cd ~
    git clone https://github.com/goggledefogger/svg-animation-town.git
    cd svg-animation-town
    ```

2.  **Install Dependencies**
    ```bash
    # Backend
    cd backend
    npm install
    
    # Frontend
    cd ../frontend
    npm install
    ```

3.  **Environment Configuration**
    
    Create `.env` files for both backend and frontend.

    **backend/.env**:
    ```bash
    PORT=3001
    OPENAI_API_KEY=sk-...
    # ... see .env.example
    ```

    **frontend/.env**:
    ```bash
    VITE_API_URL=http://localhost:3001/api
    # ... see .env.example
    ```

## Service Installation (Systemd)

We use systemd to keep the services running in the background.

1.  **Copy Service Files**
    ```bash
    sudo cp deployment/svg-backend.service /etc/systemd/system/
    sudo cp deployment/svg-frontend.service /etc/systemd/system/
    ```

2.  **Reload and Start**
    ```bash
    sudo systemctl daemon-reload
    sudo systemctl enable svg-backend svg-frontend
    sudo systemctl start svg-backend svg-frontend
    ```

## Deployment Methods

### Option A: Remote Deployment (Recommended)

Deploy from your local machine without manually SSH-ing into the server each time.

1.  **Run the Remote Deploy Script**
    Pass your server's SSH address as an argument:
    ```bash
    ./remote-deploy.sh dannybauman@your-server-ip
    ```
    
    *Tip: Create a `.env.deploy` file with `DEPLOY_TARGET=user@host` to skip typing the address.*

    This script automatically:
    1.  Pushes your local changes to GitHub.
    2.  Connects to the server.
    3.  Runs the deployment process (pull, install, restart).

### Option B: Manual Deployment (On Server)

If you are already on the server:

1.  Navigate to the repository:
    ```bash
    cd ~/svg-animation-town
    ```
2.  Run the local deploy script:
    ```bash
    ./deploy.sh
    ```
