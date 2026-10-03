import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Camera, Check, CircleAlert, Clock3, Info, Phone, Redo2, RefreshCw, Store, TriangleAlert, WifiOff, X } from "lucide-react";
import type { ConflictView, ConflictResolution } from "../../../api/DispatcherApi";
import { ApiError } from "../../../api/DispatcherApi";
import { Mono } from "../../../shared/ui/Mono";
import { useToast } from "../../../shared/ui/useToast";
import { AppBar } from "../chrome/AppBar";
import { PageHeader } from "../chrome/PageHeader";
import { ROUTES } from "../chrome/routes";
import { Screen } from "../chrome/Screen";
import { useDispatcher } from "../context";
import { useLoad } from "../hooks";
import { Banner } from "../ui/Banner";
import { Btn } from "../ui/Btn";
import { Chip } from "../ui/Chip";
import { cx } from "../ui/cx";
import { Skel } from "../ui/Skel";
import { StateBlock } from "../ui/StateBlock";
import styles from "./Conflict.module.css";

const EVENT_ICON = {
  offline: <WifiOff size={15} />,
  deferred: <Redo2 size={14} />,
  arrived: <Clock3 size={15} />,
  delivered: <Check size={16} />,
  synced: <RefreshCw size={15} />,
} as const;

/** D7: two true records for one stop. The dispatcher keeps one outcome; both records stay in the audit (PRD v3 section 3). */
export function ConflictRoute() {
  const { api, offline, invalidate } = useDispatcher();
  const { id = "c1" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  // Kandy is where the conflict lives, whichever depot the dispatcher had open.
  const load = useLoad(() => api.getConflict(id), [id], 5_000);
  const view = load.data;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const run = async (action: () => Promise<ConflictView>, done?: (v: ConflictView) => void) => {
    setBusy(true);
    setFailed(null);
    try {
      const next = await action();
      invalidate();
      done?.(next);
    } catch (error) {
      setFailed(error instanceof Error ? error.message : "That didn't go through. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  };
  const ask = () => void run(() => api.askStore(id));
  const resolve = (resolution: ConflictResolution) =>
    void run(
      () => api.resolveConflict(id, resolution),
      (next) => toast.show(next.resolved?.toast ?? "Conflict resolved. Driver and store told.", { icon: "check" }),
    );
  const back = () => navigate(ROUTES.live);

  const notFound = load.status === "error" && load.error instanceof ApiError && load.error.code === "not_found";

  let body;
  if (load.status === "loading") {
    body = (
      <>
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.skelCard} aria-hidden>
            <Skel w={140} h={10} />
            <Skel w={600} h={14} />
            <Skel w={420} h={14} />
          </div>
        ))}
      </>
    );
  } else if (notFound) {
    body = (
      <StateBlock
        icon={<Check size={24} />}
        tone="success"
        title="No conflict here"
        body="It may already be settled. Nothing was changed."
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
        title="Couldn't load this conflict"
        body="Nothing was changed. Both records are safe."
        action={
          <Btn variant="secondary" icon={<RefreshCw size={16} />} onClick={load.reload}>
            Retry
          </Btn>
        }
      />
    );
  } else if (view) {
    body = <Body view={view} busy={busy || offline} failed={failed} onAsk={ask} onResolve={resolve} onBack={back} onCall={() => toast.show(`Calling ${view.outletId}...`)} />;
  }

  const resolved = view?.state === "resolved";
  const badges = !view ? undefined : resolved ? (
    <span className={styles.badges}>
      <Chip tone="success" pill icon={<Check size={14} />}>
        {view.outcome ?? "Delivered"}
      </Chip>
      <Chip tone="outlineInk" small>
        {view.outcome === "Partial" ? "Follow-up created" : "Deferral withdrawn"}
      </Chip>
    </span>
  ) : (
    <Chip tone="warningOutline" pill icon={<TriangleAlert size={14} />}>
      Conflict · needs a decision
    </Chip>
  );

  return (
    <Screen
      bar={<AppBar current="live" depot="kandy" onDepot={() => navigate(ROUTES.live)} place="Kandy" />}
      offlineNote="Offline. You can read both records. Deciding needs a connection."
    >
      <div className={styles.page}>
        <PageHeader
          overline={
            <span className={styles.crumb}>
              <Link to={ROUTES.live}>LIVE</Link>
              <span aria-hidden>›</span>
              {view ? `CONFLICT · ${view.outletId} · ${view.outletName.toUpperCase()} · ${view.district.toUpperCase()}` : "CONFLICT"}
            </span>
          }
          title={view ? `Two records for ${view.orders.map((o) => o.id).join(" + ")}` : "Two records for one stop"}
          actions={badges}
        />
        {body}
      </div>
    </Screen>
  );
}

