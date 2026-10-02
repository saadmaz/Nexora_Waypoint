import { useState, type ReactNode } from "react";
import { ConnectivityChip, FieldTopBar, type ChipStatus } from "../../../field/components";
import { Alert } from "../../../shared/ui/Alert";
import { Button } from "../../../shared/ui/Button";
import { Icon } from "../../../shared/ui/Icon";
import { Mono } from "../../../shared/ui/Mono";
import type { PlanDiffView } from "../types";
import styles from "./PlanChanged.module.css";

export type PlanChangedPhase = "ready" | "acknowledged" | "noChange" | "upToDate" | "loading" | "offline" | "error";

export type PlanChangedProps = {
  phase: PlanChangedPhase;
  /** "Peliyagoda": the subtitle reads "Peliyagoda dock". */
  dockName: string;
  fromVersion: number;
  toVersion: number;
  /** Scenario time, "03:04": shown in the subtitle where the frames show it. */
  nowLabel?: string;
  connectivity: { status: ChipStatus; time?: string; count?: number };
  diff?: PlanDiffView;
  /** Who acknowledged and when, for L4.2's "v4 ✓ Priya 03:05". */
  ack?: { by: string; at: string };
  /** When this tablet last synced, for L4.S 3's "Last synced 03:05". */
  lastSyncedAt?: string;
  /** The vehicle a no-change dock acknowledges for ("VEH039", L4.3). */
  noChangeVehicleId?: string;
  onAcknowledge: () => void;
  onBeginLoading: () => void;
  onRetry: () => void;
  /** The title is a link back to the dock, as the frames draw it. */
  onBack: () => void;
  /** The PIN sheet. */
  children?: ReactNode;
};

/**
 * L4 Plan changed (loader prompt section 3): what changed for this dock between the last version it
 * acknowledged and the current one. Removed is loudest, then Changed, then Unchanged, then the new
 * trip's totals. A version with no change for this dock still needs acknowledging (L4.3). States:
 * up to date, loading, offline ("may be missing a newer version") and error with Retry.
 */
