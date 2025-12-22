#!/bin/bash
# Setup script for Velo Backend

set -e

echo "🚀 Setting up Velo Backend..."

# Check Python version
echo "📍 Checking Python version..."
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "   Python version: $python_version"

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
else
    echo "✅ Virtual environment already exists"
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "⬆️  Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Copy .env.example if .env doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your actual Supabase credentials!"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your Supabase credentials"
echo "2. Activate virtual environment: source venv/bin/activate"
echo "3. Run the server: python app/main.py"
echo "   or: uvicorn app.main:app --reload"
echo ""
echo "📚 Documentation: http://localhost:8000/docs"
echo "💚 Health check: http://localhost:8000/health"

