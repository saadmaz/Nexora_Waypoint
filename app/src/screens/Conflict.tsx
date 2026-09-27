import type { CSSProperties, ReactNode } from 'react';
import {
  ArrowRight,
  Camera,
  Check,
  CircleAlert,
  Clock3,
  Info,
  Phone,
  Redo2,
  RefreshCw,
  Store,
  TriangleAlert,
  WifiOff,
  X,
} from 'lucide-react';
import { AppBar, PageHeader, Screen, useFrame, useGo } from '../components/shell';
import { Button, M, Skel, Tag, Toast, cx } from '../components/ui';
import { Pill } from './Live';
import './conflict.css';

type Frame = 'D7.1' | 'D7.2' | 'D7.3' | 'D7.4' | 'D7.S-empty' | 'D7.S-loading' | 'D7.S-offline' | 'D7.S-error';

const TIME: Record<Frame, string> = {
  'D7.1': '06:44',
  'D7.2': '06:46',
  'D7.3': '07:05',
  'D7.4': '06:44',
  'D7.S-empty': '07:40',
  'D7.S-loading': '06:44',
  'D7.S-offline': '06:44',
  'D7.S-error': '06:44',
};

function Label({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span className="c-label" style={style}>
      {children}
    </span>
  );
}

/* ---------- Timeline ---------- */
const EVENTS: Array<{ time: string; title: string; note: string; dot: string; icon: ReactNode }> = [
  { time: '05:17', title: 'Driver offline', note: 'Kandy corridor coverage gap', dot: 'offline', icon: <WifiOff size={14} /> },
  { time: '05:21', title: 'Dispatch deferred · v5', note: 'Store asked by phone at 05:20', dot: 'deferred', icon: <Redo2 size={14} /> },
  { time: '05:26', title: 'Arrived · waiting', note: 'Window opens 05:30', dot: 'success', icon: <Clock3 size={14} /> },
  { time: '05:42', title: 'Delivered', note: '12 + 8 units · S. Fernando', dot: 'success', icon: <Check size={14} /> },
  { time: '06:40', title: 'Synced', note: 'Records disagree → conflict', dot: 'now', icon: <RefreshCw size={14} /> },
];

