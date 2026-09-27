import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Cloud,
  History,
  Info,
  Lock,
  Redo2,
  RefreshCw,
  Send,
  Snowflake,
  TriangleAlert,
  Truck,
  UserRound,
  WifiOff,
} from 'lucide-react';
import { AppBar, PageHeader, Screen, Stepper, useFrame, useGo } from '../components/shell';
import type { Depot } from '../components/shell';
import { Button, CloseButton, Drawer, M, MockTag, Tag, cx } from '../components/ui';
import './deferrals.css';

type Frame = 'D4.1' | 'D4.2' | 'D4.3' | 'D4.4' | 'D4.5' | 'D4.S-empty' | 'D4.S-loading' | 'D4.S-offline' | 'D4.S-error';

/* ---------- Building blocks ---------- */
function FreshTag() {
  return (
    <span className="d-tag d-tag--fresh">
      <span className="d-sq" />
      Fresh
    </span>
  );
}

function ChilledTag() {
  return (
    <span className="d-tag d-tag--chilled">
      <Snowflake size={13} />
      Chilled
    </span>
  );
}

function OutlineTag({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <span className="d-tag d-tag--outline">
      {icon}
      {children}
    </span>
  );
}

export function DeferPill({ children }: { children: ReactNode }) {
  return (
    <span className="d-pill">
      <Redo2 size={14} />
      {children}
    </span>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <span className="d-label">{children}</span>;
}

interface CardProps {
  tags: ReactNode;
  ids: string;
  newTag?: boolean;
  pill: string;
  title: string;
  reason: string;
  reasonDetail?: string;
  decidedBy: string;
  storeTold: ReactNode;
  harm: string;
  freed: string;
  binding: string;
  children?: ReactNode;
  onOpen?: () => void;
}

function DeferralCard({ tags, ids, newTag, pill, title, reason, reasonDetail, decidedBy, storeTold, harm, freed, binding, children, onOpen }: CardProps) {
  return (
    <article className={cx('d-card', onOpen && 'is-clickable')} onClick={onOpen} tabIndex={onOpen ? 0 : undefined} onKeyDown={(e) => e.key === 'Enter' && onOpen?.()}>
      <div className="wp-row" style={{ gap: 6 }}>
        {tags}
        <M w={500} style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
          {ids}
        </M>
        <span style={{ flex: 1 }} />
        {newTag && <span className="d-new">New in v4</span>}
        <DeferPill>{pill}</DeferPill>
      </div>
      <h3 className="d-card__title">{title}</h3>
      <div className="d-cols">
        <div className="d-col">
          <Label>Reason</Label>
          <span className="d-val">{reason}</span>
          {reasonDetail && <span className="d-sub">{reasonDetail}</span>}
        </div>
        <div className="d-col">
          <Label>Decided by</Label>
          <span className="d-val">{decidedBy}</span>
        </div>
        <div className="d-col">
          <Label>Store told</Label>
          {storeTold}
        </div>
      </div>
      <div className="wp-row" style={{ gap: 20 }}>
        <span className="wp-row" style={{ gap: 6 }}>
          <Label>Harm</Label>
          <span style={{ fontSize: 13 }}>{harm}</span>
        </span>
        <span className="wp-row" style={{ gap: 6 }}>
          <Label>Capacity freed</Label>
          <span style={{ fontSize: 13 }}>{freed}</span>
        </span>
      </div>
      <div>
        <OutlineTag>{binding}</OutlineTag>
      </div>
      {children}
    </article>
  );
}

const notSent = <span className="d-val muted">Not sent</span>;

function Ord1020({ storeTold = notSent }: { storeTold?: ReactNode }) {
  return (
    <DeferralCard
      tags={
        <>
          <FreshTag />
          <ChilledTag />
          <OutlineTag>Van only</OutlineTag>
        </>
      }
      ids="ORD1020"
      pill="Deferred · capacity → Wed"
      title="OUT001: chilled order, 208 units"
      reason="Van-only access"
      reasonDetail="van_only and 1,250 kg; the largest Peliyagoda reefer van carries 1,040 kg; whole orders can't split."
      decidedBy="System draft · 16:05"
      storeTold={storeTold}
      harm="3 days since served"
      freed="(no legal vehicle)"
      binding="Binding: van access"
    />
  );
}

function Ord1009({ storeTold = notSent, children }: { storeTold?: ReactNode; children?: ReactNode }) {
  return (
    <DeferralCard
      tags={
        <>
          <FreshTag />
          <ChilledTag />
          <OutlineTag>Street</OutlineTag>
        </>
      }
      ids="ORD1009"
      pill="Deferred · policy → Wed"
      title="OUT014: chilled order"
      reason="Outside window"
      reasonDetail="A 5th stop on VEH003 Trip 2 would arrive 08:06; window closes 08:00."
      decidedBy="System draft · Kumari 21:15"
      storeTold={storeTold}
      harm="Served yesterday, not skipped before"
      freed="95 kg / 0.9 m³ on VEH003 Trip 2"
      binding="Binding: window"
    >
      {children}
    </DeferralCard>
  );
}

function Ord1002({ onOpen }: { onOpen?: () => void }) {
  return (
    <DeferralCard
      tags={
        <>
          <FreshTag />
          <ChilledTag />
          <OutlineTag>Rear dock</OutlineTag>
        </>
      }
      ids="ORD1002"
      newTag
      pill="Deferred · policy → Wed"
      title="OUT009: chilled order"
      reason="Vehicle unavailable"
      reasonDetail="VEH003 failed its check; replacement VEH036 is 120 kg / 0.7 m³ short on Trip 1."
      decidedBy="Kumari · 03:00"
      storeTold={<span className="d-val" style={{ color: 'var(--warning)' }}>Sent 03:00 · not yet seen</span>}
      harm="Served yesterday, not skipped before"
      freed="210 kg / 1.4 m³ on VEH036 (least surplus)"
      binding="Binding: weight / volume"
      onOpen={onOpen}
    />
  );
}

interface RowItem {
  ids: string;
  detail: string;
  status?: ReactNode;
}

function RowList({ rows, more, onMore }: { rows: RowItem[]; more: string; onMore?: () => void }) {
  return (
    <div className="d-rows">
      {rows.map((r) => (
        <div key={r.ids} className="d-row">
          <FreshTag />
          <ChilledTag />
          <M w={500} style={{ fontSize: 13 }}>
            {r.ids}
          </M>
          <span className="muted" style={{ fontSize: 12 }}>
            {r.detail}
          </span>
          <span style={{ flex: 1 }} />
          {r.status}
          <DeferPill>Deferred · policy → Wed</DeferPill>
        </div>
      ))}
      <button className="d-row d-row--more" onClick={onMore}>
        <span className="wp-link wp-row" style={{ gap: 6, fontSize: 14, fontWeight: 600 }}>
          {more}
          <ChevronDown size={16} />
        </span>
        <span style={{ flex: 1 }} />
        <MockTag />
      </button>
    </div>
  );
}

const ROW_1017 = { ids: 'ORD1017 · OUT007', detail: '5th stop would arrive 08:06 · frees 65 kg / 0.6 m³' };
const ROW_1006 = { ids: 'ORD1006 · OUT033', detail: '4th stop on VEH035 Trip 2 would arrive 08:02 · frees 130 kg / 1.1 m³' };
const ROW_1009 = { ids: 'ORD1009 · OUT014', detail: '5th stop on VEH003 Trip 2 would arrive 08:06 · frees 95 kg / 0.9 m³' };

function SidePanel({ notices }: { notices: { value: string; note: string } }) {
  return (
    <aside className="d-side">
      <section className="d-panel">
        <span className="wp-row" style={{ gap: 8 }}>
          <Lock size={16} />
          <Label>Protected · 2</Label>
        </span>
        {[
          ['OUT012 · ORD1001'],
          ['OUT029 · ORD1005'],
        ].map(([id]) => (
          <div key={id} className="wp-col" style={{ gap: 4, paddingTop: 10 }}>
            <div className="wp-row" style={{ justifyContent: 'space-between' }}>
              <M w={500} style={{ fontSize: 13 }}>
                {id}
              </M>
              <OutlineTag icon={<Lock size={13} />}>Protected</OutlineTag>
            </div>
            <span className="muted" style={{ fontSize: 12 }}>
              Deferred yesterday: protected by the continuity guard
            </span>
          </div>
        ))}
      </section>
      <section className="d-panel" style={{ gap: 8 }}>
        <Label>Store notices</Label>
        <M w={600} style={{ fontSize: 22 }}>
          {notices.value}
        </M>
        <span className="muted" style={{ fontSize: 12 }}>
          {notices.note}
        </span>
      </section>
    </aside>
  );
}

function ForcedAlert({ count, policy }: { count: number; policy: number }) {
  return (
    <div className="d-alert d-alert--warning">
      <TriangleAlert size={20} />
      <div className="wp-col" style={{ flex: 1, gap: 2 }}>
        <b style={{ fontSize: 14, fontWeight: 600 }}>Capacity forces {count} deferrals at Peliyagoda.</b>
        <span style={{ fontSize: 13, lineHeight: '18px' }}>1 has no legal vehicle; policy chose the other {policy}. Each one below says why.</span>
      </div>
      <OutlineTag>Mock data</OutlineTag>
    </div>
  );
}

/* ---------- D4.2 drawer ---------- */
function DetailDrawer({ onClose, onHistory }: { onClose: () => void; onHistory: () => void }) {
  const others: Array<[string, string, ReactNode]> = [
    ['OUT012 · ORD1001', 'Deferred yesterday: skipping again isn’t allowed', <OutlineTag icon={<Lock size={13} />}>Protected</OutlineTag>],
    ['OUT005 · ORD1011', 'Frees 260 kg: more surplus than needed', <OutlineTag>Mock data</OutlineTag>],
    ['OUT006 · ORD1016', 'Frees 230 kg: more surplus than needed', <OutlineTag>Mock data</OutlineTag>],
  ];
  return (
    <Drawer onClose={onClose} label="Deferral detail ORD1002">
      <div className="d-drawer">
        <div className="wp-row" style={{ justifyContent: 'space-between' }}>
          <DeferPill>Deferred · policy → Wed</DeferPill>
          <CloseButton onClick={onClose} label="Close deferral detail" />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 8 }}>ORD1002 · OUT009</h2>
        <div className="wp-row" style={{ gap: 6 }}>
          <FreshTag />
          <ChilledTag />
          <OutlineTag>Rear dock</OutlineTag>
          <M style={{ fontSize: 12, color: 'var(--ink-muted)' }}>04:00–07:45 · 210 kg · 1.4 m³</M>
        </div>
        <div className="wp-divider" style={{ margin: '12px 0 8px' }} />
        <div className="d-grid">
          <div className="d-col">
            <Label>Type</Label>
            <OutlineTag>Policy: a legal vehicle exists</OutlineTag>
          </div>
          <div className="d-col">
            <Label>Binding</Label>
            <OutlineTag>Binding: weight / volume</OutlineTag>
          </div>
          <div className="d-col">
            <Label>Harm</Label>
            <span className="d-val">Served yesterday, not skipped before.</span>
          </div>
          <div className="d-col">
            <Label>Capacity freed</Label>
            <M w={600} style={{ fontSize: 14 }}>
              210 kg / 1.4 m³
            </M>
          </div>
          <div className="d-col">
            <Label>Next run</Label>
            <M style={{ fontSize: 14 }}>Wed 30 Sep · from 04:00</M>
          </div>
          <div className="d-col">
            <Label>Store told</Label>
            <span className="wp-row" style={{ gap: 6, color: 'var(--warning)', fontSize: 14 }}>
              <Clock3 size={16} />
              Sent 03:00 · not yet seen
            </span>
          </div>
        </div>
        <div className="wp-divider" style={{ margin: '12px 0' }} />
        <Label>Why not the others</Label>
        <div className="wp-col" style={{ gap: 8, marginTop: 8 }}>
          {others.map(([id, why, tag]) => (
            <div key={id} className="d-other">
              <M w={500} style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                {id}
              </M>
              <span className="muted" style={{ fontSize: 12, flex: 1, lineHeight: 1.1 }}>
                {why}
              </span>
              {tag}
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div className="wp-divider" />
        <span className="wp-row muted" style={{ gap: 8, fontSize: 13, padding: '10px 0' }}>
          <UserRound size={16} />
          Decided by Kumari · plan v4 · 03:00
        </span>
        <div className="wp-row" style={{ gap: 16 }}>
          <Button variant="ghost" icon={<History size={16} />} onClick={onHistory} style={{ fontWeight: 600 }}>
            Open order history
          </Button>
          <Button variant="secondary" icon={<Send size={16} />} style={{ fontWeight: 600 }}>
            Resend notice
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

/* ---------- D4.4 Kandy store request ---------- */
function KandyStoreRequest() {
  return (
    <>
      <div className="d-alert d-alert--info">
        <Info size={20} />
        <div className="wp-col" style={{ flex: 1, gap: 2 }}>
          <b style={{ fontSize: 14, fontWeight: 600 }}>0 deferrals forced by capacity at Kandy. 2 at store request.</b>
          <span style={{ fontSize: 13, lineHeight: '18px' }}>Kandy has enough capacity today, these two wait only because OUT084 asked.</span>
        </div>
      </div>
      <div className="d-layout">
        <div className="d-main">
          <h2 className="d-group">Store request (2)</h2>
          <DeferralCard
            tags={
              <>
                <FreshTag />
                <ChilledTag />
                <span className="d-tag d-tag--ambient">Ambient</span>
              </>
            }
            ids="ORD2001 · ORD2002"
            pill="Deferred · store request → Wed"
            title="OUT084 · Waypoint Fresh: chilled 12 units + dry 8 units"
            reason="Other · store request"
            reasonDetail="Receiving staff unavailable today (Anusha phoned 05:20)."
            decidedBy="Kumari · 05:21 · plan v5"
            storeTold={<span className="d-val" style={{ color: 'var(--success)' }}>✓ Seen 05:22 (Mock)</span>}
            harm="1 day since served"
            freed="115 kg / 1.3 m³ on VEH039 Trip 1"
            binding="Binding: none: store asked"
          >
            <div className="d-offline-strip">
              <WifiOff size={16} />
              VEH039 offline since 05:17, change not yet received by the driver. The truck may still deliver.
            </div>
          </DeferralCard>
          <section className="d-panel" style={{ gap: 8 }}>
            <Label>Capacity · 0</Label>
            <span className="muted" style={{ fontSize: 13 }}>
              No Kandy order lacks a legal vehicle today.
            </span>
            <div className="wp-divider" />
            <Label>Policy · 0</Label>
            <span className="muted" style={{ fontSize: 13 }}>
              No Kandy order was chosen to wait.
            </span>
          </section>
        </div>
        <aside className="d-side">
          <section className="d-panel">
            <Label>Kandy pool · Tue 29 Sep</Label>
            <M w={600} style={{ fontSize: 18 }}>
              64 orders · 2 deferred
            </M>
            <div className="wp-col" style={{ gap: 6 }}>
              <div className="wp-row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
                <b style={{ fontWeight: 600 }}>Reefer Fresh minutes</b>
                <M w={500}>73 / 270 · VEH039</M>
              </div>
              <span className="d-meter">
                <span style={{ width: '27%' }} />
              </span>
            </div>
          </section>
          <section className="d-panel" style={{ gap: 8 }}>
            <Label>VEH039 · Nimal</Label>
            <div className="wp-row" style={{ gap: 6 }}>
              <Tag tone="live" pill icon={<Truck size={14} />} style={{ height: 24, padding: '0 8px' }}>
                Departed 05:10
              </Tag>
              <Tag tone="warning" icon={<Clock3 size={13} />}>
                Plan v4 on device
              </Tag>
            </div>
            <span className="muted" style={{ fontSize: 12 }}>
              Last heard 05:17 · known coverage gap on the Kandy corridor
            </span>
          </section>
        </aside>
      </div>
    </>
  );
}

/* ---------- Screen ---------- */
export default function Deferrals() {
  const loc = useLocation();
  const fromNav = loc.pathname === '/deferrals';
  const [frame, setFrame] = useFrame<Frame>(fromNav ? 'D4.5' : 'D4.1');
  const go = useGo();

  const v4 = frame === 'D4.2' || frame === 'D4.3';
  const kandy = frame === 'D4.4';
  const allNotified = frame === 'D4.5';
  const offline = frame === 'D4.S-offline';
  const state = frame === 'D4.S-empty' || frame === 'D4.S-loading';
  const navCurrent = kandy || allNotified ? 'deferrals' : 'plan';

  const count = frame === 'D4.S-empty' ? 0 : kandy ? 2 : v4 ? 20 : 19;
  const time = kandy ? '05:22' : v4 ? '03:02' : allNotified ? '23:58' : frame.startsWith('D4.S') ? '23:30' : '23:32';
  const context = kandy ? 'Tue 29 Sep · Kandy' : v4 ? 'Tue 29 Sep · Peliyagoda' : 'Mon 28 Sep · Peliyagoda';
  const onDepot = (d: Depot) => setFrame(d === 'Kandy' ? 'D4.4' : 'D4.1');

  const bar = (
    <AppBar
      current={navCurrent}
      deferrals={count}
      time={time}
      context={context}
      depot={kandy ? 'Kandy' : 'Peliyagoda'}
      onDepot={onDepot}
      syncLabel="Live sync"
      offline={offline}
      offlineQuiet
    />
  );

  const overline = kandy
    ? 'DEFERRALS · KANDY · PLAN v5 · 05:21'
    : v4
      ? 'DEFERRALS · PELIYAGODA · PLAN v4 · 03:00'
      : allNotified
        ? 'DEFERRALS · PELIYAGODA · PLAN v3 RELEASED 23:40'
        : 'DEFERRALS · PELIYAGODA · PLAN v3 DRAFT';
  const title = kandy
    ? '2 orders wait for Wed 30 Sep'
    : v4
      ? '20 orders wait for Wed 30 Sep'
      : allNotified
        ? '19 orders wait: every store has been told'
        : state
          ? 'Deferrals'
          : '19 orders wait for Wed 30 Sep';

  const released = kandy || allNotified;
  const actions = released ? (
    <Button variant="secondary" iconRight={<ArrowRight size={16} />} onClick={() => go('/live', kandy ? 'D6.4' : 'D6.1')}>
      Open live view
    </Button>
  ) : (
    <>
      {!state && (
        <Button variant="secondary" icon={<Send size={16} />} onClick={() => setFrame('D4.5')}>
          Notify stores
        </Button>
      )}
      <Button iconRight={<ArrowRight size={16} />} disabled={frame === 'D4.S-loading'} onClick={() => go('/plan/release', 'D5.1')} style={{ fontWeight: 700 }}>
        Confirm and release
      </Button>
    </>
  );

  let body: ReactNode;
  if (kandy) {
    body = <KandyStoreRequest />;
  } else if (frame === 'D4.S-empty') {
    body = (
      <div className="wp-card wp-card--flat d-empty">
        <div className="wp-state__tile is-success" style={{ borderRadius: 12 }}>
          <Check size={24} />
        </div>
        <b style={{ fontSize: 22, fontWeight: 600 }}>No deferrals in this plan</b>
        <span className="muted" style={{ fontSize: 15 }}>
          Every confirmed order has a vehicle.
        </span>
        <div className="t-facts">
          <div>
            <span>Confirmed orders</span>
            <M w={500}>212</M>
          </div>
          <div>
            <span>Served</span>
            <M w={500}>212</M>
          </div>
        </div>
        <Button variant="ghost" iconRight={<ArrowRight size={16} />} onClick={() => go('/plan/release', 'D5.1')} style={{ fontWeight: 600, padding: '0 16px' }}>
          Go to release
        </Button>
      </div>
    );
  } else if (frame === 'D4.S-loading') {
    body = (
      <div className="wp-col" style={{ gap: 20 }}>
        <span className="wp-loading-caption" style={{ fontSize: 14, fontWeight: 500 }}>
          <RefreshCw size={16} className="spin" />
          Loading deferrals…
        </span>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="d-skel">
            {[260, 420, 700, 360].map((w, k) => (
              <span key={k} className="t-bar" style={{ width: w }} />
            ))}
          </div>
        ))}
      </div>
    );
  } else {
    const queued = (
      <span className="d-queued">
        <Cloud size={14} />
        Queued · sends on reconnect
      </span>
    );
    const errorAlert = (
      <div className="d-inline-error">
        <CircleAlert size={18} />
        <span style={{ flex: 1 }}>Notice to OUT014 failed, the deferral is saved.</span>
        <Button variant="secondary" size="xs" icon={<RefreshCw size={13} />} onClick={() => setFrame('D4.1')}>
          Retry
        </Button>
      </div>
    );
    const seen = (t: string) => <span className="d-val" style={{ color: 'var(--success)' }}>✓ Seen {t}</span>;

    body = (
      <>
        {allNotified ? (
          <div className="d-alert d-alert--success">
            <Check size={20} />
            <div className="wp-col" style={{ flex: 1, gap: 2 }}>
              <b style={{ fontSize: 14, fontWeight: 600 }}>19 notices sent at 23:41 · 12 seen so far.</b>
              <span style={{ fontSize: 13, lineHeight: '18px' }}>Stores that haven't opened Waypoint will see the notice next time they do.</span>
            </div>
            <OutlineTag>Mock data</OutlineTag>
          </div>
        ) : (
          <ForcedAlert count={v4 ? 20 : 19} policy={v4 ? 19 : 18} />
        )}
        <div className="d-layout">
          <div className="d-main">
            <h2 className="d-group">Capacity: no legal vehicle (1)</h2>
            <Ord1020 storeTold={allNotified ? seen('23:52') : offline ? queued : notSent} />
            <h2 className="d-group">Policy: chosen to absorb the shortfall ({v4 ? 19 : 18})</h2>
            {v4 ? (
              <>
                <Ord1002 onOpen={() => setFrame('D4.2')} />
                <RowList rows={[ROW_1009, ROW_1017, ROW_1006]} more="+15 more policy deferrals" />
              </>
            ) : (
              <>
                <Ord1009
                  storeTold={allNotified ? <span className="d-val muted">Sent 23:41 · not yet seen</span> : offline ? queued : notSent}
                >
                  {allNotified && (
                    <span className="wp-row muted" style={{ gap: 6, fontSize: 12 }}>
                      <RefreshCw size={14} />
                      First send failed 23:41 · resent 23:43
                    </span>
                  )}
                  {frame === 'D4.S-error' && errorAlert}
                </Ord1009>
                <RowList
                  rows={
                    frame === 'D4.S-offline' || frame === 'D4.S-error'
                      ? [ROW_1017]
                      : allNotified
                        ? [
                            {
                              ...ROW_1017,
                              status: (
                                <span className="wp-row" style={{ gap: 6, fontSize: 12, color: 'var(--success)' }}>
                                  <Check size={14} />
                                  Seen 23:47
                                </span>
                              ),
                            },
                            {
                              ...ROW_1006,
                              status: (
                                <span className="wp-row muted" style={{ gap: 6, fontSize: 12 }}>
                                  <Clock3 size={14} />
                                  Sent · not yet seen
                                </span>
                              ),
                            },
                          ]
                        : [ROW_1017, ROW_1006]
                  }
                  more={frame === 'D4.S-offline' || frame === 'D4.S-error' ? '+16 more policy deferrals' : '+15 more policy deferrals'}
                />
              </>
            )}
          </div>
          <SidePanel
            notices={
              v4
                ? { value: '19 / 20 sent', note: 'ORD1002 notice sent 03:00, not yet seen by OUT009.' }
                : allNotified
                  ? { value: '19 / 19 sent', note: '12 seen · 7 not yet seen, they’ll see it on next open.' }
                  : { value: '0 / 19 sent', note: 'Notices go out when you release, or now with Notify stores.' }
            }
          />
        </div>
      </>
    );
  }

  return (
    <Screen
      dense
      bar={bar}
      conn={
        offline ? (
          <div className="wp-connbar" role="status" style={{ height: 38 }}>
            <WifiOff size={17} />
            <span>
              <b style={{ fontWeight: 700 }}>Offline.</b>&nbsp;&nbsp;<span style={{ fontWeight: 500 }}>2 store notices will send when you reconnect.</span>
            </span>
            <M style={{ marginLeft: 'auto', color: 'var(--on-chrome-muted)', fontSize: 12 }}>Last sync 23:28</M>
          </div>
        ) : undefined
      }
    >
      <div className="wp-col" style={{ gap: 14 }}>
        <PageHeader overline={overline} title={title} actions={actions}>
          <Stepper current={4} done={released ? [1, 2, 3, 4, 5] : [1, 2, 3]} />
        </PageHeader>
        {body}
      </div>
      {frame === 'D4.2' && <DetailDrawer onClose={() => setFrame('D4.3')} onHistory={() => go('/plan/queue', 'D1.5')} />}
    </Screen>
  );
}
