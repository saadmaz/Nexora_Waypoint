import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { DeliveriesRoute } from "../screens/deliveries/DeliveriesRoute";
import { IssuesRoute } from "../screens/issues/IssuesRoute";
import { OrdersRoute } from "../screens/orders/OrdersRoute";
import { ReceiptRoute } from "../screens/receipt/ReceiptRoute";
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
          <Route path="/store/deliveries/:date/receipt" element={<ReceiptRoute />} />
          <Route path="/store/issues" element={<IssuesRoute />} />
          <Route path="*" element={<Navigate to="/store/orders" replace />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
}
