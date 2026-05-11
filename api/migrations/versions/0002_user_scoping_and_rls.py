"""user scoping and row-level security

Phase 2 / spec §8: introduces tenant scoping for the cloud Postgres tier.

* Adds the ``users`` and ``devices`` tables described in spec §8.
* Adds a ``user_id`` foreign key to every existing user-data table
  (``app_usage``, ``sessions``, ``pickups``, ``app_categories``, ``goals``,
  ``app_blocks``, ``category_blocks``, ``settings``, ``rewards_ledger``,
  ``rewards_awards``).
* Re-keys tables that used a natural primary or unique key so the same
  string can be reused across tenants — ``app_categories.app_name``,
  ``app_blocks.app_name``, ``category_blocks.category_name``,
  ``settings.key``, and the ``rewards_awards`` award triple all become
  ``user_id``-prefixed.
* Enables row-level security on every per-user table with a
  ``tenant_isolation`` policy that filters on the
  ``app.current_user_id`` GUC. The application code sets this per
  request via ``SET LOCAL app.current_user_id = '<uuid>'``; migrations
  and the table owner bypass RLS by default, which keeps Alembic itself
  unaffected.

Revision ID: 0002_user_scoping_and_rls
Revises: 0001_initial_schema_mirror
Create Date: 2026-04-28
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0002_user_scoping_and_rls"
down_revision = "0001_initial_schema_mirror"
branch_labels = None
depends_on = None


_USER_TABLES = (
    "app_usage",
    "sessions",
    "pickups",
    "app_categories",
    "goals",
    "app_blocks",
    "category_blocks",
    "settings",
    "rewards_ledger",
    "rewards_awards",
)

_RLS_TABLES = _USER_TABLES + ("devices",)


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.create_table(
        "users",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("email", sa.Text, nullable=False, unique=True),
        sa.Column("auth_provider", sa.Text),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_table(
        "devices",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("device_name", sa.Text, nullable=False),
        sa.Column("last_sync_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("agent_version", sa.Text),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_devices_user_id",
            ondelete="CASCADE",
        ),
    )
    op.create_index("idx_devices_user", "devices", ["user_id"])

    for table in _USER_TABLES:
        op.add_column(
            table,
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                nullable=False,
            ),
        )
        op.create_foreign_key(
            f"fk_{table}_user_id",
            table,
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )
        op.create_index(f"idx_{table}_user", table, ["user_id"])

    op.drop_constraint("app_categories_pkey", "app_categories", type_="primary")
    op.create_primary_key(
        "pk_app_categories",
        "app_categories",
        ["user_id", "app_name"],
    )

    op.drop_constraint("app_blocks_pkey", "app_blocks", type_="primary")
    op.create_primary_key(
        "pk_app_blocks",
        "app_blocks",
        ["user_id", "app_name"],
    )

    op.drop_constraint(
        "category_blocks_category_name_key",
        "category_blocks",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_category_blocks_user_name",
        "category_blocks",
        ["user_id", "category_name"],
    )

    op.drop_constraint("settings_pkey", "settings", type_="primary")
    op.create_primary_key("pk_settings", "settings", ["user_id", "key"])

    op.drop_constraint(
        "uq_rewards_awards_kind_detail_date",
        "rewards_awards",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_rewards_awards_user_kind_detail_date",
        "rewards_awards",
        ["user_id", "kind", "detail", "awarded_for_date"],
    )

    for table in _RLS_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON {table}
                USING (
                    user_id = current_setting('app.current_user_id', true)::uuid
                )
                WITH CHECK (
                    user_id = current_setting('app.current_user_id', true)::uuid
                )
            """
        )


def downgrade() -> None:
    for table in _RLS_TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    op.drop_constraint(
        "uq_rewards_awards_user_kind_detail_date",
        "rewards_awards",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_rewards_awards_kind_detail_date",
        "rewards_awards",
        ["kind", "detail", "awarded_for_date"],
    )

    op.drop_constraint("pk_settings", "settings", type_="primary")
    op.create_primary_key("settings_pkey", "settings", ["key"])

    op.drop_constraint(
        "uq_category_blocks_user_name",
        "category_blocks",
        type_="unique",
    )
    op.create_unique_constraint(
        "category_blocks_category_name_key",
        "category_blocks",
        ["category_name"],
    )

    op.drop_constraint("pk_app_blocks", "app_blocks", type_="primary")
    op.create_primary_key("app_blocks_pkey", "app_blocks", ["app_name"])

    op.drop_constraint("pk_app_categories", "app_categories", type_="primary")
    op.create_primary_key("app_categories_pkey", "app_categories", ["app_name"])

    for table in _USER_TABLES:
        op.drop_index(f"idx_{table}_user", table_name=table)
        op.drop_constraint(f"fk_{table}_user_id", table, type_="foreignkey")
        op.drop_column(table, "user_id")

    op.drop_index("idx_devices_user", table_name="devices")
    op.drop_table("devices")
    op.drop_table("users")
