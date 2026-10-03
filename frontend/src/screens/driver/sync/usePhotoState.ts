import { useMemo } from "react";
import { useBlobs, useOutbox } from "../../../field/offline";
import type { DriverRun } from "../types";

/** A photo that could not be sent. Its delivery record is already with Dispatch; the photo stays on the phone and is retried. */
export type PhotoFailure = {
  blobId: string;
  outletId?: string;
  stopNumber?: number;
  /** Epoch ms the photo was taken. */
  takenAt: number;
  /** Epoch ms of the last failed try. */
  lastTryAt: number;
  /** Epoch ms the delivery record it belongs to reached Dispatch. */
  deliverySyncedAt?: number;
};

export type PhotoState = {
  /** Stops with a photo still on the phone (waiting to send, or failed). */
  onPhoneOutlets: ReadonlySet<string>;
  /** Photos still on the phone, for the "1 on phone" pill. */
  onPhoneCount: number;
  failures: PhotoFailure[];
  /** False until the phone's blobs have been read once. */
  loaded: boolean;
};

export const NO_PHOTOS: PhotoState = { onPhoneOutlets: new Set(), onPhoneCount: 0, failures: [], loaded: true };

/**
 * Where the stop photos are, from the phone's own blobs and outbox (driver prompt 4 section 4):
 * photos upload one at a time after their records, and a failed upload never fails its record.
 */
export function usePhotoState(run: DriverRun | null): PhotoState {
  const blobs = useBlobs();
  const records = useOutbox();

  return useMemo(() => {
    const onPhone = (blobs ?? []).filter((blob) => blob.kind === "photo" && blob.uploadStatus !== "uploaded");
    const outletOf = (clientId?: string) => {
      const owner = clientId ? records.find((record) => record.clientId === clientId) : undefined;
      return { owner, outletId: (owner?.payload as { outletId?: string } | undefined)?.outletId };
    };
    const onPhoneOutlets = new Set<string>();
    for (const blob of onPhone) {
      const { outletId } = outletOf(blob.recordClientId);
      if (outletId) onPhoneOutlets.add(outletId);
    }
    const failures: PhotoFailure[] = onPhone
      .filter((blob) => blob.uploadStatus === "failed")
      .map((blob) => {
        const { owner, outletId } = outletOf(blob.recordClientId);
        return {
          blobId: blob.id,
          outletId,
          stopNumber: run?.stops.find((stop) => stop.outletId === outletId)?.number,
          takenAt: blob.createdAt,
          lastTryAt: blob.lastAttemptAt ?? blob.createdAt,
          deliverySyncedAt: owner?.syncedAt,
        };
      });
    return { onPhoneOutlets, onPhoneCount: onPhone.length, failures, loaded: blobs !== null };
  }, [blobs, records, run]);
}
