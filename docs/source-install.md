# Source Install

Use this fallback if the GitHub release DMG or zip does not work on your Mac, or if you want to run Detox directly from the repository.

## Requirements

- macOS 12 or newer.
- Python 3.9 or newer.
- Git.
- Accessibility permission for the terminal app you use to run Detox.

## Menu-Bar App

```bash
git clone https://github.com/mason-cao/detox.git
cd detox
python3 -m venv .venv
. .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
python3 -m agent
```

The Detox lantern appears in the menu bar. Use it to pause/resume tracking, open the dashboard, open logs, pair the device, sync, sign out, or quit.

Grant permission when macOS asks:

```text
System Settings -> Privacy & Security -> Accessibility -> enable Terminal
```

If you run the app from iTerm, Warp, VS Code, or another launcher, enable that app instead of Terminal.

## Headless Mode

If the menu-bar app does not start, use the headless launcher:

```bash
./start.sh
```

This starts the monitor and Flask dashboard, then opens:

```text
http://localhost:5050
```

Stop headless mode with:

```bash
./stop.sh
```

## Troubleshooting

If the dashboard is empty after a minute, check Accessibility first. Without it, macOS will let Detox run but will not allow it to read the frontmost app.

If the menu-bar app does not appear, run the headless launcher once:

```bash
./start.sh
```

If startup fails, inspect:

```text
data/monitor.log
```

If a previous run left a stale process, stop everything and start again:

```bash
./stop.sh
python3 -m agent
```

Local data is stored under `data/` in the checkout. Deleting that directory resets local usage history, goals, blocks, settings, rewards, and pairing state.