export function PlanChanged(props: PlanChangedProps) {
  const { phase, dockName, fromVersion, toVersion, nowLabel, connectivity } = props;
  const showsTime = phase === "ready" || phase === "acknowledged" || phase === "noChange" || phase === "offline";
  const titleText = phase === "noChange" || phase === "upToDate" ? `Plan v${toVersion}` : `Plan v${fromVersion} → v${toVersion}`;

  return (
    <div className={styles.screen}>
      <FieldTopBar
        title={
          <button type="button" className={styles.titleLink} onClick={props.onBack}>
            {titleText}
          </button>
        }
        subtitle={
          <>
            {dockName} dock{showsTime && nowLabel && <> · <Mono>{nowLabel}</Mono></>}
          </>
        }
      >
        <ConnectivityChip status={connectivity.status} time={connectivity.time} count={connectivity.count} size="tablet" />
      </FieldTopBar>

      {phase === "acknowledged" && (
        <div className={styles.planStatus}>
          <span className={styles.statusPill}>
            <Icon name="check" size={14} />
            Plan v{toVersion} ✓
          </span>
        </div>
      )}

      {phase === "offline" && (
        <div className={styles.offlineBar} role="status" aria-live="polite">
          <span className={styles.offlineBarIcon}>
            <Icon name="wifi-off" size={20} />
          </span>
          <span>
            You may be missing a newer version. Last synced <Mono>{props.lastSyncedAt}</Mono>.
          </span>
        </div>
      )}

      {phase === "loading" && <LoadingBody />}
      {phase === "error" && (
        <main className={styles.body}>
          <Alert tone="danger" icon="alert-circle" title={<span className={styles.errorTitle}>Couldn't load the change.</span>}>
            <p style={{ margin: "0 0 12px" }}>Don&apos;t load a vehicle whose plan may have changed. Retry, or call Dispatch.</p>
            <Button variant="secondary" icon="refresh-cw" onClick={props.onRetry}>
              Retry
            </Button>
          </Alert>
        </main>
      )}
      {phase === "upToDate" && (
        <main className={styles.body}>
          <StateBlock tone="success" title={`No changes since v${toVersion}. You're up to date.`} />
        </main>
      )}
      {phase === "noChange" && (
        <>
          <main className={styles.body}>
            <StateBlock
              tone="route"
              title={
                <>
                  Plan v{toVersion}: no change for <Mono>{props.noChangeVehicleId}</Mono>
                </>
              }
              body={dockName === "Kandy" ? "v4 changed Peliyagoda vehicles only." : `v${toVersion} did not change your vehicles.`}
            />
          </main>
          <div className={styles.pinned}>
            <Button icon="check" onClick={props.onAcknowledge}>
              Acknowledge plan v{toVersion}
            </Button>
            <p className={styles.pinnedHelper}>You&apos;ll enter your PIN</p>
          </div>
        </>
      )}

      {(phase === "ready" || phase === "acknowledged" || phase === "offline") && props.diff && (
        <>
          <main className={styles.body}>
            {phase === "acknowledged" && props.ack && (
              <div className={styles.successBanner} role="status">
                <span className={styles.successIcon}>
                  <Icon name="circle-check" size={20} />
                </span>
                <p className={styles.successText}>
                  v{toVersion} ✓ {props.ack.by} <Mono>{props.ack.at}</Mono>. Dispatch can see you have it.
                </p>
              </div>
            )}
            <p className={styles.label}>
              {phase === "ready" ? "What changed for your dock" : phase === "acknowledged" ? "What changed" : "Last synced change"}
            </p>
            <DiffBody diff={props.diff} />
          </main>
          {phase === "ready" && (
            <div className={styles.pinned}>
              <Button icon="check" onClick={props.onAcknowledge}>
                {props.diff.changed[0] ? (
                  <>
                    Acknowledge and load <Mono>{props.diff.changed[0].toVehicleId}</Mono>
                  </>
                ) : (
                  <>Acknowledge plan v{toVersion}</>
                )}
              </Button>
              <p className={styles.pinnedHelper}>You&apos;ll enter your PIN</p>
            </div>
          )}
          {phase === "acknowledged" && (
            <div className={styles.pinned}>
              <button type="button" className={styles.signalButton} onClick={props.onBeginLoading}>
                <Icon name="truck" size={22} />
                <span>
                  Begin loading <Mono>{props.diff.changed[0]?.toVehicleId ?? ""}</Mono>
                </span>
              </button>
            </div>
          )}
        </>
      )}
      {props.children}
    </div>
  );
}

function StateBlock({ tone, title, body }: { tone: "route" | "success"; title: ReactNode; body?: ReactNode }) {
  return (
    <div className={styles.stateBlock}>
      <span className={[styles.stateTile, tone === "route" ? styles.stateTileRoute : styles.stateTileSuccess].join(" ")} aria-hidden>
        <Icon name="check" size={28} />
      </span>
      <h2 className={styles.stateTitle}>{title}</h2>
      {body && <p className={styles.stateBody}>{body}</p>}
    </div>
  );
}

function LoadingBody() {
  return (
    <main className={styles.body}>
      <p className={styles.loadingLine} role="status">
        <span className={styles.spin}>
          <Icon name="refresh-cw" size={20} />
        </span>
        Loading changes…
      </p>
      {[0, 1, 2].map((i) => (
        <div key={i} className={styles.skeletonRow} aria-hidden>
          <span className={styles.skeletonBar} />
          <span className={styles.skeletonLine} />
        </div>
      ))}
    </main>
  );
}

const kg = (n: number) => n.toLocaleString("en-US");

/** Removed, then Changed, then Unchanged, the new trip's totals, and the vehicles with no change. */
function DiffBody({ diff }: { diff: PlanDiffView }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {diff.removed.map((r) => (
        <div key={r.orderId} className={styles.removed}>
          <span className={styles.removedAccent} aria-hidden />
          <div className={styles.removedBody}>
            <span className={[styles.tag, styles.tagRemoved].join(" ")}>Removed</span>
            <p className={styles.removedTitle}>
              Don&apos;t load <Mono>{r.orderId}</Mono>
            </p>
            <p className={styles.removedLine}>
              <Mono>{r.outletId}</Mono> · deferred ({r.deferralType})
            </p>
            <span className={styles.deferPill}>
              <Icon name="calendar-clock" size={14} />
              Deferred · {r.deferralType} → {r.nextRunShort}
            </span>
          </div>
        </div>
      ))}

      {diff.changed.map((c) => (
        <div key={`${c.fromVehicleId}-${c.toVehicleId}`} className={styles.card}>
          <span className={[styles.tag, styles.tagChanged].join(" ")}>Changed</span>
          <p className={styles.changedText}>
            <span className={styles.fromVehicle}>
              <Mono>{c.fromVehicleId}</Mono>
            </span>{" "}
            → <Mono>{c.toVehicleId}</Mono>
            {c.vehicleLabel.replace(c.toVehicleId, "")} · {c.trips}
          </p>
        </div>
      ))}

      {(diff.removed.length > 0 || diff.changed.length > 0) && (
        <div className={styles.card}>
          <span className={[styles.tag, styles.tagUnchanged].join(" ")}>Unchanged</span>
          <p className={styles.unchangedText}>Other stops, same order</p>
        </div>
      )}

      {diff.newTotals && (
        <div className={styles.capacity}>
          <span className={styles.label}>New trip 1</span>
          <span className={styles.capacityValue}>
            {kg(diff.newTotals.weightKg)} / {kg(diff.newTotals.weightCapKg)} kg · {diff.newTotals.volumeM3.toFixed(1)} /{" "}
            {diff.newTotals.volumeCapM3.toFixed(1)} m³
          </span>
        </div>
      )}

      {diff.noChangeVehicleIds.length > 0 && (
        <div>
          <button
            type="button"
            className={styles.collapsed}
            style={{ width: "100%" }}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className={styles.collapsedText}>
              {diff.noChangeVehicleIds.map((id, i) => (
                <span key={id}>
                  {i > 0 && ", "}
                  <Mono>{id}</Mono>
                </span>
              ))}
              : no change
            </span>
            <span className={[styles.chevron, open && styles.chevronOpen].filter(Boolean).join(" ")}>
              <Icon name="chevron-down" size={20} />
            </span>
          </button>
          {open && (
            <ul className={styles.collapsedList}>
              {diff.noChangeVehicleIds.map((id) => (
                <li key={id}>
                  <Mono>{id}</Mono>: same trips, same orders as v{diff.from}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
