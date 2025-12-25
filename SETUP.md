# Velo Setup Guide

This guide will help you get Velo up and running on your local machine.

## Prerequisites

- **Python 3.11+** (for backend)
- **Node.js 18+** (for frontend)
- **PostgreSQL** (optional - SQLite works for development)
- **Supabase Account** (for authentication)

## Step 1: Clone and Navigate

```bash
cd /Users/houman/Desktop/projects/velo
```

## Step 2: Backend Setup

### 2.1 Install Dependencies

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2.2 Configure Environment

Create `backend/.env` with the following:

```bash
# Application Settings
ENVIRONMENT=development
DEBUG=True

# Database (SQLite for local dev)
DATABASE_URL=sqlite:///./velo.db
DB_ECHO=False

# Supabase Configuration
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_KEY

# JWT Secret (from Supabase project settings > API > JWT Settings)
JWT_SECRET=YOUR_JWT_SECRET
JWT_ALGORITHM=HS256

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Optional: Currency API
CURRENCY_API_URL=https://api.exchangerate-api.com/v4/latest/USD
```

### 2.3 Start Backend Server

```bash
# Make sure you're in backend/ directory with venv activated
python app/main.py

# Or use uvicorn directly:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be available at: **http://localhost:8000**
API docs at: **http://localhost:8000/docs**

## Step 3: Frontend Setup

### 3.1 Install Dependencies

```bash
cd frontend
npm install
```

### 3.2 Configure Environment

Create `frontend/.env.local` with:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY

# Backend API URL
VITE_API_BASE_URL=http://localhost:8000/api
```

### 3.3 Start Frontend Dev Server

```bash
npm run dev
```

Frontend will be available at: **http://localhost:5173**

## Step 4: Supabase Configuration

### 4.1 Create Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Choose organization and fill in details
4. Wait for project to be created

### 4.2 Get API Credentials

Navigate to: **Project Settings → API**

Copy these values:

- **Project URL** → `SUPABASE_URL`
- **anon/public key** → `SUPABASE_ANON_KEY`
- **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

### 4.3 Get JWT Secret

Navigate to: **Project Settings → API → JWT Settings**

Copy: **JWT Secret** → `JWT_SECRET`

### 4.4 Enable OAuth Providers

Navigate to: **Authentication → Providers**

#### Enable Google OAuth:

1. Click on Google provider
2. Enable it
3. Add your OAuth credentials from Google Cloud Console
   - Go to https://console.cloud.google.com
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
4. Copy Client ID and Secret to Supabase

#### Enable GitHub OAuth:

1. Click on GitHub provider
2. Enable it
3. Add your OAuth credentials from GitHub
   - Go to GitHub Settings → Developer settings → OAuth Apps
   - Create new OAuth app
   - Authorization callback URL: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
4. Copy Client ID and Secret to Supabase

### 4.5 Configure Redirect URLs

Navigate to: **Authentication → URL Configuration**

Set:

- **Site URL**: `http://localhost:5173`
- **Redirect URLs**:
  - `http://localhost:5173/auth/callback`
  - `http://localhost:5173`

## Step 5: Database Migrations (Supabase PostgreSQL)

If you're using Supabase PostgreSQL (recommended for production), set up database migrations:

### 5.1 Configure PostgreSQL URL

Update your `backend/.env`:

```bash
# Replace SQLite with Supabase PostgreSQL
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.your-project.supabase.co:5432/postgres
```

### 5.2 Generate Initial Migration

```bash
cd backend
source venv/bin/activate

# Create initial migration from models
./migrate.sh create "Initial schema - users, trips, members, expenses, splits"

# Or use alembic directly:
alembic revision --autogenerate -m "Initial schema"
```

This creates a migration file in `backend/alembic/versions/`.

### 5.3 Review the Migration

**IMPORTANT:** Always review auto-generated migrations!

```bash
# View the generated migration
cat alembic/versions/*_initial_schema*.py
```

Check that:

- All tables are created correctly
- Foreign keys are set up
- Indexes are present
- No accidental drops

### 5.4 Apply Migration to Supabase

```bash
# Apply the migration
./migrate.sh upgrade

# Or directly:
alembic upgrade head
```

### 5.5 Verify in Supabase

1. Go to your Supabase project
2. Navigate to **Table Editor**
3. Confirm these tables exist:
   - `users`
   - `trips`
   - `trip_members`
   - `expenses`
   - `splits`

### Quick Migration Reference

```bash
# Common migration commands
./migrate.sh create "description"   # Create new migration
./migrate.sh upgrade                # Apply migrations
./migrate.sh current                # Check current version
./migrate.sh history                # View history
./migrate.sh downgrade              # Rollback last
```

**Full migration guide:** See `backend/MIGRATIONS.md`

**Note:** SQLite users can skip this - tables auto-create in development mode.

---

## Step 6: Test the Application

### 5.1 Backend Health Check

```bash
curl http://localhost:8000/health
# Should return: {"status":"healthy","service":"Velo Travel Expense Tracker"}
```

### 5.2 Frontend Test

1. Open http://localhost:5173
2. Click "Sign in with Google" or "Sign in with GitHub"
3. Complete OAuth flow
4. You should be redirected to the trips page
5. Click "Create Trip" to test trip creation

## Troubleshooting

### Backend Issues

**Database Errors:**

```bash
# Delete SQLite database and restart
rm backend/velo.db
python backend/app/main.py
```

**Import Errors:**

```bash
# Make sure venv is activated
source backend/venv/bin/activate
pip install -r backend/requirements.txt
```

**JWT Verification Errors:**

- Make sure JWT_SECRET matches the one from Supabase settings
- Check that SUPABASE_URL is correct

### Frontend Issues

**API Connection Errors:**

- Verify backend is running on port 8000
- Check `VITE_API_BASE_URL` in `.env.local`
- Look for CORS errors in browser console

**Auth Errors:**

- Verify Supabase credentials in `.env.local`
- Check OAuth provider configuration
- Verify redirect URLs are set correctly

**Build Errors:**

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Database Schema

The application will automatically create tables on first run (development mode).

Tables created:

- `users` - User profiles
- `trips` - Travel trips
- `trip_members` - Trip participants (real or fictional)
- `expenses` - Expense entries
- `splits` - How expenses are divided

## Development Workflow

### Running Both Servers

Terminal 1 (Backend):

```bash
cd backend
source venv/bin/activate
python app/main.py
```

Terminal 2 (Frontend):

```bash
cd frontend
npm run dev
```

### Making Changes

- **Backend**: Changes auto-reload with `--reload` flag
- **Frontend**: Vite hot-reloads automatically
- **Database**: Drop `velo.db` to reset in development

## Next Steps

Once setup is complete, you can:

1. ✅ Create and manage trips
2. ✅ Add real users or fictional members to trips
3. ✅ Track expenses with multi-currency support
4. ✅ View balances and optimal settlement plans
5. ✅ Record settlements between members

## Production Deployment

For production deployment:

1. Use PostgreSQL instead of SQLite
2. Set `ENVIRONMENT=production` and `DEBUG=False`
3. Use proper secrets management
4. Set up HTTPS
5. Configure production Supabase redirect URLs
6. Use Docker Compose (configuration coming soon)

---

**Need Help?** Check the documentation:

- [Backend README](./backend/README.md)
- [Frontend README](./frontend/README.md)
- [Progress Document](./PROGRESS.md)
