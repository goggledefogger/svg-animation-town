# Deployment Guide

This guide describes how to deploy the Gotham Animation Studio to a Linux server (Ubuntu/Debian recommended) using systemd.

## Prerequisites

- **Node.js (v20+)**: Installed via NVM (recommended).
- **Git**: To fetch the repository.
- **PM2 or Systemd**: This guide uses **systemd** for process management.

## Initial Setup

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

1.  **Edit Service Files** (Optional)
    Check `deployment/svg-backend.service` and `deployment/svg-frontend.service`. 
    **Ensure the paths match your server setup.**
    - `User`: Your username (e.g., `dannybauman`)
    - `WorkingDirectory`: Full path to the repo folders.
    - `ExecStart`: Path to NVM script.

2.  **Copy to System Directory**
    ```bash
    sudo cp deployment/svg-backend.service /etc/systemd/system/
    sudo cp deployment/svg-frontend.service /etc/systemd/system/
    ```

3.  **Reload and Start**
    ```bash
    sudo systemctl daemon-reload
    sudo systemctl enable svg-backend svg-frontend
    sudo systemctl start svg-backend svg-frontend
    ```

4.  **Check Status**
    ```bash
    sudo systemctl status svg-backend
    sudo systemctl status svg-frontend
    ```

## Automated Updates

To update the application to the latest version on `main`:

1.  SSH into your server.
2.  Navigate to the repository:
    ```bash
    cd ~/svg-animation-town
    ```
3.  Run the deployment script:
    ```bash
    ./deploy.sh
    ```

This script will:
- Stash local changes
- Pull the latest code
- Update dependencies
- Restart the systemd services
