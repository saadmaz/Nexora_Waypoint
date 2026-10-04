import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ComponentGallery } from "../field/gallery/ComponentGallery";
import { AuthGallery, RequireSession, RootRedirect, SessionExpiryListener, SignInRoute, StartRoute } from "../screens/auth";
import { DriverApp } from "../screens/driver/DriverApp";
import { LoaderApp } from "../screens/loader/LoaderApp";
import { Gallery } from "../screens/store/gallery/Gallery";
import DispatcherApp from "../screens/dispatcher/DispatcherApp";
import { Gallery as DispatcherGallery, GALLERY_PATH as DISPATCHER_GALLERY_PATH } from "../screens/dispatcher/gallery/Gallery";
import { PresenterControl } from "./PresenterControl";
import { StoreProvider } from "./StoreProvider";
import { StoreRoot } from "./StoreRoot";
import { StoreRoutes } from "./StoreRoutes";

/** The dev-only Store state gallery lives here. It is not linked from the product and has no router of its own. */
const GALLERY_PATH = "/store/_states";

/**
 * One app, four role roots (PRD v3 section 15). Each role keeps its own theme on its own root
 * element and its own providers, so the roles never share state:
 *
 *   /                      sends a signed-in person to their role home, anyone else to /sign-in
 *   /sign-in, /start       sign-in and the role picker (the app shell, `screens/auth`)
 *   /auth/_states          the app shell state gallery (dev only)
 *   /loader/*              Waypoint Load, Dark · pre-dawn          (LoaderApp, needs a loader sign-in)
 *   /driver/*              Driver, Dark · Field · Light            (DriverApp, needs a driver sign-in)
 *   /dispatcher/*          Waypoint Dispatch, Light · office       (DispatcherApp, needs a dispatcher sign-in)
 *   /dispatcher/_states    the Dispatch state gallery (dev only, outside the router like the Store gallery)
 *   /field/_components     the field component catalogue (dev only)
 *   /store/*               Waypoint Store, Light · office          (StoreApp, needs a store sign-in)
 *   anything else          back to /
 *
 * Every role area sits behind `RequireSession` for its own role, so typing a role's address with no
 * session lands on sign-in instead of that role's screens. The guard only reads storage, so a driver
 * who is offline with a session already on the phone still gets through to the run (PRD v3 section 15).
 *
 * The Store state gallery is a separate entry, because each of its frames runs its own router
 * and clock.
 */
export default function App() {
  // Each gallery frame runs its own router, so the galleries sit outside the app's router. All of them
  // are dev only: PRD v3 section 15 says judges never see them, and the check keeps them out of the build.
  if (import.meta.env.DEV && window.location.pathname === DISPATCHER_GALLERY_PATH) return <DispatcherGallery />;
  if (import.meta.env.DEV && window.location.pathname === GALLERY_PATH) return <Gallery />;

  return (
    <BrowserRouter>
      <SessionExpiryListener />
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/sign-in" element={<SignInRoute />} />
        <Route path="/start" element={<StartRoute />} />
        {import.meta.env.DEV && <Route path="/auth/_states" element={<AuthGallery />} />}
        <Route
          path="/loader/*"
          element={
            <RequireSession role="loader">
              <LoaderApp />
            </RequireSession>
          }
        />
        <Route
          path="/driver/*"
          element={
            <RequireSession role="driver">
              <DriverApp />
            </RequireSession>
          }
        />
        {import.meta.env.DEV && <Route path="/field/_components" element={<ComponentGallery />} />}
        <Route path="*" element={<RoleOrHome />} />
      </Routes>
    </BrowserRouter>
  );
}

/** Waypoint Store: the full Store route set under one API and one scenario clock, in a Light root. */
function StoreApp() {
  return (
    <StoreProvider>
      <StoreRoot>
        <StoreRoutes />
        {/* The store presenter moves a local mock clock: development only. On the API the dispatcher owns the clock. */}
        {import.meta.env.DEV && <PresenterControl />}
      </StoreRoot>
    </StoreProvider>
  );
}

/**
 * Waypoint Store owns `/store` and everything under it, and Waypoint Dispatch owns `/dispatcher`. Both
 * route sets use absolute paths (`/store/orders`, `/dispatcher/queue`), so neither can sit under a
 * `/store/*` or `/dispatcher/*` parent: React Router resolves a descendant <Routes> relative to its
 * parent route, and those paths would never match. They stay at the catch-all and each answers only
 * for its own prefix. Each needs its own role's session; without one it goes to sign-in. Every
 * other path goes back to `/`, which sends a signed-in person to their role home and everyone else to
 * sign-in.
 */
function RoleOrHome() {
  const { pathname } = useLocation();
  const isStore = pathname === "/store" || pathname.startsWith("/store/");
  const isDispatcher = pathname === "/dispatcher" || pathname.startsWith("/dispatcher/");
  if (isStore) {
    return (
      <RequireSession role="store">
        <StoreApp />
      </RequireSession>
    );
  }
  if (isDispatcher) {
    return (
      <RequireSession role="dispatcher">
        <DispatcherApp />
      </RequireSession>
    );
  }
  return <Navigate to="/" replace />;
}
