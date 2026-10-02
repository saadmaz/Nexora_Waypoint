import { Navigate, Route, Routes } from "react-router-dom";
import { ClockProvider } from "../../field/clock/ClockContext";
import { HERO_EVENING_DATE } from "../../field/clock/clock";
import { FieldRuntime } from "../../field/FieldRuntime";
import { PlaceholderScreen } from "../../field/PlaceholderScreen";
import { RoleRoot } from "../../shared/RoleRoot";
import { LoaderGallery } from "./gallery/LoaderGallery";

/** Waypoint Load always works in the dark (field conventions section 1): a shared dock tablet at night. */
const LOADER_THEME = "dark";

/** Where the loader's own clock starts without `?at=`: the first frame, L1.1 at 23:45 on Monday evening. */
const LOADER_START = { date: HERO_EVENING_DATE, time: "23:45" };

/**
 * The Loader role root: `/loader/*`. The state gallery sits outside the runtime and the clock,
 * because each of its frames fakes its own. Every route answers with a placeholder until prompt 2
 * builds the screen.
 */
export function LoaderApp() {
  return (
    <Routes>
      <Route path="_states" element={<LoaderGallery />} />
      <Route
        path="*"
        element={
          <ClockProvider start={LOADER_START}>
            <FieldRuntime>
              <RoleRoot theme={LOADER_THEME}>
                <LoaderRoutes />
              </RoleRoot>
            </FieldRuntime>
          </ClockProvider>
        }
      />
    </Routes>
  );
}

function LoaderRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="dock" replace />} />
      <Route
        path="dock"
        element={<PlaceholderScreen id="L1" title="Dock" note="The dock: plan version, acknowledgement and vehicles to load. Built in the loader prompt (L1)." />}
      />
      <Route
        path="vehicles/:vehicleId/trips/:trip"
        element={
          <PlaceholderScreen
            id="L2"
            title="Load plan"
            back="/loader/dock"
            note="Load in reverse stop order and pass the gate. Built in the loader prompt (L2, with the L3 flag sheet over it)."
          />
        }
      />
      <Route
        path="changes"
        element={
          <PlaceholderScreen
            id="L4"
            title="Plan changed"
            back="/loader/dock"
            note="What changed since the last acknowledged version. Built in the loader prompt (L4)."
          />
        }
      />
      <Route path="*" element={<Navigate to="dock" replace />} />
    </Routes>
  );
}
