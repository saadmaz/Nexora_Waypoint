"""orders can be frozen: the booklet's reefer rule covers chilled or frozen goods

``orders.temp`` is stored as text behind a CHECK constraint (non-native enum), so allowing a third value is a
constraint swap, not a type change. Existing rows are untouched.

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-04 18:00:00.000000
"""
from alembic import op

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(op.f('ck_orders_temp'), 'orders', type_='check')
    op.create_check_constraint(op.f('ck_orders_temp'), 'orders', "temp IN ('chilled', 'ambient', 'frozen')")


def downgrade() -> None:
    # A frozen order has no place in the old schema; downgrading with one present fails on purpose.
    op.drop_constraint(op.f('ck_orders_temp'), 'orders', type_='check')
    op.create_check_constraint(op.f('ck_orders_temp'), 'orders', "temp IN ('chilled', 'ambient')")
