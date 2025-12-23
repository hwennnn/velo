# 🚀 Deployment Guide - Velo v2.0

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL (or Supabase)
- Git

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your database credentials and Supabase keys

# Run migrations (if not already done)
alembic upgrade head

# Start server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API URL and Supabase keys

# Start development server
npm run dev
```

### Access the Application

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Environment Variables

### Backend (.env)

```env
# App
APP_NAME=Velo
APP_VERSION=2.0.0
ENVIRONMENT=development
DEBUG=true

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/velo

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
SUPABASE_JWT_SECRET=your-jwt-secret

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# API
API_PREFIX=/api
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:8000/api
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Production Deployment

### Backend (Recommended: Railway, Render, or Fly.io)

#### Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize
railway init

# Link project
railway link

# Deploy
railway up
```

#### Environment Variables for Production

```env
ENVIRONMENT=production
DEBUG=false
DATABASE_URL=<production-database-url>
SUPABASE_URL=<production-supabase-url>
SUPABASE_KEY=<production-supabase-key>
SUPABASE_JWT_SECRET=<production-jwt-secret>
CORS_ORIGINS=https://your-domain.com
```

### Frontend (Recommended: Vercel, Netlify, or Cloudflare Pages)

#### Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd frontend
vercel --prod
```

#### Build Command

```bash
npm run build
```

#### Output Directory

```
dist
```

#### Environment Variables

```env
VITE_API_URL=https://your-api.railway.app/api
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Database Migrations

### Running Migrations

```bash
cd backend
source venv/bin/activate

# Check current version
alembic current

# Upgrade to latest
alembic upgrade head

# Downgrade one version
alembic downgrade -1

# View history
alembic history
```

### Creating New Migrations

```bash
# After modifying models
alembic revision --autogenerate -m "Description of changes"

# Review the generated migration
cat alembic/versions/latest_migration.py

# Apply
alembic upgrade head
```

## Testing

### Backend Tests

```bash
cd backend
source venv/bin/activate

# Run all tests
pytest

# Run with coverage
pytest --cov=app tests/

# Run specific test
pytest tests/test_trips.py
```

### Frontend Tests

```bash
cd frontend

# Run tests
npm test

# Run with coverage
npm test -- --coverage
```

## Monitoring & Maintenance

### Health Checks

- Backend: `GET /health`
- Expected response: `{"status": "healthy"}`

### Logs

#### Backend (Development)

```bash
# Logs are printed to console
uvicorn app.main:app --reload
```

#### Backend (Production)

Configure your hosting provider's logging:

- Railway: `railway logs`
- Render: Dashboard > Logs
- Fly.io: `fly logs`

### Database Backups

#### Supabase

- Automatic backups (daily)
- Manual backup: Dashboard > Database > Backups

#### PostgreSQL

```bash
# Backup
pg_dump -h localhost -U user -d velo > backup.sql

# Restore
psql -h localhost -U user -d velo < backup.sql
```

## Performance Optimization

### Backend

1. **Enable Gzip Compression**

   ```python
   # In main.py
   from fastapi.middleware.gzip import GZipMiddleware
   app.add_middleware(GZipMiddleware, minimum_size=1000)
   ```

2. **Add Caching**

   ```python
   from fastapi_cache import FastAPICache
   from fastapi_cache.backends.redis import RedisBackend
   ```

3. **Connection Pooling**
   Already configured in `database.py` with SQLModel

### Frontend

1. **Build Optimization**

   ```bash
   npm run build
   ```

2. **Enable PWA** (Optional)

   - Add service worker
   - Configure manifest.json

3. **CDN for Static Assets**
   - Use Vercel/Netlify CDN
   - Or Cloudflare CDN

## Security Checklist

- [ ] Change default JWT secrets
- [ ] Use HTTPS in production
- [ ] Enable CORS only for trusted domains
- [ ] Set secure database passwords
- [ ] Enable rate limiting (optional)
- [ ] Regular dependency updates
- [ ] Enable Supabase RLS policies
- [ ] Use environment variables for secrets

## Troubleshooting

### Backend Won't Start

1. Check database connection:

   ```bash
   psql $DATABASE_URL
   ```

2. Check Python version:

   ```bash
   python --version  # Should be 3.10+
   ```

3. Reinstall dependencies:
   ```bash
   pip install --upgrade -r requirements.txt
   ```

### Frontend Won't Build

1. Clear cache:

   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. Check Node version:

   ```bash
   node --version  # Should be 18+
   ```

3. Check environment variables:
   ```bash
   cat .env
   ```

### Database Migration Issues

1. Check current version:

   ```bash
   alembic current
   ```

2. Reset migrations (⚠️ destroys data):
   ```bash
   alembic downgrade base
   alembic upgrade head
   ```

## Support

For issues or questions:

1. Check the documentation in `/backend` and `/frontend`
2. Review `PROGRESS.md` for feature details
3. Check `INCREMENT_2_COMPLETE.md` for recent changes

---

**Version**: 2.0.0  
**Last Updated**: December 2024  
**Status**: Production Ready ✅
