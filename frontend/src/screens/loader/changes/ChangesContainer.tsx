import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatTime } from "../../../field/clock/clock";
import { useFieldClock, useNow } from "../../../field/clock/useClock";
import { PinSheet, type ChipStatus } from "../../../field/components";
import { useConnectivity, useFieldQuery, type ConnectivityStatus } from "../../../field/offline";
import { usePeople } from "../usePeople";
import { useLoader } from "../LoaderContext";
import { PlanChanged, type PlanChangedPhase } from "./PlanChanged";

const DOCK_NAME: Record<string, string> = { peliyagoda: "Peliyagoda", kandy: "Kandy" };

function chipStatus(status: ConnectivityStatus): ChipStatus {
  return status === "online" ? "synced" : status;
}

/**
 * L4 on the live route `/loader/changes`: what changed for this dock between the version it last
 * acknowledged and the current one. The "from" version is the dock's acknowledgement; once this
 * screen acknowledges, it keeps showing that same diff (L4.2) instead of reading "from" as the
 * new version and finding nothing changed.
 */
export function ChangesContainer() {
  const { api, dockId, setCurrentPerson } = useLoader();
  const people = usePeople();
  const navigate = useNavigate();
  const clock = useFieldClock();
  const now = useNow(1000);
  const connectivity = useConnectivity();
  const [pinOpen, setPinOpen] = useState(false);
  const [acked, setAcked] = useState<{ by: string; at: string } | null>(null);

  const dock = useFieldQuery(`loader:dock:${dockId}`, useCallback(() => api.getDock(dockId), [api, dockId]));
  const view = dock.status === "ready" ? dock.value : undefined;
  const toVersion = view?.planVersion ?? 4;
  const ackVersion = view?.acknowledgement?.version;
  const fromVersion = acked ? toVersion - 1 : (ackVersion ?? toVersion - 1);
  const newer = !!view && (view.newerVersionExists || !!acked);

  const diff = useFieldQuery(
    newer ? `loader:diff:${dockId}:${fromVersion}:${toVersion}` : null,
    useCallback(() => api.getPlanDiff(dockId, fromVersion, toVersion), [api, dockId, fromVersion, toVersion]),
  );

  // A newer plan can land while this screen is open; the dock is the source of truth for it.
  useEffect(() => {
    if (clock.fixed) return;
    const id = window.setInterval(() => dock.refresh(), 15_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock.fixed, dock.refresh]);

  const chip = {
    status: chipStatus(connectivity.status),
    time: connectivity.lastSyncAt ? formatTime(connectivity.lastSyncAt) : undefined,
    count: connectivity.waitingCount,
  };
  const dockName = DOCK_NAME[dockId] ?? dockId;
  const toDock = () => navigate("/loader/dock");

  let phase: PlanChangedPhase;
  const diffView = diff.status === "ready" ? diff.value : undefined;
  const hasChanges = !!diffView && (diffView.removed.length > 0 || diffView.changed.length > 0);
  if (dock.status === "loading") phase = "loading";
  else if (dock.status === "error") phase = "error";
  else if (!newer) phase = "upToDate";
  else if (diff.status === "loading") phase = "loading";
  else if (diff.status === "error") phase = "error";
  else if (dock.stale || diff.stale) phase = "offline";
  else if (!hasChanges) phase = "noChange";
  else phase = acked ? "acknowledged" : "ready";

  const retry = () => {
    dock.retry();
    diff.retry();
  };

  const acknowledge = (personId: string, personName: string) => {
    setCurrentPerson({ id: personId, name: personName });
    setPinOpen(false);
    void api.acknowledgePlan({ dockId, version: toVersion, personId, personName }).then((result) => {
      if (result === "conflict") return dock.refresh();
      if (hasChanges) setAcked({ by: personName, at: formatTime(now) });
      else return navigate("/loader/dock");
      dock.refresh();
    });
  };

  const beginLoading = () => {
    const vehicle = diffView?.changed[0]?.toVehicleId;
    navigate(vehicle ? `/loader/vehicles/${vehicle}/trips/1` : "/loader/dock");
  };

  return (
    <PlanChanged
      phase={phase}
      dockName={dockName}
      fromVersion={fromVersion}
      toVersion={toVersion}
      nowLabel={formatTime(now)}
      connectivity={chip}
      diff={diffView}
      ack={acked ?? undefined}
      lastSyncedAt={diff.status === "ready" ? formatTime(diff.updatedAt) : undefined}
      noChangeVehicleId={view?.vehicles[0]?.vehicle.id}
      onAcknowledge={() => setPinOpen(true)}
      onBeginLoading={beginLoading}
      onRetry={retry}
      onBack={toDock}
    >
      <PinSheet
        open={pinOpen}
        onOpenChange={setPinOpen}
        title={`Acknowledge plan v${toVersion} at ${dockName} dock`}
        whoLabel="Who's acknowledging?"
        people={people}
        verify={(personId, pin, otherName) => api.verifyPin(personId, pin, otherName)}
        onConfirmed={acknowledge}
        confirmedText={(name) => `Acknowledged by ${name}`}
      />
    </PlanChanged>
  );
}
