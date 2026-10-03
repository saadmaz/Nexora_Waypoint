// Imported only through `import()` behind `import.meta.env.DEV` in main.tsx. Everything a role mocks is named here once.
import * as store from "../api/mockStoreApi";
import * as storePresets from "../app/presets";
import * as scenarioClock from "../app/scenarioClock";
import * as auth from "../screens/auth/mockAuthApi";
import * as dispatcher from "../screens/dispatcher/mock/mockDispatcherApi";
import * as loader from "../screens/loader/mockLoaderApi";
import * as driver from "../screens/driver/api/mockDriverApi";
import * as driverFixtures from "../screens/driver/fixtures";
import * as fieldClock from "../field/clock/mockClock";
import { setDevMocks } from "./registry";

export function installDevMocks(): void {
  setDevMocks({ store, storePresets, scenarioClock, auth, dispatcher, loader, driver, driverFixtures, fieldClock });
}
