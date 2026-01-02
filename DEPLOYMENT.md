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

1.  **Configure `.env.deploy`**
    Create a `.env.deploy` file in the root directory to store your deployment settings.

    **For Standard SSH:**
    ```bash
    DEPLOY_TARGET=user@your-server-ip
    ```

    **For Google Cloud (gcloud):**
    ```bash
    GCLOUD_INSTANCE=your-instance-name
    GCLOUD_PROJECT=your-project-id
    GCLOUD_ZONE=your-zone
    GCLOUD_USER=your-ssh-user
    ```

2.  **Run the Remote Deploy Script**
    ```bash
    ./remote-deploy.sh
    ```
    *If you didn't create `.env.deploy`, you can pass the target manually: `./remote-deploy.sh user@host`*

    This script automatically:
    1.  Pushes your local changes to GitHub.
    2.  Connects to the server (via SSH or gcloud).
    3.  Runs the deployment process (`./deploy.sh`).

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

## Technical Notes

- **Dependencies**: The frontend service runs `npm start` (Vite), which requires `vite` to be installed. The `deploy.sh` script is configured to run `npm install --include=dev` to ensure it's available.
- **Nginx Config**: If you encounter a 404 when accessing your server URL, ensure the default Nginx site (`/etc/nginx/sites-enabled/default`) is removed or that your app's Nginx configuration includes `default_server` in the `listen` directive to correctly route traffic.
- **Memory Management**: On low-memory instances like Google Cloud `e2-micro`, `npm install` can occasionally hang or fail. If this happens, try stopping the services (`sudo systemctl stop svg-frontend svg-backend`) before running the deployment script.

## Troubleshooting

### 404 Not Found at Root
If the homepage returns a 404 but the services are running:
1. Check if Vite started correctly: `sudo journalctl -u svg-frontend -f`
2. Ensure dependencies are fully installed: `cd frontend && npm install --include=dev`
3. Verify Nginx is pointing to the correct port (default 3000 for frontend).

### 500 Internal Server Error on /api/config
This usually indicates a backend crash or a syntax error in the configuration files. Check logs with `sudo tail -f /var/log/svg-backend.log`.
