/**
 * One row of the store's updates feed (S4): a change on the order record that concerns the
 * store's orders (PRD v3 handoff 14). The tags are labels, not statuses.
 */
export type UpdateTag = "Order" | "Plan" | "Delivery" | "Deferral" | "Review";

export type StoreUpdate = {
  id: string;
  tag: UpdateTag;
  /** ISO date (YYYY-MM-DD) the update was sent. */
  date: string;
  /** "06:44" */
  time: string;
  title: string;
  /** One line. IDs and times in it are set in Plex Mono by the screen. */
  body: string;
  /** The link's label when it is not just "View" (the resolution reads "View delivery"). */
  viewLabel?: string;
  /** What View opens: the order form, or a delivery day (S2). */
  target: { screen: "orders" } | { screen: "delivery"; date: string };
  unread: boolean;
  /** Set on a Review row once Dispatch has settled it: "06:44" (renders "Resolved 06:44"). */
  resolvedAt?: string;
};

/** Everything S4's Updates segment and the bell need, from one read. */
export type UpdatesFeed = {
  /** Newest first. */
  updates: StoreUpdate[];
  unread: number;
};

/** "Today · Tue 29 Sep", "Yesterday · Mon 28 Sep", or "Sun 27 Sep" for anything older. */
export function dayHeading(date: string, today: string, yesterday: string, label: string): string {
  if (date === today) return `Today · ${label}`;
  if (date === yesterday) return `Yesterday · ${label}`;
  return label;
}
