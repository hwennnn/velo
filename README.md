# Velo - Travel Expense Tracker 🚀

**Velo** (meaning "fast") is a mobile-first travel expense tracker with multi-currency support, fictional member placeholders, and optimal debt settlement algorithms.

## 🎯 Features

- 📱 **Mobile-First Design** - Fixed mobile container on all screen sizes
- 🔐 **OAuth Authentication** - Google & GitHub sign-in via Supabase
- 💱 **Multi-Currency Support** - Track expenses in any currency
- 👥 **Fictional Members** - Add members before they join, claim later
- 🧮 **Smart Debt Settlement** - Optimal payment calculation algorithm
- ⚡ **Fast & Modern** - React + FastAPI + PostgreSQL stack

## 📁 Project Structure

```
velo/
├── backend/          # FastAPI + SQLModel + PostgreSQL
│   ├── app/
│   │   ├── core/         # Config & database
│   │   ├── models/       # Database models
│   │   ├── api/          # API routes
│   │   └── services/     # Business logic
│   ├── tests/            # Pytest tests
│   └── requirements.txt
│
├── frontend/         # React + TypeScript + Tailwind
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── pages/        # Page components
│   │   ├── services/     # API & Supabase clients
│   │   ├── hooks/        # Custom hooks (useAuth)
│   │   └── types/        # TypeScript definitions
│   └── package.json
│
└── README.md        # This file
```

## 🚀 Quick Start

### Prerequisites

- **Backend**: Python 3.11+, PostgreSQL (or use SQLite for local dev)
- **Frontend**: Node.js 18+, npm
- **Supabase Account**: https://app.supabase.com (for authentication)

### 1. Backend Setup

```bash
cd backend

# Run setup script
./setup.sh

# Or manually:
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Run the server
python app/main.py
# Backend available at http://localhost:8000
```

The backend comes pre-configured with SQLite for local development. See `backend/README.md` for PostgreSQL/Supabase setup.

### 2. Frontend Setup

```bash
cd frontend

# Run setup script
./setup.sh

# Or manually:
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run the dev server
npm run dev
# Frontend available at http://localhost:5173
```

### 3. Configure Supabase

1. Create a project at https://app.supabase.com
2. Enable OAuth providers (Google & GitHub):
   - Go to **Authentication** → **Providers**
   - Enable and configure each provider
3. Set up redirect URLs:
   - Site URL: `http://localhost:5173`
   - Redirect URLs: `http://localhost:5173/auth/callback`
4. Copy credentials to frontend `.env.local`

## 🏗️ Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLModel** - SQL ORM with Pydantic validation
- **PostgreSQL / SQLite** - Database
- **Supabase Auth** - JWT verification
- **Pytest** - Testing framework

### Frontend
- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **React Router** - Routing
- **Supabase** - Authentication
- **Axios** - HTTP client
- **Zustand** - State management
- **Lucide React** - Icons

## 📱 Mobile-First Design

The app uses a **MobileContainer** component that:

- Shows a **centered phone container** (max-width: 28rem) on desktop
- Uses **full screen width** on mobile devices
- Has **rounded corners and shadow** on desktop
- Supports **safe area insets** for iOS notches
- Provides a **native app feel** across all devices

## 🔐 Authentication Flow

1. User signs in with Google or GitHub OAuth
2. Supabase handles authentication
3. JWT token stored in localStorage
4. Token automatically attached to backend API requests
5. Backend verifies token with Supabase
6. Protected routes require valid session

## 📚 Documentation

- [Backend Documentation](./backend/README.md) - API setup, database, testing
- [Frontend Documentation](./frontend/README.md) - React app, components, routing

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest
pytest --cov=app --cov-report=html
```

### Frontend Tests
```bash
cd frontend
npm run test  # Coming soon
```

## 🐳 Docker Deployment

```bash
# Coming soon
docker-compose up -d
```

## 🗺️ Roadmap

- [x] Backend setup with FastAPI
- [x] Frontend setup with React
- [x] Supabase authentication (Google & GitHub)
- [x] Mobile-first container layout
- [x] API client and backend integration
- [ ] Database models (Users, Trips, Members, Expenses, Splits)
- [ ] Trip management UI & API
- [ ] Member management with fictional users
- [ ] Expense entry with multi-currency
- [ ] Balance calculation engine
- [ ] Optimal settlement algorithm
- [ ] Settlement UI
- [ ] Testing suite
- [ ] Docker deployment

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! Please read the documentation and submit PRs.

---

Built with ❤️ for travelers who want to split expenses easily.
