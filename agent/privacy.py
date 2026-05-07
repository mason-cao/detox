"""Ghost Mode — opt-in hashing of app names before they leave the device.

Ghost Mode is the spec's privacy escape hatch (§10): the cloud receives only
opaque hashes, never real macOS app names. The dashboard the user sees on
their own Mac keeps reading the local SQLite which still holds plaintext, so
the trade-off is invisible until they look at the server data directly.

Implementation: SHA-256 of ``salt:app_name``, truncated to 8 hex chars and
prefixed with ``resident-`` so server logs and exports stay scannable. The
salt lives in local SQLite ``settings`` and is generated the first time
ghost mode is enabled. Two known limitations of this approach, documented
in ``docs/privacy.md``:

- Each paired device has its own salt, so the same real app produces
  different hashes per device. Multi-device aggregation is therefore broken
  while ghost mode is on — accepted for v1 in favor of keeping the salt
  on-device.
- Rows already ingested before ghost mode was enabled remain in cleartext on
  the server. Disabling ghost mode does not retroactively rotate hashes.

The setting is read from the cloud_settings mirror once paired so the cloud
dashboard's toggle propagates to the agent's egress decision; pre-pair the
agent reads the local ``settings`` row directly.
"""

from __future__ import annotations

import hashlib
import secrets

from agent import database as db


GHOST_MODE_KEY = "ghost_mode"
GHOST_MODE_SALT_KEY = "ghost_mode_salt"
HASH_PREFIX = "resident-"
HASH_HEX_CHARS = 8


def _cloud_authoritative() -> bool:
    return db._cloud_authoritative()  # type: ignore[attr-defined]


def is_enabled() -> bool:
    """True when ghost mode is on. Reads cloud mirror if paired, else local."""
    if _cloud_authoritative():
        with db.get_db() as conn:
            row = conn.execute(
                "SELECT value FROM cloud_settings WHERE key = ?",
                (GHOST_MODE_KEY,),
            ).fetchone()
        if row is not None:
            return _truthy(row["value"])
    return _truthy(db.get_setting(GHOST_MODE_KEY, "0"))


def _truthy(value) -> bool:
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "on", "yes"}


def get_or_create_salt() -> str:
    """Return the local salt, generating one on first use.

    The salt never leaves the device. ``record_*`` paths still write
    plaintext to local SQLite — only the egress payload is hashed.
    """
    salt = db.get_setting(GHOST_MODE_SALT_KEY)
    if salt:
        return salt
    salt = secrets.token_hex(16)
    db.set_setting(GHOST_MODE_SALT_KEY, salt)
    return salt


def hash_app_name(name: str, salt: str | None = None) -> str:
    if salt is None:
        salt = get_or_create_salt()
    digest = hashlib.sha256(f"{salt}:{name}".encode("utf-8")).hexdigest()
    return f"{HASH_PREFIX}{digest[:HASH_HEX_CHARS]}"


def maybe_hash(name: str) -> str:
    """Hash ``name`` if ghost mode is on, otherwise pass through unchanged."""
    if not name or not is_enabled():
        return name
    return hash_app_name(name)
