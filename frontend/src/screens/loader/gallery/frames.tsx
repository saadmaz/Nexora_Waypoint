import type { GalleryFrame } from "../../../field/gallery/StateGallery";
import { PinSheet } from "../../../field/components";
import { HERO_DATE, HERO_EVENING_DATE } from "../../../field/clock/clock";
import { Dock, type DockAlertModel } from "../dock/Dock";
import type { VehicleCardProps } from "../dock/VehicleCard";
import { Mono } from "../../../shared/ui/Mono";
import { FlagSheet, type FlagOrder, type FlagPrefill, type FlagSentModel } from "../flag/FlagSheet";
import { FlagStatus } from "../flag/FlagStatus";
import { LoadPlan, type LoadPlanRow } from "../loadplan/LoadPlan";

const noop = () => undefined;

const SYNCED = { status: "synced" as const, time: undefined, count: 0 };
const OFFLINE_CHIP = { status: "offline" as const, time: undefined, count: 0 };
const SYNCING_CHIP = { status: "syncing" as const, time: undefined, count: 0 };

const PEOPLE = [
  { id: "priya", name: "Priya" },
  { id: "ruwan", name: "Ruwan" },
];

function vehicle(
  partial: Partial<VehicleCardProps> &
    Pick<VehicleCardProps, "id" | "temperature" | "trips" | "orderCount" | "departsAt" | "inLabel">,
): VehicleCardProps {
  return { locked: false, status: "to_load", onPress: noop, ...partial };
}

// --- L1.1 · 23:45 · Peliyagoda, plan v3 not acknowledged --------------------------------------
const l11Alert: DockAlertModel = { kind: "ready", version: 3, releasedAt: "23:40", vehicleCount: 3, orderCount: 17, firstDeparture: "03:30" };
const l11Vehicles: VehicleCardProps[] = [
  vehicle({ id: "VEH003", temperature: "reefer", trips: 2, orderCount: 9, departsAt: "03:30", inLabel: "in 3 h 45 min", locked: true }),
  vehicle({ id: "VEH035", temperature: "reefer", trips: 2, orderCount: 7, departsAt: "03:30", inLabel: "in 3 h 45 min", locked: true }),
  vehicle({ id: "VEH011", temperature: "ambient", trips: 1, orderCount: 1, departsAt: "08:36", inLabel: "in 8 h 51 min", locked: true }),
];

// --- L1.3 · 00:10 · Peliyagoda, acknowledged, vehicles to load --------------------------------
const l13Alert: DockAlertModel = { kind: "acknowledgedCompact", version: 3, by: "Priya", at: "23:52" };
const l13Vehicles: VehicleCardProps[] = [
  vehicle({
    id: "VEH003",
    temperature: "reefer",
    trips: 2,
    orderCount: 9,
    departsAt: "03:30",
    inLabel: "in 3 h 20 min",
    action: { label: "Load VEH003 · departs 03:30", primary: true, icon: "truck" },
  }),
  vehicle({
    id: "VEH035",
    temperature: "reefer",
    trips: 2,
    orderCount: 7,
    departsAt: "03:30",
    inLabel: "in 3 h 20 min",
    status: "loading",
    checked: { done: 3, total: 4 },
    action: { label: "Load VEH035", primary: false },
  }),
  vehicle({ id: "VEH011", temperature: "ambient", trips: 1, orderCount: 1, departsAt: "08:36", inLabel: "in 8 h 26 min", action: { label: "Load VEH011", primary: false } }),
];

// --- L1.4 · 02:56 · VEH003 Held -----------------------------------------------------------------
const l14Alert: DockAlertModel = { kind: "acknowledgedCompact", version: 3, by: "Priya", at: "23:52" };
const l14Vehicles: VehicleCardProps[] = [
  vehicle({
    id: "VEH003",
    temperature: "reefer",
    trips: 2,
    orderCount: 9,
    departsAt: "03:30",
    inLabel: "in 34 min",
    status: "held",
    heldReason: "Held: reefer unit failed pre-departure check at 02:55",
    goTo: { label: "Go to VEH035", onClick: noop },
  }),
  vehicle({
    id: "VEH035",
    temperature: "reefer",
    trips: 2,
    orderCount: 7,
    departsAt: "03:30",
    inLabel: "in 34 min",
    status: "loading",
    checked: { done: 3, total: 5 },
    action: { label: "Load VEH035", primary: false },
  }),
  vehicle({ id: "VEH011", temperature: "ambient", trips: 1, orderCount: 1, departsAt: "08:36", inLabel: "in 5 h 40 min", action: { label: "Load VEH011", primary: false } }),
];

