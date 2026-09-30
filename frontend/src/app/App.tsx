import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { OrdersRoute } from "../screens/orders/OrdersRoute";

/**
 * Waypoint Store. Only /store/orders is routed so far (phase 4); the rest of the
 * routes land in phase 7.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/store/orders" replace />} />
        <Route path="/store/orders" element={<OrdersRoute />} />
        <Route path="*" element={<Navigate to="/store/orders" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
