import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CSSProperties, ReactNode } from 'react';
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  Flag,
  Info,
  Lock,
  Package,
  Redo2,
  RefreshCw,
  Route,
  Snowflake,
  TriangleAlert,
  WifiOff,
  X,
} from 'lucide-react';
import { AppBar, PageHeader, Screen, useFrame, useGo } from '../components/shell';
import { Button, M, Meter, Skel, Tag, Toast, cx } from '../components/ui';
import { Pill } from './Live';
import './exception.css';

type Frame = 'D8.1' | 'D8.2' | 'D8.3' | 'D8.4' | 'D8.S-empty' | 'D8.S-offline' | 'D8.S-error';

const TIME: Record<Frame, string> = {
  'D8.1': '02:58',
  'D8.2': '03:00',
  'D8.3': '03:01',
  'D8.4': '03:00',
  'D8.S-empty': '02:40',
  'D8.S-offline': '03:00',
  'D8.S-error': '03:00',
};

const TRIP1_KG = 1160;
const TRIP1_M3 = 7.7;
const CAP_KG = 1040;
const CAP_M3 = 7.0;

interface Candidate {
  outlet: string;
  order: string;
  harm: string;
  kg: number;
  m3: number;
  protected?: boolean;
}

const CANDIDATES: Candidate[] = [
  { outlet: 'OUT011', order: 'ORD1014', harm: 'Served yesterday', kg: 240, m3: 1.6 },
  { outlet: 'OUT006', order: 'ORD1016', harm: 'Served yesterday', kg: 230, m3: 1.5 },
  { outlet: 'OUT005', order: 'ORD1011', harm: 'Served yesterday', kg: 260, m3: 1.7 },
  { outlet: 'OUT009', order: 'ORD1002', harm: 'Served yesterday · least surplus', kg: 210, m3: 1.4 },
  { outlet: 'OUT012', order: 'ORD1001', harm: 'Deferred yesterday', kg: 220, m3: 1.5, protected: true },
];

function Label({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span className="x-label" style={style}>
      {children}
    </span>
  );
}

function HeldTag({ replaced }: { replaced?: boolean }) {
  return (
    <Tag tone="danger" small icon={<Lock size={13} />} className="x-tag">
      {replaced ? 'Replaced' : 'Held'}
    </Tag>
  );
}

/* ---------- Swap card ---------- */
function SwapCard({ loading, wide, replaced }: { loading?: boolean; wide?: boolean; replaced?: boolean }) {
  return (
    <section className={cx('x-card x-swap', wide && 'is-wide')} aria-label="Vehicle swap">
      <div className="x-swap__side">
        <Label>Failed</Label>
        <span className="wp-row" style={{ gap: 8 }}>
          <M w={500} style={{ fontSize: 20, color: 'var(--ink-muted)' }}>
            VEH003
          </M>
          <HeldTag replaced={replaced} />
        </span>
        <span className="muted" style={{ fontSize: 13 }}>
          Truck · reefer · 5,510 kg · 26.4 m³
        </span>
        <span style={{ fontSize: 12, color: 'var(--danger)' }}>Reefer not holding temperature</span>
      </div>
      <ArrowRight size={20} className="x-swap__arrow" />
      <div className="x-swap__side">
        <Label>Replacement</Label>
        {loading ? (
          <>
            <Skel w={160} h={20} />
            <Skel w={220} h={10} />
            <Skel w={120} h={20} />
          </>
        ) : (
          <>
            <span className="wp-row" style={{ gap: 8 }}>
              <M w={600} style={{ fontSize: 20 }}>
                VEH036
              </M>
              <Tag tone="chilled" small icon={<Snowflake size={13} />} className="x-tag">
                Reefer
              </Tag>
            </span>
            <span style={{ fontSize: 13 }}>Van · reefer · 1,040 kg · 7.0 m³</span>
            <Pill kind="delivered">Available since 02:45</Pill>
          </>
        )}
      </div>
    </section>
  );
}

