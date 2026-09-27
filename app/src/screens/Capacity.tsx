import type { ReactNode } from 'react';
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Box,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Eye,
  Fuel,
  Info,
  Lock,
  Package,
  RefreshCw,
  Snowflake,
  Split,
  Timer,
  TriangleAlert,
  Truck,
  Van,
  Weight,
  Wrench,
} from 'lucide-react';
import { AppBar, ConnectivityBar, PageHeader, Screen, Stepper, useFrame, useGo } from '../components/shell';
import type { Depot } from '../components/shell';
import { Alert, Button, M, Meter, MockTag, Skel, StateBlock, Tag, cx } from '../components/ui';
import './capacity.css';

type Frame = 'D2.1' | 'D2.2' | 'D2.3' | 'D2.4' | 'D2.S-empty' | 'D2.S-loading' | 'D2.S-offline' | 'D2.S-error';

function CapStat({ label, value, foot, bad, mock }: { label: string; value: string; foot: ReactNode; bad?: boolean; mock?: boolean }) {
  return (
    <div className="wp-card wp-stat wp-stat--stack">
      <div className="wp-stat__label">{label}</div>
      <div className="wp-stat__row">
        <div className="wp-stat__value" style={{ color: bad ? 'var(--danger)' : undefined, fontSize: 30 }}>
          {value}
        </div>
        {mock && <MockTag />}
      </div>
      <div className={cx('wp-stat__foot is-mono', bad && 'is-bad')}>
        {bad && <CircleAlert size={14} />}
        {foot}
      </div>
    </div>
  );
}

function CapStats({ spare }: { spare?: boolean }) {
  return (
    <div className="wp-stats">
      <CapStat label="Reefer Fresh minutes" value="120%" foot="430 min short" bad mock />
      <CapStat label="Reefers available" value={spare ? '9 / 9' : '8 / 9'} foot={spare ? 'VEH036 is spare' : 'VEH036 in workshop until 02:45'} />
      <CapStat label="Vehicles available" value="34 / 38" foot="4 in workshop" />
      <CapStat label="Deferrals" value="19" foot="1 capacity · 18 policy" />
    </div>
  );
}

function ForcedAlert({ onReview, snapshot }: { onReview?: () => void; snapshot?: boolean }) {
  return (
    <Alert
      tone="warning"
      icon={<TriangleAlert size={19} />}
      style={{ minHeight: snapshot ? 58 : 64 }}
      title={
        snapshot ? (
          <>
            Capacity forces <M w={400}>19</M> deferrals at Peliyagoda. <M w={400}>1</M> has no legal vehicle; policy chose the other <M w={400}>18</M>.
          </>
        ) : (
          <>
            Capacity forces <M w={400}>19</M> deferrals at Peliyagoda.
          </>
        )
      }
      actions={
        snapshot ? (
          <Tag tone="warning-outline" icon={<Lock size={13} />} style={{ background: 'transparent' }}>
            Released snapshot
          </Tag>
        ) : (
          <>
            <MockTag />
            <Button variant="warning-outline" size="sm" onClick={onReview}>
              Review deferrals
            </Button>
          </>
        )
      }
    >
      {!snapshot && (
        <>
          <M>1</M> has no legal vehicle; policy chose the other <M>18</M>.
        </>
      )}
    </Alert>
  );
}

function BindingCard({ snapshot, compact, minHeight }: { snapshot?: 'plain' | 'lock'; compact?: boolean; minHeight?: number }) {
  return (
    <div className={cx('c-binding', compact && 'is-compact')} style={{ minHeight }}>
      <div className="wp-row" style={{ justifyContent: 'space-between' }}>
        <div className="wp-row" style={{ gap: 10 }}>
          <Tag tone="signal" style={{ height: 26, padding: '0 9px' }}>
            BINDING
          </Tag>
          <Snowflake size={19} color="var(--chilled)" />
          <h2 className="c-binding__title">Reefer Fresh minutes</h2>
        </div>
        <div className="wp-row" style={{ gap: 8 }}>
          {snapshot && (
            <Tag tone="neutral" icon={snapshot === 'lock' ? <Lock size={12} /> : undefined} style={{ padding: '0 8px' }}>
              Released plan snapshot
            </Tag>
          )}
          <span className="c-util">120%</span>
        </div>
      </div>
      <M style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Demand 2,590 vs supply 2,160 (8 available reefers × 270 min)</M>
      <M w={600} style={{ fontSize: compact ? 28 : 30, color: 'var(--danger)' }}>
        2,590 / 2,160 min
      </M>
      <div className="wp-col" style={{ gap: 3 }}>
        <Meter value={2590} max={2160} height={compact ? 14 : 16} />
        <M w={600} style={{ fontSize: 12, color: 'var(--ink-muted)', paddingLeft: 'calc(83.4% - 26px)' }}>
          100%
        </M>
      </div>
      <div className="c-danger-line">
        <CircleAlert size={compact ? 16 : 17} />
        Over by 430 min, policy will choose which orders wait
      </div>
    </div>
  );
}

