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
