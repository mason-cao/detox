# infra/

Infrastructure definitions for the hosted tier. Nothing here runs today; the
v1 agent-only app needs no external services.

## Contents

- `docker-compose.dev.yml` — local Postgres + Redis for the Phase 2 FastAPI
  work. Start with `docker compose -f infra/docker-compose.dev.yml up -d`.
- `.env.example` — placeholder env vars the cloud tier will read (Postgres
  URL, Redis URL, Clerk keys, …). Copy to `.env` and fill in when needed.

## Planned additions

- `fly/` — Fly.io app config for the FastAPI service (Phase 4).
- `cloudflare/` — Pages / DNS config for the static web bundle (Phase 4).
- `terraform/` or similar — infra-as-code if the stack grows beyond those two
  providers. Not planned yet.

The split between `api/` (application code) and `infra/` (how to run it) is
intentional: application devs shouldn't need to touch infra for most work,
and infra changes shouldn't require a Python review.
