import { useState, type ReactNode } from "react";
import { Alert } from "../../../shared/ui/Alert";
import { Button } from "../../../shared/ui/Button";
import { Icon } from "../../../shared/ui/Icon";
import { LoadingSkeleton, StateScreen } from "../../../shared/ui/StateScreen";
import { Mono } from "../../../shared/ui/Mono";
import { Tag } from "../../../shared/ui/Tag";
import { Facts } from "../../../shared/ui/Facts";
import { ConnectivityChip, FieldTopBar, OfflineBanner, UnitsStepper, type ChipStatus } from "../../../field/components";
import { LoaderCheckCard, type LoaderCheckState } from "../../../field/components/LoaderCheckCard";
import type { Brand } from "../../../domain/field";
import styles from "./LoadPlan.module.css";

export type LoadPlanRow = {
  orderId: string;
  outletId: string;
  loadNumber: number;
  stopNumber: number;
  brand: Brand;
  chilled: boolean;
  dockLabel: string;
  unitsExpected: number;
  unitsLoaded: number;
  weightKg: number;
  state: "todo" | "checked" | "short";
  protectedOrder?: boolean;
  /** "heading" when this outlet has more than one order on the trip, "quantity" otherwise. */
  orderIdIn: "heading" | "quantity";
  /** "Saved on tablet" (offline) or "Check not saved. Tap again." (error), shown instead of the usual pill. */
  rowNote?: "offline" | "error";
};

export type CapacityStat = { weightKg: number; weightCapKg: number; volumeM3: number; volumeCapM3: number };
export type SwapBanner = { replacesVehicleId: string; note: string };

export type LoadPlanProps = {
  vehicleId: string;
  dockLabel: string;
  departsAt: string;
  planVersion: number;
  connectivity: { status: ChipStatus; time?: string; count?: number };
  phase: "loading" | "ready" | "loaded" | "held" | "empty" | "offline" | "error";
  checked: { done: number; total: number };
  chilledZone: boolean;
  swap?: SwapBanner;
  capacity?: CapacityStat;
  rows: LoadPlanRow[];
  heldReason?: string;
  heldGoTo?: { label: string; onClick: () => void };
  loadedBy?: { name: string; at: string };
  /** The simple "loaded" screen's reassurance lines (L2.4): absent when `swap` is set (L2.6 B shows the order list instead). */
  whoKnows?: string[];
  offlineChecksSaved?: boolean;
  /** State-gallery only: freezes one row's count-confirm open (L2.1 B, L2.2), optionally pre-set below expected. */
  demoExpanded?: { orderId: string; draftUnits?: number };
  onRecordUnits: (orderId: string, units: number) => void;
  onFlagShort: (orderId: string, units: number) => void;
  onFlagIssue: () => void;
  onConfirmGate: () => void;
  onCallDispatch?: () => void;
  onBack: () => void;
  onRetry?: () => void;
  /** L1.7: the detail pane. Its own heading instead of the phone top bar, the gate as a pinned row. */
  embedded?: boolean;
  trip?: number;
  children?: ReactNode;
};

/** L2 Load plan (loader prompt section 3): checklist, count confirm, short units, gate, loaded, held, swap. */
export function LoadPlan(props: LoadPlanProps) {
  const { vehicleId, dockLabel, departsAt, planVersion, connectivity, phase, onBack } = props;
  if (props.embedded) return <LoadPlanDetail {...props} />;
  const topBar = (
    <FieldTopBar
      title={`Load list · ${vehicleId}`}
      subtitle={
        <>
          {dockLabel} · departs <Mono>{departsAt}</Mono> · plan <Mono>v{planVersion}</Mono>
        </>
      }
      onBack={onBack}
    >
      <ConnectivityChip status={connectivity.status} time={connectivity.time} count={connectivity.count} size="tablet" />
    </FieldTopBar>
  );

  return (
    <div className={styles.screen}>
      {topBar}
      {phase === "offline" && (
        <OfflineBanner tone="waiting" compact>
          Offline: checks are saved on this tablet. You can still clear the vehicle to depart; it syncs when back online.
        </OfflineBanner>
      )}
      <main className={styles.body}>
        {phase === "loading" && <LoadingRows />}
        {phase === "empty" && <EmptyState onBack={onBack} />}
        {phase === "error" && <ErrorState onRetry={props.onRetry} />}
        {phase === "held" && <HeldView {...props} />}
        {phase === "loaded" && <LoadedView {...props} />}
        {(phase === "ready" || phase === "offline") && <ReadyView {...props} />}
      </main>
      {props.children}
    </div>
  );
}

