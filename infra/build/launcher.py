"""py2app entrypoint for Detox.app.

`agent/__main__.py` works for `python3 -m agent` because the module loader
already has the repo root on `sys.path`. py2app, however, execs the chosen
script directly, so when the script is `agent/__main__.py` the top-level
`from agent.menubar import main` fails with `ModuleNotFoundError: agent`.

This launcher fixes that by inserting the repo root onto `sys.path` (alias
builds) before importing. In a full bundle the `agent` package is collected
into the bundle's site-packages and the prepend is a harmless no-op.
"""

import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.abspath(os.path.join(_HERE, "..", ".."))
if os.path.isdir(os.path.join(_REPO_ROOT, "agent")) and _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

from agent.menubar import main  # noqa: E402

if __name__ == "__main__":
    main()
