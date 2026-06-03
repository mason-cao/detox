from pathlib import Path


def test_pair_terminal_script_uses_bundle_pair_command_when_frozen(tmp_path):
    from agent import menubar

    app = tmp_path / "Detox.app"
    app_exe = app / "Contents" / "MacOS" / "Detox"
    python_exe = app / "Contents" / "MacOS" / "python"
    app_exe.parent.mkdir(parents=True)
    app_exe.write_text("")
    python_exe.write_text("")

    script = menubar._pair_terminal_script(
        executable_path=str(python_exe),
        frozen=True,
    )

    assert str(app_exe) in script
    assert "--pair" in script
    assert "python3 -m agent.cli.pair" not in script


def test_pair_terminal_script_uses_source_module_command_in_dev(tmp_path):
    from agent import menubar

    source_file = tmp_path / "detox" / "agent" / "menubar.py"
    source_file.parent.mkdir(parents=True)
    source_file.write_text("")

    script = menubar._pair_terminal_script(
        source_file=str(source_file),
        frozen=False,
    )

    assert f"cd {tmp_path / 'detox'}" in script
    assert "-m agent.cli.pair" in script


def test_sparkle_framework_path_prefers_bundled_framework(tmp_path):
    from agent import menubar

    app = tmp_path / "Detox.app"
    executable = app / "Contents" / "MacOS" / "Detox"
    source_file = app / "Contents" / "Resources" / "lib" / "python3.11" / "agent" / "menubar.py"
    framework = app / "Contents" / "Frameworks" / "Sparkle.framework"
    framework.mkdir(parents=True)
    source_file.parent.mkdir(parents=True)
    executable.parent.mkdir(parents=True)
    executable.write_text("")
    source_file.write_text("")

    assert menubar._sparkle_framework_path(
        executable_path=str(executable),
        source_file=str(source_file),
    ) == str(framework)


def test_check_updates_notifies_when_sparkle_framework_is_missing(monkeypatch):
    from agent import menubar

    notifications = []
    monkeypatch.setattr(
        menubar,
        "_sparkle_framework_path",
        lambda: str(Path("/tmp/nonexistent/Sparkle.framework")),
    )
    monkeypatch.setattr(
        menubar.rumps,
        "notification",
        lambda *args: notifications.append(args),
    )

    menubar.DetoxApp.on_check_updates(object(), None)

    assert notifications
    assert notifications[0][0:2] == ("Detox", "Updates")
    assert "Update check failed:" in notifications[0][2]


def test_menubar_does_not_claim_cli_monitor_pid_file():
    source = Path(__file__).resolve().parents[2].joinpath("agent/menubar.py").read_text()

    assert "PID_FILE" not in source
    assert "_write_pid" not in source
    assert "set_monitor_status_provider" in source