/** L1.7 detail pane: "VEH039 · trip 1", the dock line, then the same views as the phone, scrolling inside the pane. */
function LoadPlanDetail(props: LoadPlanProps) {
  const { vehicleId, trip = 1, dockLabel, departsAt, planVersion, phase, onBack } = props;
  return (
    <div className={styles.detail}>
      <header className={styles.detailHeader}>
        <h2 className={styles.detailTitle}>
          <Mono>{vehicleId}</Mono> · trip {trip}
        </h2>
        {departsAt && (
          <p className={styles.detailSub}>
            {dockLabel} · departs <Mono>{departsAt}</Mono> · plan <Mono>v{planVersion}</Mono>
          </p>
        )}
      </header>
      {phase === "offline" && (
        <OfflineBanner tone="waiting" compact>
          Offline: checks are saved on this tablet. You can still clear the vehicle to depart; it syncs when back online.
        </OfflineBanner>
      )}
      <div className={styles.detailBody}>
        {phase === "loading" && <LoadingRows />}
        {phase === "empty" && <EmptyState onBack={onBack} />}
        {phase === "error" && <ErrorState onRetry={props.onRetry} />}
        {phase === "held" && <HeldView {...props} />}
        {phase === "loaded" && <LoadedView {...props} />}
        {(phase === "ready" || phase === "offline") && <ReadyView {...props} />}
      </div>
      {props.children}
    </div>
  );
}

function LoadingRows() {
  return (
    <>
      <p className={styles.loadingLine}>
        <Icon name="refresh-cw" size={16} />
        Loading load plan&hellip;
      </p>
      <div className={styles.skeletonCards}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.skeletonCard}>
            <div className={styles.skeletonRow}>
              <span className={styles.skeletonDisc} />
              <div className={styles.skeletonBars}>
                <LoadingSkeleton rows={3} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function EmptyState({ onBack }: { onBack: () => void }) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}>
        <Icon name="package" size={24} color="ink-muted" />
      </span>
      <h2 className={styles.emptyTitle}>No orders on this vehicle</h2>
      <Button variant="secondary" auto onClick={onBack}>
        Back to load lists
      </Button>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <Alert tone="danger" icon="alert-circle" title="Couldn't load the plan.">
      Your checks so far are kept. Try again.
      <div className={styles.errorAction}>
        <Button variant="secondary" icon="refresh-cw" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </Alert>
  );
}

