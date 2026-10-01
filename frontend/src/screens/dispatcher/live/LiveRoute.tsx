import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, CircleAlert, Clock3, Flag, Info, Lock, Redo2, RefreshCw, Route, Truck, TriangleAlert, WifiOff } from "lucide-react";
import type { Decision, DeferralKind, DepotId, LiveBoardView, LiveRow, LiveStop } from "../../../api/DispatcherApi";
import { Mono } from "../../../shared/ui/Mono";
import { useToast } from "../../../shared/ui/useToast";
import { AppBar } from "../chrome/AppBar";
import { PageHeader } from "../chrome/PageHeader";
import { ROUTES } from "../chrome/routes";
import { Screen } from "../chrome/Screen";
import { useDispatcher } from "../context";
import { useLoad } from "../hooks";
import { Btn, LinkButton } from "../ui/Btn";
import { BrandChip, Chip, TempChip } from "../ui/Chip";
import { cx } from "../ui/cx";
import { Skel } from "../ui/Skel";
import { Stat } from "../ui/Stat";
import { StateBlock } from "../ui/StateBlock";
import { DeferStopDialog } from "./DeferStopDialog";
import styles from "./Live.module.css";

type Scope = DepotId | "both";

const POLL_MS = 5_000;

function useScope(): [Scope, (next: Scope) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get("depot");
  const scope: Scope = raw === "kandy" || raw === "peliyagoda" ? raw : "both";
  const set = (next: Scope) =>
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next === "both") p.delete("depot");
      else p.set("depot", next);
      return p;
    });
  return [scope, set];
}

/** The text a hovering or focused control reveals, so a tooltip is reachable from the keyboard too. */
function Tip({ children, tip, light }: { children: ReactNode; tip: ReactNode; light?: boolean }) {
  return (
    <span className={styles.tip} tabIndex={0}>
      {children}
      <span role="tooltip" className={cx(styles.tipBox, light && styles.tipLight)}>
        {tip}
      </span>
    </span>
  );
}

function RiskChip({ row }: { row: LiveRow }) {
  if (row.risk === "Unknown · offline") {
    const chip = (
      <Chip tone="offlineOutline" pill icon={<WifiOff size={13} />}>
        Unknown · offline
      </Chip>
    );
    return row.offlineNote ? <Tip tip={row.offlineNote}>{chip}</Tip> : chip;
  }
  const ok = row.risk === "On time";
  return (
    <span className={ok ? styles.riskOk : styles.riskBad}>
      <Chip tone={ok ? "success" : "danger"} pill>
        {row.risk}
      </Chip>
    </span>
  );
}

function VehicleStatus({ status, held }: { status: LiveRow["status"]; held: boolean }) {
  return (
    <span className={styles.statusCell}>
      {held && (
        <span className={styles.held}>
          <Lock size={14} />
          Held
        </span>
      )}
      <StatusPill status={status} />
    </span>
  );
}

function StatusPill({ status }: { status: LiveStop["status"] | LiveRow["status"] }) {
  switch (status) {
    case "Departed":
      return (
        <Chip tone="signal" pill icon={<Truck size={14} />}>
          Departed
        </Chip>
      );
    case "Planned":
    case "Loaded":
    case "Loading":
      return (
        <Chip tone="info" pill icon={<Route size={14} />}>
          {status === "Loaded" ? "Loaded" : status === "Loading" ? "Loading" : "Planned"}
        </Chip>
      );
    case "Delivered":
      return (
        <Chip tone="success" pill icon={<Check size={14} />}>
          Delivered
        </Chip>
      );
    case "Conflict":
      return (
        <Chip tone="warningOutline" pill icon={<TriangleAlert size={14} />}>
          Conflict
        </Chip>
      );
    case "Change pending":
      return (
        <Chip tone="warning" pill icon={<Clock3 size={14} />}>
          Change pending
        </Chip>
      );
    default:
      return (
        <Chip tone="dashed" pill icon={<Redo2 size={14} />}>
          {status}
        </Chip>
      );
  }
}

