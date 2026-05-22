"""Migration safety contracts that unit tests can check without Postgres."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_rls_migrations_force_row_level_security_for_table_owner_runtime():
    for path in sorted((ROOT / "api/migrations/versions").glob("*.py")):
        source = path.read_text()
        if "ENABLE ROW LEVEL SECURITY" not in source:
            continue
        if path.name == "0003_devices_pairing_and_ingest_idempotency.py":
            continue

        assert "FORCE ROW LEVEL SECURITY" in source, path.name
        assert "NO FORCE ROW LEVEL SECURITY" in source, path.name


def test_pairing_claim_table_is_not_forced_before_agent_has_user_scope():
    version_0003 = (
        ROOT / "api/migrations/versions/0003_devices_pairing_and_ingest_idempotency.py"
    ).read_text()
    version_0005 = (
        ROOT / "api/migrations/versions/0005_force_rls_for_runtime_role.py"
    ).read_text()

    assert "ALTER TABLE device_pairings FORCE ROW LEVEL SECURITY" not in version_0003
    assert '"device_pairings"' not in version_0005


def test_long_revision_migration_widens_alembic_version_table():
    version_0003 = (
        ROOT / "api/migrations/versions/0003_devices_pairing_and_ingest_idempotency.py"
    ).read_text()

    assert "alembic_version" in version_0003
    assert "version_num" in version_0003
    assert "sa.String(length=255)" in version_0003


def test_dev_compose_uses_non_bypass_runtime_role():
    compose = (ROOT / "infra/docker-compose.dev.yml").read_text()
    init_sql = (ROOT / "infra/postgres/init-runtime-role.sql").read_text()

    assert "POSTGRES_USER: detox_admin" in compose
    assert "POSTGRES_USER: detox\n" not in compose
    assert "init-runtime-role.sql" in compose
    assert "CREATE ROLE detox" in init_sql
    assert "NOSUPERUSER" in init_sql
    assert "NOBYPASSRLS" in init_sql
