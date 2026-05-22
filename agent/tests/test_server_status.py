import os


def test_status_ignores_unrelated_live_pid(tmp_path, monkeypatch):
    from agent import server

    pid_file = tmp_path / "monitor.pid"
    pid_file.write_text(str(os.getpid()))
    monkeypatch.setattr(server, "PID_FILE", str(pid_file))

    response = server.app.test_client().get("/api/status")

    assert response.status_code == 200
    assert response.get_json() == {"monitor_running": False}


def test_status_uses_in_process_monitor_provider(tmp_path, monkeypatch):
    from agent import server

    missing_pid_file = tmp_path / "monitor.pid"
    monkeypatch.setattr(server, "PID_FILE", str(missing_pid_file))

    server.set_monitor_status_provider(lambda: True)
    try:
        response = server.app.test_client().get("/api/status")
    finally:
        server.set_monitor_status_provider(None)

    assert response.status_code == 200
    assert response.get_json() == {"monitor_running": True}