/** D6: what needs Kumari now, the four counts, and the vehicles that need attention first (PRD v3 section 3: exception first, no map). */
export function LiveRoute() {
  const { api, offline, invalidate } = useDispatcher();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const [scope, setScope] = useScope();
  const [all, setAll] = useState(false);
  const board = useLoad(() => api.getLiveBoard({ depot: scope, ...(all ? { all } : {}) }), [scope, all], POLL_MS);
  const view = board.data;
  const calm = params.get("state") === "calm";

  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [deferring, setDeferring] = useState<{ row: LiveRow; stop: LiveStop } | null>(null);
  const [busy, setBusy] = useState(false);
  const [deferError, setDeferError] = useState<string | null>(null);

  // The gallery opens the Defer stop dialog (D6.3) without a click.
  const seeded = useRef(false);
  useEffect(() => {
    if (!view || seeded.current || params.get("ui") !== "defer") return;
    const row = view.rows.find((r) => r.stopsDetail.length > 0);
    const stop = row?.stopsDetail[0];
    seeded.current = true;
    if (row && stop) setDeferring({ row, stop });
  }, [view, params]);

  const isOpen = (row: LiveRow) => open[row.vehicleId] ?? row.expanded;
  const nextVersion = (Number(/v(\d+)/.exec(view?.plan ?? "")?.[1]) || 3) + 1;

  const confirmDefer = async (request: { orderIds: string[]; kind: DeferralKind; reason: string }) => {
    setBusy(true);
    setDeferError(null);
    try {
      const result = await api.deferStop(request);
      setDeferring(null);
      invalidate();
      toast.show(`Plan v${result.plan} created. ${result.deferred.join(" and ")} deferred.`, { icon: "check" });
    } catch (error) {
      setDeferError(error instanceof Error ? error.message : "Couldn't defer the stop. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <PageHeader
      overline={view ? `LIVE · ${view.date.toUpperCase()} · ${view.asOf}${view.plan ? ` · ${view.plan.toUpperCase().replace("PLAN V", "PLAN v")}` : ""}` : "LIVE"}
      title="Live operations"
    />
  );

  let body;
  if (board.status === "loading") {
    body = <LiveSkeleton />;
  } else if (board.status === "error" && !view) {
    body = (
      <StateBlock
        icon={<CircleAlert size={24} />}
        tone="danger"
        title="Couldn't load the live board"
        body="Nothing was changed. The released plan and every driver's records are safe."
        action={
          <Btn variant="secondary" icon={<RefreshCw size={16} />} onClick={board.reload}>
            Retry
          </Btn>
        }
      />
    );
  } else if (view && view.rows.length === 0 && view.stats.departed.value === 0 && view.stats.loading.value === 0) {
    body = (
      <StateBlock
        icon={<Info size={24} />}
        title="Nothing is running yet"
        body="The live board fills when a plan is released and the first vehicle loads."
        action={
          <Btn variant="secondary" iconRight={<ArrowRight size={16} />} onClick={() => navigate(ROUTES.release)}>
            Go to release
          </Btn>
        }
      />
    );
  } else if (view) {
    body = (
      <>
        <Decisions view={view} calm={calm} onGo={(to) => navigate(to)} />
        <div className={styles.stats}>
          <Stat sans label="Departed" value={view.stats.departed.value} foot={view.stats.departed.foot} />
          <Stat sans label="Loading" value={view.stats.loading.value} foot={view.stats.loading.foot} />
          <Stat sans label="Delivered" value={view.stats.delivered.value} foot={view.stats.delivered.foot} />
          <Stat sans label="Issues" value={view.stats.issues.value} foot={view.stats.issues.foot} {...(view.stats.issues.bad ? { footTone: "bad" as const } : {})} />
        </div>
        <div className={styles.caption}>
          {all ? "All vehicles shown" : view.caption}
          {" · "}
          <LinkButton onClick={() => setAll(!all)}>{all ? "Show needing attention" : "Show all"}</LinkButton>
        </div>
        <Board
          view={view}
          isOpen={isOpen}
          toggle={(row) => setOpen({ ...open, [row.vehicleId]: !isOpen(row) })}
          onDefer={(row, stop) => {
            setDeferError(null);
            setDeferring({ row, stop });
          }}
          onHistory={(stop) => navigate(`${ROUTES.queue}?order=${stop.orders[0]?.id ?? ""}`)}
          readOnly={offline}
        />
      </>
    );
  }

  return (
    <Screen
      bar={
        <AppBar
          current="live"
          depot={scope === "kandy" ? "kandy" : "peliyagoda"}
          onDepot={(d) => setScope(d)}
          depotChoice={{ value: scope, onChange: setScope }}
          place=""
        />
      }
      offlineNote="Offline. The board shows what it had at {time}. Defer stop is paused."
    >
      <div className={styles.page}>
        {header}
        {body}
      </div>
      {deferring && (
        <DeferStopDialog
          key={deferring.stop.outletId}
          open
          onOpenChange={(o) => {
            if (!o) setDeferring(null);
          }}
          stop={deferring.stop}
          vehicleId={deferring.row.vehicleId}
          offlineSince={deferring.row.risk === "Unknown · offline" ? deferring.row.lastHeard.time : undefined}
          nextVersion={nextVersion}
          busy={busy}
          error={deferError}
          onConfirm={(r) => void confirmDefer(r)}
        />
      )}
    </Screen>
  );
}

function Decisions({ view, calm, onGo }: { view: LiveBoardView; calm: boolean; onGo: (to: string) => void }) {
  const needs = view.decisions.filter((d) => !d.infoOnly).length;
  const conflicts = view.decisions.filter((d) => d.kind === "conflict").length;
  const empty = view.decisions.length === 0;
  return (
    <section className={styles.decisions} aria-label="Needs a decision">
      <div className={styles.decisionsHead}>
        Needs a decision · {needs}
        {conflicts > 0 && <span className={styles.count}>{conflicts}</span>}
      </div>
      {empty ? (
        calm ? (
          <div className={styles.calm}>
            <span className={styles.calmTile}>
              <Check size={26} />
            </span>
            <div>
              <b>Nothing needs attention right now</b>
              <span>We'll put anything that needs you here first.</span>
            </div>
          </div>
        ) : (
          <div className={styles.none}>
            <Check size={16} />
            Nothing needs a decision.
          </div>
        )
      ) : (
        view.decisions.map((d) => <DecisionRow key={d.id} d={d} onGo={onGo} />)
      )}
    </section>
  );
}

function DecisionRow({ d, onGo }: { d: Decision; onGo: (to: string) => void }) {
  const tone = d.kind === "held" ? styles.decisionHeld : d.kind === "conflict" ? styles.decisionConflict : styles.decisionInfo;
  const icon = d.kind === "held" ? <Flag size={20} /> : d.kind === "conflict" ? null : d.id === "spare" ? <Truck size={20} /> : <Info size={20} />;
  return (
    <div className={cx(styles.decision, tone)}>
      {d.kind === "conflict" ? (
        <Chip tone="warningOutline" pill icon={<TriangleAlert size={14} />}>
          {d.chip ?? "Conflict"}
        </Chip>
      ) : (
        <span className={styles.decisionIcon}>{icon}</span>
      )}
      <div className={styles.decisionBody}>
        <span className={styles.decisionTitle}>{d.title}</span>
        <span className={styles.decisionText}>{d.text}</span>
      </div>
      <div className={styles.decisionRight}>
        {d.countdown && (
          <span className={styles.countdown}>
            <Clock3 size={15} />
            {d.countdown}
          </span>
        )}
        {d.at && (
          <Mono>
            <span className={styles.at}>{d.at}</span>
          </Mono>
        )}
        {d.infoOnly && <span className={styles.infoOnly}>Info only</span>}
        {d.action && (
          <Btn size="sm" iconRight={<ArrowRight size={15} />} onClick={() => onGo(d.action!.to)}>
            {d.action.label}
          </Btn>
        )}
      </div>
    </div>
  );
}

type BoardProps = {
  view: LiveBoardView;
  isOpen: (row: LiveRow) => boolean;
  toggle: (row: LiveRow) => void;
  onDefer: (row: LiveRow, stop: LiveStop) => void;
  onHistory: (stop: LiveStop) => void;
  readOnly: boolean;
};

function Board({ view, isOpen, toggle, onDefer, onHistory, readOnly }: BoardProps) {
  return (
    <div className={styles.board} role="table" aria-label="Vehicles">
      <div className={cx(styles.grid, styles.headRow)} role="row">
        {["Vehicle", "Trip", "Driver", "Plan on device", "Next stop", "Lateness risk", "Stops", "Last heard", "Status"].map((h) => (
          <span key={h} role="columnheader">
            {h}
          </span>
        ))}
      </div>
      {view.rows.map((row) => {
        const open = isOpen(row);
        const heard = row.lastHeard;
        return (
          <div key={`${row.vehicleId}-${row.trip}`} className={styles.vehicle}>
            <div className={cx(styles.grid, styles.row, row.held && styles.rowHeld)} role="row">
              <span className={styles.vehCell} role="cell">
                {row.stopsDetail.length > 0 ? (
                  <button type="button" className={styles.chevBtn} aria-expanded={open} aria-label={`${open ? "Collapse" : "Expand"} ${row.vehicleId}`} onClick={() => toggle(row)}>
                    <ChevronDown size={16} style={{ transform: open ? "none" : "rotate(-90deg)" }} />
                  </button>
                ) : (
                  <span className={styles.chevSpace} />
                )}
                <b>{row.vehicleId}</b>
              </span>
              <span role="cell">{row.trip}</span>
              <span role="cell">{row.driver}</span>
              <span className={styles.planCell} role="cell">
                {row.changePending && (
                  <span className={styles.pending}>
                    <Clock3 size={13} />
                    Change pending
                  </span>
                )}
                v{row.planOnDevice}
              </span>
              <span role="cell">{row.nextStop}</span>
              <span role="cell">
                <RiskChip row={row} />
              </span>
              <span role="cell">
                <Mono>
                  {row.stops.done} / {row.stops.total}
                </Mono>
              </span>
              <span role="cell">
                <Heard heard={heard} offline={row.risk === "Unknown · offline"} />
              </span>
              <span role="cell">
                <VehicleStatus status={row.status} held={row.held} />
              </span>
            </div>
            {open && row.stopsDetail.length > 0 && (
              <div className={styles.stops}>
                {row.stopsDetail.map((stop) => (
                  <StopRow key={stop.outletId} stop={stop} onDefer={() => onDefer(row, stop)} onHistory={() => onHistory(stop)} readOnly={readOnly} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Heard({ heard, offline }: { heard: LiveRow["lastHeard"]; offline: boolean }) {
  if (!heard.time) return null;
  return (
    <span className={cx(styles.heard, heard.synced && styles.heardOk)}>
      {offline && <WifiOff size={15} />}
      {heard.synced && <Check size={15} />}
      <Mono>{heard.time}</Mono>
      {(heard.age || heard.note) && (
        <small>
          {heard.age ? `· ${heard.age}` : ""}
          {heard.note ? (heard.age ? ` · ${heard.note}` : heard.note) : ""}
        </small>
      )}
    </span>
  );
}

function StopRow({ stop, onDefer, onHistory, readOnly }: { stop: LiveStop; onDefer: () => void; onHistory: () => void; readOnly: boolean }) {
  const status = <StatusPill status={stop.status} />;
  return (
    <div className={styles.stopRow}>
      <Mono>
        <span className={styles.stopId}>{stop.outletId}</span>
      </Mono>
      <span className={styles.stopName}>{stop.outletName}</span>
      <BrandChip brand={stop.brand} small />
      <span className={styles.orderChips}>
        {stop.orders.map((o) => (
          <span key={o.id} className={styles.orderChips}>
            <Mono>{o.id}</Mono>
            <TempChip temp={o.temp} small />
          </span>
        ))}
      </span>
      <Mono>
        <span className={styles.eta}>{stop.eta.replace(" · ", " · ")}</span>
      </Mono>
      <span className={styles.stopRight}>
        {stop.change && (
          <Chip tone="dashed" pill icon={<Redo2 size={13} />}>
            {stop.change}
          </Chip>
        )}
        {stop.statusNote && stop.status === "Delivered" ? (
          <Tip light tip={stop.tooltip ? <TipText text={stop.tooltip} /> : stop.statusNote}>
            <Chip tone="success" pill icon={<Check size={14} />}>
              {stop.statusNote}
            </Chip>
          </Tip>
        ) : (
          status
        )}
        {stop.canDefer && (
          <Btn variant="secondary" size="sm" icon={<Redo2 size={15} />} disabled={readOnly} onClick={onDefer}>
            Defer stop
          </Btn>
        )}
        <LinkButton onClick={onHistory}>History</LinkButton>
      </span>
    </div>
  );
}

function TipText({ text }: { text: string }) {
  const [head, ...rest] = text.split(". ");
  return (
    <>
      <b>{head}</b>
      <span>{rest.join(". ")}</span>
    </>
  );
}

function LiveSkeleton() {
  return (
    <>
      <div className={styles.decisions} aria-hidden>
        <Skel w={140} h={10} />
        <Skel w={260} h={12} />
      </div>
      <div className={styles.stats} aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.decisions}>
            <Skel w={80} h={10} />
            <Skel w={60} h={28} />
            <Skel w={120} h={10} />
          </div>
        ))}
      </div>
      <div className={styles.board} aria-hidden>
        <div className={cx(styles.grid, styles.headRow)} />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.skelRow}>
            <Skel w={90} h={12} />
            <Skel w={30} h={12} />
            <Skel w={90} h={12} />
            <Skel w={200} h={12} />
            <Skel w={120} h={12} />
          </div>
        ))}
      </div>
    </>
  );
}
