import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FieldTabBar, FieldTopBar, type FieldTab } from "../../../field/components";
import { Card } from "../../../shared/ui/Card";
import { LogOutButton } from "../../auth/AccountMenu";
import { accountName } from "../../auth/accountName";
import { DOCKS } from "../fixtures";
import { useLoader } from "../LoaderContext";
import styles from "./LoaderMe.module.css";

type LoaderTabKey = "dock" | "me";

/**
 * The loader phone's tab bar: Load lists · Me, as on the driver's. Wraps the phone's top-level
 * screens only; a load plan is a drill-down and keeps its own back arrow. The tablet logs out
 * from the profile circle instead. Not in the Figma file (departure: phones had no way to log out).
 */
export function LoaderPhoneTabs({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const active: LoaderTabKey = pathname.startsWith("/loader/me") ? "me" : "dock";
  const tabs: FieldTab<LoaderTabKey>[] = [
    { key: "dock", label: "Load lists", icon: "truck" },
    { key: "me", label: "Me", icon: "user" },
  ];
  return (
    <div className={styles.page}>
      <div className={styles.content}>{children}</div>
      <FieldTabBar tabs={tabs} active={active} onSelect={(key) => navigate(`/loader/${key}`)} />
    </div>
  );
}

/** The loader phone's Me tab: which account and dock this device is on, and Log out. */
export function LoaderMe() {
  const { dockId } = useLoader();
  const dockLabel = `${DOCKS.find((d) => d.id === dockId)?.name ?? dockId} dock`;
  return (
    <div className={styles.screen}>
      <FieldTopBar title="Me" subtitle={dockLabel} />
      <main className={styles.body}>
        <Card padded>
          <p className={styles.name}>{accountName("loader")}</p>
          <p className={styles.helper}>{dockLabel}. Each action still asks for your PIN.</p>
        </Card>
        <LogOutButton role="loader" />
      </main>
    </div>
  );
}
