import type { OrderKind } from "./order";

/**
 * The issue types a store can see (PRD v3 4b, Tags: Issue type). Refused and Store closed are
 * driver outcomes and never appear on the store's side. "Short" is not chosen on the sheet: it
 * is the tag an order gets when a Missing report covers only some of its units.
 */
export type IssueType = "Missing" | "Short" | "Damaged" | "Wrong item" | "Late" | "Arrived warm" | "Other";

/** What the report sheet offers, in the order S3.3 draws it. */
export const REPORTABLE_ISSUES: IssueType[] = ["Missing", "Damaged", "Wrong item", "Arrived warm", "Late", "Other"];

/** One order in a report: how many of its units are affected. */
export type IssueLine = {
  orderId: string;
  kind: OrderKind;
  /** Units affected. */
  units: number;
  /** Units on the order. */
  orderUnits: number;
};

/** A problem the store reported against a delivery (S3.3, listed on S3.7). */
export type Issue = {
  id: string;
  outletId: string;
  /** ISO date of the delivery day. */
  date: string;
  type: IssueType;
  lines: IssueLine[];
  note?: string;
  /** A photo is attached. */
  photo: boolean;
  /** "07:32" */
  reportedAt: string;
  resolved: boolean;
};

/** The tag an order carries for a line of a report: Missing on part of an order reads Short. */
export function issueTagFor(type: IssueType, line: Pick<IssueLine, "units" | "orderUnits">): IssueType {
  return type === "Missing" && line.units < line.orderUnits ? "Short" : type;
}

/** "2 units short", "12 units damaged", "arrived warm", "late" */
export function affectedText(type: IssueType, line: Pick<IssueLine, "units" | "orderUnits">): string {
  const units = `${line.units} ${line.units === 1 ? "unit" : "units"}`;
  switch (type) {
    case "Missing":
    case "Short":
      return line.units < line.orderUnits ? `${units} short` : `${units} missing`;
    case "Damaged":
      return `${units} damaged`;
    case "Wrong item":
      return `${units} wrong`;
    case "Arrived warm":
      return `${units} arrived warm`;
    case "Late":
      return "late";
    case "Other":
      return units;
  }
}