function SampleCards({ recorded }: { recorded?: boolean }) {
  return (
    <div className="c-samples">
      <div className="wp-card c-sample">
        <div className="wp-row" style={{ justifyContent: 'space-between' }}>
          <div className="wp-row" style={{ gap: 9 }}>
            <Wrench size={18} />
            <b style={{ fontSize: 15 }}>Style+Tech minutes</b>
          </div>
          <Tag tone="neutral" className="mono">
            VEH011
          </Tag>
        </div>
        <M w={600} style={{ fontSize: 24 }}>
          83 / 480 min
        </M>
        <Meter value={83} max={480} />
        {recorded && <span className="muted" style={{ fontSize: 12 }}>Recorded in released plan</span>}
      </div>
      <div className="wp-card c-sample">
        <div className="wp-row" style={{ justifyContent: 'space-between' }}>
          <div className="wp-row" style={{ gap: 9 }}>
            <Fuel size={18} />
            <b style={{ fontSize: 15 }}>Fuel</b>
          </div>
          <Tag tone="neutral" className="mono">
            VEH003
          </Tag>
        </div>
        <span className="muted" style={{ fontSize: 12 }}>
          This week incl. tonight
        </span>
        <M w={600} style={{ fontSize: 24 }}>
          74.2 / 480 L
        </M>
        <Meter value={74.2} max={480} />
        {recorded && <span className="muted" style={{ fontSize: 12 }}>Recorded in released plan</span>}
      </div>
    </div>
  );
}

function KandyPool({ released, short }: { released?: boolean; short?: boolean }) {
  return (
    <aside className="wp-card c-side" style={short ? { gap: 10, padding: 17 } : undefined}>
      <div className="wp-row" style={{ justifyContent: 'space-between' }}>
        <span className="wp-label">Kandy pool (separate)</span>
        {released ? <Lock size={14} color="var(--ink-muted)" /> : !short && <MockTag />}
      </div>
      <M w={600} style={{ fontSize: short ? 20 : 21, whiteSpace: 'nowrap' }}>
        64 orders · 0 deferred
      </M>
      <Tag pill tone="success" icon={<CircleCheck size={15} />} style={{ height: 28, fontWeight: 700, alignSelf: 'flex-start' }}>
        Enough capacity
      </Tag>
      <p className="muted" style={{ fontSize: short ? 12 : 14, lineHeight: 1.45 }}>
        Refrigeration and van access are requirements, not priorities.
      </p>
      {!short && (
        <>
          <div className="wp-divider" />
          <div className="c-note">
            <Split size={18} />
            Not pooled with Peliyagoda
          </div>
        </>
      )}
      {released && (
        <div className="c-released-line">
          <Archive size={16} />
          Included in released plan v3
        </div>
      )}
    </aside>
  );
}

