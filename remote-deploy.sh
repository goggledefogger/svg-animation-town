#!/bin/bash

# Remote Deployment Trigger
# Usage: ./remote-deploy.sh [target]

# Load config
if [ -f .env.deploy ]; then
  source .env.deploy
fi

SERVER=$1
[ -z "$SERVER" ] && SERVER=$DEPLOY_TARGET

# 1. Ensure local is pushed
echo "Pushing local changes to origin/main..."
git push origin main

# 2. Check for gcloud config
if [ -n "$GCLOUD_INSTANCE" ]; then
  echo "Using gcloud deployment to $GCLOUD_INSTANCE..."
  
  PROJECT_FLAG=""
  [ -n "$GCLOUD_PROJECT" ] && PROJECT_FLAG="--project=$GCLOUD_PROJECT"
  
  ZONE_FLAG=""
  [ -n "$GCLOUD_ZONE" ] && ZONE_FLAG="--zone=$GCLOUD_ZONE"
  
  USER_PREFIX=""
  [ -n "$GCLOUD_USER" ] && USER_PREFIX="$GCLOUD_USER@"
  
  CMD="cd ~/svg-animation-town && ./deploy.sh"
  
  gcloud compute ssh "${USER_PREFIX}${GCLOUD_INSTANCE}" $PROJECT_FLAG $ZONE_FLAG --command="$CMD"
  exit $?
fi

# 3. Fallback to standard SSH
if [ -z "$SERVER" ]; then
  echo "Usage: ./remote-deploy.sh <user@host>"
  echo "Or configure .env.deploy with GCLOUD_INSTANCE or DEPLOY_TARGET"
  exit 1
fi

echo "Deploying to $SERVER via standard SSH..."
ssh -o StrictHostKeyChecking=accept-new -t $SERVER "cd ~/svg-animation-town && ./deploy.sh"

echo "Remote deployment command finished."
