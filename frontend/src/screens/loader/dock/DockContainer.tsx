import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { colomboMs, formatTime, HERO_DATE, minutesUntil } from "../../../field/clock/clock";
import { useFieldClock, useNow } from "../../../field/clock/useClock";
import { useConnectivity, useFieldQuery, type ConnectivityStatus, type FieldQueryResult } from "../../../field/offline";
import { formatCountdown } from "../../../field/format";
import { PinSheet, type ChipStatus } from "../../../field/components";
import { DOCKS } from "../fixtures";
import { usePeople } from "../usePeople";
import { useLoader } from "../LoaderContext";
import type { DepotId } from "../../../domain/field";
import type { DockView as DockViewModel, DockVehicleSummary } from "../types";
import { Dock, type DockAlertModel } from "./Dock";
import type { VehicleCardProps } from "./VehicleCard";

function chipStatus(status: ConnectivityStatus): ChipStatus {
  return status === "online" ? "synced" : status;
}

/** Only Peliyagoda's vehicles actually changed between v3 and v4 (the VEH003 → VEH036 swap). */
function hasDiff(dockId: DepotId): boolean {
  return dockId === "peliyagoda";
}

/**
 * `embedded` is L1.7's master pane: no top bar, cards that select (no action button of their own) and
 * the selected one marked. The router decides which vehicle is selected; this only draws it.
 */
