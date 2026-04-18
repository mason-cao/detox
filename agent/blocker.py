import subprocess
from agent.notifier import notify


def kill_app(app_name):
    """Force-quit an app by process name and notify the user."""
    result = subprocess.run(
        ["pkill", "-x", app_name],
        capture_output=True,
    )
    if result.returncode == 0:
        notify(
            "Detox - App Blocked",
            f"{app_name} has been closed. Stay focused!",
        )
        return True
    return False
