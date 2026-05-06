# Detox API — Railway runbook

The hosted FastAPI service runs on Railway. One project, three services:

- **api** — this repo, built from `api/Dockerfile` per `railway.toml`.
- **postgres** — Railway's managed Postgres add-on. Source of truth for users, sessions, blocks, goals, settings, rewards.
- **redis** — Railway's managed Redis add-on. Backs the `/v1/ingest` rate limiter and `/v1/rules` etag cache.

The agent and Cloudflare Pages-hosted web both call this service over HTTPS at the custom domain (`api.detox.app`).

## One-time setup

```bash
# 1. Install + log in.
brew install railway
railway login

# 2. Create the project, then add the api service from this repo.
railway init                           # in the repo root
railway link                           # if linking an existing project

# 3. Add Postgres and Redis from the dashboard:
#    railway.app → New → Database → PostgreSQL
#    railway.app → New → Database → Redis
#    Both add-ons live in the same project as the api service.
```

## Wire the env vars

The api reads `DETOX_*` env names; Railway's Postgres/Redis plugins expose `DATABASE_URL` and `REDIS_URL`. Use Railway variable references so the api always points at the live add-on URL:

```bash
railway variables set \
    DETOX_AUTH_MODE=supabase \
    SUPABASE_URL=https://xxx.supabase.co \
    SUPABASE_JWKS_URL=https://xxx.supabase.co/auth/v1/keys \
    DETOX_DEVICE_JWT_SECRET="$(openssl rand -hex 32)" \
    API_CORS_ORIGINS="https://app.detox.app" \
    DETOX_DATABASE_URL='${{Postgres.DATABASE_URL}}' \
    DETOX_REDIS_URL='${{Redis.REDIS_URL}}' \
    DETOX_INGEST_RATE_LIMIT_PER_MINUTE=60
```

`${{Postgres.DATABASE_URL}}` and `${{Redis.REDIS_URL}}` are Railway's reference syntax — set the actual add-on names in the dashboard if Railway picked different ones. Keep all secrets (Supabase keys, the device JWT secret) in Railway, never in the repo.

## Deploy + migrate

```bash
# Push the latest commit (Railway auto-deploys on git push when GitHub is wired).
railway up                             # one-shot deploy from local

# Run alembic against the deployed db.
railway run --service api -- alembic -c api/alembic.ini upgrade head
```

The healthcheck path is `/healthz` (configured in `railway.toml`); Railway holds traffic until it returns 200.

## Custom domain

In the api service → **Settings → Networking → Custom Domain**, add `api.detox.app`. Railway provisions the cert. Point the DNS at the CNAME Railway gives you.

## Cost note

The $5/mo Hobby plan covers ~500 execution hours/month and 1 GB Postgres + 256 MB Redis storage. The api's Postgres footprint at v1 is tiny (sessions/usage/pickups in the low MB range per active user). Watch the dashboard's usage meter once real traffic shows up.

## Local-stack equivalent

For development the same shape runs out of `infra/docker-compose.dev.yml` (Postgres on `:5432`, Redis on `:6379`). Set `DETOX_DATABASE_URL=postgresql://detox:detox@localhost:5432/detox` and `DETOX_REDIS_URL=redis://localhost:6379/0` and the api boots identically.
