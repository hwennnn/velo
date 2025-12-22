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
    echo "Usage: ./migrate.sh [command]"
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
    echo "  ./migrate.sh upgrade"
    echo "  ./migrate.sh history"
}

# Function to check database connection
check_db() {
    if [[ ! -f .env ]]; then
        echo -e "${RED}❌ .env file not found${NC}"
        exit 1
    fi
    
    # Check if DATABASE_URL is set
    source .env
    if [[ -z "$DATABASE_URL" ]]; then
        echo -e "${RED}❌ DATABASE_URL not set in .env${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Database URL configured${NC}"
}

# Parse command
case "${1:-help}" in
    create)
        if [[ -z "$2" ]]; then
            echo -e "${RED}❌ Migration message required${NC}"
            echo "Usage: ./migrate.sh create '<message>'"
            exit 1
        fi
        
        echo -e "${BLUE}Creating new migration: $2${NC}"
        check_db
        alembic revision --autogenerate -m "$2"
        
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
        if [[ -z "$2" ]]; then
            echo -e "${RED}❌ Migration message required${NC}"
            echo "Usage: ./migrate.sh manual '<message>'"
            exit 1
        fi
        
        echo -e "${BLUE}Creating empty migration: $2${NC}"
        check_db
        alembic revision -m "$2"
        
        latest=$(ls -t alembic/versions/*.py 2>/dev/null | head -1)
        if [[ -f "$latest" ]]; then
            echo ""
            echo -e "${GREEN}✓ Empty migration created: $latest${NC}"
            echo "Edit the file to add your migration logic"
        fi
        ;;
    
    upgrade)
        echo -e "${BLUE}Applying all pending migrations...${NC}"
        check_db
        alembic upgrade head
        echo -e "${GREEN}✓ Migrations applied successfully${NC}"
        ;;
    
    upgrade-one)
        echo -e "${BLUE}Applying next migration...${NC}"
        check_db
        alembic upgrade +1
        echo -e "${GREEN}✓ Migration applied${NC}"
        ;;
    
    downgrade)
        echo -e "${YELLOW}⚠️  Rolling back last migration...${NC}"
        read -p "Are you sure? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            check_db
            alembic downgrade -1
            echo -e "${GREEN}✓ Rollback complete${NC}"
        else
            echo "Cancelled"
        fi
        ;;
    
    current)
        echo -e "${BLUE}Current migration version:${NC}"
        check_db
        alembic current
        ;;
    
    history)
        echo -e "${BLUE}Migration history:${NC}"
        check_db
        alembic history --verbose
        ;;
    
    pending)
        echo -e "${BLUE}Checking for pending migrations...${NC}"
        check_db
        
        # Get current and head revisions
        current=$(alembic current 2>/dev/null | grep -oP '(?<=\(head\), ).*' || echo "none")
        
        if alembic upgrade head --sql > /dev/null 2>&1; then
            echo -e "${GREEN}✓ No pending migrations${NC}"
        else
            echo -e "${YELLOW}⚠️  Pending migrations found${NC}"
            echo "Run './migrate.sh upgrade' to apply them"
        fi
        ;;
    
    sql)
        echo -e "${BLUE}Showing SQL for pending migrations (dry-run):${NC}"
        check_db
        alembic upgrade head --sql
        ;;
    
    reset)
        echo -e "${RED}⚠️  WARNING: This will reset your entire database!${NC}"
        echo "All data will be lost!"
        read -p "Type 'RESET' to confirm: " confirm
        
        if [[ "$confirm" == "RESET" ]]; then
            check_db
            echo "Rolling back all migrations..."
            alembic downgrade base
            echo "Applying all migrations..."
            alembic upgrade head
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

