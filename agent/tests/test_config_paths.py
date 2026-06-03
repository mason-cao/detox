from agent import config


def test_resolve_web_dir_uses_source_web_dir_when_present(tmp_path):
    source_root = tmp_path / "detox"
    web_dir = source_root / "web"
    web_dir.mkdir(parents=True)

    assert config._resolve_web_dir(str(source_root)) == str(web_dir)


def test_resolve_web_dir_uses_py2app_resource_web_dir_when_present(tmp_path):
    resources = tmp_path / "Detox.app" / "Contents" / "Resources"
    bundle_base = resources / "lib" / "python3.11"
    bundle_web = resources / "web"
    bundle_base.mkdir(parents=True)
    bundle_web.mkdir(parents=True)

    assert config._resolve_web_dir(str(bundle_base)) == str(bundle_web)


def test_resolve_docs_dir_uses_source_docs_dir_when_present(tmp_path):
    source_root = tmp_path / "detox"
    docs_dir = source_root / "docs"
    docs_dir.mkdir(parents=True)

    assert config._resolve_docs_dir(str(source_root)) == str(docs_dir)


def test_resolve_docs_dir_uses_py2app_resource_docs_dir_when_present(tmp_path):
    resources = tmp_path / "Detox.app" / "Contents" / "Resources"
    bundle_base = resources / "lib" / "python3.11"
    bundle_docs = resources / "docs"
    bundle_base.mkdir(parents=True)
    bundle_docs.mkdir(parents=True)

    assert config._resolve_docs_dir(str(bundle_base)) == str(bundle_docs)


def test_resolve_data_dir_uses_source_data_dir_when_not_frozen(tmp_path):
    source_root = tmp_path / "detox"

    assert config._resolve_data_dir(
        str(source_root),
        frozen=False,
    ) == str(source_root / "data")


def test_resolve_data_dir_uses_application_support_when_frozen(tmp_path):
    home_dir = tmp_path / "home"

    assert config._resolve_data_dir(
        "/irrelevant/app/resources",
        frozen=True,
        home_dir=str(home_dir),
    ) == str(home_dir / "Library" / "Application Support" / "Detox")
