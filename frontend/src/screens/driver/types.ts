import type { DepotId, DriverOutcome, PlanVersion, Stop, Vehicle } from "../../domain/field";

/**
 * Driver-specific types (prompt 3: R1 to R3). These sit beside `domain/field.ts`'s shared field
 * types; a `DriverStop` is a `Stop` plus the execution facts only the driver's own phone knows
 * (its recorded arrival and outcomes), so they never leak into the Loader's or Dispatcher's view.
 */

export type LoaderShortfall = { orderId: string; shortBy: number };

/** The loader's confirmation at the gate (PRD H6, R1.3 B "Confirmed by Ruwan · 04:50"). */
export type LoaderConfirmation = {
  by: string;
  /** "HH:MM". */
  at: string;
  shortfalls: LoaderShortfall[];
};

/** One order's recorded outcome (R3). Saved once per order, even when "same outcome" was used. */
export type RecordedOutcome = {
  orderId: string;
  outcome: DriverOutcome;
  unitsDelivered: number;
  /** Refused and Other give a reason; Damaged and Store closed do not. */
  reason?: string;
  /** Absent for Store closed. */
  receiverName?: string;
  photoBlobId?: string;
  signatureBlobId?: string;
  /** "HH:MM", device time the outcome was saved. */
  savedAt: string;
};

/** The stop's record disagrees with a plan change the phone never received (driver prompt 4, PRD
 * §19). Grouped by stop: both ORD2001 and ORD2002 share one conflict on OUT084. */
export type ConflictDetail = {
  conflictId: string;
  serverVersion: number;
  /** "Deferred · store request, 05:21, by Kumari". */
  change: string;
  /** "HH:MM", when Dispatch made the change the phone never received (05:21). */
  changedAt: string;
  /** Who made it ("Kumari"). */
  changedBy: string;
  /** "HH:MM", device time the conflict was created (when the sync ran). */
  at: string;
};

/** Dispatch's decision once a conflict is open. Clears the conflict and updates the orders. */
export type Resolution = {
  decision: "keep_delivery" | "keep_partial";
  by: string;
  /** "HH:MM". */
  at: string;
  /** Units kept, for `keep_partial` (DP-12: no driver frame, reuses R1.8 / R5.3 with "as Partial"). */
  units?: number;
};

export type DriverNoticeKind =
  | "resolved"
  | "sent_for_review"
  | "synced"
  | "photo_failed"
  | "plan_received"
  | "went_offline"
  | "orders_on_board"
  | "plan_released";

/** One entry in R8.1 (field conventions section 15: server notices from `getNotices`, and
 * device-made sync notices such as "3 records synced" that never come from the server). */
export type DriverNotice = {
  id: string;
  kind: DriverNoticeKind;
  title: string;
  body?: string;
  /** "HH:MM". */
  at: string;
  read: boolean;
  outletId?: string;
  /** "WP-SYNC-409", for a photo-upload failure (R8.3). */
  reference?: string;
  /** The photo a `photo_failed` notice is about. */
  blobId?: string;
};

export type DriverStop = Stop & {
  /** Device time the arrival was saved, "HH:MM". Absent until "Record arrival". */
  arrivalAt?: string;
  /** By order id. Populated by "Save delivery record". */
  outcomes: Partial<Record<string, RecordedOutcome>>;
  /** Set when a recorded outcome disagrees with a plan version the phone has not seen (R1.7). */
  conflict?: ConflictDetail;
  /** Set once Dispatch resolves the conflict (R1.8). */
  resolution?: Resolution;
};

export type DriverRun = {
  runNo: number;
  vehicle: Vehicle;
  depot: DepotId;
  date: string;
  /** The latest plan version released as of now, or null before the first release (R1.1). */
  currentVersion: PlanVersion | null;
  /** ISO time of the next release, for R1.1's "Tonight's plan releases at 23:40." */
  nextPlanReleaseAt: string;
  /** The route bundle cached on this phone, or null before the first download. */
  downloadedVersion: number | null;
  /** The plan version Nimal has acknowledged, or null. */
  acknowledgedVersion: number | null;
  loaderConfirmation: LoaderConfirmation | null;
  /** Device time of "Start route", "HH:MM", or null before departure. */
  departedAt: string | null;
  stops: DriverStop[];
};

/** One order's choice on R3, before it is saved (the per-order grid row, or the "same outcome" default applied to every order on the stop). */
export type OutcomeInput = {
  orderId: string;
  outcome: DriverOutcome;
  unitsDelivered: number;
  reason?: string;
  receiverName?: string;
  photoBlobId?: string;
  signatureBlobId?: string;
};

/** Text size setting (R1.9). Large scales the driver root's type 1.15x. */
export type TextSize = "standard" | "large";

/** Language setting (R1.9). Sinhala and Tamil dictionaries land in driver prompt 5; English is complete now. */
export type Language = "en" | "si" | "ta";

export type DriverSettings = {
  /** The sunlight screen switch. On forces the Field theme; off follows the phone (dark/light). */
  sunlight: boolean;
  textSize: TextSize;
  language: Language;
};

/** R6.1 choices, exactly as drawn (PRD v3 section 3 R6, V30). */
export const PROBLEM_TYPES = ["Can't reach the store", "Vehicle problem", "Goods damaged on the truck", "Running late", "Something else"] as const;
export type ProblemType = (typeof PROBLEM_TYPES)[number];

/** What R6.2 records: what happened, the stop and orders it affects, a note and an optional photo. */
export type ProblemInput = {
  type: ProblemType;
  /** The affected stop (outlet id), or none for a problem with the vehicle as a whole. */
  stopId?: string;
  orderIds: string[];
  note: string;
  photoBlobId?: string;
  /** Set when this record updates an earlier problem (V40): the thread's first record. */
  updatesClientId?: string;
};

/** A problem saved on the phone. `clientId` is its outbox record. */
export type ProblemRecord = ProblemInput & {
  clientId: string;
  /** "HH:MM", device time it was saved. */
  savedAt: string;
};

/** R6.4: one thread per first problem record, with the updates that followed it (V40). */
export type ProblemThread = {
  parent: ProblemRecord;
  updates: ProblemRecord[];
  /** "saved": still on the phone; "sent": reached the server, waiting for Dispatch; "seen": Dispatch has opened it (G-14). */
  state: "saved" | "sent" | "seen";
};

/** R7.1: one row of trip history (A34). A day with no run says why. */
export type HistoryDay = {
  date: string;
  /** "Today", or the day as "Mon 28 Sep". */
  label: string;
  run:
    | { kind: "run"; start: string; end: string | null; km: number | null; duration: string | null; stopsDone: number; stopsTotal: number; synced: boolean }
    | { kind: "no_run"; reason: string };
};

/** R9: the distance the run is closed with (A24), and what it implies for fuel. */
export type RunDistance = {
  /** "gps": tracked on the phone (the hero fixture legs in the scenario); "planned": permission refused or no fixes (DP-14). */
  source: "gps" | "planned";
  legsKm: number[];
  totalKm: number;
  /** Planned leg distance used for stretches with no fix. */
  gapFilledKm: number;
  plannedKm: number;
  kmPerL: number;
  fuelL: number;
};

/** R9: the run once it is closed. */
export type FinishedRun = { at: string; distance: RunDistance };