// --- L1.5 · 03:01 · Plan changed, review ---------------------------------------------------------
const l15Alert: DockAlertModel = { kind: "changed", fromVersion: 3, toVersion: 4, onReview: noop };
const l15Vehicles: VehicleCardProps[] = [
  vehicle({
    id: "VEH003",
    temperature: "reefer",
    trips: 2,
    orderCount: 9,
    departsAt: "03:30",
    inLabel: "in 29 min",
    locked: true,
    lockedVersion: 4,
    changeTag: "Changed",
    action: { label: "Load VEH003", primary: false },
  }),
  vehicle({
    id: "VEH035",
    temperature: "reefer",
    trips: 2,
    orderCount: 7,
    departsAt: "03:30",
    inLabel: "in 29 min",
    locked: true,
    lockedVersion: 4,
    changeTag: "No change",
    action: { label: "Load VEH035", primary: false },
  }),
  vehicle({
    id: "VEH011",
    temperature: "ambient",
    trips: 1,
    orderCount: 1,
    departsAt: "08:36",
    inLabel: "in 5 h 35 min",
    locked: true,
    lockedVersion: 4,
    changeTag: "No change",
    action: { label: "Load VEH011", primary: false },
  }),
];

// --- L1.6 A/B · Kandy, v4 no change ---------------------------------------------------------------
const l16aAlert: DockAlertModel = { kind: "noChangeReady", version: 4 };
const l16aVehicles: VehicleCardProps[] = [
  vehicle({ id: "VEH039", temperature: "reefer", trips: 1, orderCount: 3, departsAt: "05:10", inLabel: "in 56 min", locked: true }),
];

const l16bAlert: DockAlertModel = { kind: "noChangeAcknowledged", version: 4, by: "Ruwan", at: "04:15" };
const l16bVehicles: VehicleCardProps[] = [
  vehicle({ id: "VEH039", temperature: "reefer", trips: 1, orderCount: 3, departsAt: "05:10", inLabel: "in 55 min", action: { label: "Load VEH039 · departs 05:10", primary: true, icon: "truck" } }),
];

// --- L1.S3 · Offline: last-known dock, still actionable -------------------------------------------
const l1s3Vehicles: VehicleCardProps[] = [
  vehicle({ id: "VEH039", temperature: "reefer", trips: 1, orderCount: 3, departsAt: "05:10", inLabel: "in 56 min", action: { label: "Load VEH039", primary: true, icon: "truck" } }),
];

// --- L2 Load plan rows -----------------------------------------------------------------------

function row(partial: Partial<LoadPlanRow> & Pick<LoadPlanRow, "orderId" | "outletId" | "loadNumber" | "stopNumber" | "unitsExpected">): LoadPlanRow {
  return {
    brand: "Fresh",
    chilled: false,
    dockLabel: "Rear dock",
    unitsLoaded: 0,
    weightKg: 0,
    state: "todo",
    orderIdIn: "quantity",
    ...partial,
  };
}

/** VEH039 trip 1, reverse stop order: OUT087 first, OUT084's two orders last. */
function veh039Rows(unitsLoaded: { ord2003?: number; ord2002?: number; ord2001?: number } = {}): LoadPlanRow[] {
  const done = (loaded: number | undefined, expected: number): LoadPlanRow["state"] =>
    loaded === undefined ? "todo" : loaded >= expected ? "checked" : "short";
  return [
    row({ orderId: "ORD2003", outletId: "OUT087", loadNumber: 1, stopNumber: 2, unitsExpected: 9, weightKg: 55, unitsLoaded: unitsLoaded.ord2003 ?? 0, state: done(unitsLoaded.ord2003, 9) }),
    row({ orderId: "ORD2002", outletId: "OUT084", loadNumber: 2, stopNumber: 1, unitsExpected: 8, weightKg: 45, unitsLoaded: unitsLoaded.ord2002 ?? 0, state: done(unitsLoaded.ord2002, 8), orderIdIn: "heading" }),
    row({ orderId: "ORD2001", outletId: "OUT084", loadNumber: 3, stopNumber: 1, unitsExpected: 12, weightKg: 70, chilled: true, unitsLoaded: unitsLoaded.ord2001 ?? 0, state: done(unitsLoaded.ord2001, 12), orderIdIn: "heading" }),
  ];
}