function BeforePanel({ loading }: { loading?: boolean }) {
  return (
    <section className="x-card x-before" aria-label="VEH036 trip 1 before the change">
      <Label>VEH036 Trip 1 · before the change</Label>
      {loading ? (
        <div className="wp-col" style={{ gap: 12, marginTop: 4 }} aria-hidden="true">
          <Skel w={380} h={8} />
          <Skel w={380} h={8} />
          <Skel w={300} h={8} />
          <Skel w={380} h={8} />
        </div>
      ) : (
        <>
          <div className="x-meterhead">
            <Package size={16} />
            <span>Weight</span>
            <M style={{ marginLeft: 'auto', color: 'var(--danger)', fontSize: 14 }}>1,160 / 1,040 kg</M>
          </div>
          <Meter value={TRIP1_KG} max={CAP_KG} height={8} />
          <span className="x-state is-bad">
            <CircleAlert size={14} />
            Over by 120 kg, defer one order or swap vehicle
          </span>
          <div className="x-meterhead">
            <Package size={16} />
            <span>Volume</span>
            <M style={{ marginLeft: 'auto', color: 'var(--danger)', fontSize: 14 }}>7.7 / 7.0 m³</M>
          </div>
          <Meter value={TRIP1_M3} max={CAP_M3} height={8} />
          <span className="x-state is-bad">
            <CircleAlert size={14} />
            Over by 0.7 m³
          </span>
          <span className="x-state is-good">
            <Check size={14} />
            Trip 2 fits: 340 kg · 3.3 m³
          </span>
        </>
      )}
    </section>
  );
}

/* ---------- Recommendation ---------- */
function Recommendation() {
  return (
    <section className="x-reco" aria-label="Recommendation">
      <div className="wp-row" style={{ gap: 10 }}>
        <Info size={20} style={{ color: 'var(--route)', flexShrink: 0 }} />
        <h2 className="x-h2">Recommended: defer ORD1002 (OUT009)</h2>
        <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>
          Deferral type: policy: other reefers could legally carry it but are full
        </span>
      </div>
      <div className="wp-row" style={{ gap: 12, alignItems: 'flex-start' }}>
        <div className="x-defcard">
          <div className="wp-row" style={{ gap: 6 }}>
            <Tag tone="fresh" small className="x-tag">
              <span className="x-sq" />
              Fresh
            </Tag>
            <Tag tone="chilled" small icon={<Snowflake size={13} />} className="x-tag">
              Chilled
            </Tag>
            <M style={{ fontSize: 13 }}>ORD1002</M>
            <span className="x-defpill">
              <Redo2 size={14} />
              Deferred · policy → Wed
            </span>
          </div>
          <b style={{ fontSize: 16, fontWeight: 600 }}>OUT009: chilled order</b>
          <div className="x-facts">
            <div className="wp-col">
              <Label>Reason</Label>
              <span style={{ fontSize: 14 }}>Vehicle unavailable</span>
              <span className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Least surplus of the four equal-harm orders
              </span>
            </div>
            <div className="wp-col">
              <Label>Decided by</Label>
              <span style={{ fontSize: 14 }}>Recommended · 03:00</span>
            </div>
            <div className="wp-col">
              <Label>Store told</Label>
              <span className="muted" style={{ fontSize: 14 }}>
                Sent when you confirm
              </span>
            </div>
          </div>
          <div className="wp-row" style={{ gap: 20, fontSize: 13 }}>
            <span className="wp-row" style={{ gap: 6 }}>
              <Label>Harm</Label>
              Served yesterday, not skipped before
            </span>
            <span className="wp-row" style={{ gap: 6 }}>
              <Label>Capacity freed</Label>
              210 kg / 1.4 m³
            </span>
          </div>
        </div>
        <div className="x-protected">
          <Label>Protected</Label>
          <span className="wp-row" style={{ gap: 8 }}>
            <M style={{ fontSize: 13 }}>OUT012 · ORD1001</M>
            <Tag tone="outline-ink" small icon={<Lock size={13} />} className="x-tag">
              Protected
            </Tag>
          </span>
          <span className="muted" style={{ fontSize: 12 }}>
            Deferred yesterday: can't be skipped twice.
          </span>
        </div>
      </div>
    </section>
  );
}