/* ---------- D2.2 Kandy ---------- */
function KandyView({ onPeliyagoda }: { onPeliyagoda: () => void }) {
  const meters: Array<[ReactNode, string, string, number, number]> = [
    [<Weight size={16} />, 'Weight', '170 / 6,180 kg', 170, 6180],
    [<Box size={16} />, 'Volume', '1.9 / 29.9 m³', 1.9, 29.9],
    [<Timer size={16} />, 'Fresh minutes', '73 / 270 min', 73, 270],
    [<Fuel size={16} />, 'Fuel', '75.4 / 370 L', 75.4, 370],
  ];
  const fleet: Array<[ReactNode, string, number, boolean]> = [
    [<Snowflake size={15} />, 'Reefer trucks', 5, true],
    [<Package size={15} />, 'Dry-box trucks', 13, false],
    [<Snowflake size={15} />, 'Reefer vans', 2, true],
    [<Van size={15} />, 'Ambient vans', 2, false],
  ];
  return (
    <>
      <Alert
        tone="success"
        icon={<CircleCheck size={19} />}
        style={{ minHeight: 58 }}
        title={
          <>
            Kandy has enough capacity for Tue 29 Sep. <M w={600}>64</M> orders, <M w={600}>0</M> deferrals.
          </>
        }
        actions={<MockTag />}
      />
      <div className="c-main">
        <div className="wp-col" style={{ flex: 1, gap: 12, minWidth: 0 }}>
          <div className="wp-card c-sample" style={{ gap: 11, padding: 20 }}>
            <div className="wp-row" style={{ justifyContent: 'space-between' }}>
              <div className="wp-row" style={{ gap: 9 }}>
                <Snowflake size={19} color="var(--chilled)" />
                <h2 className="c-binding__title">Reefer Fresh minutes</h2>
              </div>
              <Tag pill tone="success" icon={<CircleCheck size={15} />} style={{ height: 28, fontWeight: 700 }}>
                Within supply
              </Tag>
            </div>
            <span className="muted" style={{ fontSize: 13 }}>
              Planned fresh-delivery minutes remain comfortably inside the Kandy reefer pool.
            </span>
            <Meter value={62} max={100} height={14} tone="route" />
            <span className="wp-row" style={{ gap: 7, color: 'var(--success)', fontSize: 12, fontWeight: 600 }}>
              <Check size={14} />
              Healthy headroom for planned demand
            </span>
          </div>
          <div className="wp-card c-sample" style={{ gap: 16, padding: 20 }}>
            <div className="wp-row" style={{ justifyContent: 'space-between' }}>
              <div className="wp-row" style={{ gap: 10 }}>
                <Truck size={19} />
                <b style={{ fontSize: 18 }}>VEH039 · Reefer truck · Run 1</b>
              </div>
              <Tag tone="chilled" icon={<Snowflake size={14} />} style={{ height: 26, padding: '0 9px', fontWeight: 700 }}>
                Reefer
              </Tag>
            </div>
            <M w={500} style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
              VEH039 · Fresh 73 / 270 min · fuel 75.4 / 370 L
            </M>
            <div className="wp-divider" />
            <div className="wp-col" style={{ gap: 16 }}>
              {meters.map(([icon, label, value, v, max]) => (
                <div key={label} className="wp-col" style={{ gap: 8 }}>
                  <div className="wp-row" style={{ justifyContent: 'space-between' }}>
                    <span className="wp-row" style={{ gap: 7, fontSize: 13, fontWeight: 700 }}>
                      {icon}
                      {label}
                    </span>
                    <M w={600} style={{ fontSize: 13 }}>
                      {value}
                    </M>
                  </div>
                  <Meter value={v} max={max} tone="route" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <aside className="wp-card c-side">
          <div className="wp-row" style={{ justifyContent: 'space-between' }}>
            <b style={{ fontSize: 19 }}>Kandy fleet</b>
            <MockTag />
          </div>
          <div className="wp-col" style={{ gap: 5 }}>
            <M w={600} style={{ fontSize: 30 }}>
              22 vehicles
            </M>
            <span className="muted" style={{ fontSize: 13 }}>
              Available pool by body and temperature class
            </span>
          </div>
          <div className="wp-divider" />
          <div className="wp-col">
            {fleet.map(([icon, label, n, chilled]) => (
              <div key={label} className="c-fleet-row">
                <span className="wp-row" style={{ gap: 10 }}>
                  <span className={cx('c-fleet-icon', chilled && 'is-chilled')}>{icon}</span>
                  <b style={{ fontSize: 14, fontWeight: 600 }}>{label}</b>
                </span>
                <M w={700} style={{ fontSize: 16 }}>
                  {n}
                </M>
              </div>
            ))}
          </div>
          <div className="c-note">
            <Split size={18} />
            Dedicated Kandy vehicle pool
          </div>
        </aside>
      </div>
      <Alert
        tone="info"
        icon={<Info size={19} />}
        style={{ minHeight: 56 }}
        title={
          <span style={{ fontWeight: 600 }}>
            Peliyagoda is short <M w={400}>430</M> reefer minutes, pools don't share vehicles.
          </span>
        }
        actions={
          <Button variant="ghost" size="sm" onClick={onPeliyagoda}>
            Switch to Peliyagoda
          </Button>
        }
      />
    </>
  );
}

/* ---------- D2.3 spare reefer ---------- */
function SpareCard() {
  return (
    <div className="c-spare">
      <div className="wp-row" style={{ justifyContent: 'space-between' }}>
        <div className="wp-row" style={{ gap: 9 }}>
          <Truck size={19} />
          <b style={{ fontSize: 18 }}>VEH036 · Reefer van</b>
        </div>
        <Lock size={15} color="var(--ink-muted)" />
      </div>
      <div className="wp-row" style={{ gap: 7 }}>
        <Tag tone="info" style={{ background: 'transparent', borderColor: 'var(--route)', fontWeight: 700 }}>
          Spare
        </Tag>
        <Tag tone="chilled" icon={<Snowflake size={13} />} style={{ fontWeight: 700 }}>
          Chilled
        </Tag>
      </div>
      <M style={{ fontSize: 12, lineHeight: 1.4 }}>Spare · 1,040 kg · 7.0 m³ · not on any trip</M>
      <div className="wp-col" style={{ gap: 10 }}>
        {[
          ['Payload', '0 / 1,040 kg'],
          ['Volume', '0 / 7.0 m³'],
        ].map(([l, v]) => (
          <div key={l} className="wp-col" style={{ gap: 5 }}>
            <div className="wp-row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
              <span className="muted" style={{ fontWeight: 600 }}>
                {l}
              </span>
              <M w={600}>{v}</M>
            </div>
            <Meter value={0} max={1} />
          </div>
        ))}
      </div>
      <span className="wp-row" style={{ gap: 7, color: 'var(--route)', fontSize: 12, fontWeight: 600 }}>
        <Info size={14} />
        Available now · no released trip changed
      </span>
    </div>
  );
}

/* ---------- Loading ---------- */
function LoadingView() {
  return (
    <div className="wp-col" style={{ gap: 12, flex: 1 }}>
      <div className="wp-loading-caption" style={{ height: 28 }}>
        <RefreshCw size={17} className="spin" />
        Calculating supply vs demand…
      </div>
      <div className="wp-card wp-card--flat wp-row" style={{ height: 58, padding: '0 14px', gap: 12, borderRadius: 8 }}>
        <Skel w={20} h={20} />
        <div className="wp-col" style={{ gap: 7, flex: 1 }}>
          <Skel w={420} h={11} />
          <Skel w={310} />
        </div>
        <Skel w={96} h={30} />
      </div>
      <div className="wp-stats">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="wp-card wp-stat wp-stat--stack" style={{ gap: 10, padding: '14px 18px' }}>
            <Skel w={150} />
            <Skel w={112} h={28} />
            <Skel w={205} />
          </div>
        ))}
      </div>
      <div className="c-main">
        <div className="wp-col" style={{ flex: 1, gap: 12 }}>
          <div className="wp-card wp-col" style={{ height: 246, padding: 20, gap: 15 }}>
            <div className="wp-row" style={{ justifyContent: 'space-between' }}>
              <Skel w={230} h={16} />
              <Skel w={64} h={22} />
            </div>
            <Skel w={360} h={12} />
            <Skel w={280} h={28} />
            <div className="wp-meter" style={{ height: 14 }} />
            <Skel w="100%" h={12} />
          </div>
          <div className="c-samples">
            {[0, 1].map((i) => (
              <div key={i} className="wp-card wp-col" style={{ padding: 18, gap: 13, flex: 1 }}>
                <div className="wp-row" style={{ justifyContent: 'space-between' }}>
                  <Skel w={170} h={16} />
                  <Skel w={64} h={22} />
                </div>
                <Skel w={190} h={12} />
                <Skel w={150} h={23} />
                <div className="wp-meter" />
              </div>
            ))}
          </div>
        </div>
        <div className="wp-card c-side" style={{ padding: 22 }}>
          <div className="wp-row" style={{ justifyContent: 'space-between' }}>
            <Skel w={170} h={11} />
            <Skel w={60} h={18} />
          </div>
          <Skel w={230} h={24} />
          <Skel w={142} h={28} />
          <Skel w="100%" h={12} />
          <Skel w={248} h={12} />
          <div className="wp-divider" style={{ background: 'var(--surface-2)' }} />
          <div style={{ height: 48, background: 'var(--surface-2)', borderRadius: 8 }} />
        </div>
      </div>
    </div>
  );
}

