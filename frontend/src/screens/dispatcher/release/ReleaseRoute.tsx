import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, CircleAlert, Clock3, Info, Lock, Phone, RefreshCw, Route, WifiOff, X } from "lucide-react";
import type { AcknowledgementRow, AcknowledgementsView, PlanVersionInfo, PlanView } from "../../../api/DispatcherApi";
import { Modal } from "../../../shared/ui/Modal";
import { Mono } from "../../../shared/ui/Mono";
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
import { Checkbox } from "../ui/Checkbox";
import { Chip } from "../ui/Chip";
import { cx } from "../ui/cx";
import { Skel } from "../ui/Skel";
import { Stat } from "../ui/Stat";
import { StateBlock } from "../ui/StateBlock";
import styles from "./Release.module.css";

const DEPOT_LABEL = { peliyagoda: "Peliyagoda", kandy: "Kandy" } as const;

/** "Mon 16:05" becomes "16:05". */
const clockOf = (at: string) => at.split(" ").at(-1) ?? at;

/** D5: lock the version, then watch who has it. Before release the dispatcher checks; after, the loaders and drivers acknowledge. */
export function ReleaseRoute() {
  const { api, offline, invalidate, dataVersion } = useDispatcher();
  const navigate = useNavigate();
  const toast = useToast();
  const [depot, setDepot] = useDepot();
  const plan = useLoad(() => api.getPlan({ depot }), [depot]);
  const view = plan.data;
  const released = view?.version.state === "released";
  // Who has the version is only asked once there is a released one to ask about.
  const acks = useLoad(() => (released ? api.listAcknowledgements({}) : Promise.resolve(null)), [released, depot, dataVersion], released ? 15_000 : 0);

  const [confirming, setConfirming] = useState(false);
  const [sendNotices, setSendNotices] = useState(true);
  const [busy, setBusy] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);

  const release = async () => {
    setBusy(true);
    setReleaseError(null);
    try {
      const next = await api.releasePlan({ sendNotices });
      setConfirming(false);
      invalidate();
      toast.show(`Plan v${next.version.number} is live.`, { icon: "check" });
    } catch {
      setReleaseError("Couldn't release. Nothing was changed, the plan is still a draft.");
    } finally {
      setBusy(false);
    }
  };

  const call = (who: string) => toast.show(`Calling ${who}...`);
  const live = () => navigate(withDepot(ROUTES.live, depot));
  const ready = Boolean(view?.readyToRelease) && !offline;

  const header = (
    <PageHeader
      overline={
        view
          ? `RELEASE · PLAN v${view.version.number} ${released ? `RELEASED ${clockOf(view.version.at)}` : "DRAFT"}`
          : "RELEASE"
      }
      title={view ? (released ? `Plan v${view.version.number} is live` : `Release plan v${view.version.number}`) : "Release"}
      actions={
        released ? (
          <Btn variant="secondary" iconRight={<ArrowRight size={16} />} onClick={live}>
            Open live view
          </Btn>
        ) : (
          <Btn icon={<Lock size={16} />} disabled={!view || !ready} onClick={() => setConfirming(true)}>
            {view ? `Release plan v${view.version.number}` : "Release plan"}
          </Btn>
        )
      }
      reason={
        !released && view && !ready ? (
          <span className={styles.reasonText}>{offline ? "Release needs a connection." : "Fix the checks below to release."}</span>
        ) : undefined
      }
    >
      <Stepper current={5} depot={depot} done={released ? [1, 2, 3, 4, 5] : [1, 2, 3, 4]} />
    </PageHeader>
  );

  let body;
  if (plan.status === "loading") {
    body = (
      <>
        <div className={styles.skeletonGrid} aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={styles.skelCard}>
              <Skel w={80} h={10} />
              <Skel w={90} h={28} />
              <Skel w={140} h={10} />
            </div>
          ))}
        </div>
        <div className={styles.skelCard} aria-hidden>
          <Skel w={140} h={10} />
          <Skel w={260} h={12} />
          <Skel w={300} h={12} />
          <Skel w={220} h={12} />
        </div>
      </>
    );
  } else if (plan.status === "error" && !view) {
    body = (
      <StateBlock
        icon={<CircleAlert size={24} />}
        tone="danger"
        title="Couldn't load the plan"
        body="Nothing was changed. The plan is safe."
        action={
          <Btn variant="secondary" icon={<RefreshCw size={16} />} onClick={plan.reload}>
            Retry
          </Btn>
        }
      />
    );
  } else if (view && view.summary.orders === 0) {
    body = (
      <div className={styles.emptyCard}>
        <StateBlock icon={<Check size={24} />} tone="success" title="Nothing to release" body="There are no confirmed orders for this plan." />
        <Btn variant="secondary" onClick={() => navigate(withDepot(ROUTES.queue, depot))}>
          Go to queue
        </Btn>
      </div>
    );
  } else if (view && released) {
    body = <ReleasedBody view={view} acks={acks.data ?? null} acksError={acks.status === "error"} retry={acks.reload} onCall={call} onLive={live} depot={depot} />;
  } else if (view) {
    body = <DraftBody view={view} />;
  }

  return (
    <Screen bar={<AppBar current="plan" depot={depot} onDepot={setDepot} />} offlineNote="Offline. Release is paused until you reconnect.">
      <div className={styles.page}>
        {header}
        {body}
      </div>
      {view && (
        <Modal open={confirming} onOpenChange={(o) => !busy && setConfirming(o)} title={`Release plan v${view.version.number}?`}>
          <div className={styles.modalBody}>
            <p>
              Loaders and drivers will see v{view.version.number} and must acknowledge it. {view.summary.deferred} stores will be told their order is deferred. Trips become read-only; later changes create v
              {view.version.number + 1}.
            </p>
            <div className={styles.notices}>
              <Checkbox checked={sendNotices} onChange={setSendNotices}>
                Send {view.summary.deferred} deferral notices now
              </Checkbox>
            </div>
            {releaseError && <div className={styles.modalError}>{releaseError}</div>}
            <div className={styles.modalActions}>
              <Btn variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
                Keep editing
              </Btn>
              <Btn icon={<Lock size={16} />} onClick={() => void release()} disabled={busy}>
                Release v{view.version.number}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </Screen>
  );
}

function DraftBody({ view }: { view: PlanView }) {
  const s = view.summary;
  return (
    <>
      <div className={styles.stats}>
        <Stat sans label="Orders" value={s.orders} foot={s.byDepot.map((d) => `${DEPOT_LABEL[d.depot]} ${d.orders}`).join(" · ")} />
        <Stat sans label="Served" value={s.served} foot={`on ${s.trips} trips`} />
        <Stat sans label="Deferred" value={s.deferred} footTone="warn" footIcon={<Clock3 size={14} />} foot={`${s.capacityDeferred} capacity · ${s.policyDeferred} policy`} />
        <Stat sans label="Receivers" value={s.receivers.docks + s.receivers.drivers} foot={`${s.receivers.docks} docks · ${s.receivers.drivers} drivers`} />
      </div>
      <div className={styles.split}>
        <div className={styles.left}>
          <div className={cx(styles.card, styles.cardPad)}>
            <div className={styles.overline}>Before you release</div>
            <div className={styles.checks}>
              {view.checks.map((c) => (
                <div key={c.text} className={styles.check}>
                  <span className={c.ok ? styles.tick : styles.cross}>{c.ok ? <Check size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}</span>
                  {c.text}
                </div>
              ))}
            </div>
          </div>
          <div className={styles.card}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Depot</th>
                  <th className={styles.num}>Orders</th>
                  <th className={styles.num}>Served</th>
                  <th className={styles.num}>Deferred</th>
                  <th className={styles.num}>Receivers</th>
                </tr>
              </thead>
              <tbody>
                {s.byDepot.map((d) => (
                  <tr key={d.depot}>
                    <td>{DEPOT_LABEL[d.depot]}</td>
                    <td className={styles.num}>
                      <Mono>{d.orders}</Mono>
                    </td>
                    <td className={styles.num}>
                      <Mono>{d.served}</Mono>
                    </td>
                    <td className={styles.num}>
                      <Mono>{d.deferred}</Mono>
                    </td>
                    <td className={styles.num}>
                      <Mono>{d.receivers}</Mono>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Banner tone="info" icon={<Info size={19} />} title="After release, trips become read-only.">
            Loaders and drivers must acknowledge v{view.version.number}. Later changes happen in Live and create v{view.version.number + 1}.
          </Banner>
        </div>
        <div className={cx(styles.card, styles.history, styles.side)} style={{ width: 340, flexShrink: 0 }}>
          <div className={cx(styles.overline, styles.historyTitle)}>Version history</div>
          {view.versions.map((v) => (
            <VersionRow key={v.number} v={v} />
          ))}
        </div>
      </div>
    </>
  );
}

function VersionRow({ v, onView }: { v: PlanVersionInfo; onView?: () => void }) {
  const released = v.state === "released";
  return (
    <div className={cx(styles.version, v.current && styles.versionCurrent)}>
      <div className={styles.versionTop}>
        <b>v{v.number}</b>
        <Mono>
          <span className={styles.versionCell}>{v.at.replace(/^(\w+) (.*)$/, (_m, d: string, t: string) => (v.current && !released ? "now" : `${d} ${t}`))}</span>
        </Mono>
        {released ? (
          <Chip tone="info" small icon={<Route size={13} />}>
            Released
          </Chip>
        ) : v.current ? (
          <span className={styles.currentLabel}>
            <Route size={13} />
            Current draft
          </span>
        ) : (
          <Chip tone="neutral" small icon={<Clock3 size={13} />}>
            Draft
          </Chip>
        )}
      </div>
      <span className={styles.versionNote}>{v.scope && v.number === 3 && released ? v.scope : v.note}</span>
      {onView && <LinkButton onClick={onView}>View changes</LinkButton>}
    </div>
  );
}

function AckState({ row }: { row: AcknowledgementRow }) {
  if (row.state === "acknowledged" || row.state === "no change") {
    return (
      <Chip tone="success" pill icon={<Check size={14} />}>
        {row.at}
        {row.note ? ` · ${row.note}` : ""}
      </Chip>
    );
  }
  if (row.state === "not received") {
    return (
      <Chip tone="offline" pill icon={<WifiOff size={14} />}>
        {row.note ?? "Not received"}
      </Chip>
    );
  }
  return (
    <Chip tone="warning" pill icon={<Clock3 size={14} />}>
      Acknowledgement pending
    </Chip>
  );
}

type ReleasedProps = {
  view: PlanView;
  acks: AcknowledgementsView | null;
  acksError: boolean;
  retry: () => void;
  onCall: (who: string) => void;
  onLive: () => void;
  depot: "peliyagoda" | "kandy";
};

function ReleasedBody({ view, acks, acksError, retry, onCall, onLive, depot }: ReleasedProps) {
  const navigate = useNavigate();
  if (!acks) {
    return acksError ? (
      <Banner
        tone="danger"
        icon={<CircleAlert size={20} />}
        title="Couldn't load who has the plan"
        actions={
          <Btn variant="secondary" size="sm" icon={<RefreshCw size={15} />} onClick={retry}>
            Retry
          </Btn>
        }
      >
        The plan is released. Nothing was changed.
      </Banner>
    ) : (
      <div className={styles.skelCard} aria-hidden>
        <Skel w={160} h={10} />
        <Skel w={600} h={14} />
        <Skel w={600} h={14} />
        <Skel w={600} h={14} />
      </div>
    );
  }
  const showChanges = acks.version >= 5 || acks.acknowledged === acks.total;
  const banner = acks.banner;
  const versions = [...view.versions].sort((a, b) => b.number - a.number);
  return (
    <>
      {banner && (
        <Banner
          tone={banner.tone === "success" ? "success" : "warning"}
          icon={banner.tone === "success" ? <Check size={20} /> : banner.tone === "offline" ? <WifiOff size={20} /> : <CircleAlert size={20} />}
          title={banner.title}
          actions={
            banner.action === "call-kandy" ? (
              <Btn variant="secondary" size="sm" icon={<Phone size={15} />} onClick={() => onCall("Kandy dock")}>
                Call Kandy dock
              </Btn>
            ) : banner.action === "open-live" ? (
              <Btn variant="secondary" size="sm" iconRight={<ArrowRight size={15} />} onClick={onLive}>
                Open live view
              </Btn>
            ) : undefined
          }
        >
          {banner.text}
        </Banner>
      )}
      <div className={cx(styles.card, styles.ackCard)}>
        <div className={styles.ackHead}>
          <span className={styles.overline}>Who has plan v{acks.version}</span>
          <Mono>
            <span className={styles.reasonText}>
              {acks.acknowledged} of {acks.total} acknowledged
            </span>
          </Mono>
        </div>
        <table className={cx(styles.table, styles.ackTable)}>
          <thead>
            <tr>
              <th>Person</th>
              <th>Role</th>
              <th>Vehicle / dock</th>
              <th>Plan they have</th>
              <th>Departs in</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {acks.rows.map((r) => (
              <tr key={r.person}>
                <td>
                  <span className={styles.person}>
                    <span className={styles.avatar}>{r.person.slice(0, 1)}</span>
                    {r.person}
                  </span>
                </td>
                <td>{r.role}</td>
                <td>{r.place.startsWith("VEH") ? <Mono>{r.place}</Mono> : r.place}</td>
                <td>
                  <span className={styles.planHas}>
                    <span className={styles.versionCell}>v{r.has}</span>
                    <AckState row={r} />
                  </span>
                </td>
                <td>
                  <Mono>{r.departsIn}</Mono>
                </td>
                <td>
                  <button type="button" className={styles.callBtn} onClick={() => onCall(r.person)}>
                    <Phone size={16} />
                    Call
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={cx(styles.card, styles.history, styles.wide)}>
        <div className={cx(styles.overline, styles.historyTitle)}>Version history</div>
        {versions.map((v) => (
          <VersionRow key={v.number} v={v} {...(showChanges ? { onView: () => navigate(withDepot(`${ROUTES.trips}?version=${v.number}`, depot)) } : {})} />
        ))}
      </div>
    </>
  );
}
