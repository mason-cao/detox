"""Coverage for the Postgres engine + RLS GUC plumbing.

The unit-level checks (UUID validation, SQLite no-op) run anywhere. The full
tenant-isolation contract requires a reachable Postgres exposed via
``DETOX_TEST_DATABASE_URL`` and is skipped otherwise; CI will pick it up
once the dev compose stack is wired into the runner.
"""

import os
import uuid

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from api.app.db import set_user_guc
from api.app.errors import ApiError


def _set_conn_user(conn, user_id: str) -> None:
    conn.execute(
        text("SELECT set_config('app.current_user_id', :user_id, true)"),
        {"user_id": user_id},
    )


def test_set_user_guc_rejects_non_uuid():
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    with Session(engine, future=True) as session:
        session.begin()
        with pytest.raises(ApiError):
            set_user_guc(session, "not-a-uuid")


def test_set_user_guc_noop_on_sqlite():
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    with Session(engine, future=True) as session:
        session.begin()
        # Should be a silent no-op on SQLite — no error, no rows changed.
        set_user_guc(session, str(uuid.uuid4()))


def test_set_user_guc_empty_user_id_is_noop():
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    with Session(engine, future=True) as session:
        session.begin()
        set_user_guc(session, "")


@pytest.mark.skipif(
    not os.getenv("DETOX_TEST_DATABASE_URL"),
    reason="DETOX_TEST_DATABASE_URL not set; skipping Postgres RLS isolation test",
)
def test_rls_isolates_tenants_on_postgres():
    """Two users insert blocks; each only sees their own under RLS."""
    url = os.environ["DETOX_TEST_DATABASE_URL"]
    engine = create_engine(url, future=True)

    user_a = str(uuid.uuid4())
    user_b = str(uuid.uuid4())

    # Seed users + one block each. Migrations and the table-owning role bypass
    # RLS, so we use the same role to bootstrap.
    with engine.begin() as conn:
        for uid in (user_a, user_b):
            conn.execute(
                text(
                    "INSERT INTO users (id, email, auth_provider) "
                    "VALUES (:id, :email, 'test') ON CONFLICT (id) DO NOTHING"
                ),
                {"id": uid, "email": f"{uid}@example.com"},
            )
        _set_conn_user(conn, user_a)
        conn.execute(
            text(
                "INSERT INTO app_blocks (user_id, app_name, block_type) "
                "VALUES (:uid, 'Slack', 'blocked') "
                "ON CONFLICT DO NOTHING"
            ),
            {"uid": user_a},
        )
        _set_conn_user(conn, user_b)
        conn.execute(
            text(
                "INSERT INTO app_blocks (user_id, app_name, block_type) "
                "VALUES (:uid, 'Twitter', 'blocked') "
                "ON CONFLICT DO NOTHING"
            ),
            {"uid": user_b},
        )

    # As user A, RLS must hide user B's row.
    with Session(engine, future=True) as session:
        session.begin()
        set_user_guc(session, user_a)
        rows = session.execute(text("SELECT app_name FROM app_blocks")).all()
        names = {row[0] for row in rows}
        assert "Slack" in names
        assert "Twitter" not in names
        session.commit()

    # As user B, the inverse.
    with Session(engine, future=True) as session:
        session.begin()
        set_user_guc(session, user_b)
        rows = session.execute(text("SELECT app_name FROM app_blocks")).all()
        names = {row[0] for row in rows}
        assert "Twitter" in names
        assert "Slack" not in names
        session.commit()
