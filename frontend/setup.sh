#!/bin/bash
# Setup script for Velo Frontend

set -e

echo "🚀 Setting up Velo Frontend..."

# Check Node version
echo "📍 Checking Node.js version..."
node_version=$(node --version 2>&1)
echo "   Node version: $node_version"

# Install dependencies
echo "📥 Installing dependencies..."
npm install

# Copy .env.example if .env.local doesn't exist
if [ ! -f ".env.local" ]; then
    echo "📝 Creating .env.local from .env.example..."
    cp .env.example .env.local 2>/dev/null || cp .env.sample .env.local 2>/dev/null || echo "⚠️  No .env.example found. Please create .env.local manually."
    echo "⚠️  Please edit .env.local with your actual Supabase credentials!"
    echo "   Get these values from: https://app.supabase.com/project/YOUR_PROJECT/settings/api"
else
    echo "✅ .env.local already exists"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.local with your Supabase credentials"
echo "2. Configure OAuth providers in Supabase dashboard"
echo "3. Run the development server: npm run dev"
echo ""
echo "📚 App will be available at: http://localhost:5173"
echo "📱 Mobile-first design with centered container"
echo "🔐 Google & GitHub authentication enabled"

