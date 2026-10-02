import type { GalleryFrame } from "../../../field/gallery/StateGallery";
import { PinSheet } from "../../../field/components";
import { HERO_DATE, HERO_EVENING_DATE } from "../../../field/clock/clock";
import { Dock, type DockAlertModel } from "../dock/Dock";
import type { VehicleCardProps } from "../dock/VehicleCard";

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
];
