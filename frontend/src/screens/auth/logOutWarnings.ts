import type { Role } from "../../domain/status";

export type LogOutWork = {
  /** Notes from screens holding work that would be lost (`shared/unsavedWork`). */
  unsaved: string[];
  /** Field outbox records not on the server yet. */
  waitingRecords: number;
  /** Photos and signatures not uploaded yet. */
  waitingPhotos: number;
};

/** Field roles keep their work on the device, so their outbox counts. Office roles have none. */
const FIELD_ROLES: Role[] = ["driver", "loader"];

/** What log out should warn about for this role. An empty list means log out at once. */
export function logOutWarnings(role: Role, work: LogOutWork): string[] {
  const warnings = [...work.unsaved];
  if (!FIELD_ROLES.includes(role)) return warnings;
  const records = work.waitingRecords;
  if (records > 0) {
    warnings.push(
      records === 1
        ? "1 update has not synced yet. It stays on this device and sends after the next sign-in."
        : `${records} updates have not synced yet. They stay on this device and send after the next sign-in.`,
    );
  }
  const photos = work.waitingPhotos;
  if (photos > 0) {
    warnings.push(photos === 1 ? "1 photo or signature is not uploaded yet." : `${photos} photos or signatures are not uploaded yet.`);
  }
  return warnings;
}
