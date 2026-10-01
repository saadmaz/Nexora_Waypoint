import { Navigate, Route, Routes } from "react-router-dom";
import { ClockProvider } from "../../field/clock/ClockContext";
import { HERO_DATE } from "../../field/clock/clock";
import { FieldRuntime } from "../../field/FieldRuntime";
import { PlaceholderScreen } from "../../field/PlaceholderScreen";
import { RoleRoot, type Theme } from "../../shared/RoleRoot";
import { DriverGallery } from "./gallery/DriverGallery";

/**
 * The driver's colour mode. Prompt 3 replaces this with the theme rule from the R1.9 copy
 * (sunlight switch on is Field, otherwise Dark, or Light when the phone prefers light). Until
 * then the driver is Dark · pre-dawn, as in every frame.
 */
const DRIVER_THEME: Theme = "dark";

/** Where the driver's clock starts without `?at=`: the first frame, R1.3 A at 04:45 on the hero day. */
const DRIVER_START = { date: HERO_DATE, time: "04:45" };

/**
 * The Driver role root: `/driver/*`. On a wide screen it is a centred column on surface-0
 * (field conventions section 12); the column itself comes with the shell in prompt 3. Every route
 * answers with a placeholder until the driver prompts build the screens.
 */
export function DriverApp() {
  return (
    <Routes>
      <Route path="_states" element={<DriverGallery />} />
      <Route
        path="*"
        element={
          <ClockProvider start={DRIVER_START}>
            <FieldRuntime>
              <RoleRoot theme={DRIVER_THEME}>
                <DriverRoutes />
              </RoleRoot>
            </FieldRuntime>
          </ClockProvider>
        }
      />
    </Routes>
  );
}

function DriverRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="run" replace />} />
      <Route
        path="run"
        element={<PlaceholderScreen id="R1" title="Run" note="Today's stops, available offline. Built in driver prompt 3 (R1)." />}
      />
      <Route
        path="stops/:stopId"
        element={
          <PlaceholderScreen id="R2" title="Stop" back="/driver/run" note="One stop, one decision at a time. Built in driver prompt 3 (R2)." />
        }
      />
      <Route
        path="stops/:stopId/outcome"
        element={
          <PlaceholderScreen id="R3" title="Record outcome" back="/driver/run" note="Proof that survives disputes. Built in driver prompt 3 (R3)." />
        }
      />
      <Route
        path="issues"
        element={<PlaceholderScreen id="R6" title="Issues" note="Problems recorded on the road. Built in driver prompt 5 (R6)." />}
      />
      <Route
        path="history"
        element={<PlaceholderScreen id="R7" title="History" note="Trip history, read-only. Built in driver prompt 5 (R7)." />}
      />
      <Route
        path="notifications"
        element={
          <PlaceholderScreen id="R8" title="Notifications" back="/driver/run" note="Changes to your own run. Built in driver prompt 4 (R8)." />
        }
      />
      <Route
        path="finish"
        element={<PlaceholderScreen id="R9" title="Finish run" back="/driver/run" note="Close the run with a GPS distance. Built in driver prompt 5 (R9)." />}
      />
      <Route
        path="me"
        element={<PlaceholderScreen id="R1.9" title="Me" note="Sunlight screen, text size and language. Built in driver prompt 3 (R1.9)." />}
      />
      <Route path="*" element={<Navigate to="run" replace />} />
    </Routes>
  );
}