function Timeline() {
  return (
    <section className="c-card c-timeline" aria-label="What happened">
      <Label>What happened</Label>
      <ol className="c-events">
        {EVENTS.map((e, i) => (
          <li key={e.time} className="c-event">
            <span className="wp-row">
              <span className={cx('c-dot', `c-dot--${e.dot}`)}>{e.icon}</span>
              {i < EVENTS.length - 1 && <span className="c-line" />}
            </span>
            <M w={600} style={{ fontSize: 14 }}>
              {e.time}
            </M>
            <b className="c-event__title">{e.title}</b>
            <span className="c-event__note">{e.note}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ---------- Records ---------- */
function Field({ label, width, children }: { label: string; width: number; children: ReactNode }) {
  return (
    <div className="wp-row" style={{ gap: 8 }}>
      <Label style={{ width, flexShrink: 0 }}>{label}</Label>
      {children}
    </div>
  );
}

function DriverRecord() {
  return (
    <div className="c-card c-record">
      <span className="c-record__title">DRIVER RECORD · VEH039 · NIMAL</span>
      <div className="wp-row" style={{ gap: 16, alignItems: 'flex-start' }}>
        <div className="c-photo" role="img" aria-label="Proof-of-delivery photo taken 05:42">
          <Camera size={28} />
          <span>POD photo 05:42</span>
        </div>
        <div className="wp-col" style={{ gap: 8 }}>
          <Field label="Status" width={130}>
            <Pill kind="delivered">Delivered 05:42</Pill>
          </Field>
          <Field label="Received by" width={130}>
            <span style={{ fontSize: 14 }}>S. Fernando (night staff)</span>
          </Field>
          <Field label="Units" width={130}>
            <M w={500} style={{ fontSize: 14 }}>
              12 + 8
            </M>
          </Field>
          <Field label="Device time" width={130}>
            <M style={{ fontSize: 14 }}>05:42</M>
          </Field>
        </div>
      </div>
    </div>
  );
}

function DispatchRecord({ faded }: { faded?: boolean }) {
  return (
    <div className={cx('c-card c-record c-record--dispatch', faded && 'is-faded')}>
      <span className="c-record__title">DISPATCH RECORD · KUMARI</span>
      <div className="wp-col" style={{ gap: 8 }}>
        <Field label="Status" width={160}>
          <Pill kind="deferred">Deferred · store request → Wed</Pill>
        </Field>
        <Field label="Decided" width={160}>
          <M style={{ fontSize: 14 }}>05:21 · plan v5</M>
        </Field>
        <Field label="Reason" width={160}>
          <span style={{ fontSize: 14 }}>Receiving staff unavailable</span>
        </Field>
        <Field label="Reached the driver?" width={160}>
          <span className="wp-row" style={{ gap: 6, color: 'var(--danger)', fontSize: 14, fontWeight: 600 }}>
            <X size={16} />
            No: offline since 05:17
          </span>
        </Field>
      </div>
    </div>
  );
}

function StoreReport() {
  return (
    <div className="c-card c-record c-record--store">
      <span className="c-record__title" style={{ color: 'var(--danger)' }}>
        STORE REPORT · ANUSHA
      </span>
      <span className="wp-row" style={{ gap: 6 }}>
        <Tag tone="danger" pill small icon={<CircleAlert size={14} />} className="c-pill">
          Issue
        </Tag>
        <Tag tone="danger" small className="c-tag">
          Short
        </Tag>
      </span>
      <b style={{ fontSize: 14, fontWeight: 600 }}>ORD2001 · 10 of 12 units</b>
      <div className="c-photo c-photo--sm" role="img" aria-label="Store photo">
        <Camera size={20} />
      </div>
    </div>
  );
}

/* ---------- Recommendation ---------- */
function Recommendation({ variant }: { variant: 'keep' | 'paused' | 'partial' }) {
  const reasons =
    variant === 'partial'
      ? [
          'The goods are physically at the store, with proof: photo, receiver and units.',
          'The deferral never reached the driver; he was offline from 05:17.',
          'The store confirms goods arrived, 2 units short: Partial matches the evidence.',
        ]
      : [
          'The goods are physically at the store, with proof: photo, receiver and units.',
          'The deferral never reached the driver; he was offline from 05:17.',
          'Reversing would mean a return trip for goods already received.',
        ];
  const paused = variant === 'paused';
  return (
    <section className={cx('c-reco', paused && 'is-paused')} aria-label="Recommendation">
      <div className="wp-row" style={{ gap: 10 }}>
        <Info size={20} className="c-reco__icon" />
        <h2 className="c-reco__title">{variant === 'partial' ? 'Recommended: Keep delivery as Partial (10 / 12)' : 'Recommended: Keep delivery'}</h2>
        {variant === 'partial' && (
          <Tag tone="warning" pill small icon={<TriangleAlert size={14} />} className="c-pill">
            Partial
          </Tag>
        )}
      </div>
      <ol className="c-reasons">
        {reasons.map((r, i) => (
          <li key={r}>
            <span className="c-num">{i + 1}</span>
            {r}
          </li>
        ))}
      </ol>
      <span className="c-consequence">
        {variant === 'partial'
          ? 'Status becomes Partial · follow-up created for 2 units · Wed re-run removed · all three records kept.'
          : 'Status becomes Delivered · tag Deferral withdrawn · Wed re-run removed · both records kept in the audit.'}
      </span>
      {paused && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)' }}>Paused until the store answers</span>}
    </section>
  );
}

function WhoKnows() {
  const rows = [
    ['Nimal', "Route notice 'OUT084: resolved: delivered' · 06:44"],
    ['Anusha', 'Deliveries updated: Delivered 05:42 + Deferral withdrawn · 06:44'],
    ['Kandy dock', "Wed re-run removed from tomorrow's queue · 06:44"],
  ];
  return (
    <section className="c-card c-who" aria-label="Who already knows">
      <div className="wp-row" style={{ gap: 10 }}>
        <Info size={20} style={{ color: 'var(--route)' }} />
        <h2 className="c-reco__title">Who already knows</h2>
      </div>
      {rows.map(([who, what]) => (
        <div key={who} className="wp-row" style={{ gap: 10 }}>
          <Check size={16} style={{ color: 'var(--success)' }} />
          <b style={{ fontSize: 14, fontWeight: 600 }}>{who}</b>
          <span className="muted" style={{ fontSize: 13 }}>
            {what}
          </span>
        </div>
      ))}
    </section>
  );
}

/* ---------- Screen ---------- */
export default function Conflict() {
  const [frame, setFrame] = useFrame<Frame>('D7.1');
  const go = useGo();
  const offline = frame === 'D7.S-offline';
  const resolved = frame === 'D7.4';
  const listView = frame === 'D7.S-empty' || frame === 'D7.S-loading';

  const bar = (
    <AppBar
      current="live"
      deferrals={resolved ? 0 : 2}
      time={TIME[frame]}
      context="Tue 29 Sep · Kandy"
      depot="Kandy"
      kandyFirst
      syncLabel="Live sync"
      offline={offline}
      offlineQuiet
    />
  );

  const conn = offline ? (
    <div className="wp-connbar" role="status" style={{ height: 38 }}>
      <WifiOff size={18} />
      <span>
        <b style={{ fontWeight: 700, fontSize: 14 }}>Offline.</b>&nbsp;&nbsp;
        <span style={{ fontWeight: 400, fontSize: 14 }}>Can't confirm while offline, your decision is not saved yet.</span>
      </span>
      <M style={{ marginLeft: 'auto', color: 'var(--on-chrome-muted)', fontSize: 12, fontWeight: 400 }}>Last sync 06:43</M>
    </div>
  ) : undefined;

  if (listView) {
    return (
      <Screen bar={bar}>
        <div className="wp-col" style={{ gap: 22 }}>
          <PageHeader overline="LIVE › CONFLICTS" title="Reconciliation" />
          {frame === 'D7.S-empty' ? (
            <div className="c-card c-empty">
              <span className="c-empty__tile">
                <Check size={24} />
              </span>
              <h2 style={{ fontSize: 22, fontWeight: 600 }}>No conflicts to reconcile</h2>
              <p className="muted" style={{ fontSize: 15 }}>
                Every synced record matches the current plan.
              </p>
              <Button variant="ghost" iconRight={<ArrowRight size={16} />} onClick={() => go('/live', 'D6.8')} style={{ fontWeight: 600, marginTop: 8 }}>
                Back to live
              </Button>
            </div>
          ) : (
            <div className="wp-col" style={{ gap: 16 }}>
              <div className="wp-row" style={{ gap: 8, fontSize: 14, color: 'var(--ink-muted)', fontWeight: 500, marginTop: -6 }}>
                <RefreshCw size={16} className="spin" style={{ color: 'var(--route)' }} />
                Loading both records…
              </div>
              <div className="c-card" style={{ padding: '16px 20px', gap: 12 }} aria-hidden="true">
                <Skel w={120} />
                <Skel w="100%" h={26} />
              </div>
              <div className="c-records" aria-hidden="true">
                {[false, true].map((dashed) => (
                  <div key={String(dashed)} className={cx('c-card c-record', dashed && 'c-record--dispatch')} style={{ gap: 12 }}>
                    <Skel w={220} />
                    <Skel w={150} h={110} />
                    <Skel w={300} />
                    <Skel w={260} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Screen>
    );
  }

  const statusPill = resolved ? (
    <span className="wp-row" style={{ gap: 6 }}>
      <Pill kind="delivered">Delivered</Pill>
      <Tag tone="outline" small className="c-tag">
        Deferral withdrawn
      </Tag>
    </span>
  ) : (
    <Pill kind="conflict">Conflict · needs a decision</Pill>
  );

  let banner: ReactNode = null;
  if (frame === 'D7.2') {
    banner = (
      <div className="c-alert c-alert--info" role="status">
        <Store size={20} />
        <div className="c-alert__text">
          <b>Asked OUT084 at 06:45: 'Did you receive this delivery?'</b>
          <span>Waiting for Anusha. Her answer resolves the conflict or escalates it here.</span>
        </div>
        <button className="c-waiting" onClick={() => setFrame('D7.3')} title="Simulate the store's answer">
          <Clock3 size={14} />
          Waiting · 1 min
        </button>
      </div>
    );
  } else if (frame === 'D7.3') {
    banner = (
      <div className="c-alert c-alert--danger" role="alert">
        <CircleAlert size={20} />
        <div className="c-alert__text">
          <b>OUT084 reported a shortage at 07:04.</b>
          <span>ORD2001 received 10 of 12 units (Mock). Photo attached.</span>
        </div>
      </div>
    );
  } else if (resolved) {
    banner = (
      <div className="c-alert c-alert--success" role="status">
        <Check size={20} />
        <div className="c-alert__text">
          <b>Resolved by Kumari 06:44, kept delivery.</b>
          <span>Both records and this decision are kept. Wed 30 Sep re-run removed.</span>
        </div>
      </div>
    );
  } else if (frame === 'D7.S-error') {
    banner = (
      <div className="c-alert c-alert--danger" role="alert">
        <CircleAlert size={20} />
        <div className="c-alert__text">
          <b>Resolution not saved: both records still stand.</b>
          <span>Nothing changed for the driver or the store.</span>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={16} />} onClick={() => setFrame('D7.4')}>
          Try again
        </Button>
      </div>
    );
  }

  const confirm = (label: string) => (
    <Button icon={<Check size={16} />} onClick={() => setFrame('D7.4')} disabled={offline} title={offline ? 'Reconnect to confirm' : undefined} style={{ fontWeight: 700 }}>
      {label}
    </Button>
  );

  let actions: ReactNode;
  if (resolved) {
    actions = (
      <Button variant="secondary" iconRight={<ArrowRight size={16} />} onClick={() => go('/live', 'D6.6')} style={{ fontWeight: 600 }}>
        Back to live
      </Button>
    );
  } else if (frame === 'D7.2') {
    actions = (
      <>
        <span className="muted" style={{ fontSize: 13 }}>
          You can still decide without the store.
        </span>
        <Button variant="secondary" icon={<Check size={16} />} onClick={() => setFrame('D7.4')} style={{ fontWeight: 600 }}>
          Confirm anyway
        </Button>
      </>
    );
  } else if (frame === 'D7.3') {
    actions = (
      <>
        <Button variant="secondary" icon={<Phone size={16} />} style={{ fontWeight: 600 }}>
          Call store
        </Button>
        {confirm('Confirm: keep as Partial')}
      </>
    );
  } else {
    actions = (
      <>
        {offline && (
          <span className="muted" style={{ fontSize: 13 }}>
            Reconnect to confirm
          </span>
        )}
        <Button variant="secondary" icon={<Store size={16} />} onClick={() => setFrame('D7.2')} style={{ fontWeight: 600 }}>
          Review with store first
        </Button>
        {confirm('Confirm: keep delivery')}
      </>
    );
  }

  return (
    <Screen bar={bar} conn={conn} toast={resolved ? <Toast icon={<Check size={16} style={{ color: 'var(--success)' }} />}>Conflict resolved. Driver and store told.</Toast> : undefined}>
      <div className="wp-col" style={{ gap: 22 }}>
        <PageHeader overline="LIVE › CONFLICT · OUT084 · WAYPOINT FRESH · KANDY" title="Two records for ORD2001 + ORD2002" actions={statusPill} />
        <div className="wp-col" style={{ gap: frame === 'D7.2' || frame === 'D7.3' || frame === 'D7.S-error' ? 12 : 16 }}>
          {banner}
          <Timeline />
          <div className="c-records">
            <DriverRecord />
            <DispatchRecord faded={resolved} />
            {frame === 'D7.3' && <StoreReport />}
          </div>
          {resolved ? <WhoKnows /> : <Recommendation variant={frame === 'D7.3' ? 'partial' : frame === 'D7.2' ? 'paused' : 'keep'} />}
          <div className="wp-row" style={{ gap: 8, justifyContent: 'flex-end', alignItems: 'flex-start' }}>
            {actions}
          </div>
        </div>
      </div>
    </Screen>
  );
}
