#!/bin/bash

# Exit on error
set -e

# Configuration
PROJECT_DIR=~/velo
REPO_URL="https://github.com/hwennnn/velo.git" # Replace with actual repo URL if different
BRANCH="master"
ENV_FILE=".env"

# Parse arguments
if [[ "$1" == "--production" ]]; then
    ENV_FILE=".env.production"
    echo "🏭 Deploying in PRODUCTION mode using $ENV_FILE"
fi

echo "🚀 Starting Deployment using $ENV_FILE..."

# Ensure project directory exists
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# Check if git repo exists, if not clone it
if [ ! -d ".git" ]; then
    echo "📥 Cloning repository..."
    git clone $REPO_URL .
else
    echo "🔄 Fetching latest changes..."
    git fetch origin
    git reset --hard origin/$BRANCH
fi

# Build and start containers with correct env file
echo "🏗️ Building and starting containers..."
docker compose down --remove-orphans
export ENV_FILE=$ENV_FILE
docker compose up -d --build

echo "🧹 Cleaning up unused images..."
docker image prune -f

echo "✅ Deployment Complete!"
