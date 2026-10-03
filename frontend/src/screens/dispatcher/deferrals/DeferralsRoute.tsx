import { useMemo, useState, type ReactElement } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, CircleAlert, Info, Lock, RefreshCw, Send, TriangleAlert } from "lucide-react";
import type { DeferralCard as Card, DeferralsView } from "../../../api/DispatcherApi";
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
import { Chip } from "../ui/Chip";
import { Meter } from "../ui/Meter";
import { Skel } from "../ui/Skel";
import { StateBlock } from "../ui/StateBlock";
import { Mono } from "../../../shared/ui/Mono";
import { DeferralCard } from "./DeferralCard";
import { DetailDrawer } from "./DetailDrawer";
import styles from "./Deferrals.module.css";

const BANNER_ICON = { warning: <TriangleAlert size={19} />, info: <Info size={19} />, success: <Check size={20} /> } as const;

/** D4: forced against chosen. Every deferral says why, who decided, what the store was told and what it frees (PRD v3 section 3). */
export function DeferralsRoute() {
  const { api, offline, invalidate } = useDispatcher();
  const navigate = useNavigate();
  const toast = useToast();
  const { orderId } = useParams();
  const [params] = useSearchParams();
  const [depot, setDepot] = useDepot();
  const load = useLoad(() => api.listDeferrals({ depot }), [depot]);
  const view = load.data;
  const [open, setOpen] = useState<Set<string> | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [failed, setFailed] = useState(params.get("ui") === "notice-error");

  const all = useMemo(() => (view ? [...view.capacity, ...view.policy, ...view.storeRequest] : []), [view]);
  const released = view?.plan.state === "released";

  // The card worth reading first is open: what is new in this version, or else the first one (design fix D-5).
  const defaultOpen = useMemo(() => {
    const fromUrl = params.get("open");
    if (fromUrl) return new Set(fromUrl.split(","));
    const fresh = all.find((c) => c.newInVersion !== undefined);
    const first = all[0];
    const pick = fresh ?? first;
    return new Set(pick ? [pick.orderId] : []);
  }, [all, params]);
  const expanded = open ?? defaultOpen;
  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpen(next);
  };

  const notify = async () => {
    try {
      const { sent } = await api.notifyDeferrals({ depot });
      setFailed(false);
      invalidate();
      toast.show(`${sent} store notices sent.`, { icon: "check" });
    } catch {
      setFailed(true);
    }
  };

  const detailCard = orderId ? all.find((c) => c.orderId === orderId || c.pairedOrderIds?.includes(orderId)) : undefined;
  const openDetail = (id: string) => navigate(withDepot(`${ROUTES.deferrals}/${id}`, depot));
  const closeDetail = () => navigate(withDepot(ROUTES.deferrals, depot), { replace: true });
  const serve = (id: string) => navigate(withDepot(`${ROUTES.trips}?moveTo=${id}`, depot));

  const header = (
    <PageHeader
      overline={`DEFERRALS · ${depot.toUpperCase()}${view ? ` · PLAN v${view.plan.number}${released ? ` RELEASED ${view.plan.at}` : view.plan.at === "draft" ? " DRAFT" : ` · ${view.plan.at}`}` : ""}`}
      title={view ? (view.counts.total === 0 ? "Deferrals" : view.headline) : "Deferrals"}
      actions={
        released || !view?.canRelease ? (
          <Btn variant="secondary" iconRight={<ArrowRight size={16} />} onClick={() => navigate(ROUTES.live)}>
            Open live view
          </Btn>
        ) : (
          <>
            <Btn variant="secondary" icon={<Send size={16} />} onClick={() => void notify()} disabled={!view}>
              Notify stores
            </Btn>
            <Btn iconRight={<ArrowRight size={16} />} onClick={() => navigate(withDepot(ROUTES.release, depot))} disabled={!view}>
              Confirm and release
            </Btn>
          </>
        )
      }
      reason={!released && view?.canRelease ? <span className={styles.notifyHint}>Notices also go out automatically on release</span> : undefined}
    >
      <Stepper current={4} depot={depot} done={released ? [1, 2, 3, 4, 5] : [1, 2, 3]} />
    </PageHeader>
  );

  let body;
  if (load.status === "loading") {
    body = (
      <>
        <div className={styles.loadingLine}>
          <RefreshCw size={16} />
          Loading deferrals...
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.skelCard} aria-hidden>
            <Skel w={260} h={10} />
            <Skel w={420} h={10} />
            <Skel w={740} h={10} />
            <Skel w={400} h={10} />
          </div>
        ))}
      </>
    );
  } else if (load.status === "error" && !view) {
    body = (
      <Banner
        tone="danger"
        icon={<CircleAlert size={20} />}
        title="Couldn't load the deferrals"
        actions={
          <Btn variant="secondary" size="sm" icon={<RefreshCw size={15} />} onClick={load.reload}>
            Retry
          </Btn>
        }
      >
        Nothing was changed. The plan and its deferrals are safe.
      </Banner>
    );
  } else if (view && view.counts.total === 0) {
    body = (
      <div className={styles.emptyCard}>
        <StateBlock
          icon={<Check size={24} />}
          tone="success"
          title="No deferrals in this plan"
          body="Every confirmed order has a vehicle."
        />
        <div className={styles.facts}>
          <div>
            <span>Confirmed orders</span>
            <Mono>
              <span className={styles.num}>{view.orders}</span>
            </Mono>
          </div>
          <div>
            <span>Served</span>
            <Mono>
              <span className={styles.num}>{view.served}</span>
            </Mono>
          </div>
        </div>
        <LinkButton onClick={() => navigate(withDepot(ROUTES.release, depot))}>
          Go to release <ArrowRight size={15} style={{ verticalAlign: "-2px" }} />
        </LinkButton>
      </div>
    );
  } else if (view) {
    body = (
      <>
        <Banner tone={view.banner.tone} icon={BANNER_ICON[view.banner.tone]} title={view.banner.title}>
          {view.banner.text}
        </Banner>
        <div className={styles.layout}>
          <div className={styles.main}>
            <Groups view={view} expanded={expanded} toggle={toggle} openDetail={openDetail} serve={serve} readOnly={Boolean(released) || offline} offline={offline} failed={failed} onRetry={() => void notify()} showMore={showMore} setShowMore={setShowMore} />
          </div>
          <SideColumn view={view} />
        </div>
      </>
    );
  }

  return (
    <Screen bar={<AppBar current={released ? "deferrals" : "plan"} depot={depot} onDepot={setDepot} />} offlineNote="Offline. Store notices will send when you reconnect.">
      <div className={styles.page}>
        {header}
        {body}
      </div>
      <DetailDrawer
        open={Boolean(orderId)}
        onOpenChange={(o) => {
          if (!o) closeDetail();
        }}
        card={detailCard}
        readOnly={offline}
        onHistory={() => navigate(withDepot(`${ROUTES.queue}?order=${detailCard?.orderId ?? ""}`, depot))}
        onResend={() => toast.show(`Notice to ${detailCard?.outletId ?? "the store"} sent again.`)}
      />
    </Screen>
  );
}

