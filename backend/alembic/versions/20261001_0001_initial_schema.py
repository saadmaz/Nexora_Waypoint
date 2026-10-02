"""initial schema: every PRD section 10 table

Reviewed by hand against a real PostgreSQL 16:
- Enum columns keep their CHECK constraint once (the explicit, convention-named one); autogenerate also
  rendered the type's own, which would have created each constraint twice.

Revision ID: 0001
Revises: 
Create Date: 2026-10-01 01:32:16.590634
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('audit_events',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('actor', sa.Text(), nullable=False),
    sa.Column('entity_type', sa.Text(), nullable=False),
    sa.Column('entity_id', sa.Text(), nullable=False),
    sa.Column('type', sa.Enum('ORDER_PLACED', 'ORDER_EDITED', 'ORDER_CANCELLED', 'CUTOFF_CLOSED', 'PLAN_DRAFTED', 'MOVE_ACCEPTED', 'MOVE_REFUSED', 'PLAN_RELEASED', 'PLAN_ACKNOWLEDGED', 'LOAD_CHECKED', 'LOAD_CONFIRMED', 'FLAG_RAISED', 'VEHICLE_SWAPPED', 'ORDER_DEFERRED', 'RUN_STARTED', 'ARRIVED', 'OUTCOME_RECORDED', 'SYNCED', 'CONFLICT_OPENED', 'CONFLICT_RESOLVED', 'RECEIPT_CONFIRMED', 'ISSUE_REPORTED', 'NOTICE_SEEN', 'CLOCK_ADVANCED', name='audit_type', native_enum=False, create_constraint=False, length=32), nullable=False),
    sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.CheckConstraint("type IN ('ORDER_PLACED', 'ORDER_EDITED', 'ORDER_CANCELLED', 'CUTOFF_CLOSED', 'PLAN_DRAFTED', 'MOVE_ACCEPTED', 'MOVE_REFUSED', 'PLAN_RELEASED', 'PLAN_ACKNOWLEDGED', 'LOAD_CHECKED', 'LOAD_CONFIRMED', 'FLAG_RAISED', 'VEHICLE_SWAPPED', 'ORDER_DEFERRED', 'RUN_STARTED', 'ARRIVED', 'OUTCOME_RECORDED', 'SYNCED', 'CONFLICT_OPENED', 'CONFLICT_RESOLVED', 'RECEIPT_CONFIRMED', 'ISSUE_REPORTED', 'NOTICE_SEEN', 'CLOCK_ADVANCED')", name=op.f('ck_audit_events_audit_type')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_audit_events'))
    )
    op.create_index(op.f('ix_audit_events_entity_id'), 'audit_events', ['entity_id'], unique=False)
    op.create_table('calendar_days',
    sa.Column('date', sa.Date(), nullable=False),
    sa.Column('dow', sa.Integer(), nullable=False),
    sa.Column('dow_name', sa.Text(), nullable=False),
    sa.Column('is_weekend', sa.Boolean(), nullable=False),
    sa.Column('iso_year', sa.Integer(), nullable=False),
    sa.Column('iso_week', sa.Integer(), nullable=False),
    sa.Column('is_payday', sa.Boolean(), nullable=False),
    sa.Column('festival', sa.Text(), nullable=True),
    sa.Column('festival_ramp', sa.Float(), nullable=False),
    sa.Column('is_holiday', sa.Boolean(), nullable=False),
    sa.Column('monsoon', sa.Boolean(), nullable=False),
    sa.Column('is_operating', sa.Boolean(), nullable=False),
    sa.PrimaryKeyConstraint('date', name=op.f('pk_calendar_days'))
    )
    op.create_table('clock',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('scenario_now', sa.DateTime(timezone=True), nullable=False),
    sa.Column('checkpoint', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint('id = 1', name=op.f('ck_clock_single_row')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_clock'))
    )
    op.create_table('conflicts',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('order_ids', postgresql.ARRAY(sa.Text()), nullable=False),
    sa.Column('device_record_ids', postgresql.ARRAY(sa.Text()), nullable=False),
    sa.Column('server_snapshot', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('device_snapshot', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('recommendation', sa.Enum('keep_delivery', 'keep_partial', 'keep_deferral', name='conflict_recommendation', native_enum=False, create_constraint=False, length=32), nullable=False),
    sa.Column('reasons', postgresql.ARRAY(sa.Text()), nullable=False),
    sa.Column('status', sa.Enum('open', 'awaiting_store', 'resolved', name='conflict_status', native_enum=False, create_constraint=False, length=32), nullable=False),
    sa.Column('resolution', sa.Text(), nullable=True),
    sa.Column('resolved_by', sa.Text(), nullable=True),
    sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    sa.CheckConstraint("recommendation IN ('keep_delivery', 'keep_partial', 'keep_deferral')", name=op.f('ck_conflicts_conflict_recommendation')),
    sa.CheckConstraint("status IN ('open', 'awaiting_store', 'resolved')", name=op.f('ck_conflicts_conflict_status')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_conflicts'))
    )
    op.create_table('depots',
    sa.Column('id', sa.Text(), nullable=False),
    sa.Column('name', sa.Text(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_depots'))
    )
    op.create_table('notices',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('audience', sa.Text(), nullable=False),
    sa.Column('tag', sa.Enum('Order', 'Plan', 'Delivery', 'Deferral', 'Review', 'Change', name='notice_tag', native_enum=False, create_constraint=False, length=32), nullable=False),
    sa.Column('title', sa.Text(), nullable=False),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('link', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('refs', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
    sa.CheckConstraint("tag IN ('Order', 'Plan', 'Delivery', 'Deferral', 'Review', 'Change')", name=op.f('ck_notices_notice_tag')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_notices'))
    )
    op.create_index(op.f('ix_notices_audience'), 'notices', ['audience'], unique=False)
    op.create_table('plan_versions',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('service_date', sa.Date(), nullable=False),
    sa.Column('number', sa.Integer(), nullable=False),
    sa.Column('state', sa.Enum('draft', 'released', name='plan_state', native_enum=False, create_constraint=False, length=32), nullable=False),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('created_by', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('released_at', sa.DateTime(timezone=True), nullable=True),
    sa.CheckConstraint("state IN ('draft', 'released')", name=op.f('ck_plan_versions_plan_state')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_plan_versions')),
    sa.UniqueConstraint('service_date', 'number', name=op.f('uq_plan_versions_service_date'))
    )
    op.create_table('scenario_events',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('kind', sa.Text(), nullable=False),
    sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('applied_at', sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_scenario_events'))
    )
    op.create_index(op.f('ix_scenario_events_at'), 'scenario_events', ['at'], unique=False)
    op.create_table('service_allowances',
    sa.Column('brand', sa.Enum('Fresh', 'Style', 'Tech', name='brand', native_enum=False, create_constraint=False, length=32), nullable=False),
    sa.Column('dock_type', sa.Enum('rear_dock', 'street', 'mall_bay', name='dock_type', native_enum=False, create_constraint=False, length=32), nullable=False),
    sa.Column('minutes', sa.Integer(), nullable=False),
    sa.CheckConstraint("brand IN ('Fresh', 'Style', 'Tech')", name=op.f('ck_service_allowances_brand')),
    sa.CheckConstraint("dock_type IN ('rear_dock', 'street', 'mall_bay')", name=op.f('ck_service_allowances_dock_type')),
    sa.PrimaryKeyConstraint('brand', 'dock_type', name=op.f('pk_service_allowances'))
    )
    op.create_table('traffic_speed',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('service_date', sa.Date(), nullable=True),
    sa.Column('raw', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_traffic_speed'))
    )
    op.create_table('districts',
    sa.Column('name', sa.Text(), nullable=False),
    sa.Column('depot_id', sa.Text(), nullable=False),
    sa.Column('road_class', sa.Text(), nullable=True),
    sa.Column('free_flow_kmh', sa.Float(), nullable=True),
    sa.Column('depot_to_district_km', sa.Float(), nullable=False),
    sa.Column('depot_to_district_freeflow_min', sa.Float(), nullable=False),
    sa.Column('inter_stop_km', sa.Float(), nullable=False),
    sa.Column('inter_stop_freeflow_min', sa.Float(), nullable=False),
    sa.ForeignKeyConstraint(['depot_id'], ['depots.id'], name=op.f('fk_districts_depot_id_depots')),
    sa.PrimaryKeyConstraint('name', name=op.f('pk_districts'))
    )
    op.create_table('vehicles',
    sa.Column('id', sa.Text(), nullable=False),
    sa.Column('type', sa.Enum('truck', 'van', name='vehicle_type', native_enum=False, create_constraint=False, length=32), nullable=False),
    sa.Column('temp', sa.Enum('reefer', 'ambient', name='vehicle_temp', native_enum=False, create_constraint=False, length=32), nullable=False),
    sa.Column('weight_cap_kg', sa.Float(), nullable=False),
    sa.Column('volume_cap_m3', sa.Float(), nullable=False),
    sa.Column('fuel_type', sa.Text(), nullable=True),
    sa.Column('km_per_l', sa.Float(), nullable=False),
    sa.Column('weekly_fuel_quota_l', sa.Float(), nullable=False),
    sa.Column('depot_id', sa.Text(), nullable=False),
    sa.CheckConstraint("temp IN ('reefer', 'ambient')", name=op.f('ck_vehicles_vehicle_temp')),
    sa.CheckConstraint("type IN ('truck', 'van')", name=op.f('ck_vehicles_vehicle_type')),
    sa.ForeignKeyConstraint(['depot_id'], ['depots.id'], name=op.f('fk_vehicles_depot_id_depots')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_vehicles'))
    )
    op.create_table('acknowledgements',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('plan_version_id', sa.Integer(), nullable=False),
    sa.Column('actor_kind', sa.Enum('pin_person', 'driver', name='actor_kind', native_enum=False, create_constraint=False, length=32), nullable=False),
    sa.Column('actor_id', sa.Text(), nullable=False),
    sa.Column('dock', sa.Text(), nullable=True),
    sa.Column('vehicle_id', sa.Text(), nullable=True),
    sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("actor_kind IN ('pin_person', 'driver')", name=op.f('ck_acknowledgements_actor_kind')),
    sa.ForeignKeyConstraint(['dock'], ['depots.id'], name=op.f('fk_acknowledgements_dock_depots')),
    sa.ForeignKeyConstraint(['plan_version_id'], ['plan_versions.id'], name=op.f('fk_acknowledgements_plan_version_id_plan_versions')),
    sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], name=op.f('fk_acknowledgements_vehicle_id_vehicles')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_acknowledgements'))
    )
    op.create_table('fuel_ledger',
    sa.Column('vehicle_id', sa.Text(), nullable=False),
    sa.Column('iso_year', sa.Integer(), nullable=False),
    sa.Column('iso_week', sa.Integer(), nullable=False),
    sa.Column('used_before_l', sa.Float(), nullable=False),
    sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], name=op.f('fk_fuel_ledger_vehicle_id_vehicles')),
    sa.PrimaryKeyConstraint('vehicle_id', 'iso_year', 'iso_week', name=op.f('pk_fuel_ledger'))
    )
    op.create_table('outlets',
    sa.Column('id', sa.Text(), nullable=False),
    sa.Column('name', sa.Text(), nullable=True),
    sa.Column('brand', sa.Enum('Fresh', 'Style', 'Tech', name='brand', native_enum=False, create_constraint=False, length=32), nullable=False),
    sa.Column('district', sa.Text(), nullable=False),
    sa.Column('depot_id', sa.Text(), nullable=False),
    sa.Column('dock_type', sa.Enum('rear_dock', 'street', 'mall_bay', name='dock_type', native_enum=False, create_constraint=False, length=32), nullable=False),
    sa.Column('parking_constraint', sa.Text(), nullable=False),
    sa.Column('mall_window_open', sa.Time(), nullable=True),
    sa.Column('mall_window_close', sa.Time(), nullable=True),
    sa.Column('window_open', sa.Time(), nullable=False),
    sa.Column('window_close', sa.Time(), nullable=False),
    sa.Column('units_to_kg', sa.Float(), nullable=True),
    sa.Column('units_to_m3', sa.Float(), nullable=True),
    sa.CheckConstraint("brand IN ('Fresh', 'Style', 'Tech')", name=op.f('ck_outlets_brand')),
    sa.CheckConstraint("dock_type IN ('rear_dock', 'street', 'mall_bay')", name=op.f('ck_outlets_dock_type')),
    sa.ForeignKeyConstraint(['depot_id'], ['depots.id'], name=op.f('fk_outlets_depot_id_depots')),
    sa.ForeignKeyConstraint(['district'], ['districts.name'], name=op.f('fk_outlets_district_districts')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_outlets'))
    )
    op.create_table('trips',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('plan_version_id', sa.Integer(), nullable=False),
    sa.Column('vehicle_id', sa.Text(), nullable=False),
    sa.Column('trip_no', sa.Integer(), nullable=False),
    sa.Column('brand', sa.Enum('Fresh', 'Style', 'Tech', name='brand', native_enum=False, create_constraint=False, length=32), nullable=False),
    sa.Column('district', sa.Text(), nullable=False),
    sa.Column('depart_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('minutes', sa.Integer(), nullable=False),
    sa.Column('kg', sa.Float(), nullable=False),
    sa.Column('m3', sa.Float(), nullable=False),
    sa.Column('planned_km', sa.Float(), nullable=False),
    sa.Column('planned_fuel_l', sa.Float(), nullable=False),
    sa.CheckConstraint("brand IN ('Fresh', 'Style', 'Tech')", name=op.f('ck_trips_brand')),
    sa.ForeignKeyConstraint(['district'], ['districts.name'], name=op.f('fk_trips_district_districts')),
    sa.ForeignKeyConstraint(['plan_version_id'], ['plan_versions.id'], name=op.f('fk_trips_plan_version_id_plan_versions')),
    sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], name=op.f('fk_trips_vehicle_id_vehicles')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_trips')),
    sa.UniqueConstraint('plan_version_id', 'vehicle_id', 'trip_no', name=op.f('uq_trips_plan_version_id'))
    )
    op.create_index(op.f('ix_trips_plan_version_id'), 'trips', ['plan_version_id'], unique=False)
    op.create_table('vehicle_day_status',
    sa.Column('vehicle_id', sa.Text(), nullable=False),
    sa.Column('service_date', sa.Date(), nullable=False),
    sa.Column('availability', sa.Enum('available', 'in_workshop', name='availability', native_enum=False, create_constraint=False, length=32), nullable=False),
    sa.Column('available_from', sa.DateTime(timezone=True), nullable=True),
    sa.Column('held_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('held_reason', sa.Text(), nullable=True),
    sa.Column('replaced_by', sa.Text(), nullable=True),
    sa.CheckConstraint("availability IN ('available', 'in_workshop')", name=op.f('ck_vehicle_day_status_availability')),
    sa.ForeignKeyConstraint(['replaced_by'], ['vehicles.id'], name=op.f('fk_vehicle_day_status_replaced_by_vehicles')),
    sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], name=op.f('fk_vehicle_day_status_vehicle_id_vehicles')),
    sa.PrimaryKeyConstraint('vehicle_id', 'service_date', name=op.f('pk_vehicle_day_status'))
    )
    op.create_table('exceptions',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('kind', sa.Enum('loader_flag', 'driver_problem', 'store_issue', name='exception_kind', native_enum=False, create_constraint=False, length=32), nullable=False),
    sa.Column('type', sa.Text(), nullable=False),
    sa.Column('vehicle_id', sa.Text(), nullable=True),
    sa.Column('trip_id', sa.Integer(), nullable=True),
    sa.Column('order_ids', postgresql.ARRAY(sa.Text()), nullable=False),
    sa.Column('units_short', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('detail', sa.Text(), nullable=True),
    sa.Column('raised_by', sa.Text(), nullable=True),
    sa.Column('raised_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('device_time', sa.DateTime(timezone=True), nullable=True),
    sa.Column('status', sa.Enum('open', 'decided', name='exception_status', native_enum=False, create_constraint=False, length=32), nullable=False),
    sa.Column('decision', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('decided_by', sa.Text(), nullable=True),
    sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
    sa.CheckConstraint("kind IN ('loader_flag', 'driver_problem', 'store_issue')", name=op.f('ck_exceptions_exception_kind')),
    sa.CheckConstraint("status IN ('open', 'decided')", name=op.f('ck_exceptions_exception_status')),
    sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], name=op.f('fk_exceptions_trip_id_trips')),
    sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], name=op.f('fk_exceptions_vehicle_id_vehicles')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_exceptions'))
    )
    op.create_table('orders',
    sa.Column('id', sa.Text(), nullable=False),
    sa.Column('outlet_id', sa.Text(), nullable=False),
    sa.Column('service_date', sa.Date(), nullable=False),
    sa.Column('temp', sa.Enum('chilled', 'ambient', name='temp', native_enum=False, create_constraint=False, length=32), nullable=False),
    sa.Column('units', sa.Integer(), nullable=False),
    sa.Column('weight_kg', sa.Float(), nullable=False),
    sa.Column('volume_m3', sa.Float(), nullable=False),
    sa.Column('status', sa.Enum('ordered', 'confirmed', 'planned', 'deferred', 'loaded', 'departed', 'delivered', 'partial', 'issue', 'conflict', name='order_status', native_enum=False, create_constraint=False, length=32), nullable=False),
    sa.Column('tags', postgresql.ARRAY(sa.Text()), nullable=False),
    sa.Column('received_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('placed_by', sa.Text(), nullable=True),
    sa.Column('after_cutoff', sa.Boolean(), nullable=False),
    sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deferred_from_order_id', sa.Text(), nullable=True),
    sa.Column('row_version', sa.Integer(), nullable=False),
    sa.CheckConstraint("status IN ('ordered', 'confirmed', 'planned', 'deferred', 'loaded', 'departed', 'delivered', 'partial', 'issue', 'conflict')", name=op.f('ck_orders_order_status')),
    sa.CheckConstraint("temp IN ('chilled', 'ambient')", name=op.f('ck_orders_temp')),
    sa.ForeignKeyConstraint(['deferred_from_order_id'], ['orders.id'], name=op.f('fk_orders_deferred_from_order_id_orders')),
    sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], name=op.f('fk_orders_outlet_id_outlets')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_orders'))
    )
    op.create_index(op.f('ix_orders_outlet_id'), 'orders', ['outlet_id'], unique=False)
    op.create_index('ix_orders_service_date_status', 'orders', ['service_date', 'status'], unique=False)
    op.create_table('outlet_service_history',
    sa.Column('outlet_id', sa.Text(), nullable=False),
    sa.Column('service_date', sa.Date(), nullable=False),
    sa.Column('outcome', sa.Enum('served', 'deferred', 'partial', 'no_run', name='history_outcome', native_enum=False, create_constraint=False, length=32), nullable=False),
    sa.Column('time', sa.Text(), nullable=True),
    sa.CheckConstraint("outcome IN ('served', 'deferred', 'partial', 'no_run')", name=op.f('ck_outlet_service_history_history_outcome')),
    sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], name=op.f('fk_outlet_service_history_outlet_id_outlets')),
    sa.PrimaryKeyConstraint('outlet_id', 'service_date', name=op.f('pk_outlet_service_history'))
    )
    op.create_table('users',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('email', sa.Text(), nullable=False),
    sa.Column('password_hash', sa.Text(), nullable=False),
    sa.Column('role', sa.Enum('dispatcher', 'loader', 'driver', 'store', name='role', native_enum=False, create_constraint=False, length=32), nullable=False),
    sa.Column('display_name', sa.Text(), nullable=False),
    sa.Column('depot_id', sa.Text(), nullable=True),
    sa.Column('outlet_id', sa.Text(), nullable=True),
    sa.Column('vehicle_id', sa.Text(), nullable=True),
    sa.CheckConstraint("role IN ('dispatcher', 'loader', 'driver', 'store')", name=op.f('ck_users_role')),
    sa.ForeignKeyConstraint(['depot_id'], ['depots.id'], name=op.f('fk_users_depot_id_depots')),
    sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], name=op.f('fk_users_outlet_id_outlets')),
    sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], name=op.f('fk_users_vehicle_id_vehicles')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_users')),
    sa.UniqueConstraint('email', name=op.f('uq_users_email'))
    )
    op.create_table('deferrals',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('order_id', sa.Text(), nullable=False),
    sa.Column('plan_version_id', sa.Integer(), nullable=True),
    sa.Column('type', sa.Enum('capacity', 'policy', 'store_request', name='deferral_type', native_enum=False, create_constraint=False, length=32), nullable=False),
    sa.Column('binding', sa.Enum('reefer_minutes', 'weight', 'volume', 'van_access', 'window', 'fuel', name='binding', native_enum=False, create_constraint=False, length=32), nullable=True),
    sa.Column('reason_text', sa.Text(), nullable=False),
    sa.Column('impact', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('frees', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('next_run_date', sa.Date(), nullable=True),
    sa.Column('decided_by', sa.Text(), nullable=True),
    sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('notice_sent_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('notice_seen_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('withdrawn_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('withdrawn_reason', sa.Text(), nullable=True),
    sa.CheckConstraint("binding IN ('reefer_minutes', 'weight', 'volume', 'van_access', 'window', 'fuel')", name=op.f('ck_deferrals_binding')),
    sa.CheckConstraint("type IN ('capacity', 'policy', 'store_request')", name=op.f('ck_deferrals_deferral_type')),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], name=op.f('fk_deferrals_order_id_orders')),
    sa.ForeignKeyConstraint(['plan_version_id'], ['plan_versions.id'], name=op.f('fk_deferrals_plan_version_id_plan_versions')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_deferrals'))
    )
    op.create_index(op.f('ix_deferrals_order_id'), 'deferrals', ['order_id'], unique=False)
    op.create_table('device_records',
    sa.Column('client_id', sa.UUID(), nullable=False),
    sa.Column('device_id', sa.Text(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('actor', sa.Text(), nullable=True),
    sa.Column('type', sa.Enum('driver.ack', 'driver.startRoute', 'driver.arrival', 'driver.outcome', 'driver.problem', 'driver.finishRun', 'loader.ack', 'loader.check', 'loader.confirmLoaded', 'loader.exception', name='device_record_type', native_enum=False, create_constraint=False, length=32), nullable=False),
    sa.Column('order_ids', postgresql.ARRAY(sa.Text()), nullable=False),
    sa.Column('outlet_id', sa.Text(), nullable=True),
    sa.Column('vehicle_id', sa.Text(), nullable=True),
    sa.Column('trip_no', sa.Integer(), nullable=True),
    sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('device_time', sa.DateTime(timezone=True), nullable=True),
    sa.Column('plan_version_on_device', sa.Integer(), nullable=True),
    sa.Column('received_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('result', sa.Enum('accepted', 'duplicate', 'conflict', 'error', name='sync_result', native_enum=False, create_constraint=False, length=32), nullable=False),
    sa.Column('result_reason', sa.Text(), nullable=True),
    sa.Column('conflict_id', sa.Integer(), nullable=True),
    sa.CheckConstraint("result IN ('accepted', 'duplicate', 'conflict', 'error')", name=op.f('ck_device_records_sync_result')),
    sa.CheckConstraint("type IN ('driver.ack', 'driver.startRoute', 'driver.arrival', 'driver.outcome', 'driver.problem', 'driver.finishRun', 'loader.ack', 'loader.check', 'loader.confirmLoaded', 'loader.exception')", name=op.f('ck_device_records_device_record_type')),
    sa.ForeignKeyConstraint(['conflict_id'], ['conflicts.id'], name=op.f('fk_device_records_conflict_id_conflicts')),
    sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], name=op.f('fk_device_records_outlet_id_outlets')),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_device_records_user_id_users')),
    sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], name=op.f('fk_device_records_vehicle_id_vehicles')),
    sa.PrimaryKeyConstraint('client_id', name=op.f('pk_device_records'))
    )
    op.create_table('drivers',
    sa.Column('vehicle_id', sa.Text(), nullable=False),
    sa.Column('name', sa.Text(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_drivers_user_id_users')),
    sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], name=op.f('fk_drivers_vehicle_id_vehicles')),
    sa.PrimaryKeyConstraint('vehicle_id', name=op.f('pk_drivers'))
    )
    op.create_table('pin_people',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('loader_user_id', sa.Integer(), nullable=True),
    sa.Column('name', sa.Text(), nullable=False),
    sa.Column('dock', sa.Text(), nullable=False),
    sa.Column('pin_hash', sa.Text(), nullable=False),
    sa.ForeignKeyConstraint(['dock'], ['depots.id'], name=op.f('fk_pin_people_dock_depots')),
    sa.ForeignKeyConstraint(['loader_user_id'], ['users.id'], name=op.f('fk_pin_people_loader_user_id_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_pin_people'))
    )
    op.create_table('receipts',
    sa.Column('order_id', sa.Text(), nullable=False),
    sa.Column('units_received', sa.Integer(), nullable=False),
    sa.Column('shortfall_reason', sa.Text(), nullable=True),
    sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('confirmed_by', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], name=op.f('fk_receipts_order_id_orders')),
    sa.PrimaryKeyConstraint('order_id', name=op.f('pk_receipts'))
    )
    op.create_table('trip_orders',
    sa.Column('trip_id', sa.Integer(), nullable=False),
    sa.Column('order_id', sa.Text(), nullable=False),
    sa.Column('seq', sa.Integer(), nullable=False),
    sa.Column('load_no', sa.Integer(), nullable=False),
    sa.Column('planned_arrival', sa.DateTime(timezone=True), nullable=True),
    sa.Column('handling_start', sa.DateTime(timezone=True), nullable=True),
    sa.Column('handling_end', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], name=op.f('fk_trip_orders_order_id_orders')),
    sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], name=op.f('fk_trip_orders_trip_id_trips')),
    sa.PrimaryKeyConstraint('trip_id', 'order_id', name=op.f('pk_trip_orders'))
    )
    op.create_table('attachments',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('device_record_id', sa.UUID(), nullable=True),
    sa.Column('kind', sa.Enum('photo', 'signature', name='attachment_kind', native_enum=False, create_constraint=False, length=32), nullable=False),
    sa.Column('path', sa.Text(), nullable=False),
    sa.Column('mime', sa.Text(), nullable=False),
    sa.Column('bytes', sa.Integer(), nullable=False),
    sa.CheckConstraint("kind IN ('photo', 'signature')", name=op.f('ck_attachments_attachment_kind')),
    sa.ForeignKeyConstraint(['device_record_id'], ['device_records.client_id'], name=op.f('fk_attachments_device_record_id_device_records')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_attachments'))
    )
    op.create_table('load_checks',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('trip_id', sa.Integer(), nullable=False),
    sa.Column('order_id', sa.Text(), nullable=False),
    sa.Column('units_expected', sa.Integer(), nullable=False),
    sa.Column('units_loaded', sa.Integer(), nullable=False),
    sa.Column('checked_by_pin', sa.Integer(), nullable=True),
    sa.Column('checked_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('client_id', sa.UUID(), nullable=True),
    sa.ForeignKeyConstraint(['checked_by_pin'], ['pin_people.id'], name=op.f('fk_load_checks_checked_by_pin_pin_people')),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], name=op.f('fk_load_checks_order_id_orders')),
    sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], name=op.f('fk_load_checks_trip_id_trips')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_load_checks')),
    sa.UniqueConstraint('client_id', name=op.f('uq_load_checks_client_id'))
    )
    op.create_index(op.f('ix_load_checks_trip_id'), 'load_checks', ['trip_id'], unique=False)
    op.create_table('load_gates',
    sa.Column('trip_id', sa.Integer(), nullable=False),
    sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('confirmed_by_pin', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['confirmed_by_pin'], ['pin_people.id'], name=op.f('fk_load_gates_confirmed_by_pin_pin_people')),
    sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], name=op.f('fk_load_gates_trip_id_trips')),
    sa.PrimaryKeyConstraint('trip_id', name=op.f('pk_load_gates'))
    )
    op.create_table('runs',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('vehicle_id', sa.Text(), nullable=False),
    sa.Column('trip_id', sa.Integer(), nullable=False),
    sa.Column('driver_id', sa.Text(), nullable=True),
    sa.Column('plan_version_seen', sa.Integer(), nullable=True),
    sa.Column('departed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('gps_km', sa.Float(), nullable=True),
    sa.Column('gps_gap_filled_km', sa.Float(), nullable=True),
    sa.Column('fuel_l_est', sa.Float(), nullable=True),
    sa.Column('last_heard_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['driver_id'], ['drivers.vehicle_id'], name=op.f('fk_runs_driver_id_drivers')),
    sa.ForeignKeyConstraint(['plan_version_seen'], ['plan_versions.id'], name=op.f('fk_runs_plan_version_seen_plan_versions')),
    sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], name=op.f('fk_runs_trip_id_trips')),
    sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], name=op.f('fk_runs_vehicle_id_vehicles')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_runs'))
    )


def downgrade() -> None:
    op.drop_table('runs')
    op.drop_table('load_gates')
    op.drop_index(op.f('ix_load_checks_trip_id'), table_name='load_checks')
    op.drop_table('load_checks')
    op.drop_table('attachments')
    op.drop_table('trip_orders')
    op.drop_table('receipts')
    op.drop_table('pin_people')
    op.drop_table('drivers')
    op.drop_table('device_records')
    op.drop_index(op.f('ix_deferrals_order_id'), table_name='deferrals')
    op.drop_table('deferrals')
    op.drop_table('users')
    op.drop_table('outlet_service_history')
    op.drop_index('ix_orders_service_date_status', table_name='orders')
    op.drop_index(op.f('ix_orders_outlet_id'), table_name='orders')
    op.drop_table('orders')
    op.drop_table('exceptions')
    op.drop_table('vehicle_day_status')
    op.drop_index(op.f('ix_trips_plan_version_id'), table_name='trips')
    op.drop_table('trips')
    op.drop_table('outlets')
    op.drop_table('fuel_ledger')
    op.drop_table('acknowledgements')
    op.drop_table('vehicles')
    op.drop_table('districts')
    op.drop_table('traffic_speed')
    op.drop_table('service_allowances')
    op.drop_index(op.f('ix_scenario_events_at'), table_name='scenario_events')
    op.drop_table('scenario_events')
    op.drop_table('plan_versions')
    op.drop_index(op.f('ix_notices_audience'), table_name='notices')
    op.drop_table('notices')
    op.drop_table('depots')
    op.drop_table('conflicts')
    op.drop_table('clock')
    op.drop_table('calendar_days')
    op.drop_index(op.f('ix_audit_events_entity_id'), table_name='audit_events')
    op.drop_table('audit_events')
