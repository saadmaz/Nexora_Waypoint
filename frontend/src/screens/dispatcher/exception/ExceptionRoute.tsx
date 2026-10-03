import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, Box, Check, ChevronRight, CircleAlert, Flag, Info, LoaderCircle, Lock, Redo2, RefreshCw, Route, Snowflake, TriangleAlert } from "lucide-react";
import type { ExceptionView } from "../../../api/DispatcherApi";
import { ApiError } from "../../../api/DispatcherApi";
import { Mono } from "../../../shared/ui/Mono";
import { useToast } from "../../../shared/ui/useToast";
import { AppBar } from "../chrome/AppBar";
import { PageHeader } from "../chrome/PageHeader";
import { ROUTES } from "../chrome/routes";
import { Screen } from "../chrome/Screen";
import { useDispatcher } from "../context";
import { useDepot, useLoad } from "../hooks";
import { Banner } from "../ui/Banner";
import { Btn } from "../ui/Btn";
import { BrandChip, Chip, TempChip } from "../ui/Chip";
import { Checkbox } from "../ui/Checkbox";
import { cx } from "../ui/cx";
import { Meter } from "../ui/Meter";
import { Skel } from "../ui/Skel";
import { StateBlock } from "../ui/StateBlock";
import styles from "./Exception.module.css";

const kg = (n: number) => n.toLocaleString("en-US");

/** D8: a vehicle failed the load check. The planner proposes one order to defer; the dispatcher confirms it or picks others (PRD v3 section 12). */
export function ExceptionRoute() {
  const { api, offline, invalidate } = useDispatcher();
  const { id = "x1" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const [depot, setDepot] = useDepot();
  const load = useLoad(() => api.getExceptionForReview(id), [id], 5_000);
  const view = load.data;

  // The gallery opens the manual frames (D8.3) from the address, without clicks.
  const ui = params.get("ui");
  const [manual, setManual] = useState(ui === "manual" || ui === "refuse");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(ui === "refuse" ? ["ORD1001"] : []));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const decide = async (deferOrderIds: string[]) => {
    setBusy(true);
    setFailed(null);
    try {
      const next = await api.decideException(id, { decision: "swap vehicle", deferOrderIds });
      invalidate();
      toast.show(next.confirmed?.toast ?? "Plan v4 released. Loader asked to acknowledge.", { icon: "check" });
    } catch (error) {
      setFailed(error instanceof Error ? error.message : "That didn't go through.");
    } finally {
      setBusy(false);
    }
  };

  const back = () => navigate(ROUTES.live);
  const notFound = load.status === "error" && load.error instanceof ApiError && load.error.code === "not_found";
  const confirmed = view?.state === "confirmed";

  let body;
  if (load.status === "loading") {
    body = (
      <div className={styles.top} aria-hidden>
        <div className={cx(styles.card, styles.skelStack)} style={{ flex: 1 }}>
          <Skel w={80} h={10} />
          <Skel w={160} h={24} />
          <Skel w={260} h={10} />
        </div>
        <div className={cx(styles.card, styles.skelStack, styles.before)}>
          <Skel w="100%" h={10} />
          <Skel w="100%" h={10} />
          <Skel w="70%" h={10} />
        </div>
      </div>
    );
  } else if (notFound) {
    body = (
      <StateBlock
        icon={<Check size={24} />}
        tone="success"
        title="Nothing is held"
        body="Every vehicle passed its load check. Nothing was changed."
        action={
          <Btn variant="secondary" iconRight={<ArrowRight size={16} />} onClick={back}>
            Back to live
          </Btn>
        }
      />
    );
  } else if (load.status === "error" && !view) {
    body = (
      <StateBlock
        icon={<CircleAlert size={24} />}
        tone="danger"
        title="Couldn't load this exception"
        body="Nothing was changed. The held vehicle stays held."
        action={
          <Btn variant="secondary" icon={<RefreshCw size={16} />} onClick={load.reload}>
            Retry
          </Btn>
        }
      />
    );
  } else if (view) {
    body = (
      <Body
        view={view}
        manual={manual}
        picked={picked}
        setPicked={setPicked}
        onManual={() => setManual(true)}
        onBackToRecommendation={() => {
          setManual(false);
          setPicked(new Set());
          setFailed(null);
        }}
        busy={busy || offline}
        failed={failed}
        onDecide={(ids) => void decide(ids)}
        onBack={back}
      />
    );
  }

  return (
    <Screen
      bar={<AppBar current="live" depot={depot} onDepot={setDepot} />}
      offlineNote="Offline. You can read the options. Confirming needs a connection."
    >
      <div className={styles.page}>
        <PageHeader
          overline={
            <span className={styles.crumb}>
              <Link to={ROUTES.live}>LIVE</Link>
              <span aria-hidden>›</span>
              {view ? `LOADING EXCEPTION · FLAGGED BY ${view.flaggedBy.toUpperCase()} ${view.flaggedAt}` : "LOADING EXCEPTION"}
            </span>
          }
          title={view?.title ?? "Loading exception"}
          actions={
            view && !notFound ? (
              confirmed ? (
                <span className={styles.badges}>
                  <Chip tone="outlineInk" small>
                    Replaced
                  </Chip>
                  <Chip tone="info" pill icon={<Route size={13} />}>
                    Plan v{view.confirmed?.plan ?? 4} · {view.confirmed?.at ?? "03:00"}
                  </Chip>
                </span>
              ) : (
                <span className={styles.badges}>
                  <span className={styles.heldTag}>
                    <Lock size={13} />
                    Held
                  </span>
                  <span className={styles.countdown}>{view.minutesToDeparture} min to departure</span>
                </span>
              )
            ) : undefined
          }
        />
        {body}
      </div>
    </Screen>
  );
}

