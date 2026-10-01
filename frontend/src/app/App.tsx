import { BrowserRouter } from "react-router-dom";
import { ComponentGallery } from "../field/gallery/ComponentGallery";
import { Gallery } from "../screens/store/gallery/Gallery";
import { PresenterControl } from "./PresenterControl";
import { StoreProvider } from "./StoreProvider";
import { StoreRoot } from "./StoreRoot";
import { StoreRoutes } from "./StoreRoutes";

/** The dev-only state gallery lives here. It is not linked from the product and has no router of its own. */
const GALLERY_PATH = "/store/_states";

/** The field component catalogue (dev only): every field component in all three themes. */
const FIELD_COMPONENTS_PATH = "/field/_components";

/**
 * Waypoint Store: the full route set (PRD v3 section 15) under one API and one scenario clock, in
 * a root that sets the Light theme. The state gallery is a separate entry, because each of its
 * frames runs its own router and clock.
 */
export default function App() {
  if (window.location.pathname === GALLERY_PATH) return <Gallery />;
  if (window.location.pathname === FIELD_COMPONENTS_PATH) return <ComponentGallery />;

  return (
    <BrowserRouter>
      <StoreProvider>
        <StoreRoot>
          <StoreRoutes />
          <PresenterControl />
        </StoreRoot>
      </StoreProvider>
    </BrowserRouter>
  );
}
