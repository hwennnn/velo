#!/bin/bash

# Velo Backend Startup Script

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Starting Velo Backend...${NC}"

# Check if virtual environment is activated
if [[ -z "$VIRTUAL_ENV" ]]; then
    echo -e "${YELLOW}Activating virtual environment...${NC}"
    if [ -d "venv" ]; then
        source venv/bin/activate
    else
        echo -e "${YELLOW}Virtual environment not found. Please run: python -m venv venv${NC}"
        exit 1
    fi
fi

# Get environment
ENVIRONMENT=${ENVIRONMENT:-development}

if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "${GREEN}Starting in PRODUCTION mode${NC}"
    WORKERS=${UVICORN_WORKERS:-4}
    uvicorn app.main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --workers $WORKERS \
        --loop asyncio
else
    echo -e "${GREEN}Starting in DEVELOPMENT mode with hot-reload${NC}"
    uvicorn app.main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --reload \
        --loop asyncio
fi

echo -e "${GREEN}Server stopped.${NC}"
