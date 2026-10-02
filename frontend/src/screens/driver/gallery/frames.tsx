import { HERO_DATE, HERO_EVENING_DATE } from "../../../field/clock/clock";
import type { GalleryFrame } from "../../../field/gallery/StateGallery";
import { GALLERY_SHORTFALL } from "../fixtures";
import type { OutboxRow, OutboxRowState } from "../outbox/outboxModel";
import type { DriverNotice } from "../types";
import { MeScreen } from "../me/MeScreen";
import { NotificationsScreen } from "../notices/NotificationsScreen";
import { OutcomeScreen } from "../outcome/OutcomeScreen";
import { RunScreen } from "../run/RunScreen";
import { StopScreen } from "../stop/StopScreen";
import { PhotoFailureScreen } from "../sync/PhotoFailureScreen";
import { SyncResultScreen, type SyncResultScreenProps } from "../sync/SyncResultScreen";
import type { PhotoState } from "../sync/usePhotoState";
import { fakeConnectivity } from "./fakeConnectivity";
import { renderDriverFrame } from "./renderFrame";

const ONLINE = fakeConnectivity({ status: "online" });
const OFFLINE_1 = fakeConnectivity({ status: "offline", waitingCount: 1, lastSyncAt: Date.parse(`${HERO_DATE}T05:17:00+05:30`) });
const OFFLINE_3 = fakeConnectivity({ status: "offline", waitingCount: 3, lastSyncAt: Date.parse(`${HERO_DATE}T05:17:00+05:30`) });
const OFFLINE_4 = fakeConnectivity({ status: "offline", waitingCount: 4, lastSyncAt: Date.parse(`${HERO_DATE}T05:17:00+05:30`) });
const OFFLINE_5 = fakeConnectivity({ status: "offline", waitingCount: 5, lastSyncAt: Date.parse(`${HERO_DATE}T05:17:00+05:30`) });
const OFFLINE_0 = fakeConnectivity({ status: "offline", waitingCount: 0, lastSyncAt: Date.parse(`${HERO_DATE}T05:17:00+05:30`) });

