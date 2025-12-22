# Velo Frontend - React Travel Expense Tracker

Mobile-first React application for tracking travel expenses with Supabase authentication.

## Tech Stack

- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **Supabase** - Authentication (Google & GitHub OAuth)
- **Axios** - HTTP client for API calls
- **Zustand** - State management (lightweight alternative to Redux)
- **Lucide React** - Icon library
- **date-fns** - Date formatting utilities

## Features

- 📱 **Mobile-First Design** - Fixed mobile container on all screen sizes
- 🔐 **OAuth Authentication** - Google and GitHub sign-in via Supabase
- 🌐 **Backend Integration** - Connected to FastAPI backend
- 🎨 **Modern UI** - Beautiful, touch-optimized interface
- 🔄 **Auto Token Refresh** - Seamless authentication handling
- 📦 **Type-Safe** - Full TypeScript support

## Project Structure

```
frontend/
├── public/                  # Static assets
├── src/
│   ├── assets/             # Images, fonts, etc.
│   ├── components/         # Reusable UI components
│   │   ├── MobileContainer.tsx
│   │   └── ProtectedRoute.tsx
│   ├── config/             # Configuration files
│   │   └── env.ts          # Environment variables
│   ├── hooks/              # Custom React hooks
│   │   └── useAuth.tsx     # Authentication context
│   ├── pages/              # Page components
│   │   ├── Login.tsx       # Login page
│   │   ├── AuthCallback.tsx # OAuth callback handler
│   │   └── Home.tsx        # Trips list page
│   ├── services/           # API clients
│   │   ├── supabase.ts     # Supabase client
│   │   └── api.ts          # Backend API client
│   ├── types/              # TypeScript definitions
│   │   └── index.ts        # Type definitions
│   ├── utils/              # Utility functions
│   ├── App.tsx             # Main app component
│   ├── main.tsx            # App entry point
│   ├── index.css           # Global styles
│   └── vite-env.d.ts       # Vite type definitions
├── .env.example            # Environment variables template
├── .env.local              # Local environment (gitignored)
├── index.html              # HTML entry point
├── package.json            # Dependencies
├── tailwind.config.js      # Tailwind configuration
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite configuration
```

## Setup Instructions

### 1. Prerequisites

- Node.js 18+ and npm
- Supabase account (https://app.supabase.com)

### 2. Install Dependencies

```bash
cd frontend
npm install
```

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your actual values:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Backend API
VITE_API_BASE_URL=http://localhost:8000/api

# App Info
VITE_APP_NAME=Velo
VITE_APP_VERSION=0.1.0
```

### 4. Configure Supabase Authentication

In your Supabase project dashboard:

1. Go to **Authentication** → **Providers**
2. Enable **Google** provider:
   - Add OAuth credentials from Google Cloud Console
   - Set redirect URL: `https://your-project.supabase.co/auth/v1/callback`
3. Enable **GitHub** provider:
   - Add OAuth app from GitHub Developer Settings
   - Set callback URL: `https://your-project.supabase.co/auth/v1/callback`
4. Go to **Authentication** → **URL Configuration**
   - Add Site URL: `http://localhost:5173` (for development)
   - Add Redirect URLs: `http://localhost:5173/auth/callback`

### 5. Run Development Server

```bash
npm run dev
```

The app will be available at http://localhost:5173

## Mobile Container Behavior

The app uses a **fixed mobile container** that:

- On **mobile devices**: Uses full screen width
- On **desktop**: Shows a centered phone-sized container (max-width: 28rem / 448px)
- Has rounded corners and shadow on desktop for a native app feel
- Supports safe area insets for iOS notches and Android navigation bars

## Authentication Flow

1. User clicks "Continue with Google" or "Continue with GitHub"
2. Redirected to Supabase OAuth flow
3. After authentication, redirected to `/auth/callback`
4. Callback handler gets session and redirects to `/trips`
5. All protected routes require authentication
6. JWT token automatically attached to API requests

## API Integration

The app connects to the FastAPI backend via the `api` service:

```typescript
import { api } from './services/api';

// Example: Fetch all trips
const response = await api.trips.getAll();
const trips = response.data;
```

The API client automatically:
- Attaches Supabase JWT token to requests
- Handles token refresh
- Redirects to login on 401 errors

## Available Scripts

```bash
# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Building for Production

```bash
# Create optimized production build
npm run build

# Preview the build locally
npm run preview
```

The build output will be in the `dist/` directory.

## Environment Variables

All environment variables must be prefixed with `VITE_` to be accessible in the frontend:

- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous/public key
- `VITE_API_BASE_URL` - Backend API base URL

## Troubleshooting

### "Supabase credentials not found"

Make sure you've created `.env.local` and added your Supabase credentials.

### OAuth redirect errors

1. Check that redirect URLs are properly configured in Supabase dashboard
2. Ensure Site URL matches your development/production URL
3. Verify OAuth provider credentials are correct

### API connection errors

1. Make sure backend server is running
2. Check `VITE_API_BASE_URL` matches your backend URL
3. Verify CORS is properly configured in backend

## Next Steps

- [ ] Implement trip management UI
- [ ] Add expense entry forms
- [ ] Create balances and settlement views
- [ ] Add member management
- [ ] Implement offline support
- [ ] Add push notifications

## License

MIT
