#!/bin/bash

# Remote Deployment Trigger
# Usage: ./remote-deploy.sh <user@host>
# Example: ./remote-deploy.sh dannybauman@34.12.34.56

SERVER=$1

if [ -z "$SERVER" ]; then
  # Try to read from env or config if not provided
  if [ -f .env.deploy ]; then
    source .env.deploy
    SERVER=$DEPLOY_TARGET
  fi
fi

if [ -z "$SERVER" ]; then
  echo "Usage: ./remote-deploy.sh <user@host>"
  echo "Or create a .env.deploy file with DEPLOY_TARGET=<user@host>"
  exit 1
fi

echo "Deploying to $SERVER..."

# 1. Ensure local is pushed
echo "Pushing local changes to origin/main..."
git push origin main

# 2. Trigger remote deploy
echo "Triggering remote deployment..."
# -t forces pseudo-terminal allocation for potential sudo password prompts
ssh -t $SERVER "cd ~/svg-animation-town && ./deploy.sh"

echo "Remote deployment command finished."
