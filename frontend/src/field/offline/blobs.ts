import { db, type BlobRecord } from "./db";
import { nowMs } from "./time";

/** Photos are kept at JPEG, longest edge 1600 px, quality 0.7 (PRD v3 section 15, assumption A44). */
export const PHOTO_MAX_EDGE = 1600;
export const PHOTO_QUALITY = 0.7;

/** The size a picture is scaled to so its longest edge is `maxEdge`. Never scales up. */
export function scaledSize(width: number, height: number, maxEdge = PHOTO_MAX_EDGE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const ratio = maxEdge / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

/** Compresses a photo (a file from the camera input, or a canvas from the viewfinder) to JPEG. */
export async function compressImage(source: Blob | HTMLCanvasElement): Promise<Blob> {
  const bitmap =
    source instanceof HTMLCanvasElement ? await createImageBitmap(source) : await createImageBitmap(source);
  const { width, height } = scaledSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not compress the photo"))),
      "image/jpeg",
      PHOTO_QUALITY,
    );
  });
}

export type NewBlob = {
  kind: BlobRecord["kind"];
  blob: Blob;
  /** The outbox record it belongs to; it uploads once that record is accepted. */
  recordClientId?: string;
};

/** Saves a photo or signature on the phone and returns its id for the outbox record's `blobIds`. */
export async function saveBlob(input: NewBlob): Promise<string> {
  const id = crypto.randomUUID();
  await db.blobs.add({
    id,
    kind: input.kind,
    blob: input.blob,
    mime: input.blob.type || "application/octet-stream",
    bytes: input.blob.size,
    recordClientId: input.recordClientId,
    uploadStatus: "pending",
    attempts: 0,
    createdAt: nowMs(),
  });
  return id;
}

export async function getBlob(id: string): Promise<BlobRecord | undefined> {
  return db.blobs.get(id);
}

/** Ties a saved blob to its record, once the record has an id. */
export async function attachBlob(id: string, recordClientId: string): Promise<void> {
  await db.blobs.update(id, { recordClientId });
}

/** Photos and signatures that have not uploaded, for the outbox and the R8.2 alert. */
export async function pendingBlobs(): Promise<BlobRecord[]> {
  const all = await db.blobs.toArray();
  return all.filter((b) => b.uploadStatus !== "uploaded");
}

/** Bytes held by blobs on this phone, for "Offline storage" on the Me tab. */
export async function blobBytes(): Promise<number> {
  const all = await db.blobs.toArray();
  return all.reduce((sum, b) => sum + b.bytes, 0);
}
