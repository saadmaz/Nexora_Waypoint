import { useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../../app/StoreContext";
import { DeliveriesPage, type DeliveriesPreview } from "./DeliveriesPage";

const PREVIEWS: DeliveriesPreview[] = ["loading", "error", "offline"];

/**
 * /store/deliveries (the list, S2.10) and /store/deliveries/:date (one day). `?preview=`
 * forces S2.S B, D and C (loading, error, offline); `?outlet=OUT009` shows the S2.9 view.
 * Interim, until the phase 7 gallery.
 */
export function DeliveriesRoute() {
  const { date } = useParams();
  const [params] = useSearchParams();
  const { api, now } = useStore();
  const preview = PREVIEWS.find((p) => p === params.get("preview"));
  const outlet = params.get("outlet");

  return (
    <DeliveriesPage
      key={`${date ?? ""}|${preview ?? ""}|${outlet ?? ""}`}
      api={api}
      now={now}
      {...(date ? { date } : {})}
      {...(outlet ? { outletId: outlet } : {})}
      {...(preview ? { preview } : {})}
    />
  );
}
