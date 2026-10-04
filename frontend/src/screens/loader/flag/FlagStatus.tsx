import type { ReactNode } from "react";
import { ConnectivityChip, FieldTopBar, type ChipStatus } from "../../../field/components";
import { useSheetEnvironment } from "../../../field/components/sheetEnvironment";
import { Button } from "../../../shared/ui/Button";
import { Icon } from "../../../shared/ui/Icon";
import { Mono } from "../../../shared/ui/Mono";
import styles from "./FlagStatus.module.css";

export type FlagStatusProps = {
  /** queued: no connection, the flag waits on the tablet (L3.4 A). failed: the send failed (L3.4 B). */
  kind: "queued" | "failed";
  vehicleId: string;
  /** "Peliyagoda": the top bar on these two frames reads "Peliyagoda · departs 03:30 · plan v3". */
  dockName: string;
  departsAt: string;
  planVersion: number;
  connectivity: { status: ChipStatus; time?: string; count?: number };
  /** Minutes until the vehicle departs, from the scenario clock. Never negative. */
  minutesToDeparture: number;
  /** The flag's type ("Vehicle check failed") and what it covers, with the vehicle's ID wrapped in <Mono>. */
  typeLabel: string;
  detail: ReactNode;
  /** True for a failed vehicle check: the helper then says not to load further. Other flags leave loading as it is. */
  held?: boolean;
  onRetry: () => void;
  onCallDispatch: () => void;
  onKeepWaiting: () => void;
};

/**
 * L3.4 A and L3.4 B. Both keep the flag on the tablet and tell the loader what to do next: call the
 * dispatch desk if the vehicle leaves within 30 minutes (copy from the frames; there is no phone
 * number anywhere in the app, only "Peliyagoda dispatch desk").
 */
export function FlagStatus(props: FlagStatusProps) {
  const { kind, vehicleId, dockName, departsAt, planVersion, connectivity } = props;
  const { container } = useSheetEnvironment();
  const placement = [styles.screen, container && styles.contained].filter(Boolean).join(" ");

  const pill = (
    <span className={styles.pill}>
      <Icon name="cloud" size={14} />
      Saved on tablet
    </span>
  );

  return (
    <div className={placement} role="region" aria-label={kind === "queued" ? "Flag saved on this tablet" : "Flag not sent"}>
      <FieldTopBar
        title={`Load list · ${vehicleId}`}
        subtitle={
          <>
            {dockName} · departs <Mono>{departsAt}</Mono> · plan <Mono>v{planVersion}</Mono>
          </>
        }
      >
        <ConnectivityChip status={connectivity.status} time={connectivity.time} count={connectivity.count} size="tablet" />
      </FieldTopBar>

      {kind === "queued" ? (
        <>
          <div className={[styles.bar, styles.barOffline].join(" ")} role="status" aria-live="polite">
            <span className={styles.barIcon}>
              <Icon name="wifi-off" size={20} />
            </span>
            <span className={styles.barText}>You&apos;re offline. Flag not sent yet.</span>
          </div>
          <div className={styles.content}>
            <span className={styles.tile} aria-hidden>
              <Icon name="cloud" size={28} />
            </span>
            <h2 className={styles.title}>Flag saved on this tablet</h2>
            <p className={styles.lead}>It reaches Dispatch when back online. Ask Dispatch to call if departure is under 30 min away.</p>
            <p className={styles.fact}>
              <Icon name="clock" size={16} />
              <span>
                Departs <Mono>{departsAt}</Mono> · <Mono>{props.minutesToDeparture}</Mono> min
              </span>
            </p>
            <div className={styles.summary}>
              <div className={styles.summaryRow}>
                {props.typeLabel}
                {pill}
              </div>
              <p className={styles.detail}>{props.detail}</p>
            </div>
            <Button icon="phone" onClick={props.onCallDispatch}>
              Ask Dispatch to call
            </Button>
            <p className={styles.desk}>{dockName} dispatch desk</p>
            <Button variant="ghost" onClick={props.onKeepWaiting}>
              Keep waiting
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className={[styles.bar, styles.barFailed].join(" ")} role="alert">
            <span className={[styles.barIcon, styles.barIconFailed].join(" ")}>
              <Icon name="alert-circle" size={20} />
            </span>
            <span className={styles.barText}>
              Couldn&apos;t send flag for <Mono>{vehicleId}</Mono>. Kept on tablet.
            </span>
            <button type="button" className={styles.retry} onClick={props.onRetry}>
              <Icon name="refresh-cw" size={20} />
              Retry
            </button>
          </div>
          <div className={[styles.content, styles.failedContent].join(" ")}>
            <div className={[styles.summary, styles.failedSummary].join(" ")}>
              <div className={styles.summaryRow}>
                <span className={styles.flagIcon}>
                  <Icon name="flag" size={20} />
                </span>
                {props.typeLabel}
              </div>
              <p className={styles.detail}>{props.detail}</p>
              {pill}
            </div>
            <p className={styles.helper}>
              {props.held === false ? "" : "Don't load further. "}Ask Dispatch to call if departure is under 30 min away.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
