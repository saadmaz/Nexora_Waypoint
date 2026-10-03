"""v3 data model alignment

Development-only transition from an empty 0001 schema. Recreate old PG16 volumes
before upgrading. No production backfill is intended. Downgrade discards operational
rows whose old representation cannot be recovered; reference data stays intact.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-03 13:44:46.993182
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('demand_forecasts',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('depot_id', sa.Text(), nullable=False),
    sa.Column('brand', sa.Enum('Fresh', 'Style', 'Tech', name='brand', native_enum=False, create_constraint=False, length=32), nullable=False),
    sa.Column('iso_year', sa.Integer(), nullable=False),
    sa.Column('iso_week', sa.Integer(), nullable=False),
    sa.Column('total_volume_m3', sa.Float(), nullable=False),
    sa.Column('chilled_volume_m3', sa.Float(), nullable=False),
    sa.Column('model_version', sa.Text(), nullable=False),
    sa.Column('generated_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("brand IN ('Fresh', 'Style', 'Tech')", name=op.f('ck_demand_forecasts_brand')),
    sa.CheckConstraint("brand = 'Fresh' OR chilled_volume_m3 = 0", name=op.f('ck_demand_forecasts_chilled_brand')),
    sa.ForeignKeyConstraint(['depot_id'], ['depots.id'], name=op.f('fk_demand_forecasts_depot_id_depots')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_demand_forecasts'))
    )
    op.create_index(op.f('ix_demand_forecasts_depot_id'), 'demand_forecasts', ['depot_id'], unique=False)
    op.create_table('road_conditions',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('service_date', sa.Date(), nullable=False),
    sa.Column('district', sa.Text(), nullable=False),
    sa.Column('kind', sa.Text(), nullable=False),
    sa.Column('delay_factor', sa.Float(), nullable=False),
    sa.Column('note', sa.Text(), nullable=True),
    sa.CheckConstraint("kind IN ('roadworks', 'flooding', 'incident')", name=op.f('ck_road_conditions_road_kind')),
    sa.ForeignKeyConstraint(['district'], ['districts.name'], name=op.f('fk_road_conditions_district_districts')),
    sa.ForeignKeyConstraint(['service_date'], ['calendar_days.date'], name=op.f('fk_road_conditions_service_date_calendar_days')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_road_conditions'))
    )
    op.create_index(op.f('ix_road_conditions_district'), 'road_conditions', ['district'], unique=False)
    op.create_index(op.f('ix_road_conditions_service_date'), 'road_conditions', ['service_date'], unique=False)
    op.create_table('notice_reads',
    sa.Column('notice_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('read_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['notice_id'], ['notices.id'], name=op.f('fk_notice_reads_notice_id_notices')),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_notice_reads_user_id_users')),
    sa.PrimaryKeyConstraint('notice_id', 'user_id', name=op.f('pk_notice_reads'))
    )
    op.create_table('conflict_orders',
    sa.Column('conflict_id', sa.Integer(), nullable=False),
    sa.Column('order_id', sa.Text(), nullable=False),
    sa.ForeignKeyConstraint(['conflict_id'], ['conflicts.id'], name=op.f('fk_conflict_orders_conflict_id_conflicts')),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], name=op.f('fk_conflict_orders_order_id_orders')),
    sa.PrimaryKeyConstraint('conflict_id', 'order_id', name=op.f('pk_conflict_orders'))
    )
    op.create_index(op.f('ix_conflict_orders_order_id'), 'conflict_orders', ['order_id'], unique=False)
    op.create_table('device_record_orders',
    sa.Column('client_id', sa.UUID(), nullable=False),
    sa.Column('order_id', sa.Text(), nullable=False),
    sa.ForeignKeyConstraint(['client_id'], ['device_records.client_id'], name=op.f('fk_device_record_orders_client_id_device_records')),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], name=op.f('fk_device_record_orders_order_id_orders')),
    sa.PrimaryKeyConstraint('client_id', 'order_id', name=op.f('pk_device_record_orders'))
    )
    op.create_index(op.f('ix_device_record_orders_order_id'), 'device_record_orders', ['order_id'], unique=False)
    op.create_table('exception_orders',
    sa.Column('exception_id', sa.Integer(), nullable=False),
    sa.Column('order_id', sa.Text(), nullable=False),
    sa.Column('units_short', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['exception_id'], ['exceptions.id'], name=op.f('fk_exception_orders_exception_id_exceptions')),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], name=op.f('fk_exception_orders_order_id_orders')),
    sa.PrimaryKeyConstraint('exception_id', 'order_id', name=op.f('pk_exception_orders'))
    )
    op.create_index(op.f('ix_exception_orders_order_id'), 'exception_orders', ['order_id'], unique=False)
    op.add_column('acknowledgements', sa.Column('pin_person_id', sa.Integer(), nullable=True))
    op.add_column('acknowledgements', sa.Column('depot_id', sa.Text(), nullable=True))
    op.add_column('acknowledgements', sa.Column('driver_vehicle_id', sa.Text(), nullable=True))
    op.drop_constraint(op.f('fk_acknowledgements_vehicle_id_vehicles'), 'acknowledgements', type_='foreignkey')
    op.drop_constraint(op.f('fk_acknowledgements_dock_depots'), 'acknowledgements', type_='foreignkey')
    op.create_foreign_key(op.f('fk_acknowledgements_driver_vehicle_id_drivers'), 'acknowledgements', 'drivers', ['driver_vehicle_id'], ['vehicle_id'])
    op.create_foreign_key(op.f('fk_acknowledgements_depot_id_depots'), 'acknowledgements', 'depots', ['depot_id'], ['id'])
    op.create_foreign_key(op.f('fk_acknowledgements_pin_person_id_pin_people'), 'acknowledgements', 'pin_people', ['pin_person_id'], ['id'])
    op.drop_column('acknowledgements', 'dock')
    op.drop_column('acknowledgements', 'actor_id')
    op.drop_column('acknowledgements', 'vehicle_id')
    op.add_column('audit_events', sa.Column('actor_user_id', sa.Integer(), nullable=True))
    op.add_column('audit_events', sa.Column('actor_pin_id', sa.Integer(), nullable=True))
    op.add_column('audit_events', sa.Column('order_id', sa.Text(), nullable=True))
    op.create_index(op.f('ix_audit_events_order_id'), 'audit_events', ['order_id'], unique=False)
    op.create_foreign_key(op.f('fk_audit_events_actor_pin_id_pin_people'), 'audit_events', 'pin_people', ['actor_pin_id'], ['id'])
    op.create_foreign_key(op.f('fk_audit_events_order_id_orders'), 'audit_events', 'orders', ['order_id'], ['id'])
    op.create_foreign_key(op.f('fk_audit_events_actor_user_id_users'), 'audit_events', 'users', ['actor_user_id'], ['id'])
    op.add_column('conflicts', sa.Column('resolved_by_user_id', sa.Integer(), nullable=True))
    op.create_foreign_key(op.f('fk_conflicts_resolved_by_user_id_users'), 'conflicts', 'users', ['resolved_by_user_id'], ['id'])
    op.drop_column('conflicts', 'order_ids')
    op.drop_column('conflicts', 'device_record_ids')
    op.add_column('deferrals', sa.Column('decided_by_user_id', sa.Integer(), nullable=True))
    op.create_foreign_key(op.f('fk_deferrals_decided_by_user_id_users'), 'deferrals', 'users', ['decided_by_user_id'], ['id'])
    op.add_column('device_records', sa.Column('trip_id', sa.Integer(), nullable=True))
    op.create_foreign_key(op.f('fk_device_records_trip_id_trips'), 'device_records', 'trips', ['trip_id'], ['id'])
    op.drop_column('device_records', 'order_ids')
    op.drop_column('device_records', 'trip_no')
    op.create_unique_constraint('uq_districts_name_depot_id', 'districts', ['name', 'depot_id'])
    op.create_unique_constraint(op.f('uq_drivers_user_id'), 'drivers', ['user_id'])
    op.add_column('exceptions', sa.Column('raised_by_user_id', sa.Integer(), nullable=True))
    op.add_column('exceptions', sa.Column('raised_by_pin_id', sa.Integer(), nullable=True))
    op.add_column('exceptions', sa.Column('decided_by_user_id', sa.Integer(), nullable=True))
    op.create_foreign_key(op.f('fk_exceptions_decided_by_user_id_users'), 'exceptions', 'users', ['decided_by_user_id'], ['id'])
    op.create_foreign_key(op.f('fk_exceptions_raised_by_pin_id_pin_people'), 'exceptions', 'pin_people', ['raised_by_pin_id'], ['id'])
    op.create_foreign_key(op.f('fk_exceptions_raised_by_user_id_users'), 'exceptions', 'users', ['raised_by_user_id'], ['id'])
    op.drop_column('exceptions', 'order_ids')
    op.drop_column('exceptions', 'units_short')
    op.create_foreign_key(op.f('fk_load_checks_client_id_device_records'), 'load_checks', 'device_records', ['client_id'], ['client_id'])
    op.add_column('notices', sa.Column('audience_kind', sa.Enum('store', 'driver', 'dock', 'dispatcher', name='audience_kind', native_enum=False, create_constraint=False, length=32), nullable=False))
    op.add_column('notices', sa.Column('outlet_id', sa.Text(), nullable=True))
    op.add_column('notices', sa.Column('vehicle_id', sa.Text(), nullable=True))
    op.add_column('notices', sa.Column('depot_id', sa.Text(), nullable=True))
    op.drop_index(op.f('ix_notices_audience'), table_name='notices')
    op.create_index(op.f('ix_notices_audience_kind'), 'notices', ['audience_kind'], unique=False)
    op.create_index(op.f('ix_notices_depot_id'), 'notices', ['depot_id'], unique=False)
    op.create_index(op.f('ix_notices_outlet_id'), 'notices', ['outlet_id'], unique=False)
    op.create_index(op.f('ix_notices_vehicle_id'), 'notices', ['vehicle_id'], unique=False)
    op.create_foreign_key(op.f('fk_notices_vehicle_id_vehicles'), 'notices', 'vehicles', ['vehicle_id'], ['id'])
    op.create_foreign_key(op.f('fk_notices_outlet_id_outlets'), 'notices', 'outlets', ['outlet_id'], ['id'])
    op.create_foreign_key(op.f('fk_notices_depot_id_depots'), 'notices', 'depots', ['depot_id'], ['id'])
    op.drop_column('notices', 'read_at')
    op.drop_column('notices', 'audience')
    op.create_foreign_key(op.f('fk_orders_service_date_calendar_days'), 'orders', 'calendar_days', ['service_date'], ['date'])
    op.alter_column('outlet_service_history', 'time',
               existing_type=sa.TEXT(),
               type_=sa.Time(),
               postgresql_using="time::time",
               existing_nullable=True)
    op.create_foreign_key('fk_outlets_district_depot_id_districts', 'outlets', 'districts', ['district', 'depot_id'], ['name', 'depot_id'])
    op.alter_column('pin_people', 'dock', new_column_name='depot_id')
    op.drop_constraint(op.f('fk_pin_people_dock_depots'), 'pin_people', type_='foreignkey')
    op.create_foreign_key(op.f('fk_pin_people_depot_id_depots'), 'pin_people', 'depots', ['depot_id'], ['id'])
    op.create_foreign_key(op.f('fk_plan_versions_service_date_calendar_days'), 'plan_versions', 'calendar_days', ['service_date'], ['date'])
    op.create_unique_constraint(op.f('uq_runs_trip_id'), 'runs', ['trip_id'])
    op.drop_constraint(op.f('fk_runs_driver_id_drivers'), 'runs', type_='foreignkey')
    op.drop_constraint(op.f('fk_runs_vehicle_id_vehicles'), 'runs', type_='foreignkey')
    op.drop_column('runs', 'driver_id')
    op.drop_column('runs', 'vehicle_id')
    # The raw JSON shape has no key compatible with district x hour; start it empty.
    op.drop_table('traffic_speed')
    op.create_table('traffic_speed',
        sa.Column('district', sa.Text(), nullable=False),
        sa.Column('hour', sa.Integer(), nullable=False),
        sa.Column('speed_factor', sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(['district'], ['districts.name'], name=op.f('fk_traffic_speed_district_districts')),
        sa.PrimaryKeyConstraint('district', 'hour', name=op.f('pk_traffic_speed')),
    )
    # Must exist before trip_orders' composite FK is created.
    op.create_unique_constraint('uq_trips_id_plan_version_id', 'trips', ['id', 'plan_version_id'])
    op.create_check_constraint(op.f('ck_trips_trip_no'), 'trips', 'trip_no IN (1, 2)')
    op.drop_constraint(op.f('ck_exceptions_exception_kind'), 'exceptions', type_='check')
    op.create_check_constraint(op.f('ck_exceptions_exception_kind'), 'exceptions', "kind IN ('loader_shortfall', 'driver_problem', 'store_issue')")
    op.create_check_constraint(op.f('ck_notices_audience_kind'), 'notices', "audience_kind IN ('store', 'driver', 'dock', 'dispatcher')")
    op.add_column('trip_orders', sa.Column('plan_version_id', sa.Integer(), nullable=False))
    op.alter_column('trip_orders', 'handling_start', new_column_name='planned_handling_start')
    op.alter_column('trip_orders', 'handling_end', new_column_name='planned_handling_end')
    op.add_column('trip_orders', sa.Column('actual_arrival', sa.DateTime(timezone=True), nullable=True))
    op.add_column('trip_orders', sa.Column('actual_handling_end', sa.DateTime(timezone=True), nullable=True))
    op.add_column('trip_orders', sa.Column('outcome', sa.Enum('pending', 'delivered', 'partial', 'failed', name='stop_outcome', native_enum=False, create_constraint=False, length=32), server_default='pending', nullable=False))
    op.add_column('trip_orders', sa.Column('units_delivered', sa.Integer(), nullable=True))
    op.add_column('trip_orders', sa.Column('outcome_record_id', sa.UUID(), nullable=True))
    op.add_column('trip_orders', sa.Column('pod_attachment_id', sa.UUID(), nullable=True))
    op.create_unique_constraint(op.f('uq_trip_orders_plan_version_id'), 'trip_orders', ['plan_version_id', 'order_id'])
    op.create_foreign_key(op.f('fk_trip_orders_pod_attachment_id_attachments'), 'trip_orders', 'attachments', ['pod_attachment_id'], ['id'])
    op.create_foreign_key('fk_trip_orders_trip_plan_version_trips', 'trip_orders', 'trips', ['trip_id', 'plan_version_id'], ['id', 'plan_version_id'])
    op.create_foreign_key(op.f('fk_trip_orders_plan_version_id_plan_versions'), 'trip_orders', 'plan_versions', ['plan_version_id'], ['id'])
    op.create_foreign_key(op.f('fk_trip_orders_outcome_record_id_device_records'), 'trip_orders', 'device_records', ['outcome_record_id'], ['client_id'])
    op.drop_column('trip_orders', 'load_no')
    op.create_check_constraint(op.f('ck_trip_orders_stop_outcome'), 'trip_orders', "outcome IN ('pending', 'delivered', 'partial', 'failed')")


def downgrade() -> None:
    # This local-only downgrade intentionally discards operational data. No volume is touched.
    op.execute("TRUNCATE notice_reads, conflict_orders, exception_orders, device_record_orders, demand_forecasts, "
               "audit_events, notices, scenario_events, clock, receipts, conflicts, exceptions, attachments, "
               "device_records, runs, load_gates, load_checks, acknowledgements, trip_orders, trips, deferrals, "
               "plan_versions, fuel_ledger, vehicle_day_status, outlet_service_history, orders RESTART IDENTITY CASCADE")
    op.drop_constraint(op.f('ck_exceptions_exception_kind'), 'exceptions', type_='check')
    op.create_check_constraint(op.f('ck_exceptions_exception_kind'), 'exceptions', "kind IN ('loader_flag', 'driver_problem', 'store_issue')")
    op.alter_column('trip_orders', 'planned_handling_end', new_column_name='handling_end')
    op.add_column('trip_orders', sa.Column('load_no', sa.INTEGER(), autoincrement=False, nullable=False))
    op.alter_column('trip_orders', 'planned_handling_start', new_column_name='handling_start')
    op.drop_constraint(op.f('fk_trip_orders_outcome_record_id_device_records'), 'trip_orders', type_='foreignkey')
    op.drop_constraint(op.f('fk_trip_orders_plan_version_id_plan_versions'), 'trip_orders', type_='foreignkey')
    op.drop_constraint('fk_trip_orders_trip_plan_version_trips', 'trip_orders', type_='foreignkey')
    op.drop_constraint('uq_trips_id_plan_version_id', 'trips', type_='unique')
    op.drop_constraint(op.f('ck_trips_trip_no'), 'trips', type_='check')
    op.drop_constraint(op.f('ck_trip_orders_stop_outcome'), 'trip_orders', type_='check')
    op.drop_constraint(op.f('fk_trip_orders_pod_attachment_id_attachments'), 'trip_orders', type_='foreignkey')
    op.drop_constraint(op.f('uq_trip_orders_plan_version_id'), 'trip_orders', type_='unique')
    op.drop_column('trip_orders', 'pod_attachment_id')
    op.drop_column('trip_orders', 'outcome_record_id')
    op.drop_column('trip_orders', 'units_delivered')
    op.drop_column('trip_orders', 'outcome')
    op.drop_column('trip_orders', 'actual_handling_end')
    op.drop_column('trip_orders', 'actual_arrival')
    op.drop_column('trip_orders', 'plan_version_id')
    op.drop_table('traffic_speed')
    op.create_table('traffic_speed',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('service_date', sa.Date(), nullable=True),
        sa.Column('raw', postgresql.JSONB(), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_traffic_speed')),
    )
    op.add_column('runs', sa.Column('vehicle_id', sa.TEXT(), autoincrement=False, nullable=False))
    op.add_column('runs', sa.Column('driver_id', sa.TEXT(), autoincrement=False, nullable=True))
    op.create_foreign_key(op.f('fk_runs_vehicle_id_vehicles'), 'runs', 'vehicles', ['vehicle_id'], ['id'])
    op.create_foreign_key(op.f('fk_runs_driver_id_drivers'), 'runs', 'drivers', ['driver_id'], ['vehicle_id'])
    op.drop_constraint(op.f('uq_runs_trip_id'), 'runs', type_='unique')
    op.drop_constraint(op.f('fk_plan_versions_service_date_calendar_days'), 'plan_versions', type_='foreignkey')
    op.alter_column('pin_people', 'depot_id', new_column_name='dock')
    op.drop_constraint(op.f('fk_pin_people_depot_id_depots'), 'pin_people', type_='foreignkey')
    op.create_foreign_key(op.f('fk_pin_people_dock_depots'), 'pin_people', 'depots', ['dock'], ['id'])
    op.drop_constraint('fk_outlets_district_depot_id_districts', 'outlets', type_='foreignkey')
    op.alter_column('outlet_service_history', 'time',
               existing_type=sa.Time(),
               type_=sa.TEXT(),
               postgresql_using="time::text",
               existing_nullable=True)
    op.drop_constraint(op.f('fk_orders_service_date_calendar_days'), 'orders', type_='foreignkey')
    op.add_column('notices', sa.Column('audience', sa.TEXT(), autoincrement=False, nullable=False))
    op.add_column('notices', sa.Column('read_at', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True))
    op.drop_constraint(op.f('fk_notices_depot_id_depots'), 'notices', type_='foreignkey')
    op.drop_constraint(op.f('fk_notices_outlet_id_outlets'), 'notices', type_='foreignkey')
    op.drop_constraint(op.f('fk_notices_vehicle_id_vehicles'), 'notices', type_='foreignkey')
    op.drop_index(op.f('ix_notices_vehicle_id'), table_name='notices')
    op.drop_index(op.f('ix_notices_outlet_id'), table_name='notices')
    op.drop_index(op.f('ix_notices_depot_id'), table_name='notices')
    op.drop_index(op.f('ix_notices_audience_kind'), table_name='notices')
    op.create_index(op.f('ix_notices_audience'), 'notices', ['audience'], unique=False)
    op.drop_column('notices', 'depot_id')
    op.drop_column('notices', 'vehicle_id')
    op.drop_column('notices', 'outlet_id')
    op.drop_constraint(op.f('ck_notices_audience_kind'), 'notices', type_='check')
    op.drop_column('notices', 'audience_kind')
    op.drop_constraint(op.f('fk_load_checks_client_id_device_records'), 'load_checks', type_='foreignkey')
    op.add_column('exceptions', sa.Column('units_short', postgresql.JSONB(astext_type=sa.Text()), autoincrement=False, nullable=False))
    op.add_column('exceptions', sa.Column('order_ids', postgresql.ARRAY(sa.TEXT()), autoincrement=False, nullable=False))
    op.drop_constraint(op.f('fk_exceptions_raised_by_user_id_users'), 'exceptions', type_='foreignkey')
    op.drop_constraint(op.f('fk_exceptions_raised_by_pin_id_pin_people'), 'exceptions', type_='foreignkey')
    op.drop_constraint(op.f('fk_exceptions_decided_by_user_id_users'), 'exceptions', type_='foreignkey')
    op.drop_column('exceptions', 'decided_by_user_id')
    op.drop_column('exceptions', 'raised_by_pin_id')
    op.drop_column('exceptions', 'raised_by_user_id')
    op.drop_constraint(op.f('uq_drivers_user_id'), 'drivers', type_='unique')
    op.drop_constraint('uq_districts_name_depot_id', 'districts', type_='unique')
    op.add_column('device_records', sa.Column('trip_no', sa.INTEGER(), autoincrement=False, nullable=True))
    op.add_column('device_records', sa.Column('order_ids', postgresql.ARRAY(sa.TEXT()), autoincrement=False, nullable=False))
    op.drop_constraint(op.f('fk_device_records_trip_id_trips'), 'device_records', type_='foreignkey')
    op.drop_column('device_records', 'trip_id')
    op.drop_constraint(op.f('fk_deferrals_decided_by_user_id_users'), 'deferrals', type_='foreignkey')
    op.drop_column('deferrals', 'decided_by_user_id')
    op.add_column('conflicts', sa.Column('device_record_ids', postgresql.ARRAY(sa.TEXT()), autoincrement=False, nullable=False))
    op.add_column('conflicts', sa.Column('order_ids', postgresql.ARRAY(sa.TEXT()), autoincrement=False, nullable=False))
    op.drop_constraint(op.f('fk_conflicts_resolved_by_user_id_users'), 'conflicts', type_='foreignkey')
    op.drop_column('conflicts', 'resolved_by_user_id')
    op.drop_constraint(op.f('fk_audit_events_actor_user_id_users'), 'audit_events', type_='foreignkey')
    op.drop_constraint(op.f('fk_audit_events_order_id_orders'), 'audit_events', type_='foreignkey')
    op.drop_constraint(op.f('fk_audit_events_actor_pin_id_pin_people'), 'audit_events', type_='foreignkey')
    op.drop_index(op.f('ix_audit_events_order_id'), table_name='audit_events')
    op.drop_column('audit_events', 'order_id')
    op.drop_column('audit_events', 'actor_pin_id')
    op.drop_column('audit_events', 'actor_user_id')
    op.add_column('acknowledgements', sa.Column('vehicle_id', sa.TEXT(), autoincrement=False, nullable=True))
    op.add_column('acknowledgements', sa.Column('actor_id', sa.TEXT(), autoincrement=False, nullable=False))
    op.add_column('acknowledgements', sa.Column('dock', sa.TEXT(), autoincrement=False, nullable=True))
    op.drop_constraint(op.f('fk_acknowledgements_pin_person_id_pin_people'), 'acknowledgements', type_='foreignkey')
    op.drop_constraint(op.f('fk_acknowledgements_depot_id_depots'), 'acknowledgements', type_='foreignkey')
    op.drop_constraint(op.f('fk_acknowledgements_driver_vehicle_id_drivers'), 'acknowledgements', type_='foreignkey')
    op.create_foreign_key(op.f('fk_acknowledgements_dock_depots'), 'acknowledgements', 'depots', ['dock'], ['id'])
    op.create_foreign_key(op.f('fk_acknowledgements_vehicle_id_vehicles'), 'acknowledgements', 'vehicles', ['vehicle_id'], ['id'])
    op.drop_column('acknowledgements', 'driver_vehicle_id')
    op.drop_column('acknowledgements', 'depot_id')
    op.drop_column('acknowledgements', 'pin_person_id')
    op.drop_index(op.f('ix_exception_orders_order_id'), table_name='exception_orders')
    op.drop_table('exception_orders')
    op.drop_index(op.f('ix_device_record_orders_order_id'), table_name='device_record_orders')
    op.drop_table('device_record_orders')
    op.drop_index(op.f('ix_conflict_orders_order_id'), table_name='conflict_orders')
    op.drop_table('conflict_orders')
    op.drop_table('notice_reads')
    op.drop_index(op.f('ix_road_conditions_service_date'), table_name='road_conditions')
    op.drop_index(op.f('ix_road_conditions_district'), table_name='road_conditions')
    op.drop_table('road_conditions')
    op.drop_index(op.f('ix_demand_forecasts_depot_id'), table_name='demand_forecasts')
    op.drop_table('demand_forecasts')