type GroupsProps = {
  view: DeferralsView;
  expanded: Set<string>;
  toggle: (id: string) => void;
  openDetail: (id: string) => void;
  serve: (id: string) => void;
  readOnly: boolean;
  offline: boolean;
  failed: boolean;
  onRetry: () => void;
  showMore: boolean;
  setShowMore: (v: boolean) => void;
};

function Groups(p: GroupsProps) {
  const { view, expanded } = p;
  const card = (c: Card, withFail = false) => (
    <DeferralCard
      key={c.orderId}
      card={c}
      expanded={expanded.has(c.orderId)}
      onToggle={() => p.toggle(c.orderId)}
      onDetail={() => p.openDetail(c.orderId)}
      onServe={() => p.serve(c.orderId)}
      readOnly={p.readOnly}
      offline={p.offline}
      {...(withFail && p.failed ? { noticeFailed: { onRetry: p.onRetry } } : {})}
    />
  );
  // Consecutive collapsed cards sit in one container; an expanded card stands on its own.
  const packed = (cards: Card[], failTarget?: string) => {
    const out: ReactElement[] = [];
    let run: Card[] = [];
    const flush = () => {
      if (run.length > 0) {
        out.push(
          <div key={`run-${run[0]!.orderId}`} className={styles.group}>
            {run.map((c) => card(c))}
          </div>,
        );
        run = [];
      }
    };
    for (const c of cards) {
      if (expanded.has(c.orderId)) {
        flush();
        out.push(
          <div key={c.orderId} className={styles.group}>
            {card(c, c.orderId === failTarget)}
          </div>,
        );
      } else run.push(c);
    }
    flush();
    return out;
  };
  const failTarget = view.policy.find((c) => c.orderId === "ORD1009")?.orderId ?? view.policy[0]?.orderId;
  return (
    <>
      {view.capacity.length > 0 && (
        <>
          <h2 className={styles.heading}>Capacity: no legal vehicle ({view.capacity.length})</h2>
          {packed(view.capacity)}
        </>
      )}
      {view.storeRequest.length > 0 && (
        <>
          <h2 className={styles.heading}>Store request ({view.storeRequest.length})</h2>
          {packed(view.storeRequest)}
        </>
      )}
      {view.policy.length > 0 && (
        <>
          <h2 className={styles.heading}>Policy: chosen to absorb the shortfall ({view.counts.policy})</h2>
          {packed(view.policy, failTarget)}
          {view.policyMore > 0 && (
            <div className={styles.group}>
              <button type="button" className={styles.more} aria-expanded={p.showMore} onClick={() => p.setShowMore(!p.showMore)}>
                +{view.policyMore} more policy deferrals
                <ChevronDown size={16} />
              </button>
              {p.showMore && (
                <p className={styles.moreList}>
                  The other {view.policyMore} orders (ORD3002 to ORD3016) are deferred by policy in the same way: the planner left them out to absorb the same shortfall, and the continuity guard kept both protected outlets on their trips.
                </p>
              )}
            </div>
          )}
        </>
      )}
      {view.depot === "kandy" && (
        <div className={styles.zeroBox}>
          <div>
            <span className={styles.cellLabel}>Capacity · {view.counts.capacity}</span>
            <p>No Kandy order lacks a legal vehicle today.</p>
          </div>
          <div>
            <span className={styles.cellLabel}>Policy · {view.counts.policy}</span>
            <p>No Kandy order was chosen to wait.</p>
          </div>
        </div>
      )}
    </>
  );
}

