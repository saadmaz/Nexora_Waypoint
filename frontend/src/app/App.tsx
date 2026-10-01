import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ComponentGallery } from "../field/gallery/ComponentGallery";
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
 *   /loader/*              Waypoint Load, Dark · pre-dawn          (LoaderApp)
 *   /driver/*              Driver, Dark · Field · Light            (DriverApp)
 *   /field/_components     the field component catalogue (dev only)
 *   anything else          Waypoint Store, Light · office          (StoreApp)
 *
 * The Dispatcher root joins this list when its branch merges. The Store state gallery is a
 * separate entry, because each of its frames runs its own router and clock.
 */
export default function App() {
  if (window.location.pathname === GALLERY_PATH) return <Gallery />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/loader/*" element={<LoaderApp />} />
        <Route path="/driver/*" element={<DriverApp />} />
        <Route path="/field/_components" element={<ComponentGallery />} />
        <Route path="*" element={<StoreApp />} />
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
