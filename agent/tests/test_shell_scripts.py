from pathlib import Path
import tomllib


ROOT = Path(__file__).resolve().parents[2]


def _read(path: str) -> str:
    return (ROOT / path).read_text()


def _css_rule(css: str, selector: str) -> str:
    start = css.index(f"{selector} {{")
    return css[start : css.index("}", start) + 1]


def test_start_and_stop_validate_monitor_pid_owner_before_trusting_pid_file():
    start = _read("start.sh")
    stop = _read("stop.sh")

    assert "monitor_pid_is_running" in start
    assert 'agent.monitor' in start
    assert "monitor_pid_is_running" in stop
    assert 'agent.monitor' in stop


def test_github_release_build_packages_unsigned_dmg_and_zip_without_notarization():
    script = _read("infra/build/github_release.sh")

    assert "python3 setup.py py2app" in script
    assert 'Detox-${VERSION}.dmg' in script
    assert 'Detox-${VERSION}.app.zip' in script
    assert "hdiutil create" in script
    assert "ditto -c -k --keepParent" in script
    assert "codesign --force --deep --sign -" in script
    assert "codesign --verify --deep --strict" in script
    assert "shasum -a 256" in script
    assert "DEVELOPER_ID" not in script
    assert "notarytool" not in script


def test_readme_documents_github_release_install_surface():
    readme = _read("README.md")

    assert "### A. GitHub app release (recommended)" in readme
    assert "`Detox-<version>.dmg`" in readme
    assert "`Detox-<version>.app.zip`" in readme
    assert "**System Settings -> Privacy & Security**" in readme
    assert "**Security**" in readme
    assert "**Open Anyway**" in readme
    assert "This GitHub release is unsigned" in readme
    assert "right" + "-click `Detox.app`, choose **Open**" not in readme


def test_policy_terms_describe_github_file_release_path():
    terms = _read("docs/terms.md")

    assert "GitHub file release" in terms
    assert "install from " + "source" not in terms


def test_preview_docs_use_system_settings_open_anyway_flow():
    smoke = _read("infra/preview-release-smoke.md")
    template = _read("infra/preview-release-template.md")

    for doc in (smoke, template):
        assert "System Settings -> Privacy & Security" in doc
        assert "Security" in doc
        assert "Open Anyway" in doc
        assert "Publish " + "gate" not in doc
        assert "from the same " + "checkout" not in doc
        assert "right" + "-click" not in doc
    assert "Release blockers" in smoke


def test_github_release_smoke_covers_unsigned_app_launch_path():
    smoke = _read("infra/github-release-smoke.md")

    assert "./github_release.sh <version>" in smoke
    assert "Detox-<version>.dmg" in smoke
    assert "Detox-<version>.app.zip" in smoke
    assert "Open Anyway" in smoke
    assert "Accessibility" in smoke
    assert "Open Dashboard" in smoke
    assert "Pair this device" in smoke
    assert "Release blockers" in smoke
    assert "Publish " + "gate" not in smoke
    assert "from the same " + "checkout" not in smoke
    assert "data/monitor.pid" in smoke


def test_github_release_template_requires_assets_checksums_and_warning():
    template = _read("infra/github-release-template.md")

    assert "Detox <version>" in template
    assert "Detox-<version>.dmg" in template
    assert "Detox-<version>.app.zip" in template
    assert "SHA256" in template
    assert "This GitHub release is unsigned" in template
    assert "Open Anyway" in template
    assert "Verification" not in template
    assert "Before publishing" not in template
    assert "release blocker" not in template.lower()
    assert "publish " + "gate" not in template


def test_bundled_launcher_supports_pairing_cli_command():
    launcher = _read("infra/build/launcher.py")

    assert '"--pair"' in launcher
    assert "agent.cli.pair" in launcher


def test_pair_page_points_installed_users_to_menubar_pairing():
    pair_page = _read("web/pair.html")

    assert "Detox menu bar" in pair_page
    assert "Pair this device" in pair_page
    assert "python3 -m agent.cli.pair" in pair_page


def test_market_uses_generated_icons_without_legacy_sprite_dependencies():
    market_js = _read("web/js/market.js")
    residents_js = _read("web/js/residents.js")
    residents_css = _read("web/css/residents.css")

    assert "sti" + "tch/" not in market_js
    assert "items/${name}.jpg" not in market_js
    assert "asset(`residents/" not in market_js
    assert "${this.ASSET_BASE}/residents" not in market_js
    assert "characters.png" not in market_js
    assert "/assets/sprites/residents" not in market_js
    assert "/assets/market/pixel/residents" not in residents_js
    assert "world__resident-sprite" not in residents_js
    assert "world__resident-sprite" not in residents_css


