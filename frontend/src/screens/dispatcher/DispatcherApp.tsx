import { RoleRoot } from "../../shared/RoleRoot";
import { PresenterControl } from "./chrome/PresenterControl";
import { DispatcherProvider } from "./DispatcherProvider";
import { DispatcherRoutes } from "./DispatcherRoutes";

/**
 * Waypoint Dispatch: the dispatcher's whole route set under one API and one scenario clock, in a root that
 * sets the Light theme (the planning office works in daylight, PRD v3 section 6). It runs inside the app's
 * router, behind the dispatcher sign-in. The dev-only state gallery is a separate entry, because each of its
 * frames runs its own router and clock.
 */
export default function DispatcherApp() {
  return (
    <DispatcherProvider>
      <RoleRoot theme="light">
        <DispatcherRoutes />
        <PresenterControl />
      </RoleRoot>
    </DispatcherProvider>
  );
}
