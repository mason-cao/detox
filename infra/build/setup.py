"""py2app build for Detox.app.

Run from this directory directly, or through infra/build/build.sh once the
signed release pipeline lands.
"""

import pathlib

from setuptools import setup


ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
BUILD_DIR = pathlib.Path(__file__).resolve().parent
APP = [str(ROOT / "agent" / "__main__.py")]

DATA_FILES = [
    ("web", [str(p) for p in (ROOT / "web").rglob("*") if p.is_file()]),
]

OPTIONS = {
    "argv_emulation": False,
    "iconfile": str(BUILD_DIR / "icon.icns"),
    "plist": str(BUILD_DIR / "Info.plist.tmpl"),
    "packages": ["agent", "flask", "rumps"],
    "includes": ["pkg_resources"],
    "frameworks": [],  # Sparkle.framework is added in the Sparkle task.
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
