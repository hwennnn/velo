# Velo Backend

Backend API for Velo, a travel expense tracker with multi-currency support and optimal debt settlement.

## Tech Stack

- **FastAPI** - Modern Python web framework
- **SQLModel** - SQL database ORM with Pydantic validation
- **PostgreSQL** - Database (via Supabase)
- **Supabase** - Authentication and database hosting
- **Pytest** - Testing framework

## Setup

### Prerequisites

- Python 3.11 or higher
- Supabase account

### Installation

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Configuration

```bash
cp .env.example .env
# Edit .env with your credentials
```

Required environment variables:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT secret for token verification

### Run Development Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API available at:

- API: <http://localhost:8000>
- Interactive docs: <http://localhost:8000/docs>

## Testing

```bash
pytest
pytest --cov=app --cov-report=html
```

## Database Migrations

```bash
# Generate migration
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head
```

## License

MIT
