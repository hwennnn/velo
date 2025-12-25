#!/bin/bash

# Velo Database Migration Helper Script
# Makes common Alembic operations easier

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ensure we're in the backend directory
cd "$(dirname "$0")"

# Check if virtual environment is activated
if [[ -z "$VIRTUAL_ENV" ]]; then
    echo -e "${YELLOW}⚠️  Virtual environment not activated. Activating...${NC}"
    source venv/bin/activate || {
        echo -e "${RED}❌ Failed to activate virtual environment${NC}"
        echo "Run: source venv/bin/activate"
        exit 1
    }
fi

# Function to show usage
show_usage() {
    echo -e "${BLUE}Velo Migration Helper${NC}"
    echo ""
    echo "Usage: ./migrate.sh [command] [--production]"
    echo ""
    echo "Options:"
    echo "  --production        - Use .env.production instead of .env"
    echo "                       Can also set PRODUCTION=true environment variable"
    echo ""
    echo "Commands:"
    echo "  create <message>    - Create a new migration with auto-detection"
    echo "  manual <message>    - Create an empty migration file"
    echo "  upgrade             - Apply all pending migrations"
    echo "  upgrade-one         - Apply next pending migration only"
    echo "  downgrade           - Rollback last migration"
    echo "  current             - Show current migration version"
    echo "  history             - Show migration history"
    echo "  pending             - Show pending migrations"
    echo "  sql                 - Show SQL for pending migrations (dry-run)"
    echo "  reset               - Reset database (DESTRUCTIVE!)"
    echo ""
    echo "Examples:"
    echo "  ./migrate.sh create 'Add user phone number'"
    echo "  ./migrate.sh create 'Add user phone' --production"
    echo "  ./migrate.sh upgrade --production"
    echo "  ./migrate.sh history"
    echo "  PRODUCTION=true ./migrate.sh upgrade"
}

# Function to check database connection
check_db() {
    # Determine which env file to use
    if [[ "${PRODUCTION:-false}" == "true" ]] || [[ "${1:-}" == "--production" ]]; then
        ENV_FILE=".env.production"
    else
        ENV_FILE=".env"
    fi

    if [[ ! -f "$ENV_FILE" ]]; then
        echo -e "${RED}❌ $ENV_FILE file not found${NC}"
        exit 1
    fi

    # Check if DATABASE_URL is set
    source "$ENV_FILE"
    if [[ -z "$DATABASE_URL" ]]; then
        echo -e "${RED}❌ DATABASE_URL not set in $ENV_FILE${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ Database URL configured ($ENV_FILE)${NC}"
}

# Parse command and flags
COMMAND="${1:-help}"
PRODUCTION_FLAG=""

# Check for production flag in any position
for arg in "$@"; do
    if [[ "$arg" == "--production" ]]; then
        PRODUCTION_FLAG="--production"
        break
    fi
done

# Also check environment variable
if [[ "$PRODUCTION" == "true" ]]; then
    PRODUCTION_FLAG="--production"
fi

