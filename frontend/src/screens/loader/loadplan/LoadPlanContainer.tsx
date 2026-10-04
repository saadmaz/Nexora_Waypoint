import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { formatTime } from "../../../field/clock/clock";
import { useFieldClock } from "../../../field/clock/useClock";
import { PinSheet } from "../../../field/components";
import { useConnectivity, useFieldQuery, type ConnectivityStatus } from "../../../field/offline";
import { usePeople } from "../usePeople";
import { useLoader } from "../LoaderContext";
import type { LoadPlanOrderRow } from "../types";
import { FlagContainer } from "../flag/FlagContainer";
import { askDispatchFlag } from "../flag/askDispatch";
import type { FlagPrefill } from "../flag/FlagSheet";
import { LoadPlan, type CapacityStat, type LoadPlanRow, type SwapBanner } from "./LoadPlan";
import type { ChipStatus } from "../../../field/components";
import { LOADER_POLL_MS } from "../poll";

const DOCK_LABEL: Record<string, string> = { peliyagoda: "Peliyagoda dock", kandy: "Kandy dock" };
const DOCK_TYPE_LABEL: Record<string, string> = { rear_dock: "Rear dock", street: "Street", mall_bay: "Mall bay" };

function chipStatus(status: ConnectivityStatus): ChipStatus {
  return status === "online" ? "synced" : status;
}

function buildRows(orders: LoadPlanOrderRow[]): LoadPlanRow[] {
  const outletCounts = new Map<string, number>();
  for (const o of orders) outletCounts.set(o.outletId, (outletCounts.get(o.outletId) ?? 0) + 1);
  return orders.map((o) => ({
    orderId: o.orderId,
    outletId: o.outletId,
    loadNumber: o.loadNumber,
    stopNumber: o.stopNumber,
    brand: o.brand,
    chilled: o.temperature === "chilled",
    dockLabel: DOCK_TYPE_LABEL[o.dock] ?? o.dock,
    unitsExpected: o.unitsExpected,
    unitsLoaded: o.unitsLoaded,
    weightKg: o.weightKg,
    state: o.state,
    protectedOrder: o.protectedOrder,
    orderIdIn: (outletCounts.get(o.outletId) ?? 1) > 1 ? "heading" : "quantity",
  }));
}

type LoadPlanContainerProps = {
  /** The `/flag` route: the same load plan with the L3 flag sheet over it. */
  flagOpen?: boolean;
  /** L1.7's detail pane: the tablet shell picks the vehicle, so it is a prop and not the route's. */
  embedded?: boolean;
  vehicleId?: string;
  trip?: 1 | 2;
};

