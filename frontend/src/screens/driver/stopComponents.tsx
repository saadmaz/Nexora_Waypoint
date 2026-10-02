import { Mono } from "../../shared/ui/Mono";
import type { DriverStop } from "./types";
import type { TFn } from "./stopFormat";

/** "ETA 05:26 · Window 05:30-08:00", with the times in Plex Mono. */
export function StopSchedule({ stop }: { stop: DriverStop }) {
  return (
    <>
      ETA <Mono>{stop.plannedArrival}</Mono> · Window{" "}
      <Mono>
        {stop.window.open}-{stop.window.close}
      </Mono>
    </>
  );
}

/** "2 orders · ORD2001 12 · ORD2002 8" (R1 stop cards). */
export function StopOrdersSummary({ stop, t }: { stop: DriverStop; t: TFn }) {
  const countLabel =
    stop.orders.length === 1 ? t("stop.orderSingular", { count: 1 }) : t("stop.ordersPlural", { count: stop.orders.length });
  return (
    <>
      {countLabel} ·{" "}
      {stop.orders.map((order, index) => (
        <span key={order.id}>
          {index > 0 && " · "}
          <Mono>{order.id}</Mono> {order.units}
        </span>
      ))}
    </>
  );
}
