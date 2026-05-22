"""device pairing + ingest idempotency

Phase 4 / spec §9 sync protocol:

* Adds ``device_pairings`` — short-lived 6-character claim codes the web
  issues so a Mac agent can pair without ever holding the user's Supabase
  session. Codes are stored as SHA-256 hashes; cleartext lives only in the
  HTTP response that returned them.
* Adds ``device_id`` to ``app_usage``, ``sessions``, and ``pickups`` so the
  cloud can attribute rows to the originating Mac and carry the agent's
  per-device idempotency keys.
* Adds partial unique indexes that enforce ``(user_id, device_id,
  timestamp/start_time, app_name)`` uniqueness *only when* ``device_id`` is
  set — historical Phase-2 rows ingested without a device stay legal.

Revision ID: 0003_devices_pairing_and_ingest_idempotency
Revises: 0002_user_scoping_and_rls
Create Date: 2026-05-04
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0003_devices_pairing_and_ingest_idempotency"
down_revision = "0002_user_scoping_and_rls"
branch_labels = None
depends_on = None


_INGEST_TABLES = ("app_usage", "sessions", "pickups")


def upgrade() -> None:
    op.alter_column(
        "alembic_version",
        "version_num",
        type_=sa.String(length=255),
        existing_type=sa.String(length=32),
        existing_nullable=False,
    )

    op.create_table(
        "device_pairings",
        sa.Column("code_hash", sa.Text, primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "expires_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "consumed_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "device_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_device_pairings_user_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["device_id"],
            ["devices.id"],
            name="fk_device_pairings_device_id",
            ondelete="SET NULL",
        ),
    )
    op.create_index(
        "idx_device_pairings_user", "device_pairings", ["user_id"]
    )
    op.create_index(
        "idx_device_pairings_expires_at",
        "device_pairings",
        ["expires_at"],
    )

    op.execute("ALTER TABLE device_pairings ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON device_pairings
            USING (
                user_id = current_setting('app.current_user_id', true)::uuid
            )
            WITH CHECK (
                user_id = current_setting('app.current_user_id', true)::uuid
            )
        """
    )

    for table in _INGEST_TABLES:
        op.add_column(
            table,
            sa.Column(
                "device_id",
                postgresql.UUID(as_uuid=True),
                nullable=True,
            ),
        )
        op.create_foreign_key(
            f"fk_{table}_device_id",
            table,
            "devices",
            ["device_id"],
            ["id"],
            ondelete="SET NULL",
        )
        op.create_index(
            f"idx_{table}_device", table, ["device_id"]
        )

    # Partial unique indexes — idempotency keys only apply once the row has
    # been attributed to a device. Phase-2 rows backfilled without device_id
    # are unaffected.
    op.execute(
        """
        CREATE UNIQUE INDEX uq_app_usage_idem
            ON app_usage (user_id, device_id, timestamp, app_name)
            WHERE device_id IS NOT NULL
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_sessions_idem
            ON sessions (user_id, device_id, start_time, app_name)
            WHERE device_id IS NOT NULL
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_pickups_idem
            ON pickups (user_id, device_id, timestamp)
            WHERE device_id IS NOT NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_pickups_idem")
    op.execute("DROP INDEX IF EXISTS uq_sessions_idem")
    op.execute("DROP INDEX IF EXISTS uq_app_usage_idem")

    for table in reversed(_INGEST_TABLES):
        op.drop_index(f"idx_{table}_device", table_name=table)
        op.drop_constraint(f"fk_{table}_device_id", table, type_="foreignkey")
        op.drop_column(table, "device_id")

    op.execute("DROP POLICY IF EXISTS tenant_isolation ON device_pairings")
    op.execute("ALTER TABLE device_pairings DISABLE ROW LEVEL SECURITY")
    op.drop_index(
        "idx_device_pairings_expires_at", table_name="device_pairings"
    )
    op.drop_index("idx_device_pairings_user", table_name="device_pairings")
    op.drop_table("device_pairings")
