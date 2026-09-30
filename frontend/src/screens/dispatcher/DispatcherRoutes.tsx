import { Navigate, Route, Routes } from "react-router-dom";
import { CapacityRoute } from "./capacity/CapacityRoute";
import { QueueRoute } from "./queue/QueueRoute";

/**
 * The dispatcher's route set (PRD v3 section 15). Anything else goes to the queue. Used by the app and by
 * each frame of the state gallery.
 */
export function DispatcherRoutes() {
  return (
    <Routes>
      <Route path="/dispatcher" element={<Navigate to="/dispatcher/queue" replace />} />
      <Route path="/dispatcher/queue" element={<QueueRoute />} />
      <Route path="/dispatcher/capacity" element={<CapacityRoute />} />
      <Route path="*" element={<Navigate to="/dispatcher/queue" replace />} />
    </Routes>
  );
}