type BodyProps = {
  view: ConflictView;
  busy: boolean;
  failed: string | null;
  onAsk: () => void;
  onResolve: (r: ConflictResolution) => void;
  onBack: () => void;
  onCall: () => void;
};

function Body({ view, busy, failed, onAsk, onResolve, onBack, onCall }: BodyProps) {
  const resolved = view.state === "resolved";
  const reported = view.state === "store reported an issue";
  const awaiting = view.state === "awaiting store";
  const rec = view.recommendation;
  const d = view.dispatchRecord;
  const driver = view.driverRecord;

  return (
    <>
      {resolved && view.resolved ? (
        <Banner tone="success" icon={<Check size={20} />} title={view.resolved.title}>
          {view.resolved.text}
        </Banner>
      ) : reported && view.storeReport ? (
        <Banner tone="danger" icon={<CircleAlert size={20} />} title={`${view.outletId} reported a shortage at ${view.storeReport.at}.`}>
          {view.storeReport.text.replace(" · ", " received ")}. Photo attached.
        </Banner>
      ) : awaiting && view.asked ? (
        <Banner
          tone="info"
          icon={<Store size={20} />}
          title={view.asked.text}
          actions={
            <span className={styles.waiting}>
              <Clock3 size={14} />
              Waiting · {view.asked.minutes} min
            </span>
          }
        >
          Waiting for the store. Its answer resolves the conflict or escalates it here.
        </Banner>
      ) : null}

      <section className={styles.card} aria-label="What happened">
        <div className={styles.overline}>What happened</div>
        <ol className={styles.timeline} style={{ listStyle: "none", margin: "12px 0 0", padding: 0 }}>
          {view.timeline.map((e) => (
            <li key={e.time} className={styles.event}>
              <span className={cx(styles.dot, styles[`dot_${e.kind}`])}>{EVENT_ICON[e.kind]}</span>
              <span className={styles.time}>{e.time}</span>
              <span className={styles.eventTitle}>{e.title}</span>
              <span className={styles.eventDetail}>{e.detail}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className={cx(styles.records, view.storeReport && !resolved && styles.records3)}>
        <section className={styles.record} aria-label="Driver record">
          <div className={styles.overline}>{driver.heading}</div>
          <div className={styles.recordBody}>
            <div className={styles.photo}>
              <Camera size={24} />
              {driver.photo}
            </div>
            <dl className={styles.facts}>
              <dt>Status</dt>
              <dd>
                <Chip tone="success" pill icon={<Check size={13} />}>
                  {driver.status}
                </Chip>
              </dd>
              <dt>Received by</dt>
              <dd>{driver.receivedBy}</dd>
              <dt>Units</dt>
              <dd>
                <Mono>{driver.units}</Mono>
              </dd>
              <dt>Device time</dt>
              <dd>
                <Mono>{driver.deviceTime}</Mono>
              </dd>
            </dl>
          </div>
        </section>
        <section className={cx(styles.record, styles.dispatch, resolved && styles.dim)} aria-label="Dispatch record">
          <div className={styles.overline}>{d.heading}</div>
          <dl className={styles.facts}>
            <dt>Status</dt>
            <dd>
              <Chip tone="dashed" pill icon={<Redo2 size={13} />}>
                {d.status}
              </Chip>
            </dd>
            <dt>Decided</dt>
            <dd>
              <Mono>{d.decided}</Mono>
            </dd>
            <dt>Reason</dt>
            <dd>{d.reason}</dd>
            <dt>Reached the driver?</dt>
            <dd>
              <span className={styles.bad}>
                <X size={16} />
                {d.reached}
              </span>
            </dd>
          </dl>
        </section>
        {view.storeReport && !resolved && (
          <section className={cx(styles.record, styles.storeRecord)} aria-label="Store report">
            <div className={styles.overline}>{view.storeReport.heading}</div>
            <div className={styles.tags}>
              <Chip tone="danger" pill icon={<CircleAlert size={13} />}>
                {view.storeReport.tags[0] ?? "Issue"}
              </Chip>
              <Chip tone="signal" small>
                {view.storeReport.tags[1] ?? "Short"}
              </Chip>
            </div>
            <div className={styles.reportLine}>{view.storeReport.text}</div>
            <div className={cx(styles.photo, styles.photoSmall)}>
              <Camera size={20} />
            </div>
          </section>
        )}
      </div>

      {resolved && view.resolved ? (
        <section className={cx(styles.card, styles.knows)} aria-label="Who already knows">
          <h2>
            <Info size={20} />
            Who already knows
          </h2>
          {view.resolved.whoKnows.map((k) => (
            <div key={k.who} className={styles.knowRow}>
              <Check size={16} />
              <b>{k.who}</b>
              <span>{k.what}</span>
            </div>
          ))}
        </section>
      ) : (
        <section className={cx(styles.recommend, awaiting && styles.recommendPaused)} aria-label="Recommendation">
          <div className={styles.recommendTitle}>
            <Info size={20} />
            {rec.title}
            {rec.chip && (
              <Chip tone="warning" pill icon={<TriangleAlert size={13} />}>
                {rec.chip}
              </Chip>
            )}
          </div>
          <ol className={styles.reasons} style={{ margin: 0, padding: 0 }}>
            {rec.reasons.map((r, i) => (
              <li key={r}>
                <span className={styles.reasonNo}>{i + 1}</span>
                {r}
              </li>
            ))}
          </ol>
          <div className={styles.outcome}>{rec.outcome}</div>
          {rec.pausedNote && <div className={styles.paused}>{rec.pausedNote}</div>}
        </section>
      )}

      {failed && (
        <Banner tone="danger" icon={<CircleAlert size={20} />} title="That didn't go through">
          {failed} Nothing was changed.
        </Banner>
      )}

      <div className={styles.actions}>
        {resolved ? (
          <Btn variant="secondary" iconRight={<ArrowRight size={16} />} onClick={onBack}>
            Back to live
          </Btn>
        ) : awaiting ? (
          <>
            <span className={styles.actionNote}>You can still decide without the store.</span>
            <Btn variant="secondary" icon={<Check size={16} />} disabled={busy} onClick={() => onResolve(rec.choice)}>
              Confirm anyway
            </Btn>
          </>
        ) : (
          <>
            {reported ? (
              <Btn variant="secondary" icon={<Phone size={16} />} onClick={onCall}>
                Call store
              </Btn>
            ) : (
              <Btn variant="secondary" icon={<Store size={16} />} disabled={busy} onClick={onAsk}>
                Review with store first
              </Btn>
            )}
            <Btn icon={<Check size={16} />} disabled={busy} onClick={() => onResolve(rec.choice)}>
              {reported ? "Confirm: keep as Partial" : "Confirm: keep delivery"}
            </Btn>
          </>
        )}
      </div>
    </>
  );
}
