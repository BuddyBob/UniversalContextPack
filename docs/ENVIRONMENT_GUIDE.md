# Environment Variables Guide

## File Structure Overview

```
UCPv6/
├── .env                           # Local backend development
├── .env.vercel.production        # Vercel dashboard reference
├── .env.railway.production       # Railway dashboard reference
└── frontend/
    └── .env.local                # Local frontend development
```

## 1. Local Development (.env)
**Purpose**: Running backend locally with `python simple_backend.py`
- NODE_ENV=development
- BACKEND_URL=http://localhost:8000
- All local development settings

## 2. Vercel Production (.env.vercel.production)
**Purpose**: Copy these to Vercel Dashboard → Settings → Environment Variables
- NEXT_PUBLIC_API_URL=https://universalcontextpack-production.up.railway.app
- NEXT_PUBLIC_SUPABASE_URL=...
- All frontend production configs

## 3. Railway Production (.env.railway.production)  
**Purpose**: Copy these to Railway Dashboard → Variables
- PORT=8000
- ALLOWED_ORIGINS=https://www.context-pack.com
- All backend production configs

## 4. Frontend Local (frontend/.env.local)
**Purpose**: Local frontend development with `npm run dev`
- NEXT_PUBLIC_API_URL=https://universalcontextpack-production.up.railway.app
- Local frontend overrides

## Environment Variable Flow

### Local Development:
- Backend reads: `.env` 
- Frontend reads: `frontend/.env.local`

### Production:
- Backend (Railway) reads: Variables set in Railway dashboard
- Frontend (Vercel) reads: Variables set in Vercel dashboard

## Quick Setup Commands

### For Local Development:
```bash
# Start backend locally
python simple_backend.py

# Start frontend locally (connects to production Railway backend)
cd frontend && npm run dev
```

### For Production Deployment:
1. Copy `.env.vercel.production` → Vercel Dashboard
2. Copy `.env.railway.production` → Railway Dashboard
3. Deploy both services
