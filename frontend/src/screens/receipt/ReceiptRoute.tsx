import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../../app/StoreContext";
import { ReceiptPage, type ReceiptPreview } from "./ReceiptPage";

const PREVIEWS: ReceiptPreview[] = ["loading", "error", "offline", "asked"];

/**
 * /store/deliveries/:date/receipt. `?report=1` opens the report sheet (S2.7's Report issue);
 * `?preview=loading|error|offline|asked` forces S3.S B, D, C and S3.5. Interim, until the
 * phase 7 gallery.
 */
export function ReceiptRoute() {
  const { date } = useParams();
  const [params] = useSearchParams();
  const { api, now } = useStore();
  if (!date) return <Navigate to="/store/deliveries" replace />;
  const preview = PREVIEWS.find((p) => p === params.get("preview"));

  return (
    <ReceiptPage
      key={`${date}|${preview ?? ""}`}
      api={api}
      now={now}
      date={date}
      {...(preview ? { preview } : {})}
      {...(params.get("report") ? { openReport: true } : {})}
    />
  );
}
