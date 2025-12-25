# Velo

A travel expense tracking application built with React and FastAPI, featuring multi-currency support and automated debt settlement calculations.

## Features

- Multi-currency expense tracking with real-time exchange rates
- Fictional member management (add members before they join)
- Optimal debt settlement algorithms
- Mobile-first responsive design
- OAuth authentication (Google, GitHub) via Supabase

## Installation

### Prerequisites

- Python 3.11+
- Node.js 18+
- Supabase account

### Setup

1. Clone the repository
2. Configure Supabase project with OAuth providers
3. Set up environment variables
4. Run the applications

```bash
# Backend
cd backend
cp .env.example .env  # Set up your environment variables
./start.sh

# Frontend
cd frontend
cp .env.example .env.local  # Set up your environment variables
npm install
npm run dev
```

## Tech Stack

### Backend

- FastAPI
- SQLModel
- PostgreSQL/SQLite
- Supabase (auth & database)
- Pytest

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Supabase
- Axios
- Zustand

## Architecture

### Mobile-First Design

Uses a responsive container component that:

- Centers content with max-width on desktop (28rem)
- Uses full viewport width on mobile
- Includes safe area insets for notched devices
- Maintains consistent touch targets (44px minimum)

### Authentication

- OAuth integration with Google and GitHub via Supabase
- JWT tokens stored in localStorage
- Automatic token refresh and API request headers
- Route protection with redirect to login on unauthorized access

## Documentation

- [Backend](./backend/README.md) - API endpoints, database schema, migrations
- [Frontend](./frontend/README.md) - Component architecture, routing, state management
- [Setup Guide](./SETUP.md) - Detailed installation and configuration
- [Deployment](./DEPLOYMENT_GUIDE.md) - Production deployment options

## Testing

```bash
# Backend tests
cd backend && pytest

# Frontend tests (planned)
cd frontend && npm test
```

## Deployment

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for production deployment guides.

## License

MIT
