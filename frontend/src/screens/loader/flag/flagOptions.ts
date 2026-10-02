import type { IconName } from "../../../shared/ui/Icon";
import type { ExceptionType, ExceptionView } from "../types";

/** The icons L3.1 draws on each of the six types. */
export const FLAG_TYPE_ICON: Record<ExceptionType, IconName> = {
  "Missing item": "package",
  "Damaged item": "alert-triangle",
  "Wrong item": "x",
  "Warehouse shortage": "archive",
  "Vehicle check failed": "wrench",
  Other: "info",
};

/** L3.2 A: the four reasons for a failed vehicle check. The first is chosen when the step opens. */
export const VEHICLE_CHECK_REASONS = ["Reefer not holding temperature", "Won't start", "Door or seal fault", "Other"] as const;

/** Types whose details ask which order and how many units (L3.2 B draws Missing item; the rest reuse it). */
export const ORDER_TYPES: ExceptionType[] = ["Missing item", "Damaged item", "Wrong item", "Warehouse shortage"];

/** Types that offer the optional photo tile (L3.2 A draws it; Damaged and Wrong item add it as evidence). */
export const PHOTO_TYPES: ExceptionType[] = ["Vehicle check failed", "Damaged item", "Wrong item", "Other"];

/** The label over the stepper (L3.2 B reads "Units short"). */
export const UNITS_LABEL: Record<string, string> = {
  "Missing item": "Units short",
  "Damaged item": "Units damaged",
  "Wrong item": "Units wrong",
  "Warehouse shortage": "Units short",
};

const UNITS_PHRASE: Record<string, string> = {
  "Missing item": "short",
  "Damaged item": "damaged",
  "Wrong item": "wrong",
  "Warehouse shortage": "short",
};

/** "Priya · Vehicle check failed · Reefer not holding temperature": the line under "Sent to Dispatch" (L3.3). */
export function flagSummary(ex: Pick<ExceptionView, "type" | "reason" | "orderIds" | "unitsShort" | "note" | "raisedBy">): string {
  const who = ex.raisedBy ?? "Loader";
  if (ex.type === "Vehicle check failed") return [who, ex.type, ex.reason].filter(Boolean).join(" · ");
  if (ex.type === "Other") return [who, ex.type, ex.note].filter(Boolean).join(" · ");
  const units = ex.unitsShort ? `${ex.unitsShort} units ${UNITS_PHRASE[ex.type] ?? "short"}` : undefined;
  return [who, ex.type, ex.orderIds[0], units].filter(Boolean).join(" · ");
}

/** The detail line on the queued and failed screens (L3.4 A, B): the reason, then what it covers. */
export function flagDetail(
  ex: Pick<ExceptionView, "type" | "reason" | "orderIds" | "unitsShort" | "note" | "vehicleId">,
  scope: { orders: number; trips: number },
): string {
  if (ex.type === "Vehicle check failed") {
    return `${ex.reason ?? ex.type} · All ${scope.orders} orders on ${ex.vehicleId} (${scope.trips} trip${scope.trips === 1 ? "" : "s"})`;
  }
  if (ex.type === "Other") return ex.note ?? "";
  const units = ex.unitsShort ? ` · ${ex.unitsShort} units ${UNITS_PHRASE[ex.type] ?? "short"}` : "";
  return `${ex.orderIds[0] ?? ""}${units}`;
}
