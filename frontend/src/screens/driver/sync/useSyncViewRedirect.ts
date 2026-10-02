import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFieldClock } from "../../../field/clock/useClock";
import { consumeSyncView, usePendingSyncView, type PendingSyncView } from "./syncView";

export function syncResultPath(view: PendingSyncView): string {
  return `/driver/sync-result?view=${view.kind}${view.outletId ? `&stop=${view.outletId}` : ""}`;
}

/**
 * Shows a finished sync once (driver prompt 4 section 4): while `enabled`, a pending result opens
 * R5 and is marked seen. The Run screen enables it, and so does an open Outbox sheet; the outcome
 * screens never do, so a result never interrupts the driver while recording. The result stays
 * pending until one of those is on screen. The gallery's fixed clock never redirects.
 */
export function useSyncViewRedirect(enabled: boolean, onShown?: () => void): void {
  const navigate = useNavigate();
  const clock = useFieldClock();
  const pending = usePendingSyncView();

  useEffect(() => {
    if (!enabled || clock.fixed || !pending) return;
    const view = consumeSyncView();
    if (!view) return;
    onShown?.();
    navigate(syncResultPath(view), { state: { clientIds: view.clientIds } });
  }, [enabled, clock, pending, navigate, onShown]);
}
