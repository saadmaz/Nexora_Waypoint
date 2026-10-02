import type { DepotId } from "../../domain/field";
import type {
  DockView,
  ExceptionType,
  ExceptionView,
  LoadPlanView,
  PlanDiffView,
} from "./types";

export type AcknowledgePlanInput = { dockId: DepotId; version: number; personId: string; personName: string };
export type RecordCheckInput = { vehicleId: string; trip: 1 | 2; orderId: string; unitsLoaded: number; personId: string };
export type ConfirmLoadedInput = { vehicleId: string; trip: 1 | 2; personId: string; personName: string };
export type FlagExceptionInput = {
  type: ExceptionType;
  vehicleId: string;
  trip: 1 | 2;
  orderIds: string[];
  unitsShort?: number;
  note?: string;
  reason?: string;
  /** Ids of photos already saved on the tablet (`saveBlob`); they upload after the record. */
  blobIds?: string[];
  personId: string;
  personName: string;
};

/**
 * The loader's typed API (field conventions section 10): one mock implementation over the shared
 * transport now, the real backend later behind the same shape. No screen calls `fetch` or reads
 * `fixtures.ts` directly.
 */
export interface LoaderApi {
  getDock(dockId: DepotId): Promise<DockView>;
  verifyPin(personId: string, pin: string, otherName?: string): Promise<boolean>;
  /** Returns `"conflict"` when a newer version has since been released: the dock then re-reads it. */
  acknowledgePlan(input: AcknowledgePlanInput): Promise<"accepted" | "conflict">;
  getLoadPlan(vehicleId: string, trip: 1 | 2): Promise<LoadPlanView>;
  recordCheck(input: RecordCheckInput): Promise<void>;
  confirmLoaded(input: ConfirmLoadedInput): Promise<void>;
  flagException(input: FlagExceptionInput): Promise<string>;
  getException(id: string): Promise<ExceptionView>;
  getPlanDiff(dockId: DepotId, from: number, to: number): Promise<PlanDiffView>;
  /** The newest version Dispatch has released, whatever the dock has acknowledged. */
  getCurrentVersion(): Promise<number>;
  /** Dev-only: force the VEH003 exception's decision instead of waiting for the scenario clock (loader prompt section 5). */
  devResolveExceptionNow(): Promise<void>;
}
