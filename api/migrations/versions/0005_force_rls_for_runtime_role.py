"""force RLS for runtime role

Revision ID: 0005_force_rls_for_runtime_role
Revises: 0004_rewards_inventory_milestones
Create Date: 2026-05-11
"""

from __future__ import annotations

from alembic import op


revision = "0005_force_rls_for_runtime_role"
down_revision = "0004_rewards_inventory_milestones"
branch_labels = None
depends_on = None


_RLS_TABLES = (
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
    "devices",
    "rewards_balances",
    "inventory",
    "milestones",
)


def upgrade() -> None:
    for table in _RLS_TABLES:
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")


def downgrade() -> None:
    for table in _RLS_TABLES:
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
