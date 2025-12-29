#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting VPS Setup for Velo..."

# Update system
echo "📦 Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install Docker
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm get-docker.sh
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    echo "⚠️  User added to docker group. You may need to re-login for this to take effect."
else
    echo "✅ Docker already installed"
fi

# Install Docker Compose (plugin)
echo "🐳 Installing Docker Compose..."
sudo apt-get install -y docker-compose-plugin

# Create project directory structure
echo "📂 Creating directory structure..."
PROJECT_DIR=~/velo
mkdir -p $PROJECT_DIR/nginx/conf.d
mkdir -p $PROJECT_DIR/nginx/ssl
mkdir -p $PROJECT_DIR/certbot/conf
mkdir -p $PROJECT_DIR/certbot/www

# Fix permissions
echo "🔒 Setting permissions..."
# Ensure nginx config dir is accessible
sudo chown -R $USER:$USER $PROJECT_DIR

echo "✅ VPS Setup Complete!"
echo "➡️  Next steps:"
echo "1. Clone your repository into $PROJECT_DIR (or use the deploy script)"
echo "2. Add your .env file to $PROJECT_DIR/.env"