/** VEH036 trip 1 after the swap: OUT012 (protected) first, OUT011 last. All four are chilled. */
function veh036Rows(checkedThrough = 0): LoadPlanRow[] {
  const base = [
    { orderId: "ORD1001", outletId: "OUT012", loadNumber: 1, stopNumber: 4, unitsExpected: 37, weightKg: 220, protectedOrder: true },
    { orderId: "ORD1011", outletId: "OUT005", loadNumber: 2, stopNumber: 3, unitsExpected: 43, weightKg: 260 },
    { orderId: "ORD1016", outletId: "OUT006", loadNumber: 3, stopNumber: 2, unitsExpected: 38, weightKg: 230, dockLabel: "Street" },
    { orderId: "ORD1014", outletId: "OUT011", loadNumber: 4, stopNumber: 1, unitsExpected: 40, weightKg: 240 },
  ];
  return base.map((b, i) =>
    row({ ...b, chilled: true, unitsLoaded: i < checkedThrough ? b.unitsExpected : 0, state: i < checkedThrough ? "checked" : "todo" }),
  );
}

/** VEH003 trip 1 as released in v3, original 5-stop order, all Planned (held, never checked). */
function veh003HeldRows(): LoadPlanRow[] {
  return [
    row({ orderId: "ORD1001", outletId: "OUT012", loadNumber: 1, stopNumber: 5, unitsExpected: 37, weightKg: 220, chilled: true, protectedOrder: true }),
    row({ orderId: "ORD1002", outletId: "OUT009", loadNumber: 2, stopNumber: 4, unitsExpected: 35, weightKg: 210, chilled: true }),
    row({ orderId: "ORD1011", outletId: "OUT005", loadNumber: 3, stopNumber: 3, unitsExpected: 43, weightKg: 260, chilled: true }),
    row({ orderId: "ORD1016", outletId: "OUT006", loadNumber: 4, stopNumber: 2, unitsExpected: 38, weightKg: 230, chilled: true, dockLabel: "Street" }),
    row({ orderId: "ORD1014", outletId: "OUT011", loadNumber: 5, stopNumber: 1, unitsExpected: 40, weightKg: 240, chilled: true }),
  ];
}

const VEH036_CAPACITY = { weightKg: 950, weightCapKg: 1040, volumeM3: 6.3, volumeCapM3: 7.0 };
const VEH036_SWAP = { replacesVehicleId: "VEH003", note: "OUT009 removed in v4" };
const noopUnits = () => undefined;

// --- L3 · Flag exception: the VEH003 load plan behind the sheet, plan v3, 0 of 5 checked -----------
/** The three orders L3.2 B lists (the live sheet lists every order on the trip). ORD1011 is drawn without its Chilled tag. */
const L3_ORDERS: FlagOrder[] = [
  { orderId: "ORD1001", outletId: "OUT012", units: 37, chilled: true },
  { orderId: "ORD1011", outletId: "OUT005", units: 43, chilled: false },
  { orderId: "ORD1014", outletId: "OUT011", units: 40, chilled: true },
];
const L3_SCOPE = { orders: 9, trips: 2 };
const L3_SENT: FlagSentModel = {
  at: "02:55",
  summary: "Priya · Vehicle check failed · Reefer not holding temperature",
  held: true,
  vehicleId: "VEH003",
  reviewer: "Kumari",
};

function l3Backdrop(chip: { status: "synced" | "syncing" | "offline"; time: undefined; count: number }) {
  return (
    <LoadPlan
      vehicleId="VEH003"
      dockLabel="Peliyagoda"
      departsAt="03:30"
      planVersion={3}
      connectivity={chip}
      phase="ready"
      checked={{ done: 0, total: 5 }}
      chilledZone
      rows={veh003HeldRows()}
      onRecordUnits={noopUnits}
      onFlagShort={noopUnits}
      onFlagIssue={noop}
      onConfirmGate={noop}
      onBack={noop}
    />
  );
}

