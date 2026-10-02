import type { ReactNode } from "react";
import { formatTime } from "../../field/clock/clock";
import { OfflineBanner } from "../../field/components";
import type { ConnectivitySnapshot } from "../../field/offline";
import type { TFn } from "./stopFormat";

/**
 * The two-part offline banner pattern shared by R1, R2 and R3: once something is waiting,
 * "Offline · N saved on phone" with "Last sync HH:MM" as the detail. `zeroState` is each screen's
 * own line for "nothing has been recorded yet" (R1.6's single combined sentence, R2.1's "route
 * saved").
 */
export function buildOfflineBanner(connectivity: ConnectivitySnapshot, t: TFn, zeroState: ReactNode): ReactNode {
  if (connectivity.status !== "offline") return undefined;
  if (connectivity.waitingCount === 0) return zeroState;
  const time = connectivity.lastSyncAt ? formatTime(connectivity.lastSyncAt) : "--:--";
  return (
    <OfflineBanner tone="offline" detail={t("banner.offlineLastSync", { time })}>
      {t("banner.offlineSaved", { count: connectivity.waitingCount })}
    </OfflineBanner>
  );
}
