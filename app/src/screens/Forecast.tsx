import type { ReactNode } from 'react';
import { CalendarDays, ChartLine, CircleAlert, Eye, Info, RefreshCw, TriangleAlert, WifiOff } from 'lucide-react';
import { AppBar, PageHeader, Screen, useFrame } from '../components/shell';
import { Button, M, Skel, Tag, cx } from '../components/ui';
import './forecast.css';

type Frame = 'D9.1' | 'D9.2' | 'D9.S-empty' | 'D9.S-loading' | 'D9.S-offline' | 'D9.S-error';

interface Week {
  monday: string;
  pct: number;
  flags: string[];
  expandable?: boolean;
}

const WEEKS: Week[] = [
  { monday: 'Mon 5 Oct', pct: 104, flags: ['Payday'] },
  { monday: 'Mon 12 Oct', pct: 97, flags: [] },
  { monday: 'Mon 19 Oct', pct: 126, flags: ['Festival ramp', 'Payday'], expandable: true },
  { monday: 'Mon 26 Oct', pct: 99, flags: [] },
];

/** The bar is drawn on a 0–140% scale so a 126% week still fits with room to spare. */
const SCALE = 140;

function Label({ children }: { children: ReactNode }) {
  return <span className="f-label">{children}</span>;
}

function WeekRow({ week, expanded, onToggle }: { week: Week; expanded?: boolean; onToggle?: () => void }) {
  const short = week.pct > 100;
  const body = (
    <>
      <span className="f-week">
        <Label>Week of</Label>
        <M w={600} style={{ fontSize: 15 }}>
          {week.monday}
        </M>
      </span>
      <span className="f-barcol">
        <span className="f-bar" role="meter" aria-valuenow={week.pct} aria-valuemin={0} aria-valuemax={SCALE} aria-label="Reefer demand vs usable capacity">
          <span className={cx('f-bar__fill', short ? 'is-over' : 'is-near')} style={{ width: `${(week.pct / SCALE) * 100}%` }} />
          <span className="f-bar__tick" style={{ left: `${(100 / SCALE) * 100}%` }} />
        </span>
        <span className="f-caption">Reefer demand vs usable capacity</span>
      </span>
      <M w={500} style={{ fontSize: 22, color: short ? 'var(--danger)' : 'var(--warning)' }}>
        {week.pct}%
      </M>
      <span className="f-flags">
        {week.flags.length ? (
          week.flags.map((f) => (
            <Tag key={f} tone="outline-ink" small icon={<CalendarDays size={13} />} className="f-tag">
              {f}
            </Tag>
          ))
        ) : (
          <span className="f-caption">No calendar flags</span>
        )}
      </span>
      <span className="wp-col" style={{ gap: 2 }}>
        <b style={{ fontSize: 13, fontWeight: 600, color: short ? 'var(--danger)' : 'var(--warning)' }}>{short ? 'Short' : 'Tight'}</b>
        <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{short ? 'Move workshop slots · pre-warn stores' : 'Watch'}</span>
      </span>
    </>
  );
  if (week.expandable && onToggle) {
    return (
      <button className={cx('f-row', expanded && 'is-expanded')} aria-expanded={expanded} onClick={onToggle}>
        {body}
      </button>
    );
  }
  return <div className="f-row">{body}</div>;
}

function Detail() {
  const days: Array<[string, string?]> = [['Mon'], ['Tue'], ['Wed'], ['Thu', 'ramp'], ['Fri', 'payday'], ['Sat'], ['Sun']];
  return (
    <div className="f-detail">
      <div className="f-card">
        <Label>Gap</Label>
        <M w={500} style={{ fontSize: 30, color: 'var(--danger)' }}>
          ~560 min
        </M>
        <span className="wp-row" style={{ gap: 6, fontSize: 12, color: 'var(--danger)' }}>
          <CircleAlert size={14} />
          reefer Fresh minutes short (Mock)
        </span>
      </div>
      <div className="f-card">
        <Label>Days</Label>
        <div className="wp-row" style={{ gap: 6 }}>
          {days.map(([d, flag]) => (
            <span key={d} className={cx('f-day', flag && 'is-flagged')}>
              <M w={500} style={{ fontSize: 12 }}>
                {d}
              </M>
              {flag && <span style={{ fontSize: 11 }}>{flag}</span>}
            </span>
          ))}
        </div>
      </div>
      <div className="f-levers">
        <Label>Levers (notes: nothing here changes the plan)</Label>
        <span>• Move 2 workshop slots out of this week</span>
        <span>• Pre-warn Fresh stores of likely deferrals</span>
      </div>
    </div>
  );
}