function l3Sheet(props: { phase: "form" | "sending" | "sent" | "decided"; prefill?: FlagPrefill; sent?: FlagSentModel }) {
  return (
    <FlagSheet
      open
      onOpenChange={noop}
      vehicleId="VEH003"
      trip={1}
      time="02:55"
      orders={L3_ORDERS}
      scope={L3_SCOPE}
      prefill={props.prefill}
      phase={props.phase}
      sent={props.sent}
      onSend={noop}
      onCancel={noop}
      onBackToList={noop}
      onReview={noop}
    />
  );
}

function l3Frame(
  id: string,
  node: string,
  title: string,
  time: string,
  chip: { status: "synced" | "syncing" | "offline"; time: undefined; count: number },
  sheet: Parameters<typeof l3Sheet>[0],
): GalleryFrame {
  return {
    frameId: id,
    figmaNodeId: node,
    name: title,
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time },
    render: () => (
      <div>
        {/* Figma clips the dimmed load plan at the frame's 844 px; the real screen scrolls past it. */}
        <div style={{ height: 844, overflow: "hidden" }}>{l3Backdrop(chip)}</div>
        {l3Sheet(sheet)}
      </div>
    ),
  };
}

function l3Status(kind: "queued" | "failed", chip: { status: "synced" | "syncing" | "offline"; time: undefined; count: number }) {
  return (
    <FlagStatus
      kind={kind}
      vehicleId="VEH003"
      dockName="Peliyagoda"
      departsAt="03:30"
      planVersion={3}
      connectivity={chip}
      minutesToDeparture={34}
      typeLabel="Vehicle check failed"
      detail={
        <>
          Reefer not holding temperature · All 9 orders on <Mono>VEH003</Mono> (2 trips)
        </>
      }
      onRetry={noop}
      onCallDispatch={noop}
      onKeepWaiting={noop}
    />
  );
}

