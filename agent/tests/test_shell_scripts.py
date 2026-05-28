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


def test_preview_release_smoke_covers_unsigned_app_launch_path():
    smoke = _read("infra/preview-release-smoke.md")

    assert "./preview.sh <version>" in smoke
    assert "Detox-preview-<version>.dmg" in smoke
    assert "Detox-preview-<version>.app.zip" in smoke
    assert "right-click `Detox.app`" in smoke
    assert "Accessibility" in smoke
    assert "Open Dashboard" in smoke
    assert "data/monitor.pid" in smoke


def test_preview_release_template_requires_assets_checksums_and_warning():
    template = _read("infra/preview-release-template.md")

    assert "Detox Preview <version>" in template
    assert "Detox-preview-<version>.dmg" in template
    assert "Detox-preview-<version>.app.zip" in template
    assert "SHA256" in template
    assert "This preview build is unsigned" in template
    assert "right-click `Detox.app`, choose **Open**" in template
    assert "infra/preview-release-smoke.md" in template


def test_build_readme_documents_preview_release_command():
    readme = _read("infra/build/README.md")

    assert "./preview.sh 0.1.0" in readme
    assert "Detox-preview-0.1.0.dmg" in readme
    assert "Detox-preview-0.1.0.app.zip" in readme
    assert "infra/preview-release-template.md" in readme


def test_source_install_fallback_doc_has_complete_user_path():
    readme = _read("README.md")
    source_install = _read("docs/source-install.md")

    assert "docs/source-install.md" in readme
    assert "git clone https://github.com/mason-cao/detox.git" in source_install
    assert "python3 -m venv .venv" in source_install
    assert "python3 -m pip install -r requirements.txt" in source_install
    assert "python3 -m agent" in source_install
    assert "./start.sh" in source_install
    assert "./stop.sh" in source_install
    assert "Accessibility" in source_install
    assert "data/monitor.log" in source_install
