# Deployment Guide — Schedule Designer (Automated Timetable Generator)

This guide covers everything required to deploy the **Schedule Designer** full-stack application to production.

---

## Architecture Overview

- **Backend**: FastAPI (Python 3.10+), SQLAlchemy 2.0 (Sync & Async), Pydantic v2, PostgreSQL / SQLite.
- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS, TanStack Query, Zustand.
- **Database**: PostgreSQL (recommended for production) or SQLite.

---

## 1. Quick Start with Docker Compose (Recommended)

The easiest way to run the complete stack (PostgreSQL + Backend + Frontend) locally or on a single VPS (DigitalOcean Droplet, AWS EC2, Linode, etc.).

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/)

### Steps
1. **Clone the repository**:
   ```bash
   git clone <repo-url>
   cd Timetable_generator
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   DB_USER=timetable_user
   DB_PASSWORD=your_secure_password_here
   DB_NAME=timetable_db
   SECRET_KEY=generate_a_random_64_char_secret_key
   CORS_ORIGINS=http://localhost:3000,http://your-domain.com
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

3. **Build and start all services**:
   ```bash
   docker-compose up --build -d
   ```

4. **Verify Deployment**:
   - Frontend: `http://localhost:3000`
   - Backend API Docs: `http://localhost:8000/docs`
   - Backend Health Check: `http://localhost:8000/health`

5. **Stop services**:
   ```bash
   docker-compose down
   ```

---

## 2. Cloud Platform Deployment (Render Blueprint)

This repository includes a [`render.yaml`](file:///d:/Timetable_generator/render.yaml) blueprint for 1-click deployment on [Render](https://render.com).

### Steps
1. Push this repository to GitHub or GitLab.
2. Log in to [Render Dashboard](https://dashboard.render.com).
3. Click **New** -> **Blueprint**.
4. Connect your repository. Render will automatically detect `render.yaml` and provision:
   - **PostgreSQL Database** (`timetable-db`)
   - **FastAPI Web Service** (`timetable-backend`)
   - **Next.js Web Service** (`timetable-frontend`)
5. Click **Apply**. Render will automatically wire connection strings and secrets!

---

## 3. Split Cloud Deployment (Vercel + Render / Railway + Supabase / Neon)

For maximum performance and free tier scalability:

### A. Database (Supabase / Neon)
1. Create a free PostgreSQL instance on [Supabase](https://supabase.com) or [Neon](https://neon.tech).
2. Copy your connection URI (format: `postgresql://user:password@host:5432/dbname`).

### B. Backend (Render / Railway)
1. Create a new Web Service pointing to `/backend`.
2. **Runtime**: Python 3.10+
3. **Build Command**: `pip install -r requirements.txt`
4. **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. **Environment Variables**:
   | Variable | Value |
   | :--- | :--- |
   | `DATABASE_URL` | `postgresql://user:password@host:5432/dbname` |
   | `SECRET_KEY` | *(Generate a 32+ character random string)* |
   | `DEBUG` | `False` |
   | `CORS_ORIGINS` | `https://your-frontend.vercel.app` |
   | `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` |

### C. Frontend (Vercel)
1. Import the repository into [Vercel](https://vercel.com).
2. Set **Root Directory** to `frontend`.
3. Set **Framework Preset** to `Next.js`.
4. **Environment Variables**:
   | Variable | Value |
   | :--- | :--- |
   | `NEXT_PUBLIC_API_URL` | `https://your-backend.onrender.com` |
   | `BACKEND_URL` | `https://your-backend.onrender.com` |
5. Click **Deploy**.

---

## 4. Production Environment Variables Reference

### Backend (`/backend/.env`)
```env
# Database Connection (PostgreSQL or SQLite)
DATABASE_URL=postgresql://user:password@host:5432/timetable_db

# Security
SECRET_KEY=generate-a-strong-random-key-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Application
APP_NAME=Schedule Designer
DEBUG=False

# CORS Origins (comma-separated domains allowed to connect)
CORS_ORIGINS=https://timetable.yourdomain.com,http://localhost:3000
```

### Frontend (`/frontend/.env.local` or Cloud Settings)
```env
# Client-side API URL (accessed by user browsers)
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# Server-side API URL (accessed by Next.js rewrites)
BACKEND_URL=https://api.yourdomain.com
```

---

## 5. Automatic Bootstrapping & Initial Credentials

Upon deployment, the backend's `init_db()` automatically initializes all tables and bootstraps the following if the database is newly created:

1. **Default Administrator Account**:
   - **Username**: `admin`
   - **Password**: `admin123`
   *(You can change this password or register additional users through the web UI)*

2. **Standard Roles**: `admin`, `faculty`, `student`.

3. **Base Academic Dataset**:
   - Automatically imports departments, faculty, courses, rooms, and time slots from `backend/data/timetable.xlsx` so the application is ready to use immediately without manual seeding!

### Manual Seeding (Optional)
If you prefer to re-seed demo fixtures:
```bash
# In backend directory:
python seed_data.py
```

### Import Custom Excel Data
You can upload your own Excel sheet directly through the Dashboard UI button (**"Upload Excel Data"**), or run:
```bash
# In backend directory:
python scripts/import_excel.py --file data/timetable.xlsx
```

---

## 6. Pre-Deployment Verification Checklist

- [x] **Backend Unit Tests**: 44/44 tests passing (`pytest`)
- [x] **Frontend Production Build**: Zero compile or type errors (`npm run build`)
- [x] **JWT Authentication**: Secured with `HTTPBearer` token extraction
- [x] **CORS Middleware**: Flexible origin matching supporting Vercel, custom domains, and wildcards
- [x] **PostgreSQL & SQLite Drivers**: Sync (`psycopg2-binary`) and async (`asyncpg`, `aiosqlite`) drivers installed
- [x] **Dockerfiles**: Multi-stage production images with dynamic `$PORT` support
- [x] **Docker Compose**: Pre-configured with Postgres, Backend, and Frontend
- [x] **Cloud Blueprints**: Ready-to-use `render.yaml` and `Procfile`
- [x] **Automatic Bootstrapping**: Zero-step initialization for brand new cloud databases
