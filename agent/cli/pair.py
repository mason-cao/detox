"""Pair this Mac with a Detox cloud account.

Run via ``python3 -m agent.cli.pair``. The user opens
``app.detox.app/pair`` in their browser, signs in with Supabase, and
reads back a 6-character code. The CLI POSTs the code to
``/v1/devices/pair-claim`` and stores the resulting device JWT in the
macOS Keychain. The menubar app picks the token up on next relaunch.
"""

from __future__ import annotations

import platform
import sys

from agent import cloud, keychain
from agent.config import APP_VERSION, CLOUD_API_BASE


def _device_name() -> str:
    try:
        host = platform.node() or "Mac"
    except Exception:
        host = "Mac"
    return host.split(".")[0] or "Mac"


def _prompt_code() -> str:
    print("\nDetox pairing")
    print(f"  Cloud: {CLOUD_API_BASE}")
    print("  1. Open https://app.detox.app/pair and sign in.")
    print("  2. Copy the 6-character code shown on that page.")
    print("  3. Paste it below.\n")
    raw = input("Pairing code: ").strip().upper()
    if not raw:
        print("No code entered, aborting.", file=sys.stderr)
        sys.exit(1)
    return raw


def main() -> int:
    if keychain.load_jwt():
        answer = input("This Mac is already paired. Re-pair? [y/N] ").strip().lower()
        if answer not in ("y", "yes"):
            print("Pairing unchanged.")
            return 0
        keychain.clear_jwt()

    code = _prompt_code()
    device_name = _device_name()

    try:
        resp = cloud.post_json(
            "/v1/devices/pair-claim",
            {
                "code": code,
                "device_name": device_name,
                "agent_version": APP_VERSION,
            },
            require_auth=False,
        )
    except cloud.HTTPError as exc:
        print(f"\nPairing failed: {exc}", file=sys.stderr)
        if exc.status_code == 404:
            print("Code not found — double-check the page and try again.", file=sys.stderr)
        elif exc.status_code == 410:
            print("Code expired or already used. Refresh /pair for a new one.", file=sys.stderr)
        return 1

    token = resp.get("api_token")
    device_id = resp.get("device_id", "?")
    if not isinstance(token, str) or not token:
        print("Server did not return an api_token.", file=sys.stderr)
        return 1

    keychain.store_jwt(token)
    print(f"\n✓ Paired as {device_name} (device {device_id}).")
    print("Restart the Detox menubar app to pick up the new state.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
