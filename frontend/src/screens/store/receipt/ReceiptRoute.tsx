import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { ReceiptPage, type ReceiptPreview } from "./ReceiptPage";

const PREVIEWS: ReceiptPreview[] = ["loading", "error", "offline", "asked", "shortfall"];

/**
 * /store/deliveries/:date/receipt. `?report=1` opens the report sheet (S2.7's Report issue);
 * `?preview=loading|error|offline|asked|shortfall` forces S3.S B, D, C, S3.5 and S3.1 B.
 */
export function ReceiptRoute() {
  const { date } = useParams();
  const [params] = useSearchParams();
  if (!date) return <Navigate to="/store/deliveries" replace />;
  const preview = PREVIEWS.find((p) => p === params.get("preview"));

  return (
    <ReceiptPage
      key={`${date}|${preview ?? ""}`}
      date={date}
      {...(preview ? { preview } : {})}
      {...(params.get("report") ? { openReport: true } : {})}
    />
  );
}
