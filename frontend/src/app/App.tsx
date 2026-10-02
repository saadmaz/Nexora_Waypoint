import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ComponentGallery } from "../field/gallery/ComponentGallery";
import { AuthGallery, RootRedirect, SessionExpiryListener, ShellPlaceholder, SignInRoute, StartRoute } from "../screens/auth";
import { DriverApp } from "../screens/driver/DriverApp";
import { LoaderApp } from "../screens/loader/LoaderApp";
import { Gallery } from "../screens/store/gallery/Gallery";
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
 *   /loader/*              Waypoint Load, Dark · pre-dawn          (LoaderApp)
 *   /driver/*              Driver, Dark · Field · Light            (DriverApp)
 *   /dispatcher/*          Waypoint Dispatch                       (slot, see DispatcherSlot)
 *   /field/_components     the field component catalogue (dev only)
 *   /store/*               Waypoint Store, Light · office          (StoreApp)
 *   anything else          back to /
 *
 * The Store state gallery is a separate entry, because each of its frames runs its own router
 * and clock.
 */
export default function App() {
  if (window.location.pathname === GALLERY_PATH) return <Gallery />;

  return (
    <BrowserRouter>
      <SessionExpiryListener />
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/sign-in" element={<SignInRoute />} />
        <Route path="/start" element={<StartRoute />} />
        <Route path="/auth/_states" element={<AuthGallery />} />
        <Route path="/loader/*" element={<LoaderApp />} />
        <Route path="/driver/*" element={<DriverApp />} />
        {/* DISPATCHER ROOT: replace this line with <Route path="/dispatcher/*" element={<DispatcherApp />} /> when feature/dispatch-planning merges, and delete DispatcherSlot. */}
        <Route path="/dispatcher/*" element={<DispatcherSlot />} />
        <Route path="/field/_components" element={<ComponentGallery />} />
        <Route path="*" element={<StoreOrHome />} />
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
        <PresenterControl />
      </StoreRoot>
    </StoreProvider>
  );
}

/**
 * Waypoint Store owns `/store` and everything under it. `StoreRoutes` uses absolute `/store/...`
 * paths, so it cannot sit under a `/store/*` parent: React Router resolves a descendant <Routes>
 * relative to its parent route, and `/store/orders` would never match. It stays at the catch-all
 * and answers only for its own prefix. Every other path goes back to `/`, which sends a signed-in
 * person to their role home and everyone else to sign-in.
 */
function StoreOrHome() {
  const { pathname } = useLocation();
  const isStore = pathname === "/store" || pathname.startsWith("/store/");
  return isStore ? <StoreApp /> : <Navigate to="/" replace />;
}

/**
 * Stands in for the dispatcher's root until `feature/dispatch-planning` merges. The route has to
 * exist: a signed-in dispatcher is sent from `/` to `/dispatcher/queue`, and without it that path
 * would fall to the catch-all and bounce back to `/` forever.
 */
function DispatcherSlot() {
  return (
    <ShellPlaceholder
      title="Waypoint Dispatch is not on this branch yet"
      note="The dispatcher screens arrive with the dispatch planning branch."
    />
  );
}
