import { BrowserRouter } from "react-router-dom";
import { StoreProvider } from "./StoreProvider";
import { StoreRoot } from "./StoreRoot";
import { StoreRoutes } from "./StoreRoutes";

/**
 * Waypoint Store: the full route set (PRD v3 section 15) under one API and one scenario clock, in
 * a root that sets the Light theme.
 */
export default function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <StoreRoot>
          <StoreRoutes />
        </StoreRoot>
      </StoreProvider>
    </BrowserRouter>
  );
}
