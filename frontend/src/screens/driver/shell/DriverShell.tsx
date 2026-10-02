import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { formatTime } from "../../../field/clock/clock";
import { useFieldClock, useNow } from "../../../field/clock/useClock";
import { ConnectivityChip, FieldTabBar, FieldTopBar, NotificationBell, type ChipStatus, type FieldTab } from "../../../field/components";
import { connectivity as connectivityStore, useConnectivity, type ConnectivitySnapshot } from "../../../field/offline";
import { useCoverageGap, useDriverApi, useDriverSettings, useOutboxOpen, useT } from "../context/DriverContext";
import { RUN_DATE } from "../fixtures";
import { resolveConflictNow, setFailNextUpload } from "../api/mockDriverApi";
import { OutboxSheet, type OutboxProgress, type OutboxPrototypeControls } from "../outbox/OutboxSheet";
import type { OutboxRow } from "../outbox/outboxModel";
import { useOutboxView } from "../outbox/useOutboxView";
import { useNotices } from "../notices/useNotices";
import { usePhotoState } from "../sync/usePhotoState";
import { useSyncViewRedirect } from "../sync/useSyncViewRedirect";
import { useSyncWatcher } from "../sync/useSyncWatcher";
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
  // A failed record is retried on its own every 30 s, so while any is still waiting the chip says so (R4.3 2).
  if (connectivity.status === "failed") return connectivity.waitingCount > 0 ? "retrying" : "failed";
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
  /** R8.3: a top bar with the title only, no bell and no connectivity chip. */
  bareTopBar?: boolean;
  /** R8.1: the notifications screen has no bell of its own to press. */
  hideBell?: boolean;
  /** The state gallery only: `connectivity` is one real store shared by every frame on the page, so
   * a frame that needs its own moment (Online, Offline · 5, Synced 04:54 …) passes it here instead
   * of reading the live singleton. The single-frame `?frame=` view (what the compare script shoots)
   * is unaffected either way. */
  connectivityOverride?: ConnectivitySnapshot;
  /** Sets the chip outright, for the result screens that say "Synced 06:40" or "Failed 06:42". */
  chip?: { status: ChipStatus; time?: string };
  /** The state gallery only: the Outbox rows and progress for a frame, in place of the phone's own
   * outbox, and whether the sheet starts open (R4 frames draw it open over the run). */
  outboxPreview?: { rows: OutboxRow[]; progress?: OutboxProgress; showSimulate?: boolean; open?: boolean; chip?: { status: ChipStatus; time?: string } };
  children: ReactNode;
};

/**
 * The driver chrome shared by every screen (field conventions section 5, driver prompt 3 section
 * 3): top bar with the connectivity chip and the bell, an optional banner, the scrollable body, an
 * optional pinned action bar, and the Run / Issues / History / Me tab bar. The chip opens the R4
 * Outbox sheet.
 */
export function DriverShell({
  title,
  subtitle,
  onBack,
  preDeparture = false,
  banner,
  pinned,
  showTabBar = true,
  bareTopBar = false,
  hideBell = false,
  connectivityOverride,
  chip,
  outboxPreview,
  children,
}: DriverShellProps) {
  const t = useT();
  const { settings } = useDriverSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const liveConnectivity = useConnectivity();
  const connectivity = connectivityOverride ?? liveConnectivity;
  const now = useNow();
  const clock = useFieldClock();
  const shared = useOutboxOpen();
  const [previewOpen, setPreviewOpen] = useState(outboxPreview?.open ?? false);
  const outboxOpen = outboxPreview ? previewOpen : shared.open;
  const setOutboxOpen = outboxPreview ? setPreviewOpen : shared.setOpen;
  const view = useOutboxView(connectivity.status === "syncing");
  useSyncWatcher(view.run);
  const photos = usePhotoState(view.run);
  const { unread } = useNotices();
  const api = useDriverApi();
  const wentOffline = !clock.fixed && connectivity.status === "offline";
  const spellKey = connectivity.lastSyncAt ?? 0;
  useEffect(() => {
    if (wentOffline) void api.noteWentOffline(RUN_DATE, spellKey);
  }, [api, wentOffline, spellKey]);
  // A finished sync shows once, on the Run screen or over an open Outbox, never while recording.
  const recording = location.pathname.endsWith("/outcome");
  useSyncViewRedirect(!outboxPreview && !recording && (outboxOpen || location.pathname === "/driver/run"), () => setOutboxOpen(false));
  const rows = outboxPreview?.rows ?? view.rows;
  const progress = outboxPreview ? outboxPreview.progress : view.progress;
  const coverageGap = useCoverageGap();
  const [failUpload, setFailUpload] = useState(false);
  const presenter = !outboxPreview && new URLSearchParams(location.search).get("presenter") === "1";
  const prototype: OutboxPrototypeControls | undefined = presenter
    ? {
        coverageGap: coverageGap.enabled,
        onCoverageGap: coverageGap.setEnabled,
        failNextUpload: failUpload,
        onFailNextUpload: (on) => {
          setFailUpload(on);
          setFailNextUpload(on);
        },
        onResolve: view.openConflictOutletId
          ? (decision) => void resolveConflictNow(RUN_DATE, view.openConflictOutletId as string, clock.nowMs, decision, decision === "keep_partial" ? 10 : undefined)
          : undefined,
      }
    : undefined;

  const chipSetting = chip ?? outboxPreview?.chip;
  const status = chipSetting?.status ?? chipStatus(connectivity, preDeparture);
  const chipTime =
    chipSetting?.time ?? (status === "synced" ? formatTime(now) : status === "failed" ? formatTime(connectivity.lastFailureAt ?? now) : undefined);

  const activeTab: DriverTabKey = location.pathname.startsWith("/driver/issues")
    ? "issues"
    : location.pathname.startsWith("/driver/history")
      ? "history"
      : location.pathname.startsWith("/driver/me")
        ? "me"
        : "run";

  const tabs: FieldTab<DriverTabKey>[] = [
    { key: "run", label: t("tab.run"), icon: "route" },
    { key: "issues", label: t("tab.issues"), icon: "alert-circle" },
    { key: "history", label: t("tab.history"), icon: "history" },
    { key: "me", label: t("tab.me"), icon: "user" },
  ];

  return (
    <div className={[styles.page, !clock.fixed && styles.pageFill].filter(Boolean).join(" ")}>
      <FieldTopBar title={title} subtitle={subtitle} onBack={onBack}>
        {!bareTopBar && !hideBell && <NotificationBell count={unread} onClick={() => navigate("/driver/notifications")} />}
        {!bareTopBar && (
          <ConnectivityChip
            status={status}
            time={chipTime}
            count={connectivity.waitingCount}
            progress={progress}
            onClick={() => setOutboxOpen(true)}
          />
        )}
      </FieldTopBar>
      {banner}
      <main className={[styles.main, settings.textSize === "large" && styles.mainLarge].filter(Boolean).join(" ")}>{children}</main>
      {pinned}
      {showTabBar && <FieldTabBar tabs={tabs} active={activeTab} onSelect={(key) => navigate(`/driver/${key}`)} />}
      <OutboxSheet
        open={outboxOpen}
        onOpenChange={setOutboxOpen}
        rows={rows}
        connectivity={connectivity}
        now={now}
        progress={progress}
        photoFailures={outboxPreview ? 0 : photos.failures.length}
        showSimulate={outboxPreview?.showSimulate}
        prototype={prototype}
        onSendNow={() => void connectivityStore.sendNow()}
      />
    </div>
  );
}
