import time


class FakeMonitorDB:
    def __init__(self):
        self.usage = []
        self.pickups = []
        self.sessions = []

    def get_setting(self, _key, default):
        return default

    def record_usage(self, app_name, timestamp):
        self.usage.append((app_name, timestamp))

    def record_pickup(self, timestamp):
        self.pickups.append(timestamp)

    def record_session(self, app_name, start_time, end_time):
        self.sessions.append((app_name, start_time, end_time))

    def is_app_blocked(self, _app_name):
        return False

    def get_goals(self):
        return []


def _wait_for(predicate, timeout=1.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(0.005)
    return False


def _patch_monitor_runtime(monkeypatch):
    from agent import monitor

    fake_db = FakeMonitorDB()
    monkeypatch.setattr(monitor, "db", fake_db)
    monkeypatch.setattr(monitor, "POLL_INTERVAL", 0.01)
    monkeypatch.setattr(monitor.Monitor, "get_frontmost_app", lambda _self: "Code")
    monkeypatch.setattr(monitor.Monitor, "get_idle_seconds", lambda _self: 0)
    monkeypatch.setattr(monitor, "kill_app", lambda _app_name: None)
    return monitor, fake_db


def test_start_in_thread_polls_and_stop_ends_loop(monkeypatch):
    monitor_module, fake_db = _patch_monitor_runtime(monkeypatch)
    subject = monitor_module.Monitor()

    thread = subject.start_in_thread()

    assert thread.is_alive()
    assert _wait_for(lambda: subject.last_poll_at is not None)
    assert subject.is_alive()
    assert fake_db.usage

    subject.stop()
    thread.join(timeout=2 * monitor_module.POLL_INTERVAL + 0.5)

    assert not thread.is_alive()
    assert not subject.is_alive()


def test_stop_is_idempotent():
    from agent.monitor import Monitor

    subject = Monitor()

    subject.stop()
    subject.stop()

    assert subject.running is False


def test_run_closes_in_flight_session_in_finally(monkeypatch):
    monitor_module, fake_db = _patch_monitor_runtime(monkeypatch)
    subject = monitor_module.Monitor()
    subject.current_app = "Code"
    expected_start = 1_714_492_800.0
    subject.session_start = expected_start
    subject.running = False

    subject.run()

    assert len(fake_db.sessions) == 1
    app_name, start_time, end_time = fake_db.sessions[0]
    assert app_name == "Code"
    assert start_time == expected_start
    assert start_time <= end_time
    assert subject.current_app is None
    assert subject.session_start is None
