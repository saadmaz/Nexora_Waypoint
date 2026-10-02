import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ClockProvider } from "../../field/clock/ClockContext";
import { HERO_DATE } from "../../field/clock/clock";
import { FieldRuntime } from "../../field/FieldRuntime";
import { PlaceholderScreen } from "../../field/PlaceholderScreen";
import { RoleRoot } from "../../shared/RoleRoot";
import { DriverProvider } from "./context/DriverProvider";
import { useDriverSettings } from "./context/DriverContext";
import { DriverGallery } from "./gallery/DriverGallery";
import { MeScreen } from "./me/MeScreen";
import { RunScreen } from "./run/RunScreen";
import { OutcomeScreen } from "./outcome/OutcomeScreen";
import { StopScreen } from "./stop/StopScreen";

/** Where the driver's clock starts without `?at=`: the first frame, R1.3 A at 04:45 on the hero day. */
const DRIVER_START = { date: HERO_DATE, time: "04:45" };

/**
 * The Driver role root: `/driver/*`. On a wide screen it is a centred column on surface-0
 * (field conventions section 12, built into DriverShell). The theme follows the R1.9 rule: the
 * sunlight switch wins, otherwise the phone's own colour scheme preference (DriverProvider).
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
              <DriverProvider>
                <ThemedRoot>
                  <DriverRoutes />
                </ThemedRoot>
              </DriverProvider>
            </FieldRuntime>
          </ClockProvider>
        }
      />
    </Routes>
  );
}

function ThemedRoot({ children }: { children: ReactNode }) {
  const { theme } = useDriverSettings();
  return <RoleRoot theme={theme}>{children}</RoleRoot>;
}

function DriverRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="run" replace />} />
      <Route path="run" element={<RunScreen />} />
      <Route path="stops/:stopId" element={<StopScreen />} />
      <Route path="stops/:stopId/outcome" element={<OutcomeScreen />} />
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
      <Route path="me" element={<MeScreen />} />
      <Route path="*" element={<Navigate to="run" replace />} />
    </Routes>
  );
}