export function LoadPlanContainer({ flagOpen = false, embedded = false, vehicleId: vehicleProp, trip: tripProp }: LoadPlanContainerProps) {
  const params = useParams();
  const vehicleId = vehicleProp ?? params.vehicleId ?? "";
  const trip: 1 | 2 = tripProp ?? (params.trip === "2" ? 2 : 1);
  const { api, dockId, currentPerson, setCurrentPerson } = useLoader();
  const people = usePeople();
  const navigate = useNavigate();
  const location = useLocation();
  const clock = useFieldClock();
  const connectivity = useConnectivity();
  const [gateOpen, setGateOpen] = useState(false);

  const key = `loader:loadplan:${vehicleId}:${trip}`;
  const query = useFieldQuery(key, useCallback(() => api.getLoadPlan(vehicleId, trip), [api, vehicleId, trip]));

  useEffect(() => {
    if (clock.fixed) return;
    const id = window.setInterval(() => query.refresh(), LOADER_POLL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock.fixed, query.refresh]);

  const chip = {
    status: chipStatus(connectivity.status),
    time: connectivity.lastSyncAt ? formatTime(connectivity.lastSyncAt) : undefined,
    count: connectivity.waitingCount,
  };
  const dockLabel = DOCK_LABEL[dockId] ?? dockId;
  const onBack = () => navigate("/loader/dock");
  const goFlag = (prefill?: FlagPrefill) =>
    navigate(`/loader/vehicles/${vehicleId}/trips/${trip}/flag`, { state: prefill });
  const closeFlag = () => navigate(`/loader/vehicles/${vehicleId}/trips/${trip}`, { replace: true });

  if (query.status === "loading") {
    return (
      <LoadPlan
        vehicleId={vehicleId}
        dockLabel={dockLabel}
        departsAt=""
        planVersion={0}
        connectivity={chip}
        embedded={embedded}
        trip={trip}
        phase="loading"
        checked={{ done: 0, total: 0 }}
        chilledZone={false}
        rows={[]}
        onRecordUnits={() => undefined}
        onFlagShort={() => undefined}
        onFlagIssue={() => undefined}
        onConfirmGate={() => undefined}
        onBack={onBack}
      />
    );
  }
  if (query.status === "error") {
    return (
      <LoadPlan
        vehicleId={vehicleId}
        dockLabel={dockLabel}
        departsAt=""
        planVersion={0}
        connectivity={chip}
        embedded={embedded}
        trip={trip}
        phase="error"
        checked={{ done: 0, total: 0 }}
        chilledZone={false}
        rows={[]}
        onRecordUnits={() => undefined}
        onFlagShort={() => undefined}
        onFlagIssue={() => undefined}
        onConfirmGate={() => undefined}
        onBack={onBack}
        onRetry={query.retry}
      />
    );
  }

  const view = query.value;
  const rows = buildRows(view.orders);
  const checked = { done: rows.filter((r) => r.state === "checked").length, total: rows.length };
  const chilledZone = rows.some((r) => r.chilled);

  const isSwap = view.replaces !== undefined;
  const swap: SwapBanner | undefined = view.replaces ? { replacesVehicleId: view.replaces, note: `Plan v${view.planVersion}` } : undefined;
  const capacity: CapacityStat | undefined = isSwap
    ? {
        weightKg: view.orders.reduce((s, o) => s + o.weightKg, 0),
        weightCapKg: view.vehicle.weightCapKg,
        volumeM3: Math.round(view.orders.reduce((s, o) => s + o.volumeM3, 0) * 10) / 10,
        volumeCapM3: view.vehicle.volumeCapM3,
      }
    : undefined;

  const phase = query.stale ? "offline" : rows.length === 0 ? "empty" : view.status === "held" ? "held" : view.status === "loaded" ? "loaded" : "ready";

  const recordUnits = (orderId: string, units: number) => {
    void api.recordCheck({ vehicleId, trip, orderId, unitsLoaded: units, personId: currentPerson?.id ?? "unknown" });
    query.refresh();
  };

  return (
    <LoadPlan
      vehicleId={vehicleId}
      dockLabel={dockLabel}
      departsAt={view.departsAt}
      planVersion={view.planVersion}
      connectivity={chip}
      embedded={embedded}
      trip={trip}
      phase={phase}
      checked={checked}
      chilledZone={chilledZone}
      swap={swap}
      capacity={capacity}
      rows={rows}
      heldReason={view.heldReason}
      heldGoTo={view.replacedBy ? { label: `Go to ${view.replacedBy}`, onClick: () => navigate(`/loader/vehicles/${view.replacedBy}/trips/1`) } : undefined}
      loadedBy={view.confirmedBy ? { name: view.confirmedBy, at: view.confirmedAt ?? "" } : undefined}
      whoKnows={[`The driver's phone shows ${rows.length} orders on board`, "Dispatch sees Loaded"]}
      onRecordUnits={recordUnits}
      onFlagShort={(orderId, units) => goFlag({ type: "Missing item", orderId, unitsShort: rows.find((r) => r.orderId === orderId)!.unitsExpected - units })}
      onFlagIssue={() => goFlag()}
      onConfirmGate={() => setGateOpen(true)}
      onCallDispatch={() => goFlag(askDispatchFlag(vehicleId, trip).state)}
      onBack={onBack}
      onRetry={query.retry}
    >
      <PinSheet
        open={gateOpen}
        onOpenChange={setGateOpen}
        title={`Confirm ${vehicleId} loaded`}
        whoLabel="Who's acknowledging?"
        people={people}
        verify={(personId, pin, otherName) => api.verifyPin(personId, pin, otherName)}
        onConfirmed={(personId, name) => {
          setCurrentPerson({ id: personId, name });
          void api.confirmLoaded({ vehicleId, trip, personId, personName: name }).then(() => {
            setGateOpen(false);
            query.refresh();
          });
        }}
        confirmedText={(name) => `Loaded by ${name}`}
      />
      {flagOpen && (
        <FlagContainer
          // A new visit to the flag route (say "Ask Dispatch to call" from the queued screen) starts a fresh sheet.
          key={location.key}
          vehicleId={vehicleId}
          trip={trip}
          view={view}
          dockName={dockLabel.replace(" dock", "")}
          chip={chip}
          onClose={closeFlag}
        />
      )}
    </LoadPlan>
  );
}
