import { useCallback, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { Role } from "../../domain/status";
import { countWaiting } from "../../field/offline/outbox";
import { db } from "../../field/offline/db";
import { readUnsavedWork } from "../../shared/unsavedWork";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import { getAuthApi } from "./authClient";
import { logOutWarnings } from "./logOutWarnings";

async function waitingPhotos(): Promise<number> {
  const blobs = await db.blobs.toArray();
  return blobs.filter((blob) => blob.uploadStatus !== "uploaded").length;
}

/**
 * Log out of one role: clear its session and go to sign-in. When the role has work that is not
 * saved or not synced, it asks first. Render `dialog` once wherever the log out control lives.
 * The other roles keep their sessions.
 */
export function useLogOut(role: Role): { requestLogOut: () => void; dialog: ReactNode } {
  const navigate = useNavigate();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const logOut = useCallback(async () => {
    setBusy(true);
    try {
      await getAuthApi().signOut(role);
    } finally {
      setBusy(false);
    }
    setWarnings([]);
    // Nothing re-renders when a session is cleared, and only Dispatch has a route guard, so go there directly.
    navigate("/sign-in", { replace: true });
  }, [navigate, role]);

  const requestLogOut = useCallback(() => {
    void (async () => {
      const field = role === "driver" || role === "loader";
      const [records, photos] = field ? await Promise.all([countWaiting(), waitingPhotos()]) : [0, 0];
      const found = logOutWarnings(role, { unsaved: readUnsavedWork(), waitingRecords: records, waitingPhotos: photos });
      if (found.length === 0) await logOut();
      else setWarnings(found);
    })();
  }, [role, logOut]);

  const dialog = (
    <ConfirmDialog
      open={warnings.length > 0}
      onOpenChange={(open) => !open && setWarnings([])}
      title="Log out with unsaved work?"
      confirmLabel="Log out anyway"
      cancelLabel="Keep working"
      busy={busy}
      onConfirm={() => void logOut()}
    >
      {warnings.map((warning) => (
        <p key={warning}>{warning}</p>
      ))}
    </ConfirmDialog>
  );

  return { requestLogOut, dialog };
}