function ProgressHeader({ checked, chilledZone }: { checked: { done: number; total: number }; chilledZone: boolean }) {
  const pct = checked.total > 0 ? Math.round((checked.done / checked.total) * 100) : 0;
  return (
    <div className={styles.progressHeader}>
      <div className={styles.progressRow}>
        <p className={styles.progressLabel}>
          {checked.done} of {checked.total} checked
        </p>
        {chilledZone && (
          <Tag kind="chilled" icon="snowflake">
            Chilled zone
          </Tag>
        )}
      </div>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SwapBannerRow({ swap }: { swap: SwapBanner }) {
  return (
    <div className={styles.swapRow}>
      <Tag kind="outline" icon={null}>
        Replaces {swap.replacesVehicleId}
      </Tag>
      <span className={styles.swapNote}>{swap.note}</span>
    </div>
  );
}

function CapacityBlock({ capacity }: { capacity: CapacityStat }) {
  const weightPct = Math.round((capacity.weightKg / capacity.weightCapKg) * 100);
  const volumePct = Math.round((capacity.volumeM3 / capacity.volumeCapM3) * 100);
  const warn = (pct: number) => pct >= 85;
  return (
    <div className={styles.capacity}>
      <div className={styles.capacityCol}>
        <p className={styles.capacityLabel}>Weight</p>
        <p className={styles.capacityValue}>
          <Mono>{capacity.weightKg}</Mono> / <Mono>{capacity.weightCapKg}</Mono> kg
        </p>
        <div className={styles.capacityTrack}>
          <div className={[styles.capacityFill, warn(weightPct) && styles.capacityFillWarn].filter(Boolean).join(" ")} style={{ width: `${Math.min(100, weightPct)}%` }} />
        </div>
        {warn(weightPct) && (
          <p className={styles.capacityWarn}>
            <Icon name="alert-triangle" size={14} />
            {weightPct}%: full van
          </p>
        )}
      </div>
      <div className={styles.capacityCol}>
        <p className={styles.capacityLabel}>Volume</p>
        <p className={styles.capacityValue}>
          <Mono>{capacity.volumeM3}</Mono> / <Mono>{capacity.volumeCapM3}</Mono> m&sup3;
        </p>
        <div className={styles.capacityTrack}>
          <div className={[styles.capacityFill, warn(volumePct) && styles.capacityFillWarn].filter(Boolean).join(" ")} style={{ width: `${Math.min(100, volumePct)}%` }} />
        </div>
        {warn(volumePct) && (
          <p className={styles.capacityWarn}>
            <Icon name="alert-triangle" size={14} />
            {volumePct}%: full van
          </p>
        )}
      </div>
    </div>
  );
}

function RowNote({ rowNote }: { rowNote?: "offline" | "error" }) {
  if (rowNote === "offline")
    return (
      <span className={styles.savedChip}>
        <Icon name="cloud" size={14} />
        Saved on tablet
      </span>
    );
  if (rowNote === "error")
    return (
      <p className={styles.rowError}>
        <Icon name="alert-circle" size={14} />
        Check not saved. Tap again.
      </p>
    );
  return null;
}

function ReadyView(props: LoadPlanProps) {
  const { checked, chilledZone, swap, capacity, rows, onFlagIssue, onConfirmGate, demoExpanded, embedded } = props;
  const allSettled = rows.every((r) => r.state !== "todo");
  const nextUnresolved = rows.find((r) => r.state === "todo");
  const list = rows.map((row) => (
    <Row key={row.orderId} row={row} demo={row.orderId === demoExpanded?.orderId ? demoExpanded : undefined} {...props} />
  ));
  const gateButtons = (
    <>
      <Button variant="dangerOutline" icon="flag" onClick={onFlagIssue}>
        Flag issue
      </Button>
      <Button
        variant={allSettled ? "primary" : "secondary"}
        icon="check"
        disabled={!allSettled}
        aria-describedby={embedded && !allSettled ? "gate-helper" : undefined}
        onClick={onConfirmGate}
      >
        Confirm loaded: clear to depart
      </Button>
    </>
  );
  if (embedded) {
    return (
      <>
        <div className={styles.detailProgress}>
          <ProgressHeader checked={checked} chilledZone={chilledZone} />
        </div>
        {swap && <SwapBannerRow swap={swap} />}
        {capacity && <CapacityBlock capacity={capacity} />}
        <div className={styles.detailRows}>{list}</div>
        <div className={styles.detailGate}>
          <div className={styles.detailGateButtons}>{gateButtons}</div>
          {/* L1.7 draws no helper line; the reason the button is off is still there for a screen reader. */}
          {!allSettled && nextUnresolved && (
            <p id="gate-helper" className={styles.srOnly}>
              Check {nextUnresolved.orderId} or flag an issue first
            </p>
          )}
        </div>
      </>
    );
  }
  return (
    <>
      <ProgressHeader checked={checked} chilledZone={chilledZone} />
      {swap && <SwapBannerRow swap={swap} />}
      {capacity && <CapacityBlock capacity={capacity} />}
      <p className={styles.sectionLabel}>Load order · last stop in first</p>
      {list}
      <div className={styles.gate}>
        {gateButtons}
        {!allSettled && nextUnresolved && (
          <p className={styles.gateHelper}>
            Check {nextUnresolved.orderId} or flag an issue first
          </p>
        )}
      </div>
    </>
  );
}

function Row({
  row,
  demo,
  onRecordUnits,
  onFlagShort,
  embedded,
}: LoadPlanProps & { row: LoadPlanRow; demo?: { orderId: string; draftUnits?: number } }) {
  const [expanded, setExpanded] = useState(!!demo);
  const [draft, setDraft] = useState(demo?.draftUnits ?? row.unitsExpected);

  const open = () => {
    setDraft(row.unitsExpected);
    setExpanded(true);
  };

  const cardState: LoaderCheckState = row.state;

  return (
    <LoaderCheckCard
      outletId={row.outletId}
      orderId={row.orderId}
      orderIdIn={row.orderIdIn}
      loadNumber={row.loadNumber}
      stopNumber={row.stopNumber}
      brand={row.brand}
      chilled={row.chilled}
      dock={row.dockLabel}
      unitsLoaded={row.unitsLoaded}
      unitsExpected={row.unitsExpected}
      state={cardState}
      protectedOrder={row.protectedOrder}
      compact={embedded}
    >
      {row.state === "todo" && !expanded && (
        <>
          <Button icon="check" onClick={open}>
            Load {row.unitsExpected} units
          </Button>
          <RowNote rowNote={row.rowNote} />
        </>
      )}
      {row.state === "todo" && expanded && (
        <div className={styles.countConfirm}>
          <p className={styles.countLabel}>Count loaded</p>
          <UnitsStepper value={draft} onChange={setDraft} expected={row.unitsExpected} label={`units of ${row.orderId}`} />
          {draft < row.unitsExpected ? (
            <>
              <p className={styles.shortWarn}>
                <Icon name="alert-triangle" size={16} />
                Flag this to Dispatch?
              </p>
              <Button
                variant="dangerOutline"
                icon="flag"
                onClick={() => {
                  onFlagShort(row.orderId, draft);
                  setExpanded(false);
                }}
              >
                Flag shortage
              </Button>
            </>
          ) : (
            <Button
              icon="check"
              onClick={() => {
                onRecordUnits(row.orderId, draft);
                setExpanded(false);
              }}
            >
              Confirm {draft} units
            </Button>
          )}
        </div>
      )}
      {row.state !== "todo" && <RowNote rowNote={row.rowNote} />}
    </LoaderCheckCard>
  );
}

function HeldView({ departsAt, heldReason, heldGoTo, rows, onCallDispatch }: LoadPlanProps) {
  return (
    <>
      <div className={styles.heldBanner}>
        <p className={styles.heldHeading}>
          <Icon name="lock" size={24} color="danger" />
          {heldReason}
        </p>
        <p className={styles.heldBody}>
          Don&rsquo;t load further. Departure <Mono>{departsAt}</Mono>.
        </p>
        {heldGoTo && (
          <>
            <p className={styles.heldNext}>While Dispatch decides: load {heldGoTo.label.replace("Go to ", "")} next</p>
            <Button variant="secondary" onClick={heldGoTo.onClick}>
              {heldGoTo.label}
            </Button>
          </>
        )}
      </div>
      <p className={styles.sectionLabel}>Trip 1 · frozen</p>
      {rows.map((row) => (
        <LoaderCheckCard
          key={row.orderId}
          outletId={row.outletId}
          orderId={row.orderId}
          orderIdIn={row.orderIdIn}
          loadNumber={row.loadNumber}
          stopNumber={row.stopNumber}
          brand={row.brand}
          chilled={row.chilled}
          dock={row.dockLabel}
          unitsLoaded={row.unitsLoaded}
          unitsExpected={row.unitsExpected}
          state="planned"
          protectedOrder={row.protectedOrder}
        />
      ))}
      <div className={styles.pinnedPlain}>
        <Button variant="secondary" icon="phone" onClick={onCallDispatch}>
          Call Dispatch
        </Button>
        <p className={styles.pinnedHelper}>Peliyagoda dispatch desk</p>
        <p className={styles.pinnedHelper}>Dispatch decides what happens next</p>
      </div>
    </>
  );
}

function LoadedView(props: LoadPlanProps) {
  return props.swap ? <SwapLoadedView {...props} /> : <SimpleLoadedView {...props} />;
}

/** L2.4: the plain loaded confirmation, no per-order list. */
function SimpleLoadedView({ vehicleId, chilledZone, rows, loadedBy, whoKnows, onBack }: LoadPlanProps) {
  const totalUnits = rows.reduce((sum, r) => sum + r.unitsLoaded, 0);
  const totalWeight = rows.reduce((sum, r) => sum + r.weightKg, 0);
  return (
    <StateScreen
      icon="circle-check"
      bg="success-soft"
      fg="success"
      title={`${vehicleId} loaded: cleared to depart`}
      body={loadedBy && <>{loadedBy.name} · <Mono>{loadedBy.at}</Mono></>}
      facts={[
        { key: "Units", value: `${totalUnits} units (${rows.length} orders)` },
        { key: "Weight", value: `${totalWeight} kg` },
        ...(chilledZone && loadedBy ? [{ key: "Chilled zone", value: <>Checked · {loadedBy.name} <Mono>{loadedBy.at}</Mono></> }] : []),
      ]}
      actions={
        <>
          {whoKnows && whoKnows.length > 0 && (
            <div className={styles.whoKnows}>
              <p className={styles.sectionLabel}>Who already knows</p>
              {whoKnows.map((line) => (
                <p key={line} className={styles.whoKnowsLine}>
                  <Icon name="circle-check" size={16} color="success" />
                  {line}
                </p>
              ))}
            </div>
          )}
          <Button onClick={onBack}>Back to load lists</Button>
        </>
      }
    />
  );
}

/** L2.6 B: the swap reload, with the capacity block and the full checked order list. */
function SwapLoadedView({ checked, chilledZone, swap, capacity, rows, loadedBy, onBack }: LoadPlanProps) {
  return (
    <>
      <ProgressHeader checked={checked} chilledZone={chilledZone} />
      <Alert tone="success" icon="circle-check" title={loadedBy ? `Loaded by ${loadedBy.name} ${loadedBy.at}` : "Loaded"} />
      <Facts
        items={[
          { key: "Units", value: `${rows.reduce((s, r) => s + r.unitsLoaded, 0)} units (${rows.length} orders)` },
          ...(chilledZone && loadedBy ? [{ key: "Chilled zone", value: `Checked · ${loadedBy.name} ${loadedBy.at}` }] : []),
        ]}
      />
      {capacity && <CapacityBlock capacity={capacity} />}
      {swap && <SwapBannerRow swap={swap} />}
      {rows.map((row) => (
        <LoaderCheckCard
          key={row.orderId}
          outletId={row.outletId}
          orderId={row.orderId}
          orderIdIn={row.orderIdIn}
          loadNumber={row.loadNumber}
          stopNumber={row.stopNumber}
          brand={row.brand}
          chilled={row.chilled}
          dock={row.dockLabel}
          unitsLoaded={row.unitsLoaded}
          unitsExpected={row.unitsExpected}
          state="checked"
          protectedOrder={row.protectedOrder}
        />
      ))}
      <div className={styles.pinnedPlain}>
        <Button onClick={onBack}>Back to load lists</Button>
      </div>
    </>
  );
}
