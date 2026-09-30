import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { DeliveriesRoute } from "../screens/deliveries/DeliveriesRoute";
import { OrdersRoute } from "../screens/orders/OrdersRoute";
import { StoreProvider } from "./StoreProvider";

/**
 * Waypoint Store. /store/orders (phase 4) and /store/deliveries (phase 5) are routed so far;
 * the rest of the route set lands with its phase and phase 7.
 */
export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/store/orders" replace />} />
          <Route path="/store/orders" element={<OrdersRoute />} />
          <Route path="/store/deliveries" element={<DeliveriesRoute />} />
          <Route path="/store/deliveries/:date" element={<DeliveriesRoute />} />
          <Route path="*" element={<Navigate to="/store/orders" replace />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
}