function AfterPanel() {
  return (
    <section className="x-card x-after" aria-label="VEH036 after the change">
      <div className="wp-col" style={{ gap: 8 }}>
        <Label>VEH036 after the change</Label>
        <div className="wp-row" style={{ gap: 20, alignItems: 'flex-start' }}>
          <div className="x-mini">
            <span className="x-mini__head">
              <b>Weight</b>
              <M>950 / 1,040 kg</M>
            </span>
            <Meter value={950} max={1040} height={8} tone="near" />
            <span className="x-state is-warn">
              <TriangleAlert size={14} />
              91%: little room left
            </span>
          </div>
          <div className="x-mini">
            <span className="x-mini__head">
              <b>Volume</b>
              <M>6.3 / 7.0 m³</M>
            </span>
            <Meter value={6.3} max={7} height={8} tone="near" />
            <span className="x-state is-warn">
              <TriangleAlert size={14} />
              90%: full van
            </span>
          </div>
        </div>
        <div className="wp-row" style={{ gap: 16, alignItems: 'flex-start' }}>
          {[
            ['Trip 1', '109 min'],
            ['Trip 2', '06:09 → OUT004 07:42'],
            ['Fresh', '218 / 270 min'],
            ['Fuel', '29.0 / 480 L'],
          ].map(([k, v]) => (
            <span key={k} className="wp-col" style={{ gap: 2 }}>
              <Label>{k}</Label>
              <M style={{ fontSize: 13 }}>{v}</M>
            </span>
          ))}
        </div>
      </div>
      <div className="wp-col" style={{ gap: 6, marginLeft: 'auto' }}>
        <Label>Trip 1 stops</Label>
        <span className="wp-row" style={{ gap: 6 }}>
          {['OUT011', 'OUT006', 'OUT005', 'OUT012'].map((o, i) => (
            <span key={o} className="wp-row" style={{ gap: 6 }}>
              {i > 0 && <ChevronRight size={16} />}
              <M style={{ fontSize: 13 }}>{o}</M>
            </span>
          ))}
        </span>
        <span className="muted" style={{ fontSize: 12 }}>
          OUT012 reached 05:04 · waits to 05:30
        </span>
      </div>
    </section>
  );
}

