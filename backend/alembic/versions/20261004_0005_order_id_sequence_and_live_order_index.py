"""order ids come from a sequence, and one live order per outlet, day and kind is enforced by the database

Two stores placing an order in the same moment both read ``max(id) + 1`` and both tried to insert ORD3001: one got a
primary key violation, which surfaced as a 500. Order ids now come from a sequence, so two concurrent placements take
different ids without talking to each other.

The "already ordered" check had the same shape: both transactions saw no existing order and both inserted one, leaving
the outlet with two live chilled orders for one day, which the planner then tried to place separately. A partial unique
index makes that impossible and the service answers 409 ``already_ordered`` when the database refuses it.

The index covers the orders a store placed, not the seeded ones. One order per outlet, day and kind is a rule about
*ordering* (store_writes.place), and the generated day deliberately breaks it: SEED_GENERATED_ORDERS (A41) spreads 212
Peliyagoda orders over 49 outlets, so an outlet holds about four, which is what gives the planner a full day to pack.
Indexing those too would mean choosing between the race and that seed, so the predicate names the path that has the
rule. Seeded rows are written once, by one process, and cannot race.

The sequence starts above every id the seed uses (the reference set reaches ORD2xxx and the generated day ORD3xxx),
so neither a pinned scenario id nor a generated one can collide with an id handed out at runtime.

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-04 09:00:00.000000
"""
import sqlalchemy as sa
from alembic import op

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None

#: Above ORD3001 upward, which SEED_GENERATED_ORDERS uses (A41), with room to spare.
SEQUENCE_START = 9001


def upgrade() -> None:
    op.execute(sa.text(f'CREATE SEQUENCE order_id_seq START WITH {SEQUENCE_START}'))
    # Partial twice over: a cancelled order keeps its row and its id and must not block its replacement, and the
    # generated seed is exempt (see above).
    op.create_index(
        'uq_orders_live_outlet_day_temp',
        'orders',
        ['outlet_id', 'service_date', 'temp'],
        unique=True,
        postgresql_where=sa.text("cancelled_at IS NULL AND placed_by IS DISTINCT FROM 'seed'"),
    )


def downgrade() -> None:
    op.drop_index('uq_orders_live_outlet_day_temp', table_name='orders')
    op.execute(sa.text('DROP SEQUENCE order_id_seq'))
