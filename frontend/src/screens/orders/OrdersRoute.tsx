import { useSearchParams } from "react-router-dom";
import { useStore } from "../../app/StoreContext";
import { OrdersPage, type OrdersPreview } from "./OrdersPage";

const PREVIEWS: OrdersPreview[] = ["offline", "queued", "error", "sending", "empty"];

/**
 * /store/orders. Wires the page to the shared API and clock. `?state=` picks a frame: "form"
 * starts with nothing placed (S1.1), "offline", "queued", "error", "sending" and "empty"
 * force S1.5 A to D, and no state shows the hero orders already received (S1.3). The clock
 * (`?at=15:38`) and the seed come from the StoreProvider. Interim, until phase 7.
 */
export function OrdersRoute() {
  const [params] = useSearchParams();
  const state = params.get("state");
  const { api, now } = useStore();
  const preview = PREVIEWS.find((p) => p === state);

  return <OrdersPage key={state ?? ""} api={api} now={now} {...(preview ? { preview } : {})} />;
}