case "$COMMAND" in
    create)
        # Find the message - it could be $2 or $3 depending on flag position
        MESSAGE=""
        if [[ "$2" != "--production" ]] && [[ -n "$2" ]]; then
            MESSAGE="$2"
        elif [[ "$3" != "--production" ]] && [[ -n "$3" ]]; then
            MESSAGE="$3"
        fi

        if [[ -z "$MESSAGE" ]]; then
            echo -e "${RED}❌ Migration message required${NC}"
            echo "Usage: ./migrate.sh create '<message>' [--production]"
            exit 1
        fi

        echo -e "${BLUE}Creating new migration: $MESSAGE${NC}"
        check_db "$PRODUCTION_FLAG"
        PRODUCTION="$([[ "$PRODUCTION_FLAG" == "--production" ]] && echo "true" || echo "")" alembic revision --autogenerate -m "$MESSAGE"
        
        # Get the latest migration file
        latest=$(ls -t alembic/versions/*.py 2>/dev/null | head -1)
        if [[ -f "$latest" ]]; then
            echo ""
            echo -e "${GREEN}✓ Migration created: $latest${NC}"
            echo -e "${YELLOW}⚠️  IMPORTANT: Review the migration before applying!${NC}"
            echo ""
            echo "Review with: cat $latest"
            echo "Apply with: ./migrate.sh upgrade"
        fi
        ;;
    
    manual)
        # Find the message - it could be $2 or $3 depending on flag position
        MESSAGE=""
        if [[ "$2" != "--production" ]] && [[ -n "$2" ]]; then
            MESSAGE="$2"
        elif [[ "$3" != "--production" ]] && [[ -n "$3" ]]; then
            MESSAGE="$3"
        fi

        if [[ -z "$MESSAGE" ]]; then
            echo -e "${RED}❌ Migration message required${NC}"
            echo "Usage: ./migrate.sh manual '<message>' [--production]"
            exit 1
        fi

        echo -e "${BLUE}Creating empty migration: $MESSAGE${NC}"
        check_db "$PRODUCTION_FLAG"
        PRODUCTION="$([[ "$PRODUCTION_FLAG" == "--production" ]] && echo "true" || echo "")" alembic revision -m "$MESSAGE"
        
        latest=$(ls -t alembic/versions/*.py 2>/dev/null | head -1)
        if [[ -f "$latest" ]]; then
            echo ""
            echo -e "${GREEN}✓ Empty migration created: $latest${NC}"
            echo "Edit the file to add your migration logic"
        fi
        ;;
    
    upgrade)
        echo -e "${BLUE}Applying all pending migrations...${NC}"
        check_db "$PRODUCTION_FLAG"
        PRODUCTION="$([[ "$PRODUCTION_FLAG" == "--production" ]] && echo "true" || echo "")" alembic upgrade head
        echo -e "${GREEN}✓ Migrations applied successfully${NC}"
        ;;
    
    upgrade-one)
        echo -e "${BLUE}Applying next migration...${NC}"
        check_db "$PRODUCTION_FLAG"
        PRODUCTION="$([[ "$PRODUCTION_FLAG" == "--production" ]] && echo "true" || echo "")" alembic upgrade +1
        echo -e "${GREEN}✓ Migration applied${NC}"
        ;;
    
    downgrade)
        echo -e "${YELLOW}⚠️  Rolling back last migration...${NC}"
        read -p "Are you sure? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            check_db "$PRODUCTION_FLAG"
            PRODUCTION="$([[ "$PRODUCTION_FLAG" == "--production" ]] && echo "true" || echo "")" alembic downgrade -1
            echo -e "${GREEN}✓ Rollback complete${NC}"
        else
            echo "Cancelled"
        fi
        ;;
    
    current)
        echo -e "${BLUE}Current migration version:${NC}"
        check_db "$PRODUCTION_FLAG"
        PRODUCTION="$([[ "$PRODUCTION_FLAG" == "--production" ]] && echo "true" || echo "")" alembic current
        ;;
    
    history)
        echo -e "${BLUE}Migration history:${NC}"
        check_db "$PRODUCTION_FLAG"
        PRODUCTION="$([[ "$PRODUCTION_FLAG" == "--production" ]] && echo "true" || echo "")" alembic history --verbose
        ;;
    
    pending)
        echo -e "${BLUE}Checking for pending migrations...${NC}"
        check_db "$PRODUCTION_FLAG"

        # Get current and head revisions
        current=$(PRODUCTION="$([[ "$PRODUCTION_FLAG" == "--production" ]] && echo "true" || echo "")" alembic current 2>/dev/null | grep -oP '(?<=\(head\), ).*' || echo "none")

        if PRODUCTION="$([[ "$PRODUCTION_FLAG" == "--production" ]] && echo "true" || echo "")" alembic upgrade head --sql > /dev/null 2>&1; then
            echo -e "${GREEN}✓ No pending migrations${NC}"
        else
            echo -e "${YELLOW}⚠️  Pending migrations found${NC}"
            echo "Run './migrate.sh upgrade' to apply them"
        fi
        ;;
    
    sql)
        echo -e "${BLUE}Showing SQL for pending migrations (dry-run):${NC}"
        check_db "$PRODUCTION_FLAG"
        PRODUCTION="$([[ "$PRODUCTION_FLAG" == "--production" ]] && echo "true" || echo "")" alembic upgrade head --sql
        ;;
    
    reset)
        echo -e "${RED}⚠️  WARNING: This will reset your entire database!${NC}"
        echo "All data will be lost!"
        read -p "Type 'RESET' to confirm: " confirm
        
        if [[ "$confirm" == "RESET" ]]; then
            check_db "$PRODUCTION_FLAG"
            echo "Rolling back all migrations..."
            PRODUCTION="$([[ "$PRODUCTION_FLAG" == "--production" ]] && echo "true" || echo "")" alembic downgrade base
            echo "Applying all migrations..."
            PRODUCTION="$([[ "$PRODUCTION_FLAG" == "--production" ]] && echo "true" || echo "")" alembic upgrade head
            echo -e "${GREEN}✓ Database reset complete${NC}"
        else
            echo "Cancelled"
        fi
        ;;
    
    help|--help|-h)
        show_usage
        ;;
    
    *)
        echo -e "${RED}❌ Unknown command: $1${NC}"
        echo ""
        show_usage
        exit 1
        ;;
esac

