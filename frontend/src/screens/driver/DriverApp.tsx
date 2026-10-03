import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ClockProvider } from "../../field/clock/ClockContext";
import { devMocks } from "../../devMocks/registry";
import { FieldRuntime } from "../../field/FieldRuntime";
import { RoleRoot } from "../../shared/RoleRoot";
import { DriverProvider } from "./context/DriverProvider";
import { useDriverSettings } from "./context/DriverContext";
import { DriverGallery } from "./gallery/DriverGallery";
import { FinishScreen } from "./finish/FinishScreen";
import { HistoryDayScreen, HistoryScreen } from "./history/HistoryScreen";
import { IssuesScreen } from "./issues/IssuesScreen";
import { ProblemScreen } from "./issues/ProblemScreen";
import { MeScreen } from "./me/MeScreen";
import { NotificationsScreen } from "./notices/NotificationsScreen";
import { RunScreen } from "./run/RunScreen";
import { OutcomeScreen } from "./outcome/OutcomeScreen";
import { StopScreen } from "./stop/StopScreen";
import { PhotoFailureScreen } from "./sync/PhotoFailureScreen";
import { SyncResultScreen } from "./sync/SyncResultScreen";

/** Where the driver's clock starts without `?at=`: the first frame, R1.3 A at 04:45 on the hero day. */

/**
 * The Driver role root: `/driver/*`. On a wide screen it is a centred column on surface-0
 * (field conventions section 12, built into DriverShell). The theme follows the R1.9 rule: the
 * sunlight switch wins, otherwise the phone's own colour scheme preference (DriverProvider).
 * The state gallery is dev only: judges never see it (PRD v3 section 15).
 */
export function DriverApp() {
  // Where the mock clock starts. On the real API the clock is the server's and this is never read.
  const start = import.meta.env.DEV ? devMocks().fieldClock.DRIVER_START : undefined;
  return (
    <Routes>
      {import.meta.env.DEV && <Route path="_states" element={<DriverGallery />} />}
      <Route
        path="*"
        element={
          <ClockProvider {...(start ? { start } : {})} role="driver">
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
      <Route path="sync-result" element={<SyncResultScreen />} />
      <Route path="stops/:stopId" element={<StopScreen />} />
      <Route path="stops/:stopId/outcome" element={<OutcomeScreen />} />
      <Route path="issues" element={<IssuesScreen />} />
      <Route path="issues/new" element={<ProblemScreen />} />
      <Route path="history" element={<HistoryScreen />} />
      <Route path="history/:date" element={<HistoryDayScreen />} />
      <Route path="notifications/photo/:blobId" element={<PhotoFailureScreen />} />
      <Route path="notifications" element={<NotificationsScreen />} />
      <Route path="finish" element={<FinishScreen />} />
      <Route path="me" element={<MeScreen />} />
      <Route path="*" element={<Navigate to="run" replace />} />
    </Routes>
  );
}
