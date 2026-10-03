import { AppBar } from "../../../shared/chrome/AppBar";
import { PhoneLayout } from "../../../shared/chrome/PhoneLayout";
import { SyncChip, type SyncState } from "../../../shared/chrome/TopBar";
import { Card } from "../../../shared/ui/Card";
import { OUTLET } from "../../../domain/outlet";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { useOnline } from "../../../hooks/useOnline";
import { useStore } from "../../../app/StoreContext";
import { LogOutButton } from "../../auth/AccountMenu";
import { accountName } from "../../auth/accountName";
import styles from "./MePage.module.css";

/**
 * The store's Me tab: who is signed in, for which outlet, and Log out. Not in the Figma file (departure:
 * phones had no way to log out). On desktop Log out is also in the profile circle.
 */
export function MePage() {
  const { unread } = useStore();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const online = useOnline();
  const syncState: SyncState = online ? "synced" : "offline";

  const content = (
    <>
      <h1 className={styles.title}>Me</h1>
      <Card padded>
        <p className={styles.name}>{accountName("store")}</p>
        <p className={styles.helper}>
          Store manager · {OUTLET.id} · {OUTLET.brand}, {OUTLET.district}
        </p>
      </Card>
      <LogOutButton role="store" />
    </>
  );

  if (!desktop) {
    return (
      <PhoneLayout sync={syncState} bell={{ unread }}>
        <div className={styles.phone}>{content}</div>
      </PhoneLayout>
    );
  }

  return (
    <div className={styles.desktop}>
      <AppBar bell={{ unread }} right={<SyncChip state={syncState} />} />
      <main className={styles.column}>{content}</main>
    </div>
  );
}
