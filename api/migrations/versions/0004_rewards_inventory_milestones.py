"""rewards balances, inventory, and milestones

Phase 4 / spec §8: server-authoritative reward economy.

* ``rewards_balances`` is a per-user single-row rollup the agent reads to
  paint its HUD. The cloud is the source of truth — the agent never writes
  here.
* ``inventory`` records owned market items. Refunds set ``refunded`` so a
  partial unique index can keep "one active copy per user per item" without
  blocking re-purchase after a refund.
* ``milestones`` is the Hall-of-Honor projection (``streak_day``,
  ``clean_week``, ``milestone``) — semantically the same dimension as
  ``rewards_awards`` but materialised so reads don't have to fold the
  ledger every page load.

The existing ``rewards_ledger`` and ``rewards_awards`` tables stay; they're
the append-only source events these tables roll up from.

Revision ID: 0004_rewards_inventory_milestones
Revises: 0003_devices_pairing_and_ingest_idempotency
Create Date: 2026-05-05
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0004_rewards_inventory_milestones"
down_revision = "0003_devices_pairing_and_ingest_idempotency"
branch_labels = None
depends_on = None


_RLS_TABLES = ("rewards_balances", "inventory", "milestones")


def upgrade() -> None:
    op.create_table(
        "rewards_balances",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
        ),
        sa.Column(
            "sunlight_total",
            sa.Integer,
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "starshards_total",
            sa.Integer,
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "daily_earned",
            sa.Integer,
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("daily_earn_date", sa.Date),
        sa.Column("last_earn_at", sa.TIMESTAMP(timezone=True)),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_rewards_balances_user_id",
            ondelete="CASCADE",
        ),
        sa.CheckConstraint(
            "sunlight_total >= 0 AND starshards_total >= 0 AND daily_earned >= 0",
            name="ck_rewards_balances_nonnegative",
        ),
    )

    op.create_table(
        "inventory",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("item_key", sa.Text, nullable=False),
        sa.Column("currency", sa.Text, nullable=False),
        sa.Column("price", sa.Integer, nullable=False),
        sa.Column(
            "acquired_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "refunded",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("refunded_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("refund_amount", sa.Integer),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_inventory_user_id",
            ondelete="CASCADE",
        ),
        sa.CheckConstraint(
            "currency IN ('sunlight', 'starshard')",
            name="ck_inventory_currency",
        ),
        sa.CheckConstraint(
            "price >= 0",
            name="ck_inventory_price_nonnegative",
        ),
    )
    op.create_index("idx_inventory_user", "inventory", ["user_id"])
    op.create_index(
        "idx_inventory_user_active",
        "inventory",
        ["user_id", "item_key"],
        postgresql_where=sa.text("refunded = false"),
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_inventory_user_item_active
            ON inventory (user_id, item_key)
            WHERE refunded = false
        """
    )

    op.create_table(
        "milestones",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("kind", sa.Text, nullable=False),
        sa.Column("detail", sa.Text, nullable=False),
        sa.Column(
            "currency",
            sa.Text,
            nullable=False,
            server_default="starshard",
        ),
        sa.Column(
            "amount",
            sa.Integer,
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("awarded_for_date", sa.Text, nullable=False),
        sa.Column(
            "awarded_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_milestones_user_id",
            ondelete="CASCADE",
        ),
        sa.CheckConstraint(
            "kind IN ('streak_day', 'clean_week', 'milestone')",
            name="ck_milestones_kind",
        ),
        sa.UniqueConstraint(
            "user_id",
            "kind",
            "detail",
            "awarded_for_date",
            name="uq_milestones_user_kind_detail_date",
        ),
    )
    op.create_index(
        "idx_milestones_user_awarded_at",
        "milestones",
        ["user_id", "awarded_at"],
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

    op.drop_index("idx_milestones_user_awarded_at", table_name="milestones")
    op.drop_table("milestones")

    op.execute("DROP INDEX IF EXISTS uq_inventory_user_item_active")
    op.drop_index("idx_inventory_user_active", table_name="inventory")
    op.drop_index("idx_inventory_user", table_name="inventory")
    op.drop_table("inventory")

    op.drop_table("rewards_balances")
