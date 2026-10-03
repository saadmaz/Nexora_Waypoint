import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { ClockProvider } from "../../field/clock/ClockContext";
import { devMocks } from "../../devMocks/registry";
import { FieldRuntime } from "../../field/FieldRuntime";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { RoleRoot } from "../../shared/RoleRoot";
import { ChangesContainer } from "./changes/ChangesContainer";
import { DockContainer } from "./dock/DockContainer";
import { LoaderGallery } from "./gallery/LoaderGallery";
import { LoadPlanContainer } from "./loadplan/LoadPlanContainer";
import { LoaderDevControls } from "./LoaderDevControls";
import { LoaderMe, LoaderPhoneTabs } from "./me/LoaderMe";
import { LoaderProvider } from "./LoaderProvider";
import { TabletDock } from "./tablet/TabletDock";
import { WideColumn } from "./tablet/WideColumn";

/** Waypoint Load always works in the dark (field conventions section 1): a shared dock tablet at night. */
const LOADER_THEME = "dark";

/** Where the loader's own clock starts without `?at=`: the first frame, L1.1 at 23:45 on Monday evening. */

/**
 * The Loader role root: `/loader/*`. The state gallery sits outside the runtime and the clock,
 * because each of its frames fakes its own, and is dev only: judges never see it (PRD v3 section 15).
 * L1 to L4 are built, and L1.7 swaps the dock and load plan routes for the tablet master-detail
 * from 1024 px.
 */
export function LoaderApp() {
  // Where the mock clock starts. On the real API the clock is the server's and this is never read.
  const start = import.meta.env.DEV ? devMocks().fieldClock.LOADER_START : undefined;
  return (
    <Routes>
      {import.meta.env.DEV && <Route path="_states" element={<LoaderGallery />} />}
      <Route
        path="*"
        element={
          <ClockProvider {...(start ? { start } : {})} role="loader">
            <FieldRuntime>
              <RoleRoot theme={LOADER_THEME}>
                <LoaderProvider>
                  <LoaderRoutes />
                  <LoaderDevControls />
                </LoaderProvider>
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
      <Route element={<DockRoutes />}>
        <Route
          path="dock"
          element={
            <LoaderPhoneTabs>
              <DockContainer />
            </LoaderPhoneTabs>
          }
        />
        <Route path="vehicles/:vehicleId/trips/:trip" element={<LoadPlanContainer />} />
        <Route path="vehicles/:vehicleId/trips/:trip/flag" element={<LoadPlanContainer flagOpen />} />
      </Route>
      <Route
        path="changes"
        element={
          <WideColumn>
            <ChangesContainer />
          </WideColumn>
        }
      />
      <Route
        path="me"
        element={
          <LoaderPhoneTabs>
            <LoaderMe />
          </LoaderPhoneTabs>
        }
      />
      <Route path="*" element={<Navigate to="dock" replace />} />
    </Routes>
  );
}

/**
 * The dock and load plan routes share one layout element, so moving between them at tablet width keeps
 * the shell, and the vehicle list, mounted. On a phone each route draws its own screen.
 */
function DockRoutes() {
  const tablet = useMediaQuery("(min-width: 1024px)");
  return tablet ? <TabletDock /> : <Outlet />;
}