export function DockContainer({
  embedded = false,
  selectedVehicleId,
  query: shared,
}: {
  embedded?: boolean;
  selectedVehicleId?: string;
  /** The tablet shell reads the same dock to pick the detail pane, so it owns the query and hands it down. */
  query?: FieldQueryResult<DockViewModel>;
}) {
  const { api, dockId } = useLoader();
  const navigate = useNavigate();
  const clock = useFieldClock();
  const now = useNow(1000);
  const connectivity = useConnectivity();
  const own = useFieldQuery(shared ? null : `loader:dock:${dockId}`, useCallback(() => api.getDock(dockId), [api, dockId]));
  const query = shared ?? own;
  const [ackOpen, setAckOpen] = useState(false);

  useEffect(() => {
    if (clock.fixed) return;
    const id = window.setInterval(() => query.refresh(), 15_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock.fixed, query.refresh]);

  const dockLabel = `${DOCKS.find((d) => d.id === dockId)?.name ?? dockId} dock`;
  const chip = {
    status: chipStatus(connectivity.status),
    time: connectivity.lastSyncAt ? formatTime(connectivity.lastSyncAt) : undefined,
    count: connectivity.waitingCount,
  };

  if (query.status === "loading") {
    return <Dock dockLabel={dockLabel} nowLabel={formatTime(now)} connectivity={chip} embedded={embedded} state="loading" />;
  }
  if (query.status === "error") {
    return <Dock dockLabel={dockLabel} nowLabel={formatTime(now)} connectivity={chip} embedded={embedded} state="error" onRetry={query.retry} />;
  }

  const view = query.value;

  if (view.vehicles.length === 0) {
    return (
      <Dock
        dockLabel={dockLabel}
        nowLabel={formatTime(now)}
        connectivity={chip}
        embedded={embedded}
        state="empty"
        emptyReleaseLabel="23:40"
        emptyCheckedLabel={formatTime(query.updatedAt)}
      />
    );
  }

  const ack = view.acknowledgement;
  const changed = view.newerVersionExists;
  const diffMatters = hasDiff(dockId);
  const locked = changed || !ack;

  let alert: DockAlertModel;
  if (changed && diffMatters) {
    alert = {
      kind: "changed",
      fromVersion: ack?.version ?? view.planVersion - 1,
      toVersion: view.planVersion,
      onReview: () => navigate("/loader/changes"),
    };
  } else if (changed && !diffMatters) {
    alert = { kind: "noChangeReady", version: view.planVersion };
  } else if (!ack) {
    alert = {
      kind: "ready",
      version: view.planVersion,
      releasedAt: view.planReleasedAt,
      vehicleCount: view.vehicleCount,
      orderCount: view.orderCount,
      firstDeparture: view.firstDeparture,
    };
  } else if (ack.version >= 4 && !diffMatters) {
    alert = { kind: "noChangeAcknowledged", version: ack.version, by: ack.personName, at: ack.at };
  } else {
    alert = { kind: "acknowledgedCompact", version: ack.version, by: ack.personName, at: ack.at };
  }

  const heldVehicle = view.vehicles.find((v) => v.status === "held");
  const nextToLoad = view.vehicles.find((v) => v.status !== "held" && v.status !== "replaced" && v.status !== "loaded");
  const showChangeTags = changed && diffMatters;

  const vehicles: VehicleCardProps[] = view.vehicles.map((v) =>
    buildCard(v, {
      locked,
      lockedVersion: view.planVersion,
      changeTag: showChangeTags ? (v.vehicle.id === "VEH003" || v.vehicle.id === "VEH036" ? "Changed" : "No change") : undefined,
      primary: !locked && v.vehicle.id === nextToLoad?.vehicle.id,
      embedded,
      selected: v.vehicle.id === selectedVehicleId,
      goToId: heldVehicle?.vehicle.id === v.vehicle.id ? nextToLoad?.vehicle.id : undefined,
      now,
      navigate,
    }),
  );

  const showsPinnedAcknowledge = !changed && !ack;

  if (query.stale) {
    return (
      <Dock
        dockLabel={dockLabel}
        nowLabel={formatTime(now)}
        connectivity={chip}
        embedded={embedded}
        state="offline"
        vehicles={vehicles}
        offlineVersion={view.planVersion}
        offlineAsOf={formatTime(query.updatedAt)}
        onCallDispatch={() => undefined}
      />
    );
  }

  return (
    <Dock
      dockLabel={dockLabel}
      nowLabel={formatTime(now)}
      connectivity={chip}
      embedded={embedded}
      state="ready"
      alert={alert}
      vehicles={vehicles}
      pinnedAcknowledge={showsPinnedAcknowledge ? { label: `Acknowledge plan v${view.planVersion}`, onClick: () => setAckOpen(true) } : undefined}
    >
      {showsPinnedAcknowledge && (
        <PinAck
          open={ackOpen}
          onOpenChange={setAckOpen}
          dockId={dockId}
          version={view.planVersion}
          onDone={() => {
            setAckOpen(false);
            query.refresh();
          }}
        />
      )}
    </Dock>
  );
}

function buildCard(
  v: DockVehicleSummary,
  opts: {
    locked: boolean;
    lockedVersion: number;
    changeTag?: "Changed" | "No change";
    primary: boolean;
    embedded: boolean;
    selected: boolean;
    goToId?: string;
    now: number;
    navigate: ReturnType<typeof useNavigate>;
  },
): VehicleCardProps {
  const minutes = minutesUntil(colomboMs(HERO_DATE, v.departsAt), opts.now);
  const inLabel = formatCountdown(minutes);
  const goTo = opts.goToId
    ? { label: `Go to ${opts.goToId}`, onClick: () => opts.navigate(`/loader/vehicles/${opts.goToId}/trips/1`) }
    : undefined;
  const open = () => opts.navigate(`/loader/vehicles/${v.vehicle.id}/trips/${v.activeTrip}`);
  const label = v.status === "loaded" ? `View ${v.vehicle.id}` : opts.primary ? `Load ${v.vehicle.id} · departs ${v.departsAt}` : `Load ${v.vehicle.id}`;
  return {
    id: v.vehicle.id,
    temperature: v.vehicle.temperature === "reefer" ? "reefer" : "ambient",
    trips: v.trips,
    orderCount: v.orderCount,
    departsAt: v.departsAt,
    orderIds: v.orderIds,
    inLabel,
    locked: opts.locked,
    status: v.status,
    checked: v.checked,
    changeTag: opts.changeTag,
    heldReason: v.heldReason,
    lockedVersion: opts.locked ? opts.lockedVersion : undefined,
    goTo,
    action: goTo || opts.embedded ? undefined : { label, primary: opts.primary, icon: opts.primary ? "truck" : undefined },
    selected: opts.selected,
    onSelect: opts.embedded ? open : undefined,
    onPress: open,
  };
}

function PinAck({
  open,
  onOpenChange,
  dockId,
  version,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dockId: DepotId;
  version: number;
  onDone: () => void;
}) {
  const { api, setCurrentPerson } = useLoader();
  const people = usePeople();
  return (
    <PinSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Acknowledge plan v${version} at ${dockId === "peliyagoda" ? "Peliyagoda" : "Kandy"} dock`}
      whoLabel="Who's acknowledging?"
      people={people}
      verify={(personId, pin, otherName) => api.verifyPin(personId, pin, otherName)}
      onConfirmed={(personId, name) => {
        setCurrentPerson({ id: personId, name });
        void api.acknowledgePlan({ dockId, version, personId, personName: name }).then(onDone);
      }}
      confirmedText={(name) => `Acknowledged by ${name}`}
    />
  );
}
