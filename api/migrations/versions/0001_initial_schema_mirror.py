"""initial schema mirroring SQLite

Phase 2 / spec §8: faithful Postgres rendering of the ten on-device SQLite
tables (`app_usage`, `sessions`, `pickups`, `app_categories`, `goals`,
`app_blocks`, `category_blocks`, `settings`, `rewards_ledger`,
`rewards_awards`). Multi-tenancy (``user_id`` columns + RLS) lands in a
follow-up migration so this revision matches today's local agent shape.

Revision ID: 0001_initial_schema_mirror
Revises:
Create Date: 2026-04-28
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0001_initial_schema_mirror"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "app_usage",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("app_name", sa.Text, nullable=False),
        sa.Column("timestamp", sa.Float, nullable=False),
        sa.Column("date", sa.Text, nullable=False),
    )
    op.create_index("idx_app_usage_date", "app_usage", ["date"])
    op.create_index("idx_app_usage_app_date", "app_usage", ["app_name", "date"])

    op.create_table(
        "sessions",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("app_name", sa.Text, nullable=False),
        sa.Column("start_time", sa.Float, nullable=False),
        sa.Column("end_time", sa.Float, nullable=False),
        sa.Column("duration_seconds", sa.Float, nullable=False),
        sa.Column("date", sa.Text, nullable=False),
    )
    op.create_index("idx_sessions_date", "sessions", ["date"])
    op.create_index("idx_sessions_app_date", "sessions", ["app_name", "date"])

    op.create_table(
        "pickups",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("timestamp", sa.Float, nullable=False),
        sa.Column("date", sa.Text, nullable=False),
    )
    op.create_index("idx_pickups_date", "pickups", ["date"])

    op.create_table(
        "app_categories",
        sa.Column("app_name", sa.Text, primary_key=True),
        sa.Column(
            "category",
            sa.Text,
            nullable=False,
            server_default="Uncategorized",
        ),
    )

    op.create_table(
        "goals",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("type", sa.Text, nullable=False),
        sa.Column("target_minutes", sa.Integer),
        sa.Column("app_name", sa.Text),
        sa.Column("bedtime_hour", sa.Integer),
        sa.Column("bedtime_minute", sa.Integer),
        sa.Column("active", sa.Integer, server_default=sa.text("1")),
    )

    op.create_table(
        "app_blocks",
        sa.Column("app_name", sa.Text, primary_key=True),
        sa.Column(
            "block_type",
            sa.Text,
            nullable=False,
            server_default="blocked",
        ),
        sa.Column("daily_limit_minutes", sa.Integer),
    )

    op.create_table(
        "category_blocks",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("category_name", sa.Text, nullable=False, unique=True),
        sa.Column(
            "active",
            sa.Integer,
            nullable=False,
            server_default=sa.text("1"),
        ),
    )
    op.create_index("idx_category_blocks_active", "category_blocks", ["active"])

    op.create_table(
        "settings",
        sa.Column("key", sa.Text, primary_key=True),
        sa.Column("value", sa.Text),
    )

    op.create_table(
        "rewards_ledger",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("kind", sa.Text, nullable=False),
        sa.Column("currency", sa.Text, nullable=False),
        sa.Column("amount", sa.Integer, nullable=False),
        sa.Column("item_key", sa.Text, nullable=False),
        sa.Column("spend_id", sa.BigInteger),
        sa.Column("created_at", sa.Float, nullable=False),
        sa.CheckConstraint(
            "kind IN ('spend', 'refund')",
            name="ck_rewards_ledger_kind",
        ),
        sa.CheckConstraint(
            "currency IN ('sunlight', 'starshard')",
            name="ck_rewards_ledger_currency",
        ),
        sa.ForeignKeyConstraint(
            ["spend_id"],
            ["rewards_ledger.id"],
            name="fk_rewards_ledger_spend_id",
        ),
    )
    op.create_index("idx_rewards_ledger_kind", "rewards_ledger", ["kind"])
    op.create_index("idx_rewards_ledger_item", "rewards_ledger", ["item_key"])

    op.create_table(
        "rewards_awards",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("kind", sa.Text, nullable=False),
        sa.Column("detail", sa.Text, nullable=False),
        sa.Column(
            "currency",
            sa.Text,
            nullable=False,
            server_default="starshard",
        ),
        sa.Column("amount", sa.Integer, nullable=False),
        sa.Column("awarded_for_date", sa.Text, nullable=False),
        sa.Column("awarded_at", sa.Float, nullable=False),
        sa.CheckConstraint(
            "kind IN ('streak_day', 'clean_week', 'milestone')",
            name="ck_rewards_awards_kind",
        ),
        sa.UniqueConstraint(
            "kind",
            "detail",
            "awarded_for_date",
            name="uq_rewards_awards_kind_detail_date",
        ),
    )
    op.create_index(
        "idx_rewards_awards_date",
        "rewards_awards",
        ["awarded_for_date"],
    )


def downgrade() -> None:
    op.drop_index("idx_rewards_awards_date", table_name="rewards_awards")
    op.drop_table("rewards_awards")
    op.drop_index("idx_rewards_ledger_item", table_name="rewards_ledger")
    op.drop_index("idx_rewards_ledger_kind", table_name="rewards_ledger")
    op.drop_table("rewards_ledger")
    op.drop_table("settings")
    op.drop_index("idx_category_blocks_active", table_name="category_blocks")
    op.drop_table("category_blocks")
    op.drop_table("app_blocks")
    op.drop_table("goals")
    op.drop_table("app_categories")
    op.drop_index("idx_pickups_date", table_name="pickups")
    op.drop_table("pickups")
    op.drop_index("idx_sessions_app_date", table_name="sessions")
    op.drop_index("idx_sessions_date", table_name="sessions")
    op.drop_table("sessions")
    op.drop_index("idx_app_usage_app_date", table_name="app_usage")
    op.drop_index("idx_app_usage_date", table_name="app_usage")
    op.drop_table("app_usage")