/* ---------- Screen ---------- */
export default function Capacity() {
  const [frame, setFrame] = useFrame<Frame>('D2.1');
  const go = useGo();
  const kandy = frame === 'D2.2';
  const released = frame === 'D2.3' || frame === 'D2.4';
  const offline = frame === 'D2.S-offline';
  const state = frame.startsWith('D2.S');

  const onDepot = (d: Depot) => setFrame(d === 'Kandy' ? 'D2.2' : 'D2.1');
  const toTrips = () => go('/plan/trips', 'D3.1');
  const toLive = () => go('/live', 'D6.1');

  const context =
    frame === 'D2.3' ? 'Tue 29 Sep · Peliyagoda · 02:45' : frame === 'D2.4' ? 'Mon 28 Sep · Peliyagoda · 23:40' : kandy ? 'Mon 28 Sep · Kandy' : 'Mon 28 Sep · Peliyagoda';

  const bar = (
    <AppBar current="plan" deferrals={kandy ? undefined : 19} context={context} depot={kandy ? 'Kandy' : 'Peliyagoda'} onDepot={onDepot} offline={offline} planPill={released ? 'Plan v3 · Released' : undefined} />
  );

  const overline = released
    ? 'CAPACITY · PELIYAGODA · PLAN v3 RELEASED'
    : state
      ? 'CAPACITY · PELIYAGODA'
      : kandy
        ? 'CAPACITY · KANDY · PLAN v1 DRAFT'
        : 'CAPACITY · PELIYAGODA · PLAN v1 DRAFT';

  let actions: ReactNode;
  if (frame === 'D2.3') {
    actions = (
      <div className="wp-row" style={{ gap: 18 }}>
        <span className="wp-reason" style={{ fontSize: 13, fontWeight: 500 }}>
          <Lock size={15} />
          Released trips are read-only.
        </span>
        <button className="wp-link wp-row" style={{ gap: 6, fontSize: 13 }} onClick={toLive}>
          Open operations
          <ArrowRight size={15} />
        </button>
      </div>
    );
  } else if (frame === 'D2.4') {
    actions = (
      <div className="wp-row" style={{ gap: 16 }}>
        <span className="wp-reason" style={{ fontSize: 13, fontWeight: 500 }}>
          <Lock size={15} />
          Released capacity · read-only
        </span>
        <Button variant="route-outline" size="sm" iconRight={<ArrowRight size={15} />} onClick={toLive} style={{ height: 38, padding: '0 14px', fontWeight: 700 }}>
          Open live view
        </Button>
      </div>
    );
  } else if (kandy) {
    actions = (
      <div className="wp-row" style={{ gap: 10 }}>
        <div className="wp-segment" role="radiogroup" aria-label="Depot" style={{ fontSize: 12 }}>
          {(['Peliyagoda', 'Kandy'] as Depot[]).map((d) => (
            <button key={d} role="radio" aria-checked={d === 'Kandy'} className={cx(d === 'Kandy' && 'is-selected c-seg-plain')} onClick={() => onDepot(d)}>
              {d}
            </button>
          ))}
        </div>
        <Button iconRight={<ChevronRight size={16} />} onClick={toTrips}>
          Go to trip board
        </Button>
      </div>
    );
  } else {
    actions = (
      <Button iconRight={<ChevronRight size={16} />} onClick={toTrips}>
        Go to trip board
      </Button>
    );
  }

  let body: ReactNode;
  switch (frame) {
    case 'D2.2':
      body = <KandyView onPeliyagoda={() => onDepot('Peliyagoda')} />;
      break;
    case 'D2.3':
      body = (
        <>
          <Alert
            tone="warning"
            icon={<TriangleAlert size={19} />}
            style={{ minHeight: 56 }}
            title={
              <>
                Capacity forced <M w={400}>19</M> deferrals in released plan v3.
              </>
            }
            actions={
              <Tag tone="warning-outline" style={{ background: 'transparent' }}>
                Released snapshot
              </Tag>
            }
          >
            <span style={{ fontSize: 12 }}>The new spare is visible, but released trips and deferral choices remain unchanged.</span>
          </Alert>
          <CapStats spare />
          <div className="c-main">
            <div className="wp-col" style={{ flex: 1, gap: 12, minWidth: 0 }}>
              <BindingCard snapshot="plain" compact minHeight={232} />
              <SampleCards />
            </div>
            <div className="wp-col" style={{ gap: 12, width: 340, flexShrink: 0 }}>
              <SpareCard />
              <KandyPool short />
            </div>
          </div>
        </>
      );
      break;
    case 'D2.4':
      body = (
        <>
          <div className="c-released-alert">
            <Lock size={17} />
            <span style={{ flex: 1 }}>
              Released <M w={400}>v3</M> at <M w={400}>23:40</M>, changes now go through Live.
            </span>
            <Tag tone="info" icon={<Eye size={13} />} style={{ background: 'transparent', borderColor: 'var(--route)', fontWeight: 700 }}>
              Read-only
            </Tag>
          </div>
          <ForcedAlert snapshot />
          <div className="wp-row" style={{ gap: 10, height: 28 }}>
            <M w={600} style={{ fontSize: 14 }}>
              276 orders · 257 served · 19 deferred
            </M>
            <MockTag />
            <div className="wp-divider" style={{ flex: 1, width: 'auto' }} />
            <span className="wp-reason" style={{ fontWeight: 600 }}>
              <Lock size={13} />
              Final released capacity
            </span>
          </div>
          <CapStats />
          <div className="c-main">
            <div className="wp-col" style={{ flex: 1, gap: 12, minWidth: 0 }}>
              <BindingCard snapshot="lock" compact minHeight={246} />
              <SampleCards recorded />
            </div>
            <KandyPool released />
          </div>
        </>
      );
      break;
    case 'D2.S-empty':
      body = (
        <div className="wp-card wp-card--flat" style={{ flex: 1, padding: '28px 24px 24px' }}>
          <StateBlock
            style={{ gap: 14 }}
            icon={<ChartNoAxesCombined size={23} />}
            title={<span style={{ fontSize: 21 }}>No plan drafted yet</span>}
            body="Capacity appears after the 16:00 cutoff."
            action={
              <Button variant="secondary" size="sm" icon={<ArrowLeft size={15} />} onClick={() => go('/plan/queue', 'D1.2')} style={{ height: 38, color: 'var(--ink-muted)' }}>
                Go to queue
              </Button>
            }
          />
        </div>
      );
      break;
    case 'D2.S-loading':
      body = <LoadingView />;
      break;
    case 'D2.S-error':
      body = (
        <Alert
          tone="danger"
          icon={<CircleAlert size={20} />}
          style={{ minHeight: 64, padding: '0 16px', gap: 12 }}
          title={<span style={{ color: 'var(--danger)' }}>Capacity couldn't be calculated, fleet data missing.</span>}
          actions={
            <Button variant="secondary" size="sm" icon={<RefreshCw size={15} />} onClick={() => setFrame('D2.S-loading')} style={{ height: 36, fontWeight: 700 }}>
              Retry
            </Button>
          }
        />
      );
      break;
    default:
      body = (
        <>
          <ForcedAlert onReview={() => go('/plan/deferrals', 'D4.1')} />
          <CapStats />
          <div className="c-main">
            <div className="wp-col" style={{ flex: 1, gap: 16, minWidth: 0 }}>
              <BindingCard minHeight={274} />
              <SampleCards />
            </div>
            <KandyPool />
          </div>
        </>
      );
  }

  return (
    <Screen
      bar={bar}
      conn={
        offline ? (
          <ConnectivityBar>
            Showing capacity as of <M w={500}>21:10</M>, reconnect to refresh.
          </ConnectivityBar>
        ) : undefined
      }
      toast={
        frame === 'D2.3' ? (
          <div className="c-toast" role="status">
            <span className="c-toast__icon">
              <Truck size={18} />
            </span>
            <div className="wp-col" style={{ flex: 1, gap: 2 }}>
              <b style={{ fontSize: 13, fontWeight: 600 }}>VEH036 released from workshop at 02:45, now available.</b>
              <span style={{ fontSize: 12, color: 'var(--on-chrome-muted)' }}>Reefer van</span>
            </div>
            <button onClick={toLive}>Open live view</button>
          </div>
        ) : undefined
      }
    >
      <div className="wp-col" style={{ gap: 12, flex: 1 }}>
        <PageHeader overline={overline} title="Supply vs demand for Tue 29 Sep" actions={actions}>
          <Stepper current={2} done={released ? [1, 2, 3, 4, 5] : [1]} />
        </PageHeader>
        {body}
      </div>
    </Screen>
  );
}
