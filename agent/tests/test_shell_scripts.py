from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _read(path: str) -> str:
    return (ROOT / path).read_text()


def test_start_and_stop_validate_monitor_pid_owner_before_trusting_pid_file():
    start = _read("start.sh")
    stop = _read("stop.sh")

    assert "monitor_pid_is_running" in start
    assert 'agent.monitor' in start
    assert "monitor_pid_is_running" in stop
    assert 'agent.monitor' in stop
