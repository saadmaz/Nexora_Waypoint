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

export type DriverStop = Stop & {
  /** Device time the arrival was saved, "HH:MM". Absent until "Record arrival". */
  arrivalAt?: string;
  /** By order id. Populated by "Save delivery record". */
  outcomes: Partial<Record<string, RecordedOutcome>>;
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
