import { useSearchParams } from "react-router-dom";
import { OrdersPage, type OrdersPreview } from "./OrdersPage";

const PREVIEWS: OrdersPreview[] = ["offline", "queued", "error", "sending", "empty", "review", "edit", "cancelled"];

/**
 * /store/orders. `?state=` picks a frame: "form" starts with nothing placed (S1.1), "review" opens
 * the review (S1.2, S1.6 B), "edit" opens the edit form at 10 units (S1.3 B), "cancelled" is
 * S1.3 D, and "offline", "queued", "error", "sending" and "empty" force S1.5 A to D. No state
 * shows the hero orders already received (S1.3). The API and the clock come from the StoreProvider.
 */
export function OrdersRoute() {
  const [params] = useSearchParams();
  const state = params.get("state");
  const preview = PREVIEWS.find((p) => p === state);

  return <OrdersPage key={state ?? ""} {...(preview ? { preview } : {})} />;
}
