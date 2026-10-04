import { apiClient } from "./http/config";
import type { HttpClient } from "./http/client";
import { ApiError } from "./http/errors";
import { CutoffError, NotFoundError, type ConfirmReceiptInput, type ReportIssueInput, type StoreApi } from "./StoreApi";
import { mapDelivery, mapIssue, mapOrder, mapOrderDraft, mapRecent, mapUpdatesFeed } from "./storeMappers";
import { kindToApi } from "./vocab";

/**
 * The real `StoreApi`, over `/api/v1/store/*` (backend `routers/store.py`). Same interface as the mock, so a screen cannot
 * tell them apart.
 *
 * - The server knows the outlet from the signed-in token, so the `outletId` a screen passes is not sent. A screen only ever
 *   asks for its own outlet; a different one is the server's to refuse.
 * - Replies are mapped onto the frontend's own types in `storeMappers.ts`, and the wire vocabulary is translated in
 *   `vocab.ts`. No response type is written by hand.
 * - An order edit or cancel that the server refuses with 409 is the cutoff (the route's own doc says so), and 404 is a
 *   missing order. Both become the typed errors the screens already catch. Every other failure stays an `ApiError`,
 *   a 501 stays a `NotImplementedApiError`, and nothing falls back to the mock.
 */
export function createApiStoreApi(getClient: () => HttpClient = () => apiClient("store")): StoreApi {
  const client = () => getClient();

  /** 409 on an order change is the cutoff; 404 is "no such order". */
  function orderError(error: unknown, orderId: string): unknown {
    if (error instanceof ApiError && error.status === 409) return new CutoffError(orderId);
    if (error instanceof ApiError && error.status === 404) return new NotFoundError(orderId);
    return error;
  }

  async function deliveryDay(date: string) {
    return client().get("/api/v1/store/deliveries/{day}", { path: { day: date } });
  }

  return {
    async getOutlet() {
      const me = await client().get("/api/v1/me");
      if (!me.outlet) throw new Error("This account does not manage an outlet");
      const { id, name, brand, district, dock, window } = me.outlet;
      return { id, name, brand, district, dock, window: { start: window.start, end: window.end } };
    },

    async getOrderDraft(_outletId, date) {
      return mapOrderDraft(await client().get("/api/v1/store/order-form", { query: { date } }));
    },

    async placeOrders(inputs) {
      const orders = await client().post("/api/v1/store/orders", {
        body: {
          orders: inputs.map((input) => ({
            outletId: input.outletId,
            deliveryDate: input.deliveryDate,
            line: { kind: kindToApi(input.line.kind), units: input.line.units, estimatedKg: input.line.estimatedKg, estimatedM3: input.line.estimatedM3 },
          })),
        },
      });
      return orders.map(mapOrder);
    },

    async editOrder(orderId, input) {
      try {
        return mapOrder(
          await client().patch("/api/v1/store/orders/{order_id}", {
            path: { order_id: orderId },
            body: { units: input.units, estimatedKg: input.estimatedKg, estimatedM3: input.estimatedM3 },
          }),
        );
      } catch (error) {
        throw orderError(error, orderId);
      }
    },

    async cancelOrder(orderId) {
      try {
        await client().post("/api/v1/store/orders/{order_id}/cancel", { path: { order_id: orderId } });
      } catch (error) {
        throw orderError(error, orderId);
      }
    },

    async confirmReceipt(input: ConfirmReceiptInput) {
      return mapDelivery(
        await client().post("/api/v1/store/receipts", {
          body: {
            date: input.date,
            lines: input.lines.map((line) => ({ orderId: line.orderId, received: line.received })),
            ...(input.reason !== undefined ? { reason: input.reason } : {}),
            ...(input.deviceTime !== undefined ? { deviceTime: input.deviceTime } : {}),
          },
        }),
      );
    },

    async reportIssue(input: ReportIssueInput) {
      return mapIssue(
        await client().post("/api/v1/store/issues", {
          body: {
            date: input.date,
            type: input.type,
            lines: input.lines.map((line) => ({ orderId: line.orderId, units: line.units })),
            ...(input.note !== undefined ? { note: input.note } : {}),
            photo: input.photo,
          },
        }),
      );
    },

    async listIssues() {
      return (await client().get("/api/v1/store/issues")).map(mapIssue);
    },

    async listDeliveries(_outletId, date) {
      // Without a date the server answers every delivery day from today on, earliest first.
      const days = date === undefined ? await client().get("/api/v1/store/deliveries") : await deliveryDay(date);
      return days.map(mapDelivery);
    },

    async acknowledgeDeferral({ date }) {
      // The route is keyed by the deferral, not the day, so find the day's deferral first.
      const deferralId = (await deliveryDay(date)).find((day) => day.deferral)?.deferral?.id;
      if (deferralId === undefined) return; // Nothing left to acknowledge: the deferral was withdrawn. Got it is already true.
      await client().post("/api/v1/store/deferrals/{deferral_id}/seen", { path: { deferral_id: deferralId } });
    },

    async answerReceivedQuestion({ date, answer }) {
      // The route is keyed by the review (`conflict_id`). The contract types a delivery's `review` as a loose dict of strings,
      // so the id is read from it as `conflictId`. If the backend does not send it, say so rather than guess an id.
      const review = (await deliveryDay(date)).find((day) => day.review)?.review;
      const conflictId = Number(review?.conflictId);
      if (!Number.isInteger(conflictId)) {
        throw new ApiError(502, "unexpected_reply", "The delivery under review has no conflictId, so the answer cannot be sent");
      }
      await client().post("/api/v1/store/reviews/{conflict_id}/answer", { path: { conflict_id: conflictId }, body: { answer } });
    },

    async getUpdates() {
      return mapUpdatesFeed(await client().get("/api/v1/store/updates"));
    },

    async markAllRead() {
      await client().post("/api/v1/store/updates/read-all");
    },

    async listRecent(_outletId, options) {
      return (await client().get("/api/v1/store/history", { query: { limit: options?.limit, before: options?.before } })).map(mapRecent);
    },
  };
}
