import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

/**
 * Waypoint Store. Routes land in phase 7; this shell exists so phase 1 builds
 * and runs on its own, as every phase commit must.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/store/orders" replace />} />
        <Route path="/store/orders" element={<Placeholder />} />
        <Route path="*" element={<Navigate to="/store/orders" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function Placeholder() {
  return (
    <main style={{ padding: 32 }}>
      <h1 style={{ font: "var(--text-h1)" }}>Waypoint Store</h1>
      <p style={{ font: "var(--text-body)", color: "var(--ink-muted)" }}>
        Store screens land in phases 4 to 6.
      </p>
    </main>
  );
}