/** A 1x1 grey square, standing in for a captured photo in the gallery (no real camera there). */
const PLACEHOLDER_PHOTO = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><rect width="56" height="56" fill="#8b8b8b"/></svg>',
)}`;

const OUT084_OUTCOMES = {
  ORD2001: { orderId: "ORD2001", outcome: "Delivered" as const, unitsDelivered: 12, receiverName: "S. Fernando", savedAt: "05:42" },
  ORD2002: { orderId: "ORD2002", outcome: "Delivered" as const, unitsDelivered: 8, receiverName: "S. Fernando", savedAt: "05:42" },
};


const SYNCED_0641 = fakeConnectivity({ status: "online", lastSyncAt: Date.parse(`${HERO_DATE}T06:41:00+05:30`) });
const SYNCED_0645 = fakeConnectivity({ status: "online", lastSyncAt: Date.parse(`${HERO_DATE}T06:45:00+05:30`) });

/** The conflict Dispatch's plan v5 raised on OUT084 when the sync ran at 06:41, as the mock server builds it. */
const HERO_CONFLICT = {
  conflictId: "gallery-conflict",
  serverVersion: 5,
  change: "Deferred · store request, 05:21, by Kumari",
  changedAt: "05:21",
  changedBy: "Kumari",
  at: "06:41",
};
const HERO_RESOLUTION = { decision: "keep_delivery" as const, by: "Kumari", at: "06:44" };

/** The notices the hero run has raised by 06:45. Fresh objects each time, since reading one changes it. */
function heroNotices(unread: string[]): DriverNotice[] {
  const notice = (id: string, kind: DriverNotice["kind"], title: string, body: string, at: string, extra: Partial<DriverNotice> = {}): DriverNotice => ({
    id,
    kind,
    title,
    body,
    at,
    read: !unread.includes(id),
    ...extra,
  });
  return [
    notice("resolved", "resolved", "OUT084 resolved", "Kumari kept your delivery at OUT084.", "06:44", { outletId: "OUT084" }),
    notice("photo", "photo_failed", "Sync failed", "Couldn't send photo of stop 1. Kept on phone. Retrying.", "06:42", {
      outletId: "OUT084",
      blobId: "gallery-photo",
      reference: "WP-SYNC-409",
    }),
    notice("review", "sent_for_review", "Delivery sent for review", "Dispatch deferred OUT084 at 05:21 at the store's request, while you were offline. Your record is safe.", "06:40", { outletId: "OUT084" }),
    notice("synced", "synced", "3 records synced", "Arrival OUT084, Arrival OUT087, Delivered ORD2003.", "06:40"),
    notice("plan5", "plan_received", "Plan v5 received", "OUT084 was changed while you were offline.", "06:40", { outletId: "OUT084" }),
    notice("offline", "went_offline", "You went offline", "Records now save on this phone and sync later.", "05:17"),
  ];
}

/** Only the notices raised by `time`, so a frame never holds one from the future. */
function noticesBy(time: string, unread: string[]): DriverNotice[] {
  return heroNotices(unread).filter((n) => n.at <= time);
}

/** The hero run's six outbox rows (R4), each in the state a frame draws it in. */
function heroRows(states: Partial<Record<"arrival084" | "ord2001" | "ord2002" | "arrival087" | "ord2003", OutboxRowState>> = {}): OutboxRow[] {
  const state = (key: keyof typeof states, fallback: OutboxRowState): OutboxRowState => states[key] ?? fallback;
  return [
    { clientId: "g-depart", time: "05:10", kind: "departed", state: "synced" },
    { clientId: "g-arr084", time: "05:26", kind: "arrival", subject: "OUT084", state: state("arrival084", "saved"), groupKey: "OUT084" },
    { clientId: "g-ord2001", time: "05:42", kind: "outcome", outcomeWord: "Delivered", subject: "ORD2001", state: state("ord2001", "saved"), groupKey: "OUT084" },
    { clientId: "g-ord2002", time: "05:42", kind: "outcome", outcomeWord: "Delivered", subject: "ORD2002", state: state("ord2002", "saved"), groupKey: "OUT084" },
    { clientId: "g-arr087", time: "05:48", kind: "arrival", subject: "OUT087", state: state("arrival087", "saved"), groupKey: "OUT087" },
    { clientId: "g-ord2003", time: "05:58", kind: "outcome", outcomeWord: "Delivered", subject: "ORD2003", state: state("ord2003", "saved"), groupKey: "OUT087" },
  ];
}

const ALL_RECORDED_SEED = {
  downloadedVersion: 4,
  acknowledgedVersion: 4,
  departedAt: "05:10",
  stops: {
    OUT084: { arrivalAt: "05:26", outcomes: OUT084_OUTCOMES },
    OUT087: { arrivalAt: "05:48", outcomes: { ORD2003: { orderId: "ORD2003", outcome: "Delivered" as const, unitsDelivered: 9, savedAt: "05:58" } } },
  },
};

function outboxFrame(
  frameId: string,
  figmaNodeId: string,
  name: string,
  time: string,
  connectivity: ReturnType<typeof fakeConnectivity>,
  preview: NonNullable<NonNullable<Parameters<typeof RunScreen>[0]>["outboxPreview"]>,
): GalleryFrame {
  return {
    frameId,
    figmaNodeId,
    name,
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time },
    render: () =>
      renderDriverFrame(<RunScreen connectivityOverride={connectivity} forceJustSaved={false} outboxPreview={{ open: true, ...preview }} />, {
        theme: "dark",
        apiOptions: { seed: ALL_RECORDED_SEED },
      }),
  };
}

const OUTBOX_FRAMES: GalleryFrame[] = [
  outboxFrame("R4.1", "442:58541", "R4.1 · 05:59 · Outbox, records waiting", "05:59", OFFLINE_5, { rows: heroRows() }),
  outboxFrame(
    "R4.2",
    "442:58658",
    "R4.2 · 06:40 · Outbox, syncing",
    "06:40",
    fakeConnectivity({ status: "syncing", waitingCount: 3, lastSyncAt: Date.parse(`${HERO_DATE}T05:17:00+05:30`) }),
    {
      rows: heroRows({ arrival084: "synced", ord2001: "review", ord2002: "review", arrival087: "sending", ord2003: "saved" }),
      progress: { done: 3, total: 5 },
      showSimulate: false,
    },
  ),
  outboxFrame(
    "R4.3-1",
    "442:58760",
    "R4.3 · 1 · 06:41 · Outbox, conflict sent for review",
    "06:41",
    fakeConnectivity({ status: "online", lastSyncAt: Date.parse(`${HERO_DATE}T06:41:00+05:30`) }),
    { rows: heroRows({ arrival084: "synced", ord2001: "review", ord2002: "review", arrival087: "synced", ord2003: "synced" }), showSimulate: false },
  ),
  outboxFrame(
    "R4.3-2",
    "442:58856",
    "R4.3 · 2 · Outbox, error and retrying",
    "06:41",
    fakeConnectivity({ status: "failed", waitingCount: 1, lastFailureAt: Date.parse(`${HERO_DATE}T06:41:00+05:30`) }),
    { rows: heroRows({ arrival084: "synced", ord2001: "synced", ord2002: "synced", arrival087: "synced", ord2003: "retrying" }), showSimulate: false },
  ),
  outboxFrame(
    "R4.3-3",
    "442:58955",
    "R4.3 · 3 · 06:45 · Outbox, all synced",
    "06:45",
    fakeConnectivity({ status: "online", lastSyncAt: Date.parse(`${HERO_DATE}T06:45:00+05:30`) }),
    { rows: heroRows({ arrival084: "synced", ord2001: "synced", ord2002: "synced", arrival087: "synced", ord2003: "synced" }), showSimulate: false },
  ),
];

/** The six R5 states use the run's five records (the departure left before coverage dropped, so R5 does not list it). */
function syncRows(states: Parameters<typeof heroRows>[0] = {}): OutboxRow[] {
  return heroRows(states).filter((row) => row.kind !== "departed");
}

function syncFrame(
  frameId: string,
  figmaNodeId: string,
  name: string,
  time: string,
  connectivity: ReturnType<typeof fakeConnectivity>,
  props: SyncResultScreenProps,
  seed: Record<string, unknown> = {},
): GalleryFrame {
  return {
    frameId,
    figmaNodeId,
    name,
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time },
    render: () =>
      renderDriverFrame(<SyncResultScreen connectivityOverride={connectivity} {...props} />, {
        theme: "dark",
        apiOptions: { seed: { ...ALL_RECORDED_SEED, knownServerVersion: 5, ...seed } },
      }),
  };
}

const SYNCED_0640 = fakeConnectivity({ status: "online", lastSyncAt: Date.parse(`${HERO_DATE}T06:40:00+05:30`) });

const SYNC_FRAMES: GalleryFrame[] = [
  syncFrame(
    "R5.1",
    "442:59014",
    "R5.1 · 06:40 · Sync result, conflict sent to Dispatch",
    "06:40",
    SYNCED_0640,
    { viewOverride: { kind: "conflict", outletId: "OUT084" }, rowsOverride: syncRows({ arrival084: "synced", ord2001: "review", ord2002: "review", arrival087: "synced", ord2003: "synced" }) },
    { conflicts: { OUT084: HERO_CONFLICT } },
  ),
  syncFrame(
    "R5.2",
    "442:59107",
    "R5.2 · 06:45 · Sync result, all synced",
    "06:45",
    ONLINE,
    { viewOverride: { kind: "synced" }, rowsOverride: syncRows({ arrival084: "synced", ord2001: "synced", ord2002: "synced", arrival087: "synced", ord2003: "synced" }) },
  ),
  syncFrame(
    "R5.3",
    "442:59186",
    "R5.3 · 06:44 · Sync result, resolved",
    "06:44",
    fakeConnectivity({ status: "online", lastSyncAt: Date.parse(`${HERO_DATE}T06:44:00+05:30`) }),
    { viewOverride: { kind: "resolved", outletId: "OUT084" } },
    { resolutions: { OUT084: HERO_RESOLUTION } },
  ),
  syncFrame(
    "R5.S-1",
    "442:59254",
    "R5.S · 1 · 06:41 · Offline again",
    "06:41",
    fakeConnectivity({ status: "offline", waitingCount: 2, lastSyncAt: Date.parse(`${HERO_DATE}T06:40:00+05:30`) }),
    { viewOverride: { kind: "conflict" } },
  ),
  syncFrame(
    "R5.S-2",
    "442:59307",
    "R5.S · 2 · 06:42 · Error, sync failed",
    "06:42",
    fakeConnectivity({ status: "failed", waitingCount: 1, lastFailureAt: Date.parse(`${HERO_DATE}T06:42:00+05:30`) }),
    { viewOverride: { kind: "conflict" } },
  ),
  syncFrame("R5.S-3", "442:59366", "R5.S · 3 · Empty, nothing to sync", "06:50", ONLINE, { viewOverride: { kind: "empty" } }),
  syncFrame(
    "R5.S-4",
    "442:59413",
    "R5.S · 4 · Loading",
    "06:42",
    fakeConnectivity({ status: "syncing", waitingCount: 3 }),
    { viewOverride: { kind: "conflict" } },
  ),
];

/** OUT084's photo failed to send at 06:42; its delivery record reached Dispatch at 06:40 (R8.2, R8.3). */
const HERO_PHOTO_FAILED: PhotoState = {
  onPhoneOutlets: new Set(["OUT084"]),
  onPhoneCount: 1,
  loaded: true,
  failures: [
    {
      blobId: "gallery-photo",
      outletId: "OUT084",
      stopNumber: 1,
      takenAt: Date.parse(`${HERO_DATE}T05:42:00+05:30`),
      lastTryAt: Date.parse(`${HERO_DATE}T06:42:00+05:30`),
      deliverySyncedAt: Date.parse(`${HERO_DATE}T06:40:00+05:30`),
    },
  ],
};

const PHOTO_FRAMES: GalleryFrame[] = [
  {
    frameId: "R8.2",
    figmaNodeId: "442:60467",
    name: "R8.2 · 06:42 · Sync issue alert on the run",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "06:42" },
    render: () =>
      renderDriverFrame(
        <RunScreen
          connectivityOverride={fakeConnectivity({ status: "failed", lastFailureAt: Date.parse(`${HERO_DATE}T06:42:00+05:30`), lastSyncAt: Date.parse(`${HERO_DATE}T06:40:00+05:30`) })}
          forceJustSaved={false}
          photoStateOverride={HERO_PHOTO_FAILED}
        />,
        { theme: "dark", apiOptions: { seed: { ...ALL_RECORDED_SEED, knownServerVersion: 5, notices: noticesBy("06:42", ["photo"]) } } },
      ),
  },
  {
    frameId: "R8.3",
    figmaNodeId: "442:60556",
    name: "R8.3 · 06:42 · Notification detail, sync failed",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "06:42" },
    render: () =>
      renderDriverFrame(<PhotoFailureScreen blobIdOverride="gallery-photo" photoStateOverride={HERO_PHOTO_FAILED} />, {
        theme: "dark",
        apiOptions: { seed: { ...ALL_RECORDED_SEED, knownServerVersion: 5 } },
      }),
  },
];

const NOTICE_FRAMES: GalleryFrame[] = [
  {
    frameId: "R8.1",
    figmaNodeId: "442:60337",
    name: "R8.1 · 06:45 · Notifications",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "06:45" },
    render: () =>
      renderDriverFrame(<NotificationsScreen connectivityOverride={SYNCED_0645} />, {
        theme: "dark",
        apiOptions: { seed: { ...ALL_RECORDED_SEED, knownServerVersion: 5, resolutions: { OUT084: HERO_RESOLUTION }, notices: noticesBy("06:45", ["resolved", "photo"]) } },
      }),
  },
  {
    frameId: "R8.4",
    figmaNodeId: "442:60600",
    name: "R8.4 · Notifications, empty",
    width: 390,
    height: 844,
    clock: { date: HERO_EVENING_DATE, time: "23:00" },
    render: () => renderDriverFrame(<NotificationsScreen connectivityOverride={ONLINE} />, { theme: "dark", apiOptions: { seed: {} } }),
  },
];

/**
 * Every Driver frame (`/driver/_states`), registered as its screens land (field conventions
 * section 10, driver prompt 3 section 9). `?frame=ID` renders one at its Figma size.
 */
export const DRIVER_FRAMES: GalleryFrame[] = [
  {
    frameId: "R1.1",
    figmaNodeId: "442:55516",
    name: "R1.1 · No route yet",
    width: 390,
    height: 844,
    clock: { date: HERO_EVENING_DATE, time: "23:00" },
    render: () => renderDriverFrame(<RunScreen connectivityOverride={ONLINE} />, { theme: "dark" }),
  },
  {
    frameId: "R1.2-A",
    figmaNodeId: "442:55566",
    name: "R1.2 · A · 04:54 · Downloading",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "04:54" },
    render: () =>
      renderDriverFrame(<RunScreen connectivityOverride={ONLINE} forcedProgress={{ done: 2, total: 3 }} />, {
        theme: "dark",
        apiOptions: { seed: {} },
      }),
  },
  {
    frameId: "R1.2-B",
    figmaNodeId: "442:55645",
    name: "R1.2 · B · 04:54 · Ready offline",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "04:54" },
    render: () =>
      renderDriverFrame(<RunScreen connectivityOverride={ONLINE} />, {
        theme: "dark",
        apiOptions: { seed: { downloadedVersion: 4 } },
      }),
  },
  {
    frameId: "R1.3-A",
    figmaNodeId: "442:55724",
    name: "R1.3 · A · 04:45 · Waiting for loading",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "04:45" },
    render: () => renderDriverFrame(<RunScreen connectivityOverride={ONLINE} />, { theme: "dark", apiOptions: { seed: {} } }),
  },
  {
    frameId: "R1.3-B",
    figmaNodeId: "442:55800",
    name: "R1.3 · B · 04:55 · Loaded and acknowledged",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "04:55" },
    render: () =>
      renderDriverFrame(<RunScreen connectivityOverride={ONLINE} />, {
        theme: "dark",
        apiOptions: { seed: { downloadedVersion: 4, acknowledgedVersion: 4 } },
      }),
  },
  {
    frameId: "R1.4",
    figmaNodeId: "442:55871",
    name: "R1.4 · Ready, start route",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:08" },
    render: () =>
      renderDriverFrame(<RunScreen connectivityOverride={ONLINE} />, {
        theme: "dark",
        apiOptions: { seed: { downloadedVersion: 4, acknowledgedVersion: 4 } },
      }),
  },
  {
    frameId: "R1.5",
    figmaNodeId: "442:55952",
    name: "R1.5 · Departed, online",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:12" },
    render: () =>
      renderDriverFrame(<RunScreen connectivityOverride={ONLINE} />, {
        theme: "dark",
        apiOptions: { seed: { downloadedVersion: 4, acknowledgedVersion: 4, departedAt: "05:10" } },
      }),
  },
  {
    frameId: "R1.6",
    figmaNodeId: "442:56048",
    name: "R1.6 · Offline, last synced 05:17",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:20" },
    render: () =>
      renderDriverFrame(
        <RunScreen
          connectivityOverride={fakeConnectivity({ status: "offline", lastSyncAt: Date.parse(`${HERO_DATE}T05:17:00+05:30`) })}
        />,
        { theme: "dark", apiOptions: { seed: { downloadedVersion: 4, acknowledgedVersion: 4, departedAt: "05:10" } } },
      ),
  },
  {
    frameId: "R1.9",
    figmaNodeId: "442:56149",
    name: "R1.9 · Me tab, sunlight screen toggle",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:10" },
    render: () => renderDriverFrame(<MeScreen storageOverride="3.2 MB used" />, { theme: "dark" }),
  },
  {
    frameId: "R1.10",
    figmaNodeId: "442:56242",
    name: "R1.10 · Route, Field · sunlight variant",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:12" },
    render: () =>
      renderDriverFrame(<RunScreen connectivityOverride={ONLINE} />, {
        theme: "field",
        apiOptions: { seed: { downloadedVersion: 4, acknowledgedVersion: 4, departedAt: "05:10" } },
      }),
  },
  {
    frameId: "R1.S",
    figmaNodeId: "442:56338",
    name: "R1.S · Error: download failed",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "04:52" },
    render: () =>
      renderDriverFrame(<RunScreen connectivityOverride={fakeConnectivity({ status: "offline" })} forceDownloadError />, {
        theme: "dark",
        apiOptions: { seed: {} },
      }),
  },
  {
    frameId: "R1.7",
    figmaNodeId: "442:56405",
    name: "R1.7 · 06:41 · Under review (after sync)",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "06:41" },
    render: () =>
      renderDriverFrame(<RunScreen connectivityOverride={SYNCED_0641} forceJustSaved={false} />, {
        theme: "dark",
        apiOptions: { seed: { ...ALL_RECORDED_SEED, knownServerVersion: 5, conflicts: { OUT084: HERO_CONFLICT }, notices: noticesBy("06:41", ["review", "synced"]) } },
      }),
  },
  {
    frameId: "R1.8",
    figmaNodeId: "442:56492",
    name: "R1.8 · 06:45 · Resolved notice",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "06:45" },
    render: () =>
      renderDriverFrame(<RunScreen connectivityOverride={SYNCED_0645} forceJustSaved={false} />, {
        theme: "dark",
        apiOptions: { seed: { ...ALL_RECORDED_SEED, knownServerVersion: 5, resolutions: { OUT084: HERO_RESOLUTION }, notices: noticesBy("06:45", ["resolved", "review", "synced"]) } },
      }),
  },
  {
    frameId: "R2.1",
    figmaNodeId: "442:56582",
    name: "R2.1 · Before arrival (OUT084)",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:20" },
    render: () =>
      renderDriverFrame(<StopScreen connectivityOverride={OFFLINE_0} stopIdOverride="OUT084" />, {
        theme: "dark",
        apiOptions: { seed: { downloadedVersion: 4, acknowledgedVersion: 4, departedAt: "05:10" } },
      }),
  },
  {
    frameId: "R2.2-A",
    figmaNodeId: "442:56678",
    name: "R2.2 · A · 05:27 · Waiting for the window",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:27" },
    render: () =>
      renderDriverFrame(<StopScreen connectivityOverride={OFFLINE_1} stopIdOverride="OUT084" />, {
        theme: "dark",
        apiOptions: {
          seed: { downloadedVersion: 4, acknowledgedVersion: 4, departedAt: "05:10", stops: { OUT084: { arrivalAt: "05:26", outcomes: {} } } },
        },
      }),
  },
  {
    frameId: "R2.2-B",
    figmaNodeId: "442:56771",
    name: "R2.2 · B · 05:30 · Window open",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:30" },
    render: () =>
      renderDriverFrame(<StopScreen connectivityOverride={OFFLINE_1} stopIdOverride="OUT084" />, {
        theme: "dark",
        apiOptions: {
          seed: { downloadedVersion: 4, acknowledgedVersion: 4, departedAt: "05:10", stops: { OUT084: { arrivalAt: "05:26", outcomes: {} } } },
        },
      }),
  },
  {
    frameId: "R2.3-A",
    figmaNodeId: "442:56867",
    name: "R2.3 · A · 05:48 · OUT087",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:48" },
    render: () =>
      renderDriverFrame(<StopScreen connectivityOverride={OFFLINE_3} stopIdOverride="OUT087" />, {
        theme: "dark",
        apiOptions: {
          seed: {
            downloadedVersion: 4,
            acknowledgedVersion: 4,
            departedAt: "05:10",
            stops: {
              OUT084: {
                arrivalAt: "05:26",
                outcomes: {
                  ORD2001: { orderId: "ORD2001", outcome: "Delivered", unitsDelivered: 12, receiverName: "S. Fernando", savedAt: "05:42" },
                  ORD2002: { orderId: "ORD2002", outcome: "Delivered", unitsDelivered: 8, receiverName: "S. Fernando", savedAt: "05:42" },
                },
              },
            },
          },
        },
      }),
  },
  {
    frameId: "R2.3-B",
    figmaNodeId: "442:56947",
    name: "R2.3 · B · 05:48 · Loader shortfall shown on the stop",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:48" },
    render: () =>
      renderDriverFrame(<StopScreen connectivityOverride={OFFLINE_3} stopIdOverride="OUT087" />, {
        theme: "dark",
        apiOptions: {
          confirmation: GALLERY_SHORTFALL,
          seed: { downloadedVersion: 4, acknowledgedVersion: 4, departedAt: "05:10" },
        },
      }),
  },
  {
    frameId: "R2.S-1",
    figmaNodeId: "442:57038",
    name: "R2.S · 1 · Offline: arrival saved",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:26" },
    render: () =>
      renderDriverFrame(<StopScreen connectivityOverride={OFFLINE_1} stopIdOverride="OUT084" forceJustSaved />, {
        theme: "dark",
        apiOptions: {
          seed: { downloadedVersion: 4, acknowledgedVersion: 4, departedAt: "05:10", stops: { OUT084: { arrivalAt: "05:26", outcomes: {} } } },
        },
      }),
  },
  {
    frameId: "R2.S-2",
    figmaNodeId: "442:57128",
    name: "R2.S · 2 · Error: couldn't save arrival",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:20" },
    render: () =>
      renderDriverFrame(<StopScreen connectivityOverride={OFFLINE_0} stopIdOverride="OUT084" forceSaveError />, {
        theme: "dark",
        apiOptions: { seed: { downloadedVersion: 4, acknowledgedVersion: 4, departedAt: "05:10" } },
      }),
  },
  {
    frameId: "R2.S-3",
    figmaNodeId: "442:57220",
    name: "R2.S · 3 · Empty: not on your route",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:20" },
    render: () =>
      renderDriverFrame(<StopScreen connectivityOverride={ONLINE} stopIdOverride="OUT999" />, {
        theme: "dark",
        apiOptions: { seed: { downloadedVersion: 4, acknowledgedVersion: 4, departedAt: "05:10" } },
      }),
  },
  {
    frameId: "R2.S-4",
    figmaNodeId: "442:57268",
    name: "R2.S · 4 · Loading",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:20" },
    render: () =>
      renderDriverFrame(<StopScreen connectivityOverride={ONLINE} stopIdOverride="OUT084" />, {
        theme: "dark",
        apiOptions: { seed: {}, stuckLoading: true },
      }),
  },
  {
    frameId: "R3.1",
    figmaNodeId: "442:57326",
    name: "R3.1 · Same outcome for the stop (default)",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:42" },
    render: () =>
      renderDriverFrame(
        <OutcomeScreen
          connectivityOverride={OFFLINE_1}
          stopIdOverride="OUT084"
          initial={{ photo: { blobId: "gallery", url: PLACEHOLDER_PHOTO, time: "05:42" }, receiverName: "S. Fernando" }}
        />,
        {
          theme: "dark",
          apiOptions: {
            seed: { downloadedVersion: 4, acknowledgedVersion: 4, departedAt: "05:10", stops: { OUT084: { arrivalAt: "05:26", outcomes: {} } } },
          },
        },
      ),
  },
  {
    frameId: "R3.2-A",
    figmaNodeId: "442:57461",
    name: "R3.2 · A · Camera viewfinder (no camera in this browser: file-input fallback shown)",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:42" },
    render: () =>
      renderDriverFrame(<OutcomeScreen connectivityOverride={OFFLINE_1} stopIdOverride="OUT084" subviewOverride="camera" />, {
        theme: "dark",
        apiOptions: {
          seed: { downloadedVersion: 4, acknowledgedVersion: 4, departedAt: "05:10", stops: { OUT084: { arrivalAt: "05:26", outcomes: {} } } },
        },
      }),
  },
  {
    frameId: "R3.3",
    figmaNodeId: "442:57522",
    name: "R3.3 · Receiver name entry",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:42" },
    render: () =>
      renderDriverFrame(
        <OutcomeScreen connectivityOverride={OFFLINE_1} stopIdOverride="OUT084" subviewOverride="receiver" initial={{ receiverName: "S. F" }} />,
        {
          theme: "dark",
          apiOptions: {
            seed: { downloadedVersion: 4, acknowledgedVersion: 4, departedAt: "05:10", stops: { OUT084: { arrivalAt: "05:26", outcomes: {} } } },
          },
        },
      ),
  },
  {
    frameId: "R3.4",
    figmaNodeId: "442:57635",
    name: "R3.4 · Damaged goods with units (per-order grid)",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:42" },
    render: () =>
      renderDriverFrame(
        <OutcomeScreen
          connectivityOverride={OFFLINE_1}
          stopIdOverride="OUT084"
          initial={{
            sameOutcome: false,
            perOrder: { ORD2001: { outcome: "Damaged", units: 10 }, ORD2002: { outcome: "Delivered", units: 8 } },
            photo: { blobId: "gallery", url: PLACEHOLDER_PHOTO, time: "05:42" },
            receiverName: "S. Fernando",
          }}
        />,
        {
          theme: "dark",
          apiOptions: {
            seed: { downloadedVersion: 4, acknowledgedVersion: 4, departedAt: "05:10", stops: { OUT084: { arrivalAt: "05:26", outcomes: {} } } },
          },
        },
      ),
  },
  {
    frameId: "R3.5-A",
    figmaNodeId: "442:57767",
    name: "R3.5 · A · Store closed",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:42" },
    render: () =>
      renderDriverFrame(
        <OutcomeScreen
          connectivityOverride={OFFLINE_1}
          stopIdOverride="OUT084"
          initial={{ stopOutcome: "Store closed", photo: { blobId: "gallery", url: PLACEHOLDER_PHOTO, time: "05:42" } }}
        />,
        {
          theme: "dark",
          apiOptions: {
            seed: { downloadedVersion: 4, acknowledgedVersion: 4, departedAt: "05:10", stops: { OUT084: { arrivalAt: "05:26", outcomes: {} } } },
          },
        },
      ),
  },
  {
    frameId: "R3.5-B",
    figmaNodeId: "442:57856",
    name: "R3.5 · B · Refused, with reason",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:42" },
    render: () =>
      renderDriverFrame(
        <OutcomeScreen
          connectivityOverride={OFFLINE_1}
          stopIdOverride="OUT084"
          initial={{ stopOutcome: "Refused", refusedReason: "Other", receiverName: "S. Fernando" }}
        />,
        {
          theme: "dark",
          apiOptions: {
            seed: { downloadedVersion: 4, acknowledgedVersion: 4, departedAt: "05:10", stops: { OUT084: { arrivalAt: "05:26", outcomes: {} } } },
          },
        },
      ),
  },
  {
    frameId: "R3.5-C",
    figmaNodeId: "442:58109",
    name: "R3.5 · C · Run afterwards: failed stop card",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:44" },
    render: () =>
      renderDriverFrame(<RunScreen connectivityOverride={OFFLINE_1} />, {
        theme: "dark",
        apiOptions: {
          seed: {
            downloadedVersion: 4,
            acknowledgedVersion: 4,
            departedAt: "05:10",
            stops: {
              OUT084: {
                arrivalAt: "05:26",
                outcomes: {
                  ORD2001: { orderId: "ORD2001", outcome: "Store closed", unitsDelivered: 0, savedAt: "05:44" },
                  ORD2002: { orderId: "ORD2002", outcome: "Store closed", unitsDelivered: 0, savedAt: "05:44" },
                },
              },
            },
          },
        },
      }),
  },
  {
    frameId: "R3.6",
    figmaNodeId: "442:57953",
    name: "R3.6 · Validation: missing photo or name (scrolled to proof)",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:42" },
    render: () =>
      renderDriverFrame(<OutcomeScreen connectivityOverride={OFFLINE_1} stopIdOverride="OUT084" initial={{ showValidation: true }} />, {
        theme: "dark",
        apiOptions: {
          seed: { downloadedVersion: 4, acknowledgedVersion: 4, departedAt: "05:10", stops: { OUT084: { arrivalAt: "05:26", outcomes: {} } } },
        },
      }),
  },
  {
    frameId: "R3.7",
    figmaNodeId: "442:58033",
    name: "R3.7 · Saved to phone confirmation",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:43" },
    render: () =>
      renderDriverFrame(<RunScreen connectivityOverride={OFFLINE_3} />, {
        theme: "dark",
        apiOptions: {
          seed: { downloadedVersion: 4, acknowledgedVersion: 4, departedAt: "05:10", stops: { OUT084: { arrivalAt: "05:26", outcomes: OUT084_OUTCOMES } } },
        },
      }),
  },
  {
    frameId: "R3.8",
    figmaNodeId: "442:58199",
    name: "R3.8 · Record outcome, OUT087",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:58" },
    render: () =>
      renderDriverFrame(
        <OutcomeScreen
          connectivityOverride={OFFLINE_4}
          stopIdOverride="OUT087"
          initial={{ photo: { blobId: "gallery", url: PLACEHOLDER_PHOTO, time: "05:58" }, receiverName: "Anusha" }}
        />,
        {
          theme: "dark",
          apiOptions: {
            seed: {
              downloadedVersion: 4,
              acknowledgedVersion: 4,
              departedAt: "05:10",
              stops: { OUT084: { arrivalAt: "05:26", outcomes: OUT084_OUTCOMES }, OUT087: { arrivalAt: "05:48", outcomes: {} } },
            },
          },
        },
      ),
  },
  {
    frameId: "R3.9",
    figmaNodeId: "442:58311",
    name: "R3.9 · OUT087 saved, all stops recorded (offline)",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:59" },
    render: () =>
      renderDriverFrame(<RunScreen connectivityOverride={OFFLINE_5} forceJustSaved />, {
        theme: "dark",
        apiOptions: {
          seed: {
            downloadedVersion: 4,
            acknowledgedVersion: 4,
            departedAt: "05:10",
            stops: {
              OUT084: { arrivalAt: "05:26", outcomes: OUT084_OUTCOMES },
              OUT087: { arrivalAt: "05:48", outcomes: { ORD2003: { orderId: "ORD2003", outcome: "Delivered", unitsDelivered: 9, savedAt: "05:58" } } },
            },
          },
        },
      }),
  },
  {
    frameId: "R3.10",
    figmaNodeId: "442:58399",
    name: "R3.10 · 05:59 · All stops recorded, waiting for signal",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:59" },
    render: () =>
      renderDriverFrame(<RunScreen connectivityOverride={OFFLINE_5} forceJustSaved={false} />, {
        theme: "dark",
        apiOptions: {
          seed: {
            downloadedVersion: 4,
            acknowledgedVersion: 4,
            departedAt: "05:10",
            stops: {
              OUT084: { arrivalAt: "05:26", outcomes: OUT084_OUTCOMES },
              OUT087: { arrivalAt: "05:48", outcomes: { ORD2003: { orderId: "ORD2003", outcome: "Delivered", unitsDelivered: 9, savedAt: "05:58" } } },
            },
          },
        },
      }),
  },
  {
    frameId: "R3.11",
    figmaNodeId: "442:58483",
    name: "R3.11 · Signature pad (optional)",
    width: 390,
    height: 844,
    clock: { date: HERO_DATE, time: "05:42" },
    render: () =>
      renderDriverFrame(
        <OutcomeScreen
          connectivityOverride={OFFLINE_1}
          stopIdOverride="OUT084"
          subviewOverride="signature"
          initial={{ receiverName: "S. Fernando", photo: { blobId: "gallery", url: PLACEHOLDER_PHOTO, time: "05:42" } }}
        />,
        {
          theme: "dark",
          apiOptions: {
            seed: { downloadedVersion: 4, acknowledgedVersion: 4, departedAt: "05:10", stops: { OUT084: { arrivalAt: "05:26", outcomes: {} } } },
          },
        },
      ),
  },
  ...OUTBOX_FRAMES,
  ...SYNC_FRAMES,
  ...PHOTO_FRAMES,
  ...NOTICE_FRAMES,
];