/* ---------- Manual (D8.3) ---------- */
function Manual({ picked, setPicked }: { picked: string[]; setPicked: (p: string[]) => void }) {
  const chosen = CANDIDATES.filter((c) => picked.includes(c.outlet) && !c.protected);
  const freedKg = chosen.reduce((s, c) => s + c.kg, 0);
  const freedM3 = chosen.reduce((s, c) => s + c.m3, 0);
  const overKg = TRIP1_KG - freedKg - CAP_KG;
  const overM3 = +(TRIP1_M3 - freedM3 - CAP_M3).toFixed(1);
  const fits = overKg <= 0 && overM3 <= 0;

  const toggle = (c: Candidate) => setPicked(picked.includes(c.outlet) ? picked.filter((p) => p !== c.outlet) : [...picked, c.outlet]);

  return (
    <section className={cx('x-card x-manual', fits && 'is-fits')} aria-label="Choose orders to defer">
      <div className={cx('x-gap', fits ? 'is-good' : 'is-bad')} role="status">
        {fits ? <Check size={20} /> : <CircleAlert size={20} />}
        <b>
          {fits
            ? `Fits: ${(TRIP1_KG - freedKg).toLocaleString('en-US')} / 1,040 kg · ${(TRIP1_M3 - freedM3).toFixed(1)} / 7.0 m³`
            : `Still over by ${Math.max(0, overKg)} kg / ${Math.max(0, overM3).toFixed(1)} m³, pick orders to defer`}
        </b>
        <span className="muted" style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 400 }}>
          Turns green when Trip 1 fits
        </span>
      </div>
      {CANDIDATES.map((c) => {
        const on = picked.includes(c.outlet);
        const bad = on && c.protected;
        return (
          <div key={c.outlet} className={cx('x-cand', bad && 'is-refused')}>
            <label className="x-cand__row">
              <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(c)} />
              <span className={cx('x-box', on && !bad && 'is-on', bad && 'is-bad')}>
                {bad ? <X size={14} strokeWidth={3} /> : on ? <Check size={14} strokeWidth={3} /> : null}
              </span>
              <M style={{ fontSize: 13 }}>
                {c.outlet} · {c.order}
              </M>
              <span className="muted" style={{ fontSize: 12 }}>
                Harm: {c.harm}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 12 }}>
                Frees {c.kg} kg / {c.m3} m³
              </span>
              {c.protected && (
                <span className="wp-row" style={{ gap: 4, color: 'var(--danger)', fontSize: 13, fontWeight: 600, marginLeft: 12 }}>
                  <Lock size={14} />
                  Protected
                </span>
              )}
            </label>
            {bad && (
              <div className="x-refusal" role="alert">
                <Lock size={16} />
                OUT012 is protected: deferred yesterday. Pick another order.
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function WhoKnows() {
  const rows = [
    ['Peliyagoda dock', "'Plan changed v3 → v4, review' · 03:00"],
    ['VEH036 driver', 'New trip on phone · 03:00'],
    ['OUT009', 'Deferral notice · 03:00 · not yet seen'],
    ['Deferrals', 'Now 20 (1 capacity · 19 policy)'],
  ];
  return (
    <section className="x-card x-who" aria-label="Who already knows">
      <div className="wp-row" style={{ gap: 10 }}>
        <Info size={20} style={{ color: 'var(--route)' }} />
        <h2 className="x-h2">Who already knows</h2>
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
export default function Exception() {
  const [frame, setFrame] = useFrame<Frame>('D8.1');
  const go = useGo();
  const [picked, setPicked] = useState<string[]>(['OUT012']);
  const offline = frame === 'D8.S-offline';
  const confirmed = frame === 'D8.4';
  const [params] = useSearchParams();
  const auto = params.get('auto') === '1';

  // Arriving from the Live inbox, the options are worked out in the background.
  useEffect(() => {
    if (!auto || frame !== 'D8.1') return;
    const t = window.setTimeout(() => setFrame('D8.2'), 1800);
    return () => window.clearTimeout(t);
  }, [auto, frame, setFrame]);

  const bar = (
    <AppBar
      current="live"
      deferrals={confirmed ? 20 : 19}
      time={TIME[frame]}
      context="Tue 29 Sep · Peliyagoda"
      syncLabel="Live sync"
      offline={offline}
      offlineQuiet
    />
  );

  if (frame === 'D8.S-empty') {
    return (
      <Screen bar={bar}>
        <div className="wp-col" style={{ gap: 22 }}>
          <PageHeader overline="LIVE › LOADING EXCEPTIONS" title="Loading exceptions" />
          <div className="x-card x-empty">
            <span className="x-empty__tile">
              <Check size={24} />
            </span>
            <h2 style={{ fontSize: 22, fontWeight: 600 }}>No open loading exceptions</h2>
            <p className="muted" style={{ fontSize: 15 }}>
              Loaders at both docks can flag a problem from their load list.
            </p>
            <Button variant="ghost" iconRight={<ArrowRight size={16} />} onClick={() => go('/live', 'D6.8')} style={{ fontWeight: 600, marginTop: 8 }}>
              Back to live
            </Button>
          </div>
        </div>
      </Screen>
    );
  }

  const minutes = frame === 'D8.1' ? 32 : 30;
  const headerActions = confirmed ? (
    <span className="wp-row" style={{ gap: 16 }}>
      <Tag tone="outline-ink" small className="x-tag">
        Replaced
      </Tag>
      <Tag tone="info" pill small icon={<Route size={14} />} className="x-pilltag">
        Plan v4 · 03:00
      </Tag>
    </span>
  ) : (
    <span className="wp-row" style={{ gap: 16 }}>
      <HeldTag />
      <M style={{ color: 'var(--danger)', fontSize: 14 }}>{minutes} min to departure</M>
    </span>
  );

  const conn = offline ? (
    <div className="wp-connbar" role="status" style={{ height: 38 }}>
      <WifiOff size={18} />
      <span>
        <b style={{ fontWeight: 700, fontSize: 14 }}>Offline.</b>&nbsp;&nbsp;
        <span style={{ fontWeight: 400, fontSize: 14 }}>Can't confirm while offline: VEH003 stays Held.</span>
      </span>
      <M style={{ marginLeft: 'auto', color: 'var(--on-chrome-muted)', fontSize: 12, fontWeight: 400 }}>Last sync 03:00</M>
    </div>
  ) : undefined;

  let banner: ReactNode = null;
  if (frame === 'D8.1') {
    banner = (
      <div className="x-alert x-alert--danger" role="status">
        <Flag size={20} />
        <div className="x-alert__text">
          <b>Reefer not holding temperature · flagged by Priya 02:55</b>
          <span>9 orders on 2 trips stay Planned. Trip 1 departs 03:30 from the Peliyagoda dock.</span>
        </div>
      </div>
    );
  } else if (frame === 'D8.S-error') {
    banner = (
      <div className="x-alert x-alert--danger" role="alert">
        <CircleAlert size={20} />
        <div className="x-alert__text">
          <b>VEH036 is no longer available, pick another vehicle.</b>
          <span>Another dispatcher assigned it at 03:01. VEH003 stays Held.</span>
        </div>
        <Button variant="secondary" size="sm" iconRight={<ArrowRight size={16} />} onClick={() => setFrame('D8.3')}>
          Show other vehicles
        </Button>
      </div>
    );
  } else if (confirmed) {
    banner = (
      <div className="x-alert x-alert--success" role="status">
        <Check size={20} />
        <div className="x-alert__text">
          <b>Plan v4 created · VEH003 → VEH036 · ORD1002 deferred (policy)</b>
          <span>VEH036 carries 950 / 1,040 kg on Trip 1. OUT012 stays on the truck.</span>
        </div>
      </div>
    );
  }

  const chosen = CANDIDATES.filter((c) => picked.includes(c.outlet) && !c.protected);
  const manualFits = TRIP1_KG - chosen.reduce((s, c) => s + c.kg, 0) <= CAP_KG && TRIP1_M3 - chosen.reduce((s, c) => s + c.m3, 0) <= CAP_M3 + 1e-9;
  const manualBlocked = !manualFits || picked.includes('OUT012');

  let actions: ReactNode = null;
  if (confirmed) {
    actions = (
      <Button variant="secondary" iconRight={<ArrowRight size={16} />} onClick={() => go('/live', 'D6.1')} style={{ fontWeight: 600 }}>
        Back to live
      </Button>
    );
  } else if (frame === 'D8.3') {
    actions = (
      <>
        <Button variant="ghost" onClick={() => setFrame('D8.2')} style={{ fontWeight: 600 }}>
          Back to recommendation
        </Button>
        {manualBlocked && (
          <span className="muted" style={{ fontSize: 13, alignSelf: 'center' }}>
            Pick an order that frees at least 120 kg
          </span>
        )}
        <Button disabled={manualBlocked} onClick={() => setFrame('D8.4')} style={{ fontWeight: 700 }}>
          Confirm my choice
        </Button>
      </>
    );
  } else if (frame !== 'D8.1') {
    actions = (
      <>
        {offline && (
          <span className="muted" style={{ fontSize: 13, alignSelf: 'center' }}>
            Reconnect to confirm · or call the dock
          </span>
        )}
        <Button variant="secondary" onClick={() => setFrame('D8.3')} style={{ fontWeight: 600 }}>
          Adjust manually
        </Button>
        <Button icon={<Check size={16} />} disabled={offline || frame === 'D8.S-error'} onClick={() => setFrame('D8.4')} style={{ fontWeight: 700 }}>
          Confirm: defer ORD1002, load VEH036
        </Button>
      </>
    );
  }

  return (
    <Screen
      bar={bar}
      conn={conn}
      toast={confirmed ? <Toast icon={<Check size={16} style={{ color: 'var(--signal)' }} />}>Plan v4 released. Loader asked to acknowledge.</Toast> : undefined}
    >
      <div className="wp-col" style={{ gap: 22 }}>
        <PageHeader
          overline="LIVE › LOADING EXCEPTION · FLAGGED BY PRIYA 02:55"
          title={confirmed ? 'VEH003 replaced by VEH036, plan v4' : 'VEH003 held: replace it before 03:30'}
          actions={headerActions}
        />
        <div className="wp-col" style={{ gap: 14 }}>
          {banner}
          {confirmed ? (
            <SwapCard wide replaced />
          ) : (
            <div className="wp-row" style={{ gap: 16, alignItems: 'flex-start' }}>
              <SwapCard loading={frame === 'D8.1'} />
              <BeforePanel loading={frame === 'D8.1'} />
            </div>
          )}
          {frame === 'D8.1' && (
            <section className="x-card x-working" aria-live="polite">
              <span className="wp-row" style={{ gap: 10 }}>
                <RefreshCw size={20} className="spin" style={{ color: 'var(--route)' }} />
                <b style={{ fontSize: 16, fontWeight: 600 }}>Working out the options…</b>
              </span>
              <span style={{ fontSize: 13 }}>Checking spare reefers at Peliyagoda and which orders could wait without skipping an outlet twice.</span>
            </section>
          )}
          {frame === 'D8.3' && <Manual picked={picked} setPicked={setPicked} />}
          {confirmed && <WhoKnows />}
          {(frame === 'D8.2' || frame === 'D8.S-offline' || frame === 'D8.S-error') && <Recommendation />}
          {frame !== 'D8.1' && frame !== 'D8.3' && <AfterPanel />}
          {actions && (
            <div className="wp-row" style={{ gap: 8, justifyContent: 'flex-end' }}>
              {actions}
            </div>
          )}
        </div>
      </div>
    </Screen>
  );
}
