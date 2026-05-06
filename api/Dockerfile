# syntax=docker/dockerfile:1.7
#
# Detox API container — built by Railway from this Dockerfile.
# Build context is the repo root (the agent/ package is imported by the
# api at runtime). Two stages so the runtime image carries only the
# wheels we need, not the build toolchain.
#
# Railway sets ``PORT``; we honor it with a default of 8080 for local
# docker runs.

# ── Stage 1: builder ─────────────────────────────────────────────────
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /build

# Build deps for psycopg + cryptography wheels.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Pyproject is the dep source of truth — keep this list in lock-step.
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install \
        "fastapi>=0.115,<1.0" \
        "uvicorn[standard]>=0.34,<1.0" \
        "sqlalchemy>=2.0,<3.0" \
        "alembic>=1.13,<2.0" \
        "psycopg[binary]>=3.2,<4.0" \
        "pyjwt[crypto]>=2.8,<3.0" \
        "httpx>=0.27,<1.0" \
        "redis>=5.0,<6.0"

# ── Stage 2: runtime ─────────────────────────────────────────────────
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    PYTHONPATH="/srv" \
    PORT=8080

# libpq runtime so psycopg can dlopen at request time.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libpq5 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

COPY --from=builder /opt/venv /opt/venv
COPY api/__init__.py ./api/__init__.py
COPY api/app ./api/app
COPY api/alembic.ini ./api/alembic.ini
COPY api/migrations ./api/migrations
COPY agent ./agent

RUN useradd --create-home --shell /usr/sbin/nologin detox \
    && chown -R detox:detox /srv
USER detox

EXPOSE 8080

# Bind to whatever PORT Railway hands us (default 8080 locally).
CMD ["sh", "-c", "uvicorn api.app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
