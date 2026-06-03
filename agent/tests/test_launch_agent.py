import plistlib
import sys


def test_install_writes_launch_agent_plist_and_loads_it(tmp_path, monkeypatch):
    from agent import launch_agent

    plist_path = tmp_path / "LaunchAgents" / "com.detox.agent.plist"
    log_path = tmp_path / "monitor.log"
    bundle_exe = tmp_path / "Detox"
    bundle_exe.write_text("")
    calls = []

    monkeypatch.setattr(launch_agent, "LAUNCH_AGENT_PATH", str(plist_path))
    monkeypatch.setattr(launch_agent, "LOG_PATH", str(log_path))
    monkeypatch.setattr(launch_agent, "BUNDLE_IDENTIFIER", "com.detox.agent")
    monkeypatch.setenv("DETOX_BUNDLE_EXEC", str(bundle_exe))
    monkeypatch.setattr(
        launch_agent.subprocess,
        "run",
        lambda cmd, check: calls.append((cmd, check)),
    )

    launch_agent.install()

    assert launch_agent.is_installed()
    with plist_path.open("rb") as f:
        payload = plistlib.load(f)
    assert payload == {
        "Label": "com.detox.agent",
        "ProgramArguments": [str(bundle_exe)],
        "RunAtLoad": True,
        "KeepAlive": False,
        "StandardOutPath": str(log_path),
        "StandardErrorPath": str(log_path),
        "ProcessType": "Interactive",
    }
    assert calls == [(["launchctl", "load", "-w", str(plist_path)], False)]


def test_install_uses_python_module_entrypoint_in_dev(tmp_path, monkeypatch):
    from agent import launch_agent

    plist_path = tmp_path / "LaunchAgents" / "com.detox.agent.plist"
    calls = []

    monkeypatch.setattr(launch_agent, "LAUNCH_AGENT_PATH", str(plist_path))
    monkeypatch.delenv("DETOX_BUNDLE_EXEC", raising=False)
    monkeypatch.setattr(
        launch_agent.subprocess,
        "run",
        lambda cmd, check: calls.append((cmd, check)),
    )

    launch_agent.install()

    with plist_path.open("rb") as f:
        payload = plistlib.load(f)
    assert payload["ProgramArguments"] == [sys.executable, "-m", "agent"]


def test_install_uses_app_executable_when_py2app_frozen(tmp_path, monkeypatch):
    from agent import launch_agent

    plist_path = tmp_path / "LaunchAgents" / "com.detox.agent.plist"
    app_exe = tmp_path / "Detox.app" / "Contents" / "MacOS" / "Detox"
    python_exe = app_exe.parent / "python"
    app_exe.parent.mkdir(parents=True)
    app_exe.write_text("")
    python_exe.write_text("")
    calls = []

    monkeypatch.setattr(launch_agent, "LAUNCH_AGENT_PATH", str(plist_path))
    monkeypatch.delenv("DETOX_BUNDLE_EXEC", raising=False)
    monkeypatch.setattr(launch_agent.sys, "frozen", "macosx_app", raising=False)
    monkeypatch.setattr(launch_agent.sys, "executable", str(python_exe))
    monkeypatch.setattr(
        launch_agent.subprocess,
        "run",
        lambda cmd, check: calls.append((cmd, check)),
    )

    launch_agent.install()

    with plist_path.open("rb") as f:
        payload = plistlib.load(f)
    assert payload["ProgramArguments"] == [str(app_exe)]


def test_uninstall_unloads_and_removes_existing_plist(tmp_path, monkeypatch):
    from agent import launch_agent

    plist_path = tmp_path / "LaunchAgents" / "com.detox.agent.plist"
    plist_path.parent.mkdir()
    plist_path.write_bytes(b"placeholder")
    calls = []

    monkeypatch.setattr(launch_agent, "LAUNCH_AGENT_PATH", str(plist_path))
    monkeypatch.setattr(
        launch_agent.subprocess,
        "run",
        lambda cmd, check: calls.append((cmd, check)),
    )

    launch_agent.uninstall()

    assert not launch_agent.is_installed()
    assert calls == [(["launchctl", "unload", "-w", str(plist_path)], False)]


def test_uninstall_missing_plist_is_a_noop(tmp_path, monkeypatch):
    from agent import launch_agent

    plist_path = tmp_path / "LaunchAgents" / "com.detox.agent.plist"
    calls = []

    monkeypatch.setattr(launch_agent, "LAUNCH_AGENT_PATH", str(plist_path))
    monkeypatch.setattr(
        launch_agent.subprocess,
        "run",
        lambda cmd, check: calls.append((cmd, check)),
    )

    launch_agent.uninstall()

    assert calls == []