def test_focus_mode_banner_uses_dawn_cove_pixel_theme():
    css = _read("web/css/style.css")
    banner_rule = _css_rule(css, ".focus-mode-banner")
    button_rule = _css_rule(css, ".focus-exit-btn")

    assert "border-left" not in banner_rule
    assert "border-radius" not in banner_rule
    assert "var(--dc-parchment)" in banner_rule
    assert "var(--dc-ink)" in banner_rule
    assert "var(--dc-danger)" in button_rule
    assert "color: white" not in button_rule


def test_isle_editor_does_not_overlap_datebar_and_buildings_have_hitboxes():
    css = _read("web/css/isle.css")
    world_js = _read("web/js/world.js")
    start = css.index(".isle__editor {\n    top:")
    editor_rule = css[start : css.index("}", start) + 1]

    assert "54px" not in editor_rule
    assert "72px" in editor_rule
    assert "world__building-hitbox" in world_js
    assert 'pointer-events="all"' in world_js


def test_build_readme_documents_github_release_command():
    readme = _read("infra/build/README.md")

    assert "./github_release.sh 0.1.0" in readme
    assert "Detox-0.1.0.dmg" in readme
    assert "Detox-0.1.0.app.zip" in readme
    assert "infra/github-release-template.md" in readme


def test_unsigned_github_release_omits_sparkle_framework():
    setup = _read("infra/build/setup.py")
    script = _read("infra/build/github_release.sh")
    preview = _read("infra/build/preview.sh")

    assert "DETOX_INCLUDE_SPARKLE" in setup
    assert "SPARKLE_FRAMEWORKS" in setup
    assert "DETOX_INCLUDE_SPARKLE=0" in script
    assert "DETOX_INCLUDE_SPARKLE=0" in preview
    assert "codesign --force --deep --sign -" in script
    assert "codesign --force --deep --sign -" in preview


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


def test_py2app_setup_disables_unused_tk_recipe_for_preview_builds():
    setup = _read("infra/build/setup.py")

    assert "_disable_py2app_tkinter_recipe()" in setup
    assert '"tkinter"' in setup
    assert '"_tkinter"' in setup
    assert '"PIL.ImageTk"' in setup
    assert '"PIL._tkinter_finder"' in setup


def test_py2app_setup_excludes_test_modules_from_preview_bundle():
    setup = _read("infra/build/setup.py")

    assert '"agent.tests"' in setup
    assert '"pytest"' in setup
    assert '"_pytest"' in setup


def test_py2app_setup_preserves_web_asset_subdirectories():
    setup = _read("infra/build/setup.py")

    assert "WEB_SOURCE_DIR" in setup
    assert "relative_to(WEB_SOURCE_DIR)" in setup
    assert "web_data_files" in setup


def test_py2app_setup_packages_policy_docs_for_bundled_settings_links():
    setup = _read("infra/build/setup.py")

    assert "DOCS_SOURCE_DIR" in setup
    assert "docs_data_files" in setup
    assert '"docs/privacy.md"' in setup
    assert '"docs/terms.md"' in setup


def test_preview_and_release_build_scripts_prune_agent_tests_from_bundle():
    preview = _read("infra/build/preview.sh")
    release = _read("infra/build/build.sh")

    for script in (preview, release):
        assert "prune_bundle_dev_artifacts" in script
        assert 'rm -rf "$APP/Contents/Resources/lib/python3.11/agent/tests"' in script


def test_preview_and_release_build_scripts_render_versioned_info_plist():
    template = _read("infra/build/Info.plist.tmpl")
    preview = _read("infra/build/preview.sh")
    release = _read("infra/build/build.sh")

    assert "<string>__VERSION__</string>" in template
    assert "<string>__BUILD__</string>" in template
    for script in (preview, release):
        assert "render_info_plist" in script
        assert "__VERSION__" in script
        assert "__BUILD__" in script


def test_agent_default_version_matches_api_package_version():
    config = _read("agent/config.py")
    api_project = tomllib.loads(_read("api/pyproject.toml"))
    expected = api_project["project"]["version"]

    assert f'APP_VERSION = os.environ.get("DETOX_APP_VERSION", "{expected}")' in config


def test_mobile_isle_layout_stacks_overlays_below_hud():
    css = _read("web/css/isle.css")
    mobile = css.split("@media (max-width: 760px)", 1)[1].split("/* ── Buildings", 1)[0]

    isle_rule = _css_rule(mobile, ".isle")
    stage_rule = _css_rule(mobile, ".isle__stage")
    assert "height: auto" in isle_rule
    assert "overflow: visible" in isle_rule
    assert "height: clamp(320px, 72vw, 460px)" in stage_rule
    for selector in (".isle__datebar", ".isle__weather-badge", ".isle__signboards"):
        assert "position: static" in _css_rule(mobile, selector)


def test_mobile_compass_toggle_sits_below_isle_weather_badge():
    css = _read("web/css/compass.css")
    mobile = css.split("@media (max-width: 760px)", 1)[1]
    toggle_rule = _css_rule(mobile, ".compass-toggle")

    assert "top: calc(var(--hud-top-h) + 160px)" in toggle_rule
