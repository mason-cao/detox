import subprocess


def notify(title, message, sound="default"):
    """Send a macOS notification via osascript."""
    # Escape quotes for AppleScript
    title = title.replace('"', '\\"')
    message = message.replace('"', '\\"')
    subprocess.run(
        [
            "osascript",
            "-e",
            f'display notification "{message}" with title "{title}" sound name "{sound}"',
        ],
        capture_output=True,
    )