type BodyProps = {
  view: ExceptionView;
  manual: boolean;
  picked: Set<string>;
  setPicked: (s: Set<string>) => void;
  onManual: () => void;
  onBackToRecommendation: () => void;
  busy: boolean;
  failed: string | null;
  onDecide: (orderIds: string[]) => void;
  onBack: () => void;
};

function Body({ view, manual, picked, setPicked, onManual, onBackToRecommendation, busy, failed, onDecide, onBack }: BodyProps) {
  const working = view.state === "working";
  const confirmed = view.state === "confirmed";
  const rec = view.recommendation;

  const chosen = view.candidates.filter((c) => picked.has(c.orderId));
  const freedKg = chosen.reduce((a, c) => a + c.kg, 0);
  const freedM3 = chosen.reduce((a, c) => a + c.m3, 0);
  const refused = chosen.find((c) => c.protected);
  const fits = !refused && chosen.length > 0 && freedKg >= view.need.kg && freedM3 >= view.need.m3;
  const stillKg = Math.max(0, view.need.kg - freedKg);
  const stillM3 = Math.max(0, view.need.m3 - freedM3);

  return (
    <>
      {working ? (
        <Banner tone="danger" icon={<Route size={20} />} title={`${view.reason} · flagged by ${view.flaggedBy} ${view.flaggedAt}`}>
          {view.ordersText}
        </Banner>
      ) : confirmed && view.confirmed ? (
        <Banner tone="success" icon={<Check size={20} />} title={`Plan v${view.confirmed.plan} created · VEH003 → VEH036 · ORD1002 deferred (policy)`}>
          {view.confirmed.text}
        </Banner>
      ) : (
        <Banner tone="danger" icon={<Flag size={20} />} title={`${view.reason} · flagged by ${view.flaggedBy} ${view.flaggedAt}`}>
          {view.ordersText}
        </Banner>
      )}

      <div className={styles.top}>
        <section className={cx(styles.card, styles.swap)} aria-label="Failed and replacement vehicle">
          <div className={cx(styles.vehicleCol, styles.failed)}>
            <span className={styles.overline}>Failed</span>
            <span className={styles.vehicleId}>
              {view.failed.vehicleId}
              <span className={styles.heldTag}>
                <Lock size={12} />
                {view.failed.tag}
              </span>
            </span>
            <span className={styles.spec}>{view.failed.spec}</span>
            <span className={styles.failReason}>{view.failed.reason}</span>
          </div>
          <span className={styles.arrow} aria-hidden>
            <ArrowRight size={22} />
          </span>
          <div className={styles.vehicleCol}>
            <span className={styles.overline}>Replacement</span>
            {view.replacement ? (
              <>
                <span className={styles.vehicleId}>
                  {view.replacement.vehicleId}
                  <Chip tone="info" small icon={<Snowflake size={12} />}>
                    Reefer
                  </Chip>
                </span>
                <span className={styles.spec}>{view.replacement.spec}</span>
                <span className={styles.since}>
                  <Check size={13} />
                  Available since {view.replacement.since}
                </span>
              </>
            ) : (
              <div className={styles.skelStack} aria-hidden>
                <Skel w={160} h={22} />
                <Skel w={220} h={10} />
                <Skel w={120} h={18} />
              </div>
            )}
          </div>
        </section>
        {!confirmed && (
          <section className={cx(styles.card, styles.before)} aria-label="Replacement before the change">
            <span className={styles.overline}>VEH036 Trip 1 · before the change</span>
            {view.before ? (
              <>
                <Resource label="Weight" used={view.before.weight.used} limit={view.before.weight.limit} unit="kg" note={view.before.weight.over} fmt={kg} />
                <Resource label="Volume" used={view.before.volume.used} limit={view.before.volume.limit} unit="m³" note={view.before.volume.over} fmt={(n) => n.toFixed(1)} />
                <span className={cx(styles.note, styles.noteGood)}>
                  <Check size={14} />
                  {view.before.trip2}
                </span>
              </>
            ) : (
              <div className={styles.skelStack} aria-hidden>
                <Skel w="100%" h={10} />
                <Skel w="100%" h={10} />
                <Skel w="70%" h={10} />
              </div>
            )}
          </section>
        )}
      </div>

      {working && (
        <section className={styles.working} aria-live="polite">
          <b>
            <LoaderCircle size={18} />
            Working out the options...
          </b>
          Checking spare reefers at Peliyagoda and which orders could wait without skipping an outlet twice.
        </section>
      )}

      {confirmed && view.confirmed && (
        <section className={cx(styles.card, styles.knows)} aria-label="Who already knows">
          <h2>
            <Info size={20} />
            Who already knows
          </h2>
          {view.confirmed.whoKnows.map((k) => (
            <div key={k.who} className={styles.knowRow}>
              <Check size={16} />
              <b>{k.who}</b>
              <span>{k.what}</span>
            </div>
          ))}
        </section>
      )}

      {!working && !confirmed && !manual && rec && (
        <section className={styles.recommend} aria-label="Recommendation">
          <div className={styles.recommendHead}>
            <span className={styles.recommendTitle}>
              <Info size={20} />
              Recommended: defer {rec.orderId} ({rec.outletId})
            </span>
            <span className={styles.typeNote}>{rec.typeNote}</span>
          </div>
          <div className={styles.recommendBody}>
            <div className={styles.deferCard}>
              <div className={styles.deferTop}>
                <BrandChip brand="Fresh" small />
                <TempChip temp="chilled" small />
                <Mono>
                  <span className={styles.cellSmall}>{rec.orderId}</span>
                </Mono>
                <span className={styles.right}>
                  <Chip tone="dashed" small icon={<Redo2 size={13} />}>
                    Deferred · {rec.kind} → Wed
                  </Chip>
                </span>
              </div>
              <div className={styles.deferTitle}>{rec.title}</div>
              <div className={styles.deferGrid}>
                <Cell label="Reason" value="Vehicle unavailable" small="Least surplus of the four equal-impact orders" />
                <Cell label="Decided by" value={rec.decidedBy} />
                <Cell label="Store told" value="Sent when you confirm" />
                <Cell label="Impact on store" value={rec.impact} />
                <Cell label="Frees" value={rec.frees} />
                <Cell label="Next run" value={rec.nextRun} />
              </div>
            </div>
            <div className={styles.protectedCard}>
              <span className={styles.overline}>Protected</span>
              {rec.protected.map((p) => (
                <div key={p.orderId}>
                  <div className={styles.protectedRow}>
                    <Mono>
                      {p.outletId} · {p.orderId}
                    </Mono>
                    <Chip tone="outlineInk" small icon={<Lock size={12} />}>
                      Protected
                    </Chip>
                  </div>
                  <span className={styles.cellSmall}>{p.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {!working && view.after && !manual && (
        <section className={cx(styles.card, styles.after)} aria-label="Replacement after the change">
          <div className={styles.afterMain}>
            <span className={styles.overline}>VEH036 after the change</span>
            <div className={styles.afterBars}>
              <Resource label="Weight" used={view.after.weight.used} limit={view.after.weight.limit} unit="kg" note={view.after.weight.warn} fmt={kg} warn />
              <Resource label="Volume" used={view.after.volume.used} limit={view.after.volume.limit} unit="m³" note={view.after.volume.warn} fmt={(n) => n.toFixed(1)} warn />
            </div>
            <div className={styles.stats}>
              <div>
                <span>Trip 1</span>
                <span>{view.after.trip1Minutes} min</span>
              </div>
              <div>
                <span>Trip 2</span>
                <span>{view.after.trip2.replace("→", "→")}</span>
              </div>
              <div>
                <span>Fresh</span>
                <span>{view.after.fresh}</span>
              </div>
              <div>
                <span>Fuel</span>
                <span>{view.after.fuel}</span>
              </div>
            </div>
          </div>
          <div className={styles.afterSide}>
            <span className={styles.overline}>Trip 1 stops</span>
            <span className={styles.chain}>
              {view.after.stops.map((s, i) => (
                <span key={s} className={styles.chain}>
                  {i > 0 && <ChevronRight size={14} />}
                  {s}
                </span>
              ))}
            </span>
            <span className={styles.cellSmall}>{view.after.stopsNote}</span>
          </div>
        </section>
      )}

      {manual && !working && !confirmed && (
        <section className={styles.manual} aria-label="Pick orders to defer">
          <div className={cx(styles.manualHead, fits && styles.manualHeadOk)}>
            <span>
              {fits ? <Check size={16} /> : <CircleAlert size={16} />}
              {fits ? "Trip 1 fits" : `Still over by ${stillKg} kg / ${stillM3.toFixed(1)} m³, pick orders to defer`}
            </span>
            <span className={styles.manualHint}>Turns green when Trip 1 fits</span>
          </div>
          {view.candidates.map((c) => {
            const refusedRow = picked.has(c.orderId) && c.protected;
            return (
              <div key={c.orderId}>
                <div className={cx(styles.candidate, refusedRow && styles.candidateRefused)}>
                  <Checkbox
                    checked={picked.has(c.orderId)}
                    refused={refusedRow}
                    onChange={(on) => {
                      const next = new Set(picked);
                      if (on) next.add(c.orderId);
                      else next.delete(c.orderId);
                      setPicked(next);
                    }}
                  >
                    <Mono>
                      {c.outletId} · {c.orderId}
                    </Mono>
                  </Checkbox>
                  <span className={styles.impact}>Impact on store: {c.impact}</span>
                  <span className={styles.frees}>
                    Frees {c.kg} kg / {c.m3.toFixed(1)} m³
                  </span>
                  {c.protected && (
                    <span className={styles.protectedTag}>
                      <Lock size={13} />
                      Protected
                    </span>
                  )}
                </div>
                {refusedRow && (
                  <div className={styles.refusal} role="alert">
                    <Lock size={15} />
                    {c.outletId} is protected: deferred yesterday. Pick another order.
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {failed && (
        <Banner tone="danger" icon={<TriangleAlert size={20} />} title="That didn't go through">
          {failed} Nothing was changed.
        </Banner>
      )}

      {!working && (
        <div className={styles.actions}>
          {confirmed ? (
            <Btn variant="secondary" iconRight={<ArrowRight size={16} />} onClick={onBack}>
              Back to live
            </Btn>
          ) : manual ? (
            <>
              <Btn variant="ghost" onClick={onBackToRecommendation}>
                Back to recommendation
              </Btn>
              {!fits && <span className={styles.actionNote}>Pick an order that frees at least {view.need.kg} kg</span>}
              <Btn disabled={!fits || busy} onClick={() => onDecide([...picked])}>
                Confirm my choice
              </Btn>
            </>
          ) : (
            <>
              <Btn variant="secondary" disabled={busy || !rec} onClick={onManual}>
                Adjust manually
              </Btn>
              <Btn icon={<Check size={16} />} disabled={busy || !rec} onClick={() => rec && onDecide([rec.orderId])}>
                Confirm: defer {rec?.orderId ?? ""}, load {view.replacement?.vehicleId ?? ""}
              </Btn>
            </>
          )}
        </div>
      )}
    </>
  );
}

function Cell({ label, value, small }: { label: string; value: string; small?: string }) {
  return (
    <div>
      <div className={styles.cellLabel}>{label}</div>
      <div className={styles.cellValue}>{value}</div>
      {small && <div className={styles.cellSmall}>{small}</div>}
    </div>
  );
}

type ResourceProps = { label: string; used: number; limit: number; unit: string; note: string; fmt: (n: number) => string; warn?: boolean };

function Resource({ label, used, limit, unit, note, fmt, warn }: ResourceProps) {
  const over = used > limit;
  return (
    <div className={styles.res}>
      <div className={styles.resTop}>
        <span>
          <Box size={15} />
          {label}
        </span>
        <span className={cx(styles.figure, over && styles.figureBad)}>
          {fmt(used)} / {fmt(limit)} {unit}
        </span>
      </div>
      <Meter value={used} max={limit} label={label} {...(over ? {} : { tone: warn ? ("near" as const) : ("route" as const) })} />
      <span className={cx(styles.note, over ? styles.noteBad : styles.noteWarn)}>
        {over ? <CircleAlert size={14} /> : <TriangleAlert size={14} />}
        {note}
      </span>
    </div>
  );
}
