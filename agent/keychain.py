"""Keychain-backed storage for the agent's device JWT.

The agent stores its long-lived device JWT under
``com.detox.agent`` / ``default`` so the token survives quit + relaunch
without ever touching disk in plaintext. ``keyring`` resolves to the
macOS Keychain via Security.framework on Darwin.
"""

from __future__ import annotations

import keyring
from keyring.errors import PasswordDeleteError

SERVICE = "com.detox.agent"
ACCOUNT = "default"


def store_jwt(token: str) -> None:
    keyring.set_password(SERVICE, ACCOUNT, token)


def load_jwt() -> str | None:
    return keyring.get_password(SERVICE, ACCOUNT)


def clear_jwt() -> None:
    try:
        keyring.delete_password(SERVICE, ACCOUNT)
    except PasswordDeleteError:
        pass
