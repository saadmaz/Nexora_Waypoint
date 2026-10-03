import type { DeferralType, OrderStatus } from "../domain/status";
import type { OrderKind } from "../domain/order";
import type { Temperature } from "../domain/field";
import type { components } from "./schema";
import { ApiError } from "./http/errors";

/**
 * The backend writes its vocabulary as snake_case wire values (`store_request`, `pending_sync`) and calls the order kind a
 * temperature (`ambient`). The frontend's shared types (`domain/`) keep the words the screens print. These tables are the one
 * place that translates between them. Each is a full `Record` over the generated union, so when the backend adds a value the
 * build fails here instead of a screen showing a blank.
 */

type ApiOrderStatus = components["schemas"]["OrderStatus"];
type ApiDeferralType = components["schemas"]["DeferralType"];
type ApiTemp = components["schemas"]["Temp"];

const STATUS: Record<ApiOrderStatus, OrderStatus> = {
  ordered: "Ordered",
  confirmed: "Confirmed",
  planned: "Planned",
  deferred: "Deferred",
  loaded: "Loaded",
  departed: "Departed",
  delivered: "Delivered",
  partial: "Partial",
  issue: "Issue",
  conflict: "Conflict",
  pending_sync: "Pending sync",
};

const DEFERRAL: Record<ApiDeferralType, DeferralType> = {
  capacity: "capacity",
  policy: "policy",
  store_request: "store request",
};

/** A store order is "chilled" or "dry"; the backend calls the dry one "ambient". */
const KIND: Record<ApiTemp, OrderKind> = { chilled: "chilled", ambient: "dry" };
const KIND_TO_API: Record<OrderKind, ApiTemp> = { chilled: "chilled", dry: "ambient" };
const TEMPERATURE: Record<ApiTemp, Temperature> = { chilled: "chilled", ambient: "ambient" };

/** The reply is not what the contract says it is. Not a network failure and not a verdict from the server, so it has its own code. */
export function unexpectedReply(what: string): ApiError {
  return new ApiError(502, "unexpected_reply", `The server's reply was not what this app expects: ${what}`);
}

function lookup<K extends string, V>(table: Record<K, V>, value: string, what: string): V {
  if (Object.prototype.hasOwnProperty.call(table, value)) return table[value as K];
  throw unexpectedReply(`${what} "${value}"`);
}

export const statusFromApi = (value: string): OrderStatus => lookup(STATUS, value, "order status");
export const deferralTypeFromApi = (value: string): DeferralType => lookup(DEFERRAL, value, "deferral type");
export const kindFromApi = (value: string): OrderKind => lookup(KIND, value, "order kind");
export const kindToApi = (kind: OrderKind): ApiTemp => KIND_TO_API[kind];
export const temperatureFromApi = (value: string): Temperature => lookup(TEMPERATURE, value, "temperature");

/** Narrows a free-text field the backend types as `str` to the union the screens expect, or fails loudly. */
export function oneOf<T extends string>(allowed: readonly T[], value: string, what: string): T {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw unexpectedReply(`${what} "${value}"`);
}

/** Reads a string out of a backend `dict[str, str]` field. */
export function field(dict: Record<string, unknown> | null | undefined, key: string, what: string): string {
  const value = dict?.[key];
  if (typeof value !== "string") throw unexpectedReply(`${what} has no "${key}"`);
  return value;
}
