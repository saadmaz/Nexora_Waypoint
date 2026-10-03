/**
 * The development mocks, reached through one door. `main.tsx` installs them before the first render, and only inside
 * `if (import.meta.env.DEV)`, so a production build never imports them, their fixtures or their persona names: the CI
 * bundle check fails the build if any of those strings reach `dist/` (DP-26). The types below are erased at build time.
 */
export type DevMocks = {
  store: typeof import("../api/mockStoreApi");
  storePresets: typeof import("../app/presets");
  scenarioClock: typeof import("../app/mockScenarioClock");
  auth: typeof import("../screens/auth/mockAuthApi");
  dispatcher: typeof import("../screens/dispatcher/mock/mockDispatcherApi");
  loader: typeof import("../screens/loader/mockLoaderApi");
  driver: typeof import("../screens/driver/api/mockDriverApi");
  fieldClock: typeof import("../field/clock/mockClock");
  driverFixtures: typeof import("../screens/driver/fixtures");
};

let installed: DevMocks | null = null;

export function setDevMocks(mocks: DevMocks): void {
  installed = mocks;
}

/** The mocks. Only code that runs when a role is on its mock (never in a production build) may call this. */
export function devMocks(): DevMocks {
  if (!installed) throw new Error("The development mocks are not installed (this is a production build, or main.tsx did not run)");
  return installed;
}
