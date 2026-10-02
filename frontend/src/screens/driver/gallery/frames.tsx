import { HERO_DATE, HERO_EVENING_DATE } from "../../../field/clock/clock";
import type { GalleryFrame } from "../../../field/gallery/StateGallery";
import { MeScreen } from "../me/MeScreen";
import { RunScreen } from "../run/RunScreen";
import { fakeConnectivity } from "./fakeConnectivity";
import { renderDriverFrame } from "./renderFrame";

const ONLINE = fakeConnectivity({ status: "online" });

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
];
