"""Manage the LaunchAgent plist that auto-starts Detox at login."""

import os
import plistlib
import subprocess
import sys

from agent.config import BUNDLE_IDENTIFIER, LAUNCH_AGENT_PATH, LOG_PATH


def _program_arguments():
    """Resolve the executable the LaunchAgent should invoke."""
    bundle_exe = os.environ.get("DETOX_BUNDLE_EXEC")
    if bundle_exe and os.path.exists(bundle_exe):
        return [bundle_exe]
    return [sys.executable, "-m", "agent"]


def _plist_payload():
    return {
        "Label": BUNDLE_IDENTIFIER,
        "ProgramArguments": _program_arguments(),
        "RunAtLoad": True,
        "KeepAlive": False,
        "StandardOutPath": LOG_PATH,
        "StandardErrorPath": LOG_PATH,
        "ProcessType": "Interactive",
    }


def is_installed():
    return os.path.exists(LAUNCH_AGENT_PATH)


def install():
    os.makedirs(os.path.dirname(LAUNCH_AGENT_PATH), exist_ok=True)
    with open(LAUNCH_AGENT_PATH, "wb") as f:
        plistlib.dump(_plist_payload(), f)
    subprocess.run(["launchctl", "load", "-w", LAUNCH_AGENT_PATH], check=False)


def uninstall():
    if not is_installed():
        return
    subprocess.run(["launchctl", "unload", "-w", LAUNCH_AGENT_PATH], check=False)
    try:
        os.remove(LAUNCH_AGENT_PATH)
    except OSError:
        pass
