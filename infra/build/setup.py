"""py2app build for Detox.app.

Run from this directory directly, or through infra/build/build.sh once the
signed release pipeline lands.
"""

import os
import pathlib
import sys

from setuptools import setup


ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
BUILD_DIR = pathlib.Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _disable_py2app_tkinter_recipe():
    """Detox does not use Tk; py2app's Tk probe aborts on some macOS builds."""
    try:
        from py2app.recipes import tkinter as py2app_tkinter
    except Exception:
        return

    py2app_tkinter.check = lambda _cmd, _mf: None


_disable_py2app_tkinter_recipe()


APP = [str(BUILD_DIR / "launcher.py")]
INFO_PLIST = pathlib.Path(
    os.environ.get("DETOX_INFO_PLIST", BUILD_DIR / "Info.plist.tmpl")
)
SPARKLE_FRAMEWORK = BUILD_DIR / "Sparkle.framework"

DATA_FILES = [
    ("web", [str(p) for p in (ROOT / "web").rglob("*") if p.is_file()]),
]

OPTIONS = {
    "argv_emulation": False,
    "iconfile": str(BUILD_DIR / "icon.icns"),
    "plist": str(INFO_PLIST),
    "packages": ["agent", "flask", "rumps", "keyring", "requests"],
    "includes": ["pkg_resources"],
    "excludes": [
        "tkinter",
        "_tkinter",
        "PIL.ImageTk",
        "PIL._tkinter_finder",
        "agent.tests",
        "pytest",
        "_pytest",
    ],
    "frameworks": [str(SPARKLE_FRAMEWORK)] if (SPARKLE_FRAMEWORK / "Sparkle").exists() else [],
    "resources": [],
    "strip": True,
}

setup(
    app=APP,
    name="Detox",
    data_files=DATA_FILES,
    options={"py2app": OPTIONS},
    setup_requires=["py2app>=0.28"],
)
