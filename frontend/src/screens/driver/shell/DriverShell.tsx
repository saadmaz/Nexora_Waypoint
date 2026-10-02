import { useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { formatTime } from "../../../field/clock/clock";
import { useNow } from "../../../field/clock/useClock";
import { BottomSheet, ConnectivityChip, FieldTabBar, FieldTopBar, NotificationBell, type ChipStatus, type FieldTab } from "../../../field/components";
import { useConnectivity, type ConnectivitySnapshot } from "../../../field/offline";
import { useT } from "../context/DriverContext";
import styles from "./DriverShell.module.css";

type DriverTabKey = "run" | "issues" | "history" | "me";

/**
 * Pre-departure, the chip reads "Synced HH:MM" against the current clock (R1.2 to R1.4: every
 * frame's chip time matches that frame's own clock exactly, since everything on screen is current
 * by definition before the driver has left). Once departed it simplifies to "Online" (R1.5, R1.10,
 * R2, R3): live tracking matters more than a sync timestamp while driving.
 */
function chipStatus(connectivity: ConnectivitySnapshot, preDeparture: boolean): ChipStatus {
  if (connectivity.status === "offline") return "offline";
  if (connectivity.status === "syncing") return "syncing";
  if (connectivity.status === "failed") return "failed";
  return preDeparture ? "synced" : "online";
}

export type DriverShellProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  /** Shows "Synced HH:MM" instead of "Online" while connected (R1's pre-departure states). */
  preDeparture?: boolean;
  /** The OfflineBanner, built by the caller from its own data. Omit it when nothing to say. */
  banner?: ReactNode;
  /** The pinned action bar, above the tab bar. */
  pinned?: ReactNode;
  showTabBar?: boolean;
  /** The state gallery only: `connectivity` is one real store shared by every frame on the page, so
   * a frame that needs its own moment (Online, Offline · 5, Synced 04:54 …) passes it here instead
   * of reading the live singleton. The single-frame `?frame=` view (what the compare script shoots)
   * is unaffected either way. */
  connectivityOverride?: ConnectivitySnapshot;
  children: ReactNode;
};

/**
 * The driver chrome shared by every screen (field conventions section 5, driver prompt 3 section
 * 3): top bar with the connectivity chip and the bell, an optional banner, the scrollable body, an
 * optional pinned action bar, and the Run / Issues / History / Me tab bar. The chip opens a
 * placeholder outbox sheet; driver prompt 4 replaces it with the real one.
 */
export function DriverShell({
  title,
  subtitle,
  onBack,
  preDeparture = false,
  banner,
  pinned,
  showTabBar = true,
  connectivityOverride,
  children,
}: DriverShellProps) {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const liveConnectivity = useConnectivity();
  const connectivity = connectivityOverride ?? liveConnectivity;
  const now = useNow();
  const [outboxOpen, setOutboxOpen] = useState(false);

  const status = chipStatus(connectivity, preDeparture);
  const chipTime = status === "synced" ? now : status === "failed" ? (connectivity.lastFailureAt ?? now) : undefined;

  const activeTab: DriverTabKey = location.pathname.startsWith("/driver/issues")
    ? "issues"
    : location.pathname.startsWith("/driver/history")
      ? "history"
      : location.pathname.startsWith("/driver/me")
        ? "me"
        : "run";

  const tabs: FieldTab<DriverTabKey>[] = [
    { key: "run", label: t("tab.run"), icon: "route" },
    { key: "issues", label: t("tab.issues"), icon: "flag" },
    { key: "history", label: t("tab.history"), icon: "history" },
    { key: "me", label: t("tab.me"), icon: "user" },
  ];

  return (
    <div className={styles.page}>
      <FieldTopBar title={title} subtitle={subtitle} onBack={onBack}>
        <ConnectivityChip
          status={status}
          time={chipTime !== undefined ? formatTime(chipTime) : undefined}
          count={connectivity.waitingCount}
          onClick={() => setOutboxOpen(true)}
        />
        <NotificationBell count={0} onClick={() => navigate("/driver/notifications")} />
      </FieldTopBar>
      {banner}
      <main className={styles.main}>{children}</main>
      {pinned}
      {showTabBar && <FieldTabBar tabs={tabs} active={activeTab} onSelect={(key) => navigate(`/driver/${key}`)} />}
      <BottomSheet open={outboxOpen} onOpenChange={setOutboxOpen} title="Outbox" description="What's waiting to send.">
        <p className={styles.outboxBody}>Coming in driver prompt 4.</p>
      </BottomSheet>
    </div>
  );
}
