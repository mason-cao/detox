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


def test_preview_build_packages_unsigned_dmg_and_zip_without_notarization():
    script = _read("infra/build/preview.sh")

    assert "python3 setup.py py2app" in script
    assert 'Detox-preview-${VERSION}.dmg' in script
    assert 'Detox-preview-${VERSION}.app.zip' in script
    assert "hdiutil create" in script
    assert "ditto -c -k --keepParent" in script
    assert "shasum -a 256" in script
    assert "codesign" not in script
    assert "notarytool" not in script
    assert "spctl" not in script


def test_readme_documents_github_preview_install_surface():
    readme = _read("README.md")

    assert "### A. GitHub preview app (recommended)" in readme
    assert "`Detox-preview-<version>.dmg`" in readme
    assert "`Detox-preview-<version>.app.zip`" in readme
    assert "right-click `Detox.app`, choose **Open**" in readme
    assert "This preview is unsigned" in readme
