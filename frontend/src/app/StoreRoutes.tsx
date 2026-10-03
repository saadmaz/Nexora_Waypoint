import { Navigate, Route, Routes } from "react-router-dom";
import { DeliveriesRoute } from "../screens/store/deliveries/DeliveriesRoute";
import { IssuesRoute } from "../screens/store/issues/IssuesRoute";
import { MePage } from "../screens/store/me/MePage";
import { OrdersRoute } from "../screens/store/orders/OrdersRoute";
import { ReceiptRoute } from "../screens/store/receipt/ReceiptRoute";
import { UpdatesRoute } from "../screens/store/updates/UpdatesRoute";

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
      <Route path="/store/me" element={<MePage />} />
      <Route path="/store/updates" element={<UpdatesRoute view="updates" />} />
      <Route path="/store/history" element={<UpdatesRoute view="history" />} />
      <Route path="*" element={<Navigate to="/store/orders" replace />} />
    </Routes>
  );
}
