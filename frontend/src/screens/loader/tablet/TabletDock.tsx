import { useCallback } from "react";
import { useLocation, useMatch } from "react-router-dom";
import { formatDate, formatTime } from "../../../field/clock/clock";
import { useNow } from "../../../field/clock/useClock";
import type { ChipStatus } from "../../../field/components";
import { useConnectivity, useFieldQuery, type ConnectivityStatus } from "../../../field/offline";
import { Icon } from "../../../shared/ui/Icon";
import { DockContainer } from "../dock/DockContainer";
import { DOCKS } from "../../../domain/field";
import { LoadPlanContainer } from "../loadplan/LoadPlanContainer";
import { useLoader } from "../LoaderContext";
import { TabletShell } from "./TabletShell";
import styles from "./TabletDock.module.css";

function chipStatus(status: ConnectivityStatus): ChipStatus {
  return status === "online" ? "synced" : status;
}

/**
 * The dock and load plan routes at 1024 px and above (L1.7). The URL still says which vehicle is open
 * (`/loader/vehicles/VEH039/trips/1`, with `/flag` over it), so a reload, a link and the flag flow all
 * work as they do on a phone; on `/loader/dock` itself the next vehicle to load is selected.
 */
export function TabletDock() {
  const { api, dockId } = useLoader();
  const now = useNow(1000);
  const connectivity = useConnectivity();
  const location = useLocation();
  const route = useMatch("/loader/vehicles/:vehicleId/trips/:trip/*");
  const flagOpen = location.pathname.endsWith("/flag");
  const dock = useFieldQuery(`loader:dock:${dockId}`, useCallback(() => api.getDock(dockId), [api, dockId]));
  const view = dock.status === "ready" ? dock.value : undefined;

  let selected: { vehicleId: string; trip: 1 | 2 } | undefined;
  if (route?.params.vehicleId) {
    selected = { vehicleId: route.params.vehicleId, trip: route.params.trip === "2" ? 2 : 1 };
  } else if (view && !view.newerVersionExists && view.acknowledgement) {
    const next = view.vehicles.find((v) => v.status !== "held" && v.status !== "replaced" && v.status !== "loaded") ?? view.vehicles[0];
    if (next) selected = { vehicleId: next.vehicle.id, trip: next.activeTrip === 2 ? 2 : 1 };
  }

  const locked = !!view && (view.newerVersionExists || !view.acknowledgement);

  return (
    <TabletShell
      dockLabel={`${DOCKS.find((d) => d.id === dockId)?.name ?? dockId} dock`}
      dateLabel={formatDate(now)}
      connectivity={{
        status: chipStatus(connectivity.status),
        time: connectivity.lastSyncAt ? formatTime(connectivity.lastSyncAt) : undefined,
        count: connectivity.waitingCount,
      }}
      master={<DockContainer embedded query={dock} selectedVehicleId={selected?.vehicleId} />}
      detail={
        selected ? (
          <LoadPlanContainer key={`${selected.vehicleId}:${selected.trip}`} embedded vehicleId={selected.vehicleId} trip={selected.trip} flagOpen={flagOpen} />
        ) : (
          <div className={styles.placeholder}>
            <span className={styles.placeholderIcon}>
              <Icon name={locked ? "lock" : "truck"} size={24} color="ink-muted" />
            </span>
            <p className={styles.placeholderTitle}>
              {locked ? `Acknowledge plan v${view?.planVersion} to open a load list` : "Choose a vehicle"}
            </p>
            <p className={styles.placeholderBody}>
              {locked ? "Vehicles stay locked until a loader acknowledges the current plan." : "Its load list opens here."}
            </p>
          </div>
        )
      }
    />
  );
}
