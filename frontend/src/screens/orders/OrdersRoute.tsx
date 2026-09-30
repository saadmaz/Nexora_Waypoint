import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { createMockStoreApi } from "../../api/mockStoreApi";
import { scenarioNow } from "../../app/scenarioClock";
import { OrdersPage, type OrdersPreview } from "./OrdersPage";

const PREVIEWS: OrdersPreview[] = ["offline", "queued", "error", "sending", "empty"];

/**
 * /store/orders. Wires the page to the mock API and a clock. `?at=15:38` sets the
 * clock; `?state=` picks a frame: "form" starts with nothing placed (S1.1),
 * "offline", "queued", "error", "sending" and "empty" force S1.5 A to D, and no
 * state shows the hero orders already received (S1.3). Interim, until phase 7.
 */
export function OrdersRoute() {
  const [params] = useSearchParams();
  const at = params.get("at");
  const state = params.get("state");

  const now = useMemo(() => scenarioNow(at), [at]);
  const seed = state && state !== "received" ? "empty" : "placed";
  const api = useMemo(() => createMockStoreApi(now, { seed }), [now, seed]);
  const preview = PREVIEWS.find((p) => p === state);

  return <OrdersPage key={`${at}|${state}`} api={api} now={now} {...(preview ? { preview } : {})} />;
}
