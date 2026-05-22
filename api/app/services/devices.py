"""Device pairing service — issue, claim, list, heartbeat.

Pairing is a two-step handshake: the web (which has the user's Supabase
session) calls ``pair_init`` to mint a 6-character claim code; the macOS
agent (which has nothing yet) calls ``pair_claim`` with the code and walks
away with a long-lived device JWT.

Codes are stored as SHA-256 hashes; cleartext exists only in the response
to ``pair_init``. Codes expire after ``settings.pairing_code_ttl_seconds``
(default 5 minutes) and are single-use — the row is marked ``consumed_at``
on successful claim.
"""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from ..config import Settings
from ..db import set_user_guc
from ..device_auth import issue_device_token
from ..errors import ApiError


# Crockford-ish alphabet — drops 0/O/1/I/L to reduce paste mistakes.
_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_CODE_LENGTH = 6


@dataclass(frozen=True)
class PairInitResult:
    code: str
    expires_at: datetime


@dataclass(frozen=True)
class PairClaimResult:
    device_id: str
    api_token: str


def _generate_code() -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(_CODE_LENGTH))


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.upper().encode("utf-8")).hexdigest()


def pair_init(session: Session, *, user_id: str, ttl_seconds: int) -> PairInitResult:
    """Mint a single-use pairing code for the authenticated user."""
    code = _generate_code()
    code_hash = _hash_code(code)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)

    session.execute(
        text(
            """
            INSERT INTO device_pairings (code_hash, user_id, expires_at)
            VALUES (:code_hash, :user_id, :expires_at)
            """
        ),
        {
            "code_hash": code_hash,
            "user_id": user_id,
            "expires_at": expires_at,
        },
    )
    return PairInitResult(code=code, expires_at=expires_at)


def pair_claim(
    session: Session,
    settings: Settings,
    *,
    code: str,
    device_name: str,
    agent_version: str | None,
) -> PairClaimResult:
    """Look up a pending pairing, register the device, return a device JWT.

    Pairing claim runs without RLS scoping — the agent has no session yet —
    so this query intentionally bypasses the GUC. A 404 is returned for any
    unknown / consumed / expired code so attackers cannot distinguish.
    """
    code_hash = _hash_code(code)

    row = session.execute(
        text(
            """
            SELECT user_id, expires_at, consumed_at
            FROM device_pairings
            WHERE code_hash = :code_hash
            """
        ),
        {"code_hash": code_hash},
    ).one_or_none()

    if row is None:
        raise ApiError("pairing code not found", status_code=404)

    user_id, expires_at, consumed_at = row
    if consumed_at is not None:
        raise ApiError("pairing code already used", status_code=410)
    if expires_at <= datetime.now(timezone.utc):
        raise ApiError("pairing code expired", status_code=410)

    set_user_guc(session, str(user_id))
    inserted = session.execute(
        text(
            """
            INSERT INTO devices (user_id, device_name, agent_version)
            VALUES (:user_id, :device_name, :agent_version)
            RETURNING id
            """
        ),
        {
            "user_id": str(user_id),
            "device_name": device_name,
            "agent_version": agent_version,
        },
    ).scalar_one()
    device_id = str(inserted)

    session.execute(
        text(
            """
            UPDATE device_pairings
            SET consumed_at = now(), device_id = :device_id
            WHERE code_hash = :code_hash
            """
        ),
        {"code_hash": code_hash, "device_id": device_id},
    )

    api_token = issue_device_token(
        settings,
        user_id=str(user_id),
        device_id=device_id,
    )
    return PairClaimResult(device_id=device_id, api_token=api_token)


def list_devices(session: Session, *, user_id: str) -> list[dict]:
    rows = session.execute(
        text(
            """
            SELECT id, device_name, agent_version, last_sync_at
            FROM devices
            WHERE user_id = :user_id
            ORDER BY last_sync_at DESC NULLS LAST, device_name
            """
        ),
        {"user_id": user_id},
    ).all()
    return [
        {
            "id": str(row[0]),
            "device_name": row[1],
            "agent_version": row[2],
            "last_sync_at": row[3].isoformat() if row[3] else None,
        }
        for row in rows
    ]


def heartbeat(
    session: Session,
    *,
    device_id: str,
    agent_version: str | None,
) -> None:
    result = session.execute(
        text(
            """
            UPDATE devices
            SET last_sync_at = now(),
                agent_version = COALESCE(:agent_version, agent_version)
            WHERE id = :device_id
            """
        ),
        {"device_id": device_id, "agent_version": agent_version},
    )
    if result.rowcount == 0:
        raise ApiError("device not found", status_code=404)
