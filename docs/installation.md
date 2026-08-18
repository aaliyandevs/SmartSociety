# 12. Installation & Deployment

## 12.1 Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 18.18+ (20 or 22 recommended) | `node --version` |
| npm | 9+ | Ships with Node |
| PostgreSQL | 14+ | **Optional** — see below |

### About PostgreSQL

The application targets PostgreSQL 14 or later. If you do not have PostgreSQL
installed, you do not need to install anything: `npm run db:up` starts a real
PostgreSQL 17 server from binaries bundled as a dev dependency, using a
project-local data directory (`.postgres/`). Nothing is installed system-wide
and nothing is left behind after `npm run db:down`.

If you already run PostgreSQL — locally, or a hosted instance such as Neon,
Supabase or RDS — skip that step and point `DATABASE_URL` at it.

---

## 12.2 Quick start

```bash
# 1. Install dependencies
npm install

# 2. Create .env, start the database, migrate and seed — all in one step
npm run setup

# 3. Start the application
npm run dev
```

Open <http://localhost:3000> and sign in with any demo account below.

`npm run setup` generates a fresh `AUTH_SECRET`, so no placeholder secret is
ever used, even locally.

---

## 12.3 Step-by-step setup

If you prefer to run each step yourself:

```bash
# 1 · Dependencies
npm install

# 2 · Environment
cp .env.example .env                    # macOS / Linux
copy .env.example .env                  # Windows

#     Generate a real secret and paste it into AUTH_SECRET:
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# 3 · Database — either start the bundled server...
npm run db:up
#     ...or point DATABASE_URL at your own PostgreSQL instance.

# 4 · Schema
npx prisma migrate deploy
npx prisma generate

# 5 · Demo data
npm run db:seed

# 6 · Run
npm run dev
```

### Database commands

| Command | What it does |
|---|---|
| `npm run db:up` | Start the bundled PostgreSQL server (initialises on first run) |
| `npm run db:down` | Stop it |
| `node scripts/db-server.mjs status` | Is it running? |
| `node scripts/db-server.mjs destroy` | Stop it and delete the data directory |
| `npm run db:migrate` | Create and apply a migration during development |
| `npm run db:deploy` | Apply pending migrations (production) |
| `npm run db:seed` | Load the demo data |
| `npm run db:reset` | Drop, re-migrate and re-seed |
| `npm run db:studio` | Open Prisma Studio, a database browser |
| `npm run db:sql` | Regenerate `database/schema.sql` from the migrations |

### Applying the plain SQL script instead

The SRS asks for `.sql` files containing the database and table definitions.
`database/schema.sql` is generated from the migration history and can be applied
directly:

```bash
createdb smartsociety
psql -d smartsociety -f database/schema.sql
npm run db:seed        # optional demo data
```

---

## 12.4 Environment variables

Copy `.env.example` to `.env`. Never commit `.env`.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string |
| `AUTH_SECRET` | **Yes** | — | Session signing key, **≥ 32 characters** |
| `AUTH_SESSION_TTL` | No | `28800` | Session lifetime in seconds (8 hours) |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Public base URL |
| `NEXT_PUBLIC_SOCIETY_NAME` | No | `Green Meadows Residency` | Society name shown in the UI |
| `UPLOAD_DIR` | No | `uploads` | Where complaint photos are written |
| `UPLOAD_MAX_BYTES` | No | `5242880` | Maximum upload size (5 MB) |
| `LOCAL_PG_PORT` | No | `5433` | Port for the bundled PostgreSQL |
| `LOCAL_PG_USER` / `LOCAL_PG_PASSWORD` / `LOCAL_PG_DATABASE` | No | `smartsociety` | Bundled PostgreSQL credentials |

The application refuses to start with a missing `DATABASE_URL` or an
`AUTH_SECRET` shorter than 32 characters, rather than running insecurely.

---

## 12.5 Demo credentials

Created by `npm run db:seed`. They are also listed on the sign-in page, where a
single click fills the form.

| Role | Email | Password |
|---|---|---|
| **Administrator** | `admin@smartsociety.local` | `Admin@12345` |
| **Resident** | `resident@smartsociety.local` | `Resident@12345` |
| **Security Guard** | `guard@smartsociety.local` | `Guard@12345` |
| **Maintenance Staff** | `maintenance@smartsociety.local` | `Maintenance@12345` |

Additional seeded accounts — a second administrator (`secretary@…`), two more
guards (`guard2@…`, `guard3@…`), five more technicians (`electrician@…`,
`lift@…`, `housekeeping@…`, `gardening@…`, `handyman@…`) and 41 further
residents — all use **`Society@12345`**.

> These are demonstration accounts for a locally-seeded database. Change or
> remove them before any real deployment.

---

## 12.6 Development commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build (runs `prisma generate` first) |
| `npm start` | Serve the production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm test` | Unit and integration tests |
| `npm run test:watch` | Tests in watch mode |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run verify` | typecheck + lint + tests |
| `npm run check:pages` | Request all 55 authenticated routes and report status and timing |

---

## 12.7 Production build

```bash
npm run build
npm start          # serves on port 3000 (PORT=8080 npm start to change it)
```

Before deploying:

1. Set a strong, unique `AUTH_SECRET` (48 random bytes).
2. Point `DATABASE_URL` at a managed PostgreSQL instance with backups enabled.
3. Set `NEXT_PUBLIC_APP_URL` to the public HTTPS URL.
4. Run `npx prisma migrate deploy` against the production database.
5. Decide whether to seed. **Do not seed demo accounts into production** —
   create a single administrator instead and onboard real residents through the
   application.
6. Terminate TLS in front of the app; the session cookie sets `Secure` whenever
   `NODE_ENV=production`.
7. Give `uploads/` persistent storage — on an ephemeral filesystem, complaint
   photos will not survive a restart.

### Docker

No Dockerfile is included, but the application is a standard Next.js server:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
```

Mount a volume at `/app/uploads` and supply `DATABASE_URL` and `AUTH_SECRET` as
environment variables.

### Platform notes

| Platform | Notes |
|---|---|
| **Vercel** | Works with a hosted PostgreSQL. Uploads need object storage instead of the local filesystem — see [Assumptions](./assumptions.md#a-4-file-storage) |
| **Railway / Render / Fly.io** | Provision PostgreSQL, set the two required variables, attach a persistent volume for `uploads/` |
| **Self-hosted VPS** | `npm run build && npm start` behind nginx or Caddy for TLS; the SRS reference hardware (quad-core, 16 GB) is ample |

---

## 12.8 Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Can't reach database server` | PostgreSQL is not running | `npm run db:up`, then `node scripts/db-server.mjs status` |
| `AUTH_SECRET must be at least 32 characters` | Placeholder secret still in `.env` | Generate one with the `node -e` command above |
| `character … has no equivalent in encoding "WIN1252"` | An existing cluster was created with a non-UTF-8 encoding | `node scripts/db-server.mjs destroy && npm run db:up` — the bundled server forces UTF-8 |
| Port 5433 already in use | Another PostgreSQL instance | Set `LOCAL_PG_PORT` and update `DATABASE_URL` |
| Port 3000 already in use | Another dev server | `PORT=3001 npm run dev` |
| Prisma types look stale after a schema edit | Client not regenerated | `npx prisma generate` |
| `npm run test:e2e` cannot launch a browser | Playwright browsers not installed | `npx playwright install chromium` |
| Camera unavailable on the verify screen | Permission denied, or a non-HTTPS origin | Use the numeric keypad; browsers only grant camera access on `localhost` or HTTPS |
| Seeding fails midway | Partially-migrated database | `npm run db:reset` |
