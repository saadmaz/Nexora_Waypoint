import type { ReactNode } from "react";
import { Alert } from "../../../shared/ui/Alert";
import { Button } from "../../../shared/ui/Button";
import { Icon } from "../../../shared/ui/Icon";
import { LoadingSkeleton, StateScreen } from "../../../shared/ui/StateScreen";
import { Mono } from "../../../shared/ui/Mono";
import { ConnectivityChip, FieldTopBar, OfflineBanner, type ChipStatus } from "../../../field/components";
import { VehicleCard, type VehicleCardProps } from "./VehicleCard";
import styles from "./Dock.module.css";

export type DockAlertModel =
  | { kind: "ready"; version: number; releasedAt: string; vehicleCount: number; orderCount: number; firstDeparture: string }
  | { kind: "noChangeReady"; version: number }
  | { kind: "acknowledgedCompact"; version: number; by: string; at: string }
  | { kind: "changed"; fromVersion: number; toVersion: number; onReview: () => void }
  | { kind: "noChangeAcknowledged"; version: number; by: string; at: string };

export type DockProps = {
  dockLabel: string;
  nowLabel: string;
  connectivity: { status: ChipStatus; time?: string; count?: number };
  state: "ready" | "empty" | "loading" | "offline" | "error";
  alert?: DockAlertModel;
  vehicles?: VehicleCardProps[];
  pinnedAcknowledge?: { label: string; onClick: () => void };
  emptyReleaseLabel?: string;
  emptyCheckedLabel?: string;
  offlineVersion?: number;
  offlineAsOf?: string;
  onCallDispatch?: () => void;
  onRetry?: () => void;
  children?: ReactNode;
};

/** L1 Dock (field conventions, loader prompt section 3): every state at phone width. */
export function Dock({
  dockLabel,
  nowLabel,
  connectivity,
  state,
  alert,
  vehicles,
  pinnedAcknowledge,
  emptyReleaseLabel,
  emptyCheckedLabel,
  offlineVersion,
  offlineAsOf,
  onCallDispatch,
  onRetry,
  children,
}: DockProps) {
  return (
    <div className={styles.screen}>
      <FieldTopBar title="Load lists" subtitle={nowLabel ? <>{dockLabel} · <Mono>{nowLabel}</Mono></> : dockLabel}>
        <ConnectivityChip status={connectivity.status} time={connectivity.time} count={connectivity.count} size="tablet" />
      </FieldTopBar>

      {state === "offline" && (
        <OfflineBanner tone="offline" compact>
          Dock tablet offline: showing plan <Mono>v{offlineVersion}</Mono> as of <Mono>{offlineAsOf}</Mono>.
        </OfflineBanner>
      )}

      <main className={styles.body}>
        {state === "loading" && (
          <>
            <p className={styles.loadingLine}>
              <Icon name="refresh-cw" size={16} />
              Loading tonight&rsquo;s vehicles&hellip;
            </p>
            <div className={styles.skeletonCards}>
              {[0, 1, 2].map((i) => (
                <div key={i} className={styles.skeletonCard}>
                  <LoadingSkeleton rows={3} />
                </div>
              ))}
            </div>
          </>
        )}

        {state === "empty" && (
          <StateScreen
            icon="truck"
            bg="surface-2"
            fg="ink-muted"
            title="No vehicles for this dock yet"
            body={
              <>
                <p>
                  Tonight&rsquo;s plan releases around <Mono>{emptyReleaseLabel}</Mono>.
                </p>
                <p className={styles.lastChecked}>
                  Last checked <Mono>{emptyCheckedLabel}</Mono>
                </p>
              </>
            }
          />
        )}

        {state === "error" && (
          <Alert tone="danger" icon="alert-circle" title="Couldn't load vehicles.">
            Your last acknowledgement is kept. Try again, or call Dispatch if departure is close.
            <div className={styles.errorAction}>
              <Button variant="secondary" icon="refresh-cw" onClick={onRetry}>
                Retry
              </Button>
            </div>
          </Alert>
        )}

        {state === "offline" && (
          <Alert tone="warning" icon="alert-triangle" title={undefined}>
            Don&rsquo;t start a vehicle whose plan may have changed; reconnect or call Dispatch.
            <div className={styles.errorAction}>
              <Button variant="secondary" icon="phone" onClick={onCallDispatch}>
                Call Dispatch
              </Button>
            </div>
            <p className={styles.dispatchDesk}>Peliyagoda dispatch desk</p>
          </Alert>
        )}

        {state === "ready" && alert && <DockAlert alert={alert} />}

        {(state === "ready" || state === "offline") && vehicles && vehicles.length > 0 && (
          <>
            <p className={styles.sectionLabel}>
              {alert?.kind === "ready" || alert?.kind === "noChangeReady"
                ? "Vehicles · locked until you acknowledge"
                : "Sorted by departure"}
            </p>
            {vehicles.map((vehicle) => (
              <VehicleCard key={vehicle.id} {...vehicle} />
            ))}
          </>
        )}
      </main>

      {pinnedAcknowledge && (
        <div className={styles.pinned}>
          <Button icon="check" onClick={pinnedAcknowledge.onClick}>
            {pinnedAcknowledge.label}
          </Button>
          <p className={styles.pinnedHelper}>You&rsquo;ll enter your PIN</p>
        </div>
      )}

      {children}
    </div>
  );
}

function DockAlert({ alert }: { alert: DockAlertModel }) {
  switch (alert.kind) {
    case "ready":
      return (
        <Alert tone="info" icon="info" title={<>Plan v{alert.version} is ready</>}>
          <p>
            Acknowledge before loading. Released <Mono>{alert.releasedAt}</Mono>.
          </p>
          <p className={styles.alertMeta}>
            Plan <Mono>v{alert.version}</Mono> · <Mono>{alert.vehicleCount}</Mono> {alert.vehicleCount === 1 ? "vehicle" : "vehicles"} ·{" "}
            <Mono>{alert.orderCount}</Mono> orders · first departure <Mono>{alert.firstDeparture}</Mono>
          </p>
        </Alert>
      );
    case "noChangeReady":
      return (
        <Alert tone="info" icon="info" title={undefined}>
          Plan v{alert.version}: no change to your vehicles. Acknowledge to continue.
        </Alert>
      );
    case "acknowledgedCompact":
      return (
        <span className={styles.ackChip}>
          <Icon name="check" size={14} /> v{alert.version} · acknowledged by {alert.by} <Mono>{alert.at}</Mono>
        </span>
      );
    case "changed":
      return (
        <Alert
          tone="warning"
          icon="alert-triangle"
          title={
            <>
              Plan changed v{alert.fromVersion} &rarr; v{alert.toVersion}
            </>
          }
        >
          <p>Review before loading.</p>
          <div className={styles.reviewAction}>
            <Button icon="check" iconRight="chevron-right" onClick={alert.onReview}>
              Review change
            </Button>
          </div>
        </Alert>
      );
    case "noChangeAcknowledged":
      return (
        <Alert tone="success" icon="circle-check" title={undefined}>
          Plan v{alert.version} acknowledged by {alert.by} <Mono>{alert.at}</Mono>. No change to your vehicles.
        </Alert>
      );
    default:
      return null;
  }
}
