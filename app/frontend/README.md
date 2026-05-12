# Frontend

## Prerequisites

- Node.js 20+ (recommended)
- npm 10+ (or newer)
- Backend API running (default: http://127.0.0.1:8000)

## First-time setup (Git Bash)

```bash
cd app/frontend
cp .env.example .env
npm install
```

## Start frontend (Git Bash)

```bash
cd app/frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

Frontend URL:

- http://127.0.0.1:5173/

## Environment variable

Set backend API URL in `app/frontend/.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## Useful commands

```bash
cd app/frontend
npm run lint
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```