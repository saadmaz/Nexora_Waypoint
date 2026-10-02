import type { StoreApi } from "../api/StoreApi";
import { HERO_DATE } from "../api/mockDeliveries";
import { estimateFor } from "../domain/estimate";
import { OUTLET } from "../domain/outlet";
import { operatingDayFor } from "../domain/schedule";

/**
 * Dev presets: writes made through the StoreApi before the first screen draws, so a frame that
 * needs a tap to reach (S1.3 C, S3.2, S4.1 with 2 unread) can be opened straight from an address
 * or from the state gallery. `?preset=a,b` in mock mode; nothing links to them.
 */
export const PRESETS = [
  "order-edited",
  "order-cancelled",
  "after-cutoff-placed",
  "receipt-confirmed",
  "receipt-confirmed-review",
  "issue-reported",
  "deferral-seen",
  "read-all",
] as const;

export type Preset = (typeof PRESETS)[number];

export function isPreset(value: string): value is Preset {
  return (PRESETS as readonly string[]).includes(value);
}

/** The times the frames show for the store's own actions. */
const RECEIPT_TIME = "07:30";

export async function applyPreset(api: StoreApi, now: () => Date, preset: Preset): Promise<void> {
  const outletId = OUTLET.id;
  switch (preset) {
    case "order-edited": {
      // A25: ORD2001 12 to 10 units at 15:42, about 58 kg and 0.6 m3.
      const draft = await api.getOrderDraft(outletId);
      const order = draft.orders.find((o) => o.line.kind === "chilled");
      if (order) {
        const { kg, m3 } = estimateFor(draft.unitFactors, "chilled", 10);
        await api.editOrder(order.id, { units: 10, estimatedKg: kg, estimatedM3: m3 });
      }
      return;
    }
    case "order-cancelled": {
      const draft = await api.getOrderDraft(outletId);
      await Promise.all(draft.orders.map((order) => api.cancelOrder(order.id)));
      return;
    }
    case "after-cutoff-placed": {
      const draft = await api.getOrderDraft(outletId, operatingDayFor(now()));
      await api.placeOrders(
        (["chilled", "dry"] as const).map((kind) => {
          const units = draft.defaultUnits[kind];
          const { kg, m3 } = estimateFor(draft.unitFactors, kind, units);
          return { outletId, deliveryDate: draft.deliveryDate, line: { kind, units, estimatedKg: kg, estimatedM3: m3 } };
        }),
      );
      return;
    }
    case "receipt-confirmed":
    case "receipt-confirmed-review": {
      const [delivery] = await api.listDeliveries(outletId, HERO_DATE);
      if (!delivery) return;
      await api.confirmReceipt({
        outletId,
        date: HERO_DATE,
        lines: delivery.orders.map((o) => ({ orderId: o.id, received: o.units })),
        deviceTime: RECEIPT_TIME,
      });
      return;
    }
    case "issue-reported": {
      const [delivery] = await api.listDeliveries(outletId, HERO_DATE);
      const order = delivery?.orders.find((o) => o.kind === "chilled");
      if (!order) return;
      // S3.3 to S3.4: ORD2001, Missing, 2 units, photo attached.
      await api.reportIssue({
        outletId,
        date: HERO_DATE,
        type: "Missing",
        lines: [{ orderId: order.id, units: 2 }],
        photo: true,
      });
      return;
    }
    case "deferral-seen":
      await api.acknowledgeDeferral({ outletId, date: HERO_DATE });
      return;
    case "read-all":
      await api.markAllRead(outletId);
      return;
  }
}
