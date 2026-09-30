import { Navigate, Route, Routes } from "react-router-dom";
import { DeliveriesRoute } from "../screens/deliveries/DeliveriesRoute";
import { IssuesRoute } from "../screens/issues/IssuesRoute";
import { OrdersRoute } from "../screens/orders/OrdersRoute";
import { ReceiptRoute } from "../screens/receipt/ReceiptRoute";
import { UpdatesRoute } from "../screens/updates/UpdatesRoute";

/**
 * The store's route set (PRD v3 section 15). Anything else goes to the orders. Used by the app
 * and by each frame of the state gallery.
 */
export function StoreRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/store/orders" replace />} />
      <Route path="/store/orders" element={<OrdersRoute />} />
      <Route path="/store/deliveries" element={<DeliveriesRoute />} />
      <Route path="/store/deliveries/:date" element={<DeliveriesRoute />} />
      <Route path="/store/deliveries/:date/receipt" element={<ReceiptRoute />} />
      <Route path="/store/issues" element={<IssuesRoute />} />
      <Route path="/store/updates" element={<UpdatesRoute view="updates" />} />
      <Route path="/store/history" element={<UpdatesRoute view="history" />} />
      <Route path="*" element={<Navigate to="/store/orders" replace />} />
    </Routes>
  );
}
