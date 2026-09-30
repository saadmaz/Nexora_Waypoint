import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, CircleAlert, Lock, RefreshCw, Route as RouteIcon } from "lucide-react";
import type { DeferredCard, DepotId, MoveTarget, PlanTrip } from "../../../api/DispatcherApi";
import { useToast } from "../../../shared/ui/useToast";
import { AppBar } from "../chrome/AppBar";
import { PageHeader } from "../chrome/PageHeader";
import { ROUTES, withDepot } from "../chrome/routes";
import { Screen } from "../chrome/Screen";
import { Stepper } from "../chrome/Stepper";
import { useDispatcher } from "../context";
import { useDepot, useLoad } from "../hooks";
import { Banner } from "../ui/Banner";
import { Btn, LinkButton } from "../ui/Btn";
import { Skel } from "../ui/Skel";
import { StateBlock } from "../ui/StateBlock";
import { DeferredPanel } from "./DeferredPanel";
import { Lane } from "./Lane";
import { MoveToDialog } from "./MoveToDialog";
import { AnchoredPopover, MovePreview, RefusalPopover, WhyPopover } from "./Popovers";
import { targetKey, tripKey, type Interaction } from "./types";
import styles from "./Trips.module.css";

const PLAN_STATE_TEXT = (n: number, state: "draft" | "released", at: string) => `PLAN v${n} ${state === "released" ? `RELEASED ${at.split(" ").at(-1)}` : "DRAFT"}`;

