import { Navigate, Route, Routes } from "react-router-dom";
import { CapacityRoute } from "./capacity/CapacityRoute";
import { DeferralsRoute } from "./deferrals/DeferralsRoute";
import { ReleaseRoute } from "./release/ReleaseRoute";
import { LiveRoute } from "./live/LiveRoute";
import { ConflictRoute } from "./conflict/ConflictRoute";
import { ExceptionRoute } from "./exception/ExceptionRoute";
import { QueueRoute } from "./queue/QueueRoute";
import { TripsRoute } from "./trips/TripsRoute";

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
      <Route path="/dispatcher/trips" element={<TripsRoute />} />
      <Route path="/dispatcher/deferrals" element={<DeferralsRoute />} />
      <Route path="/dispatcher/deferrals/:orderId" element={<DeferralsRoute />} />
      <Route path="/dispatcher/release" element={<ReleaseRoute />} />
      <Route path="/dispatcher/live" element={<LiveRoute />} />
      <Route path="/dispatcher/conflicts/:id" element={<ConflictRoute />} />
      <Route path="/dispatcher/exceptions/:id" element={<ExceptionRoute />} />
      <Route path="*" element={<Navigate to="/dispatcher/queue" replace />} />
    </Routes>
  );
}