export default function Forecast() {
  const [frame, setFrame] = useFrame<Frame>('D9.1');
  const offline = frame === 'D9.S-offline';
  const error = frame === 'D9.S-error';
  const bare = frame === 'D9.S-empty' || frame === 'D9.S-loading';

  const bar = <AppBar current="forecast" deferrals={19} time="21:15" context="Mon 28 Sep · Peliyagoda" syncLabel="Live sync" offline={offline} />;

  const overline = bare
    ? 'FORECAST · PELIYAGODA'
    : `FORECAST · PELIYAGODA · AS OF MON ${error ? '21' : '28'} SEP${offline ? ' · OFFLINE' : ''}`;

  const actions = bare ? undefined : (
    <span className="wp-row" style={{ gap: 16 }}>
      {offline && (
        <span className="wp-row" style={{ gap: 8, fontSize: 13, color: 'var(--ink-muted)' }}>
          <WifiOff size={16} />
          Forecast as of Mon 28 Sep.
        </span>
      )}
      <Tag tone="outline-ink" small className="f-tag">
        Mock data
      </Tag>
      <Tag tone="outline-ink" small icon={<Eye size={14} />} className="f-tag">
        View only
      </Tag>
    </span>
  );

  let body: ReactNode;
  if (frame === 'D9.S-empty') {
    body = (
      <div className="f-card f-empty">
        <span className="f-empty__tile">
          <ChartLine size={22} />
        </span>
        <h2 style={{ fontSize: 22, fontWeight: 600 }}>No forecast weeks yet</h2>
        <p className="muted" style={{ fontSize: 15 }}>
          The outlook appears once there is at least one full week of order history.
        </p>
      </div>
    );
  } else if (frame === 'D9.S-loading') {
    body = (
      <div className="wp-col" style={{ gap: 20 }}>
        <span className="wp-row" style={{ gap: 8, fontSize: 14, color: 'var(--ink-muted)', fontWeight: 500 }}>
          <RefreshCw size={16} className="spin" style={{ color: 'var(--route)' }} />
          Loading 4 weeks…
        </span>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="f-card f-skel" aria-hidden="true">
            <Skel w={120} />
            <Skel w={520} />
            <Skel w={60} />
            <Skel w={200} />
          </div>
        ))}
      </div>
    );
  } else {
    const expanded = frame === 'D9.2';
    body = (
      <div className="wp-col" style={{ gap: 12 }}>
        {error ? (
          <div className="f-alert f-alert--warning" role="alert">
            <TriangleAlert size={22} />
            <div className="f-alert__text">
              <b>Forecast unavailable: showing last week's.</b>
              <span>Figures are from Mon 21 Sep. We'll retry automatically.</span>
            </div>
            <Button variant="secondary" size="sm" icon={<RefreshCw size={16} />} onClick={() => setFrame('D9.1')}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="f-alert f-alert--info" role="note">
            <Info size={22} />
            <div className="f-alert__text">
              <b>Baseline forecast: Datathon Task 2A model not wired in.</b>
              <span>Weeks are ISO weeks labelled by their Monday. Over 100% means some orders will wait unless capacity moves.</span>
            </div>
          </div>
        )}
        {WEEKS.map((w) => (
          <div key={w.monday} className="wp-col" style={{ gap: 16 }}>
            <WeekRow week={w} expanded={expanded && w.expandable} onToggle={w.expandable ? () => setFrame(expanded ? 'D9.1' : 'D9.2') : undefined} />
            {expanded && w.expandable && <Detail />}
          </div>
        ))}
      </div>
    );
  }

  return (
    <Screen bar={bar}>
      <div className="wp-col" style={{ gap: 22 }}>
        <PageHeader overline={overline} title="Which weeks will be short" actions={actions} />
        {body}
      </div>
    </Screen>
  );
}
