import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ConnectivityChip, FieldTopBar } from "./components";
import { useConnectivity } from "./offline";
import { formatTime } from "./clock/clock";
import { useNow } from "./clock/useClock";
import styles from "./PlaceholderScreen.module.css";

export type PlaceholderScreenProps = {
  /** The screen ID from the design, for example "L2" or "R3". */
  id: string;
  title: string;
  /** What lands here, and in which prompt. */
  note: string;
  back?: string;
  children?: ReactNode;
};

/**
 * A route with no screen yet. The foundation only wires the roots, so each Loader and Driver ID
 * answers with this: the real connectivity chip and scenario clock, so both can be seen working.
 * The role prompts replace each placeholder with the screen.
 */
export function PlaceholderScreen({ id, title, note, back, children }: PlaceholderScreenProps) {
  const navigate = useNavigate();
  const connectivity = useConnectivity();
  const now = useNow();
  const chip = connectivity.status === "offline" ? "offline" : connectivity.status === "online" ? "synced" : connectivity.status;
  return (
    <div className={styles.screen}>
      <FieldTopBar
        title={title}
        subtitle={`${id} · ${formatTime(now)}`}
        onBack={back ? () => navigate(back) : undefined}
      >
        <ConnectivityChip
          status={chip}
          time={connectivity.lastSyncAt ? formatTime(connectivity.lastSyncAt) : undefined}
          count={connectivity.waitingCount}
        />
      </FieldTopBar>
      <main className={styles.body}>
        <h2 className={styles.heading}>{id} is not built yet</h2>
        <p className={styles.note}>{note}</p>
        {children}
      </main>
    </div>
  );
}
