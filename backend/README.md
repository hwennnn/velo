# Velo Backend

Backend API for Velo, a travel expense tracker with multi-currency support and optimal debt settlement.

## Tech Stack

- **FastAPI** - Modern Python web framework
- **SQLModel** - SQL database ORM with Pydantic validation
- **PostgreSQL** - Database (via Supabase)
- **Supabase** - Authentication and database hosting
- **Pytest** - Testing framework

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application entry point
│   ├── core/
│   │   ├── config.py        # Environment configuration
│   │   └── database.py      # Database connection & session management
│   ├── models/              # SQLModel database models
│   ├── api/                 # API route handlers
│   └── services/            # Business logic services
├── tests/                   # Pytest test suite
├── requirements.txt         # Python dependencies
├── .env.example            # Environment variables template
└── README.md               # This file
```

## Setup Instructions

### 1. Prerequisites

- Python 3.11 or higher
- PostgreSQL (or Supabase account)
- Virtual environment tool (venv, virtualenv, or conda)

### 2. Create Virtual Environment

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

```bash
cp .env.example .env
# Edit .env with your actual credentials
```

Required environment variables:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT secret for token verification

### 5. Run the Development Server

```bash
# From the backend directory
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Or using the main.py directly
python app/main.py
```

The API will be available at:

- API: <http://localhost:8000>
- Interactive docs: <http://localhost:8000/docs>
- ReDoc: <http://localhost:8000/redoc>

## Testing

Run tests with pytest:

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_example.py
```

## API Documentation

Once the server is running in development mode, visit:

- Swagger UI: <http://localhost:8000/docs>
- ReDoc: <http://localhost:8000/redoc>

## Development

### Adding New Routes

1. Create a new file in `app/api/` (e.g., `trips.py`)
2. Define your routes using FastAPI router
3. Import and include the router in `app/main.py`

### Adding New Models

1. Create a new file in `app/models/` (e.g., `trip.py`)
2. Define your SQLModel class
3. Import the model in `app/core/database.py` (in the `init_db` function)

### Database Migrations

For production, use Alembic for database migrations:

```bash
# Generate a new migration
alembic revision --autogenerate -m "Description of changes"

# Apply migrations
alembic upgrade head
```

## Environment Configuration

The application uses Pydantic Settings for type-safe configuration management. All settings are defined in `app/core/config.py` and can be overridden via environment variables.

## Supabase Integration

The backend integrates with Supabase for:

- **Authentication**: JWT token verification
- **Database**: PostgreSQL hosting with Row Level Security (RLS)
- **Real-time**: Future feature for live expense updates

Make sure to configure RLS policies in your Supabase dashboard to secure your data.

## Production Deployment

See the root `docker-compose.yml` for production deployment configuration.

## License

MIT
