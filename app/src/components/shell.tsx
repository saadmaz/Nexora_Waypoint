import type { ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChartNoAxesCombined, Check, ClipboardList, ClockArrowDown, Lock, Radio, WifiOff } from 'lucide-react';
import { cx } from './ui';

export type Depot = 'Peliyagoda' | 'Kandy';
export type NavKey = 'plan' | 'live' | 'deferrals' | 'forecast';

/** The frame (Figma variant) a screen renders, read from `?frame=`. */
export function useFrame<T extends string>(fallback: T): [T, (next: T) => void] {
  const [params, setParams] = useSearchParams();
  const frame = (params.get('frame') as T | null) ?? fallback;
  const setFrame = (next: T) => {
    const p = new URLSearchParams(params);
    p.set('frame', next);
    setParams(p, { replace: false });
  };
  return [frame, setFrame];
}

export function useGo() {
  const navigate = useNavigate();
  return (path: string, frame?: string) => navigate(frame ? `${path}?frame=${frame}` : path);
}

function Diamond() {
  return (
    <svg className="wp-diamond" viewBox="0 0 17 17" aria-hidden="true">
      <rect x="3.5" y="3.5" width="10" height="10" rx="1.2" transform="rotate(45 8.5 8.5)" fill="var(--signal)" />
    </svg>
  );
}

const NAV: Array<{ key: NavKey; label: string; to: string; icon: ReactNode }> = [
  { key: 'plan', label: 'Plan', to: '/plan/queue', icon: <ClipboardList size={16} /> },
  { key: 'live', label: 'Live', to: '/live', icon: <Radio size={16} /> },
  { key: 'deferrals', label: 'Deferrals', to: '/deferrals', icon: <ClockArrowDown size={16} /> },
  { key: 'forecast', label: 'Forecast', to: '/forecast', icon: <ChartNoAxesCombined size={16} /> },
];

interface AppBarProps {
  current: NavKey;
  deferrals?: number;
  context: string;
  depot?: Depot;
  onDepot?: (d: Depot) => void;
  offline?: boolean;
  planPill?: ReactNode;
  /** Released-plan frames swap the depot switch for the plan pill. */
  showDepot?: boolean;
}

export function AppBar({ current, deferrals, context, depot = 'Peliyagoda', onDepot, offline, planPill, showDepot = !planPill }: AppBarProps) {
  return (
    <header className="wp-appbar">
      <Link to="/plan/queue" className="wp-brand" aria-label="Waypoint Dispatch home">
        <Diamond />
        <span>
          <b>Waypoint</b> Dispatch
        </span>
      </Link>
      <nav className="wp-nav" aria-label="Primary">
        {NAV.map((n) => (
          <Link key={n.key} to={n.to} className={cx('wp-nav__item', current === n.key && 'is-current')} aria-current={current === n.key ? 'page' : undefined}>
            <span className="wp-nav__label">
              {n.icon}
              {n.label}
              {n.key === 'deferrals' && deferrals ? <span className="wp-count">{deferrals}</span> : null}
            </span>
            <span className="wp-nav__bar" />
          </Link>
        ))}
      </nav>
      <div className="wp-appbar__context">
        <span className="wp-appbar__meta">{context}</span>
        {planPill && (
          <span className="wp-plan-pill">
            <Lock size={13} />
            {planPill}
          </span>
        )}
        {showDepot && (
        <div className="wp-depot" role="radiogroup" aria-label="Depot">
          {(['Peliyagoda', 'Kandy'] as Depot[]).map((d) => (
            <button key={d} role="radio" aria-checked={depot === d} className={cx(depot === d && 'is-selected')} onClick={() => onDepot?.(d)}>
              {d}
            </button>
          ))}
        </div>
        )}
        {offline ? (
          <span className="wp-sync is-offline">
            <WifiOff size={13} />
            Offline
          </span>
        ) : (
          <span className="wp-sync">
            <span className="wp-sync__dot" />
            Live
          </span>
        )}
        <span className="wp-avatar" aria-label="Kumari">
          K
        </span>
      </div>
    </header>
  );
}

export function ConnectivityBar({ children }: { children: ReactNode }) {
  return (
    <div className="wp-connbar" role="status">
      <WifiOff size={17} />
      <span>{children}</span>
    </div>
  );
}

const STEPS = [
  { n: 1, label: 'Queue', to: '/plan/queue' },
  { n: 2, label: 'Capacity', to: '/plan/capacity' },
  { n: 3, label: 'Trips', to: '/plan/trips' },
  { n: 4, label: 'Deferrals', to: '/plan/deferrals' },
  { n: 5, label: 'Release', to: '/plan/release' },
];

/**
 * Planning stepper. `current` is the active step; `next` highlights the
 * following step as reachable (route ring); `done` marks steps complete.
 */
export function Stepper({ current, next, done }: { current: number; next?: boolean; done?: number[] }) {
  const doneSet = new Set(done ?? Array.from({ length: current - 1 }, (_, i) => i + 1));
  return (
    <nav className="wp-stepper" aria-label="Planning steps">
      {STEPS.map((s) => {
        const isDone = doneSet.has(s.n);
        const isCurrent = !isDone && s.n === current;
        const isNext = !isDone && next && s.n === current + 1;
        return (
          <Link key={s.n} to={s.to} className={cx('wp-step', isDone && 'is-done', isCurrent && 'is-current', isNext && 'is-next')} aria-current={isCurrent ? 'step' : undefined}>
            <span className="wp-step__body">
              <span className="wp-step__marker">{isDone && <Check size={9} strokeWidth={3.5} />}</span>
              <span className="wp-step__label">
                {s.n} {s.label}
              </span>
            </span>
            {s.n < 5 && <span className="wp-step__track" />}
          </Link>
        );
      })}
    </nav>
  );
}

interface PageHeaderProps {
  overline: ReactNode;
  title: ReactNode;
  titleAddon?: ReactNode;
  actions?: ReactNode;
  reason?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({ overline, title, titleAddon, actions, reason, children }: PageHeaderProps) {
  return (
    <div className="wp-header">
      <div className="wp-header__row">
        <div className="wp-header__title-block">
          <div className="wp-overline">{overline}</div>
          <div className="wp-title-line">
            <h1 className="wp-h1">{title}</h1>
            {titleAddon}
          </div>
        </div>
        {(actions || reason) && (
          <div className="wp-header__actions">
            <div className="wp-header__actions-row">{actions}</div>
            {reason && <div className="wp-reason">{reason}</div>}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

export function Screen({ bar, conn, children, toast }: { bar: ReactNode; conn?: ReactNode; children: ReactNode; toast?: ReactNode }) {
  return (
    <div className="wp-app">
      {bar}
      {conn}
      <main className="wp-workspace">{children}</main>
      {toast}
    </div>
  );
}
