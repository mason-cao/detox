import subprocess


def escape_applescript_string(value):
    return str(value).replace("\\", "\\\\").replace('"', '\\"')


def notify(title, message, sound="default"):
    """Send a macOS notification via osascript."""
    title = escape_applescript_string(title)
    message = escape_applescript_string(message)
    sound = escape_applescript_string(sound)
    subprocess.run(
        [
            "osascript",
            "-e",
            f'display notification "{message}" with title "{title}" sound name "{sound}"',
        ],
        capture_output=True,
    )