export const LOADER_FRAMES: GalleryFrame[] = [
  {
    frameId: "L1.1",
    figmaNodeId: "442:27369",
    name: "L1.1 · 23:45 · Dock: plan not acknowledged",
    width: 390,
    height: 844,
    clock: { date: HERO_EVENING_DATE, time: "23:45" },
    render: () => (
      <Dock
        dockLabel="Peliyagoda dock"
        nowLabel="23:45"
        connectivity={SYNCED}
        state="ready"
        alert={l11Alert}
        vehicles={l11Vehicles}
        pinnedAcknowledge={{ label: "Acknowledge plan v3", onClick: noop }}
      />
    ),
  },
  {
    frameId: "L1.2-A",
    figmaNodeId: "442:27454",
    name: "L1.2 · A · 04:15 · PIN sheet: entry (Kandy, plan v4)",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "04:14" },
    render: () => (
      <div>
        <Dock dockLabel="Kandy dock" nowLabel="04:14" connectivity={SYNCED} state="ready" alert={l16aAlert} vehicles={l16aVehicles} />
        <PinSheet
          open
          onOpenChange={noop}
          title="Acknowledge plan v4 at Kandy dock"
          whoLabel="Who's acknowledging?"
          people={PEOPLE}
          initialPersonId="ruwan"
          demoPhase="entry"
          demoDigits="12"
          verify={async () => true}
          onConfirmed={noop}
          confirmedText={(name) => `Acknowledged by ${name} · 04:15`}
        />
      </div>
    ),
  },
  {
    frameId: "L1.2-B",
    figmaNodeId: "442:27562",
    name: "L1.2 · B · 04:15 · PIN confirm: success",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "04:14" },
    render: () => (
      <div>
        <Dock dockLabel="Kandy dock" nowLabel="04:14" connectivity={SYNCED} state="ready" alert={l16aAlert} vehicles={l16aVehicles} />
        <PinSheet
          open
          onOpenChange={noop}
          title="Acknowledge plan v4 at Kandy dock"
          whoLabel="Who's acknowledging?"
          people={PEOPLE}
          initialPersonId="ruwan"
          demoPhase="ok"
          demoDigits="5678"
          verify={async () => true}
          onConfirmed={noop}
          confirmedText={(name) => `Acknowledged by ${name} · 04:15`}
        />
      </div>
    ),
  },
  {
    frameId: "L1.2-C",
    figmaNodeId: "442:27673",
    name: "L1.2 · C · Wrong PIN (shake)",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "04:14" },
    render: () => (
      <div>
        <Dock dockLabel="Kandy dock" nowLabel="04:14" connectivity={SYNCED} state="ready" alert={l16aAlert} vehicles={l16aVehicles} />
        <PinSheet
          open
          onOpenChange={noop}
          title="Acknowledge plan v4 at Kandy dock"
          whoLabel="Who's acknowledging?"
          people={PEOPLE}
          initialPersonId="ruwan"
          demoPhase="wrong"
          demoDigits="1234"
          verify={async () => false}
          onConfirmed={noop}
          confirmedText={(name) => `Acknowledged by ${name} · 04:15`}
        />
      </div>
    ),
  },
  {
    frameId: "L1.3",
    figmaNodeId: "442:27785",
    name: "L1.3 · 00:10 · Acknowledged, vehicles to load",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "00:10" },
    render: () => <Dock dockLabel="Peliyagoda dock" nowLabel="00:10" connectivity={SYNCED} state="ready" alert={l13Alert} vehicles={l13Vehicles} />,
  },
  {
    frameId: "L1.4",
    figmaNodeId: "442:27879",
    name: "L1.4 · 02:56 · VEH003 Held",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "02:56" },
    render: () => <Dock dockLabel="Peliyagoda dock" nowLabel="02:56" connectivity={SYNCED} state="ready" alert={l14Alert} vehicles={l14Vehicles} />,
  },
  {
    frameId: "L1.5",
    figmaNodeId: "442:27979",
    name: "L1.5 · 03:01 · Plan changed, review change",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "03:01" },
    render: () => <Dock dockLabel="Peliyagoda dock" nowLabel="03:01" connectivity={SYNCED} state="ready" alert={l15Alert} vehicles={l15Vehicles} />,
  },
  {
    frameId: "L1.6-A",
    figmaNodeId: "442:28085",
    name: "L1.6 · A · 04:14 · Kandy, v4 no change (before acknowledging)",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "04:14" },
    render: () => (
      <Dock
        dockLabel="Kandy dock"
        nowLabel="04:14"
        connectivity={SYNCED}
        state="ready"
        alert={l16aAlert}
        vehicles={l16aVehicles}
        pinnedAcknowledge={{ label: "Acknowledge plan v4", onClick: noop }}
      />
    ),
  },
  {
    frameId: "L1.6-B",
    figmaNodeId: "442:28138",
    name: "L1.6 · B · 04:15 · Kandy, v4 acknowledged (after)",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "04:15" },
    render: () => <Dock dockLabel="Kandy dock" nowLabel="04:15" connectivity={SYNCED} state="ready" alert={l16bAlert} vehicles={l16bVehicles} />,
  },
  {
    frameId: "L1.S-1",
    figmaNodeId: "442:28192",
    name: "L1.S · 1 · Empty: no vehicles yet",
    width: 390,
    height: 844,
    clock: { date: HERO_EVENING_DATE, time: "22:10" },
    render: () => (
      <Dock dockLabel="Peliyagoda dock" nowLabel="22:10" connectivity={SYNCED} state="empty" emptyReleaseLabel="23:40" emptyCheckedLabel="22:10" />
    ),
  },
  {
    frameId: "L1.S-2",
    figmaNodeId: "442:28217",
    name: "L1.S · 2 · Loading",
    width: 390,
    height: 844,
    clock: { date: HERO_EVENING_DATE, time: "22:10" },
    render: () => <Dock dockLabel="Peliyagoda dock" nowLabel="" connectivity={SYNCING_CHIP} state="loading" />,
  },
  {
    frameId: "L1.S-3",
    figmaNodeId: "442:28249",
    name: "L1.S · 3 · Offline: plan v4 as of 04:10",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "04:14" },
    render: () => (
      <Dock
        dockLabel="Kandy dock"
        nowLabel="04:14"
        connectivity={OFFLINE_CHIP}
        state="offline"
        vehicles={l1s3Vehicles}
        offlineVersion={4}
        offlineAsOf="04:10"
      />
    ),
  },
  {
    frameId: "L1.S-4",
    figmaNodeId: "442:28313",
    name: "L1.S · 4 · Error: couldn't load vehicles",
    width: 390,
    height: 844,
    clock: { date: HERO_EVENING_DATE, time: "22:10" },
    render: () => <Dock dockLabel="Peliyagoda dock" nowLabel="22:10" connectivity={SYNCED} state="error" onRetry={noop} />,
  },

  // --- L2 Load plan ----------------------------------------------------------------------------
  {
    frameId: "L2.1-A",
    figmaNodeId: "442:28482",
    name: "L2.1 · A · 04:30 · In progress (VEH039, 2 of 3 checked)",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "04:30" },
    render: () => (
      <LoadPlan
        vehicleId="VEH039"
        dockLabel="Kandy dock"
        departsAt="05:10"
        planVersion={4}
        connectivity={SYNCED}
        phase="ready"
        checked={{ done: 2, total: 3 }}
        chilledZone
        rows={veh039Rows({ ord2003: 9, ord2002: 8 })}
        onRecordUnits={noopUnits}
        onFlagShort={noopUnits}
        onFlagIssue={noop}
        onConfirmGate={noop}
        onBack={noop}
      />
    ),
  },
  {
    frameId: "L2.1-B",
    figmaNodeId: "442:28591",
    name: "L2.1 · B · 04:31 · Count confirm, stepper prefilled",
    width: 390,
    height: 1000,
    clock: { date: HERO_DATE, time: "04:31" },
    render: () => (
      <LoadPlan
        vehicleId="VEH039"
        dockLabel="Kandy dock"
        departsAt="05:10"
        planVersion={4}
        connectivity={SYNCED}
        phase="ready"
        checked={{ done: 2, total: 3 }}
        chilledZone
        rows={veh039Rows({ ord2003: 9, ord2002: 8 })}
        demoExpanded={{ orderId: "ORD2001", draftUnits: 12 }}
        onRecordUnits={noopUnits}
        onFlagShort={noopUnits}
        onFlagIssue={noop}
        onConfirmGate={noop}
        onBack={noop}
      />
    ),
  },
  {
    frameId: "L2.2",
    figmaNodeId: "442:28714",
    name: "L2.2 · 03:20 · Short units entry (VEH036)",
    width: 390,
    height: 1040,
    clock: { date: HERO_DATE, time: "03:20" },
    render: () => (
      <LoadPlan
        vehicleId="VEH036"
        dockLabel="Peliyagoda dock"
        departsAt="03:30"
        planVersion={4}
        connectivity={SYNCED}
        phase="ready"
        checked={{ done: 3, total: 4 }}
        chilledZone
        swap={VEH036_SWAP}
        rows={veh036Rows(3)}
        demoExpanded={{ orderId: "ORD1014", draftUnits: 36 }}
        onRecordUnits={noopUnits}
        onFlagShort={noopUnits}
        onFlagIssue={noop}
        onConfirmGate={noop}
        onBack={noop}
      />
    ),
  },
  {
    frameId: "L2.3-A",
    figmaNodeId: "442:28858",
    name: "L2.3 · A · 04:49 · All checked, gate enabled",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "04:49" },
    render: () => (
      <LoadPlan
        vehicleId="VEH039"
        dockLabel="Kandy dock"
        departsAt="05:10"
        planVersion={4}
        connectivity={SYNCED}
        phase="ready"
        checked={{ done: 3, total: 3 }}
        chilledZone
        rows={veh039Rows({ ord2003: 9, ord2002: 8, ord2001: 12 })}
        onRecordUnits={noopUnits}
        onFlagShort={noopUnits}
        onFlagIssue={noop}
        onConfirmGate={noop}
        onBack={noop}
      />
    ),
  },
  {
    frameId: "L2.3-B",
    figmaNodeId: "442:28959",
    name: "L2.3 · B · 04:49 · PIN sheet: confirm VEH039 loaded",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "04:49" },
    render: () => (
      <div>
        <LoadPlan
          vehicleId="VEH039"
          dockLabel="Kandy dock"
          departsAt="05:10"
          planVersion={4}
          connectivity={SYNCED}
          phase="ready"
          checked={{ done: 3, total: 3 }}
          chilledZone
          rows={veh039Rows({ ord2003: 9, ord2002: 8, ord2001: 12 })}
          onRecordUnits={noopUnits}
          onFlagShort={noopUnits}
          onFlagIssue={noop}
          onConfirmGate={noop}
          onBack={noop}
        />
        <PinSheet
          open
          onOpenChange={noop}
          title="Confirm VEH039 loaded"
          whoLabel="Who's acknowledging?"
          people={PEOPLE}
          initialPersonId="ruwan"
          demoPhase="entry"
          demoDigits="12"
          verify={async () => true}
          onConfirmed={noop}
          confirmedText={(name) => `Loaded by ${name}`}
        />
      </div>
    ),
  },
  {
    frameId: "L2.4",
    figmaNodeId: "442:29120",
    name: "L2.4 · 04:50 · Loaded / cleared",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "04:50" },
    render: () => (
      <LoadPlan
        vehicleId="VEH039"
        dockLabel="Kandy dock"
        departsAt="05:10"
        planVersion={4}
        connectivity={SYNCED}
        phase="loaded"
        checked={{ done: 3, total: 3 }}
        chilledZone
        rows={veh039Rows({ ord2003: 9, ord2002: 8, ord2001: 12 })}
        loadedBy={{ name: "Ruwan", at: "04:50" }}
        whoKnows={["Nimal's phone shows 3 orders on board", "Dispatch and OUT084 see Loaded"]}
        onRecordUnits={noopUnits}
        onFlagShort={noopUnits}
        onFlagIssue={noop}
        onConfirmGate={noop}
        onBack={noop}
      />
    ),
  },
  {
    frameId: "L2.5",
    figmaNodeId: "442:29162",
    name: "L2.5 · 02:56 · Held (VEH003)",
    width: 390,
    height: 1240,
    clock: { date: HERO_DATE, time: "02:56" },
    render: () => (
      <LoadPlan
        vehicleId="VEH003"
        dockLabel="Peliyagoda dock"
        departsAt="03:30"
        planVersion={3}
        connectivity={SYNCED}
        phase="held"
        checked={{ done: 0, total: 5 }}
        chilledZone
        rows={veh003HeldRows()}
        heldReason="Held: reefer unit failed pre-departure check at 02:55"
        heldGoTo={{ label: "Go to VEH035", onClick: noop }}
        onRecordUnits={noopUnits}
        onFlagShort={noopUnits}
        onFlagIssue={noop}
        onConfirmGate={noop}
        onCallDispatch={noop}
        onBack={noop}
      />
    ),
  },
  {
    frameId: "L2.6-A",
    figmaNodeId: "442:29293",
    name: "L2.6 · A · 03:10 · VEH036 reload after swap",
    width: 390,
    height: 1360,
    clock: { date: HERO_DATE, time: "03:10" },
    render: () => (
      <LoadPlan
        vehicleId="VEH036"
        dockLabel="Peliyagoda dock"
        departsAt="03:30"
        planVersion={4}
        connectivity={SYNCED}
        phase="ready"
        checked={{ done: 0, total: 4 }}
        chilledZone
        swap={VEH036_SWAP}
        capacity={VEH036_CAPACITY}
        rows={veh036Rows(0)}
        onRecordUnits={noopUnits}
        onFlagShort={noopUnits}
        onFlagIssue={noop}
        onConfirmGate={noop}
        onBack={noop}
      />
    ),
  },
  {
    frameId: "L2.6-B",
    figmaNodeId: "442:29445",
    name: "L2.6 · B · 03:25 · VEH036 loaded",
    width: 390,
    height: 1340,
    clock: { date: HERO_DATE, time: "03:25" },
    render: () => (
      <LoadPlan
        vehicleId="VEH036"
        dockLabel="Peliyagoda dock"
        departsAt="03:30"
        planVersion={4}
        connectivity={SYNCED}
        phase="loaded"
        checked={{ done: 4, total: 4 }}
        chilledZone
        swap={VEH036_SWAP}
        capacity={VEH036_CAPACITY}
        rows={veh036Rows(4)}
        loadedBy={{ name: "Priya", at: "03:25" }}
        onRecordUnits={noopUnits}
        onFlagShort={noopUnits}
        onFlagIssue={noop}
        onConfirmGate={noop}
        onBack={noop}
      />
    ),
  },
  {
    frameId: "L2.S-1",
    figmaNodeId: "442:29604",
    name: "L2.S · 1 · Empty: no orders on this vehicle",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:10" },
    render: () => (
      <LoadPlan
        vehicleId="VEH039"
        dockLabel="Kandy dock"
        departsAt="05:10"
        planVersion={4}
        connectivity={SYNCED}
        phase="empty"
        checked={{ done: 0, total: 0 }}
        chilledZone={false}
        rows={[]}
        onRecordUnits={noopUnits}
        onFlagShort={noopUnits}
        onFlagIssue={noop}
        onConfirmGate={noop}
        onBack={noop}
      />
    ),
  },
  {
    frameId: "L2.S-2",
    figmaNodeId: "442:29624",
    name: "L2.S · 2 · Loading",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:10" },
    render: () => (
      <LoadPlan
        vehicleId="VEH039"
        dockLabel="Kandy dock"
        departsAt="05:10"
        planVersion={4}
        connectivity={SYNCED}
        phase="loading"
        checked={{ done: 0, total: 0 }}
        chilledZone={false}
        rows={[]}
        onRecordUnits={noopUnits}
        onFlagShort={noopUnits}
        onFlagIssue={noop}
        onConfirmGate={noop}
        onBack={noop}
      />
    ),
  },
  {
    frameId: "L2.S-3",
    figmaNodeId: "442:29659",
    name: "L2.S · 3 · Offline: checks saved on tablet",
    width: 390,
    height: 1000,
    clock: { date: HERO_DATE, time: "05:10" },
    render: () => (
      <LoadPlan
        vehicleId="VEH039"
        dockLabel="Kandy dock"
        departsAt="05:10"
        planVersion={4}
        connectivity={OFFLINE_CHIP}
        phase="offline"
        checked={{ done: 2, total: 3 }}
        chilledZone
        rows={veh039Rows({ ord2003: 9, ord2002: 8 }).map((r) => (r.state === "checked" ? { ...r, rowNote: "offline" } : r))}
        onRecordUnits={noopUnits}
        onFlagShort={noopUnits}
        onFlagIssue={noop}
        onConfirmGate={noop}
        onBack={noop}
      />
    ),
  },
  {
    frameId: "L2.S-4",
    figmaNodeId: "442:29774",
    name: "L2.S · 4 · Error: check not saved",
    width: 390,
    height: 1000,
    clock: { date: HERO_DATE, time: "05:10" },
    render: () => (
      <LoadPlan
        vehicleId="VEH039"
        dockLabel="Kandy dock"
        departsAt="05:10"
        planVersion={4}
        connectivity={SYNCED}
        phase="ready"
        checked={{ done: 2, total: 3 }}
        chilledZone
        rows={veh039Rows({ ord2003: 9, ord2002: 8 }).map((r) => (r.orderId === "ORD2001" ? { ...r, rowNote: "error" } : r))}
        onRecordUnits={noopUnits}
        onFlagShort={noopUnits}
        onFlagIssue={noop}
        onConfirmGate={noop}
        onBack={noop}
      />
    ),
  },
  l3Frame("L3.1", "442:29884", "L3.1 · 02:55 · Flag exception: choose type", "02:55", SYNCED, { phase: "form" }),
  l3Frame("L3.2-A", "442:30012", "L3.2 · A · 02:55 · Flag exception: details (Vehicle check failed)", "02:55", SYNCED, {
    phase: "form",
    prefill: { type: "Vehicle check failed" },
  }),
  l3Frame("L3.2-B", "442:30131", "L3.2 · B · 02:55 · Flag exception: details (Missing item)", "02:55", SYNCED, {
    phase: "form",
    prefill: { type: "Missing item", orderId: "ORD1014", unitsShort: 4 },
  }),
  l3Frame("L3.3-A", "442:30276", "L3.3 · A · 02:55 · Flag sent: Kumari reviewing", "02:55", SYNCED, { phase: "sent", sent: L3_SENT }),
  l3Frame("L3.3-B", "442:30384", "L3.3 · B · 03:02 · Flag sent: decision made, plan v4", "03:02", SYNCED, {
    phase: "decided",
    sent: { ...L3_SENT, decidedVersion: 4 },
  }),
  {
    frameId: "L3.4-A",
    figmaNodeId: "442:30494",
    name: "L3.4 · A · 02:56 · Flag queued offline",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "02:56" },
    render: () => l3Status("queued", OFFLINE_CHIP),
  },
  {
    frameId: "L3.4-B",
    figmaNodeId: "442:30547",
    name: "L3.4 · B · Flag: error, couldn't send",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "02:56" },
    render: () => l3Status("failed", SYNCED),
  },
  l3Frame("L3.4-C", "442:30582", "L3.4 · C · Flag: sending to Dispatch", "02:55", SYNCING_CHIP, {
    phase: "sending",
    prefill: { type: "Vehicle check failed" },
  }),
];