function SideColumn({ view }: { view: DeferralsView }) {
  return (
    <div className={styles.side}>
      {view.side ? (
        <>
          <div className={styles.sideCard}>
            <span className={styles.sideTitle}>{view.side.pool.title}</span>
            <div className={styles.bigFigure}>
              <Mono>
                {view.side.pool.orders} orders · {view.side.pool.deferred} deferred
              </Mono>
            </div>
            <div className={styles.poolMeter}>
              <div className={styles.poolMeterTop}>
                <span>{view.side.pool.label}</span>
                <Mono>
                  {view.side.pool.used} / {view.side.pool.limit} · {view.side.pool.vehicleId}
                </Mono>
              </div>
              <Meter value={view.side.pool.used} max={view.side.pool.limit} tone="route" />
            </div>
          </div>
          <div className={styles.sideCard}>
            <span className={styles.sideTitle}>{view.side.driver.heading}</span>
            <div className={styles.chipRow}>
              {view.side.driver.chips.map((c) => (
                <Chip key={c.label} tone={c.tone === "live" ? "live" : "warning"} pill>
                  {c.label}
                </Chip>
              ))}
            </div>
            <span className={styles.noticeNote}>{view.side.driver.note}</span>
          </div>
        </>
      ) : (
        <>
          <div className={styles.sideCard}>
            <span className={styles.sideTitle}>
              <Lock size={16} />
              Protected · {view.protected.length}
            </span>
            {view.protected.map((p) => (
              <div key={p.orderId} className={styles.protectedRow}>
                <div className={styles.protectedTop}>
                  <Mono>
                    {p.outletId} · {p.orderId}
                  </Mono>
                  <Chip tone="outlineInk" small icon={<Lock size={12} />}>
                    Protected
                  </Chip>
                </div>
                <span className={styles.protectedText}>{p.text}</span>
              </div>
            ))}
          </div>
          <div className={styles.sideCard}>
            <span className={styles.sideTitle}>Store notices</span>
            <div className={styles.bigFigure}>
              <Mono>
                {view.notices.sent} / {view.notices.total} sent
              </Mono>
            </div>
            <span className={styles.noticeNote}>{view.notices.note}</span>
          </div>
        </>
      )}
    </div>
  );
}