/** D3: the trip board. A system draft the dispatcher edits, each edit checked by the rules before it is kept (PRD v3 section 3 D3). */
export function TripsRoute() {
  const { api, offline, invalidate } = useDispatcher();
  const navigate = useNavigate();
  const toast = useToast();
  const [depot, setDepot] = useDepot();
  const [params] = useSearchParams();
  const plan = useLoad(() => api.getPlan({ depot }), [depot]);
  const view = plan.data;
  const boxRef = useRef<HTMLDivElement>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [interaction, setInteraction] = useState<Interaction>({ kind: "none" });
  const [saveError, setSaveError] = useState<string | null>(null);
  const checking = useRef("");

  const readOnly = Boolean(view?.readOnly) || offline;
  const trips = useMemo(() => (view ? view.lanes.flatMap((l) => l.trips) : []), [view]);
  const tripOf = useCallback((orderId: string): PlanTrip | undefined => trips.find((t) => t.stops.some((s) => s.orderIds.includes(orderId))), [trips]);
  const cardOf = useCallback((orderId: string): DeferredCard | undefined => view?.deferred.find((c) => c.orderId === orderId), [view]);

  const clear = useCallback(() => {
    setInteraction({ kind: "none" });
    setDragging(null);
    checking.current = "";
  }, []);

  // ---- writes ---------------------------------------------------------------

  const commit = useCallback(
    async (orderId: string, target: MoveTarget) => {
      try {
        await api.saveMoves({ moves: [{ orderId, to: target }] });
        clear();
        setSaveError(null);
        invalidate();
        toast.show(target === "deferred" ? `Deferred ${orderId}. Saved to the draft.` : `Moved ${orderId} to ${target.vehicleId} · Trip ${target.trip}. Saved to the draft.`);
      } catch {
        clear();
        setSaveError(orderId);
      }
    },
    [api, clear, invalidate, toast],
  );

  // ---- drag and drop --------------------------------------------------------

  const startDrag = (orderId: string) => {
    setDragging(orderId);
    setSelected(null);
    setInteraction({ kind: "drag", orderId });
  };

  const over = async (orderId: string, target: MoveTarget) => {
    const key = `${orderId}->${targetKey(target)}`;
    if (checking.current === key) return;
    checking.current = key;
    const result = await api.validateMove({ orderId, to: target });
    setInteraction((prev) => (prev.kind === "drag" && prev.orderId === orderId ? { kind: "drag", orderId, over: target, result } : prev));
  };

  const drop = async (target: MoveTarget) => {
    if (!dragging) return;
    const orderId = dragging;
    const result = await api.validateMove({ orderId, to: target });
    setDragging(null);
    checking.current = "";
    if (result.ok) await commit(orderId, target);
    else setInteraction({ kind: "refused", orderId, target, result });
  };

  const showWhy = async (orderId: string) => {
    const trip = tripOf(orderId);
    if (!trip) return;
    const result = await api.validateMove({ orderId, to: { vehicleId: trip.vehicleId, trip: trip.trip } });
    setInteraction({ kind: "why", orderId, result });
  };

  // ---- gallery: reach a frame without a drag --------------------------------

  const seeded = useRef(false);
  useEffect(() => {
    const ui = params.get("ui");
    if (!view || !ui || seeded.current) return;
    seeded.current = true;
    const refuse = async (orderId: string, target: MoveTarget) => {
      const result = await api.validateMove({ orderId, to: target });
      setInteraction({ kind: "refused", orderId, target, result });
    };
    switch (ui) {
      case "accept": {
        void api.validateMove({ orderId: "ORD1003", to: { vehicleId: "VEH035", trip: 1 } }).then((result) => {
          setDragging("ORD1003");
          setInteraction({ kind: "drag", orderId: "ORD1003", over: { vehicleId: "VEH035", trip: 1 }, result });
        });
        break;
      }
      case "refuse-window":
        void refuse("ORD1009", { vehicleId: "VEH003", trip: 2 });
        break;
      case "refuse-two":
        void refuse("ORD1002", { vehicleId: "VEH011", trip: 1 });
        break;
      case "refuse-guard":
        void refuse("ORD1001", "deferred");
        break;
      case "moveto":
        setInteraction({ kind: "moveTo", orderId: "ORD1017" });
        break;
      case "why":
        void showWhy("ORD1014");
        break;
      case "save-error":
        setSaveError("ORD1003");
        break;
    }
    // The gallery only opens a frame once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Close a popover when the dispatcher clicks anywhere else.
  useEffect(() => {
    if (interaction.kind !== "refused" && interaction.kind !== "why") return;
    const away = (event: MouseEvent) => {
      const el = event.target as HTMLElement;
      if (!el.closest(`.${styles.popover}`) && !el.closest(`.${styles.miniButton}`)) clear();
    };
    const esc = (event: KeyboardEvent) => {
      if (event.key === "Escape") clear();
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [interaction.kind, clear]);

  // ---- what is drawn --------------------------------------------------------

  const hover = useMemo(() => {
    if (interaction.kind === "drag" && interaction.over && interaction.result) {
      return { key: targetKey(interaction.over), state: interaction.result.ok ? ("accept" as const) : ("refuse" as const), showNewStop: interaction.result.ok };
    }
    if (interaction.kind === "refused") return { key: targetKey(interaction.target), state: "refuse" as const, showNewStop: false };
    return null;
  }, [interaction]);

  const released = view?.version.state === "released";
  const header = (
    <PageHeader
      overline={`TRIPS · ${depot.toUpperCase()}${view ? ` · ${PLAN_STATE_TEXT(view.version.number, view.version.state, view.version.at)}` : ""}`}
      title="Trip board"
      actions={
        released ? (
          <Btn variant="secondary" iconRight={<ArrowRight size={16} />} onClick={() => navigate(ROUTES.live)}>
            Open live view
          </Btn>
        ) : (
          <Btn iconRight={<ArrowRight size={16} />} onClick={() => navigate(withDepot(ROUTES.deferrals, depot))} disabled={!view}>
            Review deferrals
          </Btn>
        )
      }
    >
      <div className={styles.stepperRow}>
        <Stepper current={3} depot={depot} done={released ? [1, 2, 3, 4, 5] : [1, 2]} />
        <div className={styles.legend}>
          <span className={styles.legendChip}>
            <RouteIcon size={13} />
            Every trip carries one brand and one district
          </span>
          <span className={styles.legendHint}>{readOnly ? "Released trips are read-only" : "Drag an order, or select it and press Move to…"}</span>
        </div>
      </div>
    </PageHeader>
  );

  let body;
  if (plan.status === "loading") body = <TripsSkeleton />;
  else if (plan.status === "error" && !view) {
    body = (
      <Banner
        tone="danger"
        icon={<CircleAlert size={20} />}
        title="Couldn't load the plan"
        actions={
          <Btn variant="secondary" size="sm" icon={<RefreshCw size={15} />} onClick={plan.reload}>
            Retry
          </Btn>
        }
      >
        Nothing was changed. Your drafts are safe.
      </Banner>
    );
  } else if (view && view.lanes.length === 0) {
    body = (
      <div className={styles.banner}>
        <StateBlock icon={<RouteIcon size={23} />} title="No plan drafted yet" body="Trips appear when the 16:05 draft is ready." />
      </div>
    );
  } else if (view) {
    const refusedCard = interaction.kind === "refused" ? cardOf(interaction.orderId) : undefined;
    const anchor = (target: MoveTarget) => targetKey(target);
    body = (
      <>
        {released && (
          <Banner
            tone="info"
            icon={<Lock size={20} />}
            title={`Plan v${view.version.number} released at ${view.version.at.split(" ").at(-1)}, the board is read-only.`}
            actions={
              <LinkButton onClick={() => navigate(ROUTES.live)}>
                Open live view <ArrowRight size={15} style={{ verticalAlign: "-2px" }} />
              </LinkButton>
            }
          >
            Changes after release happen in Live and create a new version.
          </Banner>
        )}
        {saveError && (
          <Banner
            tone="danger"
            icon={<CircleAlert size={20} />}
            title={`Move not saved: ${saveError} is back on ${tripOf(saveError) ? `${tripOf(saveError)!.vehicleId} · Trip ${tripOf(saveError)!.trip}` : "its trip"}.`}
            actions={
              <Btn variant="secondary" size="sm" icon={<RefreshCw size={15} />} onClick={() => setSaveError(null)}>
                Try again
              </Btn>
            }
          >
            Your other edits are safe. This was a save failure, not a rule refusal.
          </Banner>
        )}
        <div className={styles.body} ref={boxRef}>
          <div className={styles.board}>
            {view.lanes.map((lane) => (
              <Lane
                key={lane.vehicleId}
                lane={lane}
                hover={hover}
                readOnly={readOnly}
                selected={selected}
                dragging={dragging}
                onSelect={(id) => setSelected((s) => (s === id ? null : id))}
                onMoveTo={(id) => setInteraction({ kind: "moveTo", orderId: id })}
                onWhy={(id) => void showWhy(id)}
                onDragStart={startDrag}
                onDragEnd={() => {
                  if (interaction.kind === "drag") clear();
                }}
                onDragOver={(target) => dragging && void over(dragging, target)}
                onDragLeave={() => undefined}
                onDrop={(target) => void drop(target)}
              />
            ))}
          </div>
          <DeferredPanel
            cards={view.deferred}
            total={view.deferredTotal}
            depot={depot}
            readOnly={readOnly}
            dropState={interaction.kind === "refused" && interaction.target === "deferred" ? "refuse" : "none"}
            returned={interaction.kind === "refused" && interaction.target !== "deferred" ? interaction.orderId : null}
            onMoveTo={(id) => setInteraction({ kind: "moveTo", orderId: id })}
            onDragStart={startDrag}
            onDragEnd={() => {
              if (interaction.kind === "drag") clear();
            }}
            onDragOver={() => dragging && void over(dragging, "deferred")}
            onDragLeave={() => undefined}
            onDrop={() => void drop("deferred")}
          />
          {interaction.kind === "drag" && interaction.result?.ok && interaction.over && interaction.over !== "deferred" && (
            <AnchoredPopover anchor={anchor(interaction.over)} container={boxRef} width={320} label="Move preview">
              <MovePreview result={interaction.result} />
            </AnchoredPopover>
          )}
          {interaction.kind === "refused" && (
            <AnchoredPopover anchor={anchor(interaction.target)} container={boxRef} width={interaction.target === "deferred" ? 360 : 340} tone="danger" label="Move refused">
              <RefusalPopover
                result={interaction.result}
                card={refusedCard}
                trip={tripOf(interaction.orderId)}
                keepLabel={interaction.result.protectedReason ? `Keep on ${tripOf(interaction.orderId)?.vehicleId ?? ""} · Trip ${tripOf(interaction.orderId)?.trip ?? ""}` : refusedCard ? "Keep deferred" : "Keep here"}
                onKeep={clear}
                onTryAnother={() => setInteraction({ kind: "moveTo", orderId: interaction.orderId })}
              />
            </AnchoredPopover>
          )}
          {interaction.kind === "why" && interaction.result && tripOf(interaction.orderId) && (
            <AnchoredPopover anchor={tripKey(tripOf(interaction.orderId)!.vehicleId, tripOf(interaction.orderId)!.trip)} container={boxRef} width={340} label="Why this vehicle">
              <WhyPopover result={interaction.result} trip={tripOf(interaction.orderId)} />
            </AnchoredPopover>
          )}
        </div>
        {interaction.kind === "moveTo" && (
          <MoveToDialog
            open
            onOpenChange={(o) => {
              if (!o) clear();
            }}
            api={api}
            plan={view}
            orderId={interaction.orderId}
            deferred={cardOf(interaction.orderId)}
            onMove={(target) => void commit(interaction.orderId, target)}
          />
        )}
      </>
    );
  }

  return (
    <Screen bar={<AppBar current="plan" depot={depot} onDepot={(d: DepotId) => setDepot(d)} />} offlineNote="Offline. Edits paused. Last saved change {time}.">
      <div className={styles.page}>
        {header}
        {body}
      </div>
    </Screen>
  );
}

function TripsSkeleton() {
  return (
    <div className={styles.body}>
      <div className={styles.board}>
        <div className={styles.loadingLine}>
          <RefreshCw size={16} />
          Drafting plan v1...
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.skelLane} aria-hidden>
            <div className={styles.skelHead}>
              <Skel w={80} h={12} />
              <Skel w={130} h={12} />
              <Skel w={110} h={10} />
            </div>
            {(i < 3 ? [0, 1] : [0]).map((j) => (
              <div key={j} className={styles.skelTrip}>
                <Skel w={220} h={10} />
                <Skel w={160} h={10} />
                <Skel w="100%" h={10} />
                <Skel w="100%" h={10} />
                <Skel w={260} h={10} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <aside className={styles.pool} aria-hidden>
        <h2 className={styles.poolTitle}>Unplaced / deferred</h2>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.skelPoolCard}>
            <Skel w={120} h={10} />
            <Skel w="100%" h={10} />
          </div>
        ))}
      </aside>
    </div>
  );
}
