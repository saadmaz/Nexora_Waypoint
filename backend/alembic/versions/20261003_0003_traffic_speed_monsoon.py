"""traffic_speed is keyed by monsoon as well as district and hour

The reference CSV has two rows for every district and hour, one for a monsoon day and one for any other day, so
(district, hour) cannot be the key: loading the real file failed with a duplicate key and stopped the API container.
Existing rows (there can be none: that load never completed) are kept as non-monsoon.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-03 20:00:00.000000
"""
import sqlalchemy as sa
from alembic import op

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('traffic_speed', sa.Column('monsoon', sa.Boolean(), server_default=sa.false(), nullable=False))
    op.drop_constraint(op.f('pk_traffic_speed'), 'traffic_speed', type_='primary')
    op.create_primary_key(op.f('pk_traffic_speed'), 'traffic_speed', ['district', 'hour', 'monsoon'])
    op.alter_column('traffic_speed', 'monsoon', server_default=None)


def downgrade() -> None:
    # Two rows share each (district, hour) once monsoon rows exist; keep the non-monsoon ones.
    op.execute("DELETE FROM traffic_speed WHERE monsoon")
    op.drop_constraint(op.f('pk_traffic_speed'), 'traffic_speed', type_='primary')
    op.create_primary_key(op.f('pk_traffic_speed'), 'traffic_speed', ['district', 'hour'])
    op.drop_column('traffic_speed', 'monsoon')
