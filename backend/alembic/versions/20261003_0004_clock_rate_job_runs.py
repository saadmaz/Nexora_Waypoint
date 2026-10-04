"""the scenario clock ticks: anchor and rate, and a record of the jobs that ran

The clock row used to hold a fixed time that only moved when the presenter advanced it. It now holds an anchor
(a scenario time and the wall time it was set) and a rate, so scenario time keeps moving between presenter jumps and
can be paused. job_runs makes each timed job run exactly once.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-03 22:00:00.000000
"""
import sqlalchemy as sa
from alembic import op

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('clock', 'scenario_now', new_column_name='anchor_scenario')
    op.add_column('clock', sa.Column('anchor_wall', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.add_column('clock', sa.Column('rate', sa.Float(), server_default='1', nullable=False))
    op.alter_column('clock', 'anchor_wall', server_default=None)
    op.alter_column('clock', 'rate', server_default=None)
    op.create_table(
        'job_runs',
        sa.Column('key', sa.Text(), nullable=False),
        sa.Column('ran_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('key', name=op.f('pk_job_runs')),
    )


def downgrade() -> None:
    op.drop_table('job_runs')
    op.drop_column('clock', 'rate')
    op.drop_column('clock', 'anchor_wall')
    op.alter_column('clock', 'anchor_scenario', new_column_name='scenario_now')
