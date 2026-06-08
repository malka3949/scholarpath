# ScholarPath

Monorepo for the ScholarPath scholarship platform (Phase 1 MVP).

## Stack

- **Frontend:** Next.js 15 (Hebrew UI) + NextAuth + route middleware
- **Backend:** NestJS + JWT
- **Database:** PostgreSQL + Prisma migrations
- **Monorepo:** npm workspaces + Turborepo

## Quick Start

```bash
npm install

# Add POSTGRES_SUPERUSER_PASSWORD to .env (postgres user password)
npm run db:setup
npm run db:migrate
npm run db:seed
npm run dev
```

Open **http://localhost:3000**

| Service | URL |
|---------|-----|
| Web | http://localhost:3000 |
| API | http://localhost:3001/api |

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@scholarpath.local | admin123 |
| Student | student@scholarpath.local | student123 |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API + Web |
| `npm run build` | Build all apps |
| `npm run db:setup` | Create PostgreSQL DB + user (once) |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed 50 scholarships + demo users |

## Docker (alternative)

```bash
docker compose up -d
npm run db:migrate
npm run db:seed
```

## Project Structure

```
apps/
  api/     NestJS backend
  web/     Next.js frontend
packages/
  database/  Prisma schema + migrations
scripts/     PostgreSQL setup
DOCS/        Planning + progress
```

See `DOCS/PROGRESS.md` for current status.
