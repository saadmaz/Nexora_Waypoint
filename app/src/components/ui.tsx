import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { useEffect } from 'react';
import { Check, Lock, Snowflake, X } from 'lucide-react';

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/* ---------- Button ---------- */
type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'route-outline'
  | 'warning-outline'
  | 'danger-outline'
  | 'signal';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx('wp-btn', `wp-btn--${variant}`, size !== 'md' && `wp-btn--${size}`, className)}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
}

/* ---------- Tag ---------- */
export type TagTone =
  | 'neutral'
  | 'ambient'
  | 'outline'
  | 'outline-ink'
  | 'outline-muted'
  | 'dashed'
  | 'fresh'
  | 'style'
  | 'tech'
  | 'chilled'
  | 'info'
  | 'success'
  | 'warning'
  | 'warning-outline'
  | 'danger'
  | 'signal'
  | 'live'
  | 'offline'
  | 'conflict'
  | 'selected';

interface TagProps {
  tone?: TagTone;
  icon?: ReactNode;
  dot?: boolean;
  pill?: boolean;
  small?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function Tag({ tone = 'neutral', icon, dot, pill, small, className, style, children }: TagProps) {
  return (
    <span
      className={cx('wp-tag', `wp-tag--${tone}`, pill && 'wp-tag--pill', small && 'wp-tag--sm', className)}
      style={style}
    >
      {dot && <span className="wp-tag__dot" />}
      {icon}
      {children}
    </span>
  );
}

export type Brand = 'Fresh' | 'Style' | 'Tech';

export function BrandTag({ brand, dot = true }: { brand: Brand; dot?: boolean }) {
  return (
    <Tag tone={brand.toLowerCase() as TagTone} dot={dot}>
      {brand}
    </Tag>
  );
}

export function TempTag({ temp, icon = true, dry }: { temp: 'Chilled' | 'Ambient'; icon?: boolean; dry?: boolean }) {
  if (temp === 'Chilled') {
    return (
      <Tag tone="chilled" icon={icon ? <Snowflake size={13} /> : undefined}>
        Chilled
      </Tag>
    );
  }
  return (
    <Tag tone={dry ? 'ambient' : 'neutral'}>
      Ambient
      {dry && <span style={{ fontWeight: 400, color: 'var(--ink-muted)' }}>&nbsp;(dry)</span>}
    </Tag>
  );
}

export function MockTag() {
  return <span className="wp-mock">Mock data</span>;
}

export function ProtectedTag({ tone = 'outline-ink' }: { tone?: TagTone }) {
  return (
    <Tag tone={tone} icon={<Lock size={13} />}>
      Protected
    </Tag>
  );
}

/* ---------- Stat ---------- */
interface StatProps {
  label: string;
  value: ReactNode;
  foot?: ReactNode;
  footIcon?: ReactNode;
  footTone?: 'warn' | 'bad' | 'good';
  footMono?: boolean;
  valueColor?: string;
  mock?: boolean;
  stacked?: boolean;
  style?: CSSProperties;
}

export function Stat({ label, value, foot, footIcon, footTone, footMono, valueColor, mock, stacked, style }: StatProps) {
  const footEl = foot && (
    <div className={cx('wp-stat__foot', footTone && `is-${footTone}`, footMono && 'is-mono')}>
      {footIcon}
      {foot}
    </div>
  );
  if (stacked) {
    return (
      <div className="wp-card wp-stat wp-stat--stack" style={style}>
        <div className="wp-stat__label">{label}</div>
        <div className="wp-stat__row">
          <div className="wp-stat__value" style={{ color: valueColor }}>
            {value}
          </div>
          {mock && <MockTag />}
        </div>
        {footEl}
      </div>
    );
  }
  return (
    <div className="wp-card wp-stat" style={style}>
      <div className="wp-stat__main">
        <div className="wp-stat__label">{label}</div>
        <div className="wp-stat__value" style={{ color: valueColor }}>
          {value}
        </div>
      </div>
      {footEl}
    </div>
  );
}

/* ---------- Alert ---------- */
interface AlertProps {
  tone: 'info' | 'success' | 'warning' | 'danger' | 'muted';
  icon?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Alert({ tone, icon, title, children, actions, className, style }: AlertProps) {
  return (
    <div className={cx('wp-alert', `wp-alert--${tone}`, className)} style={style} role={tone === 'danger' ? 'alert' : 'status'}>
      {icon && <span className="wp-alert__icon">{icon}</span>}
      <div className="wp-alert__body">
        {title && <div className="wp-alert__title">{title}</div>}
        {children && <div className="wp-alert__text">{children}</div>}
      </div>
      {actions}
    </div>
  );
}

/* ---------- State screen ---------- */
interface StateBlockProps {
  icon: ReactNode;
  tone?: 'neutral' | 'success';
  title: ReactNode;
  body?: ReactNode;
  facts?: ReactNode;
  action?: ReactNode;
  style?: CSSProperties;
}

export function StateBlock({ icon, tone = 'neutral', title, body, facts, action, style }: StateBlockProps) {
  return (
    <div className="wp-state" style={style}>
      <div className={cx('wp-state__tile', tone === 'success' && 'is-success')}>{icon}</div>
      <div className="wp-state__copy">
        <div className="wp-state__title">{title}</div>
        {body && <div className="wp-state__body">{body}</div>}
      </div>
      {facts && <div className="wp-state__facts">{facts}</div>}
      {action}
    </div>
  );
}

/* ---------- Skeleton ---------- */
export function Skel({ w, h = 10, style }: { w: number | string; h?: number; style?: CSSProperties }) {
  return <span className="wp-skel" style={{ width: w, height: h, ...style }} />;
}

/* ---------- Checkbox ---------- */
export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange?: (v: boolean) => void; label?: ReactNode }) {
  return (
    <label className="wp-row" style={{ gap: 10, cursor: onChange ? 'pointer' : 'default' }}>
      <span
        className={cx('wp-checkbox', checked && 'is-checked')}
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => onChange?.(!checked)}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            onChange?.(!checked);
          }
        }}
      >
        {checked && <Check size={14} strokeWidth={3} />}
      </span>
      {label}
    </label>
  );
}

/* ---------- Overlays ---------- */
function useEscape(onClose?: () => void) {
  useEffect(() => {
    if (!onClose) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
}

export function Drawer({ width = 480, onClose, children, label }: { width?: number; onClose?: () => void; children: ReactNode; label: string }) {
  useEscape(onClose);
  return (
    <>
      <div className="wp-scrim" onClick={onClose} />
      <aside className="wp-drawer" style={{ width }} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </aside>
    </>
  );
}

export function Modal({ width = 560, onClose, children, label }: { width?: number; onClose?: () => void; children: ReactNode; label: string }) {
  useEscape(onClose);
  return (
    <>
      <div className="wp-scrim" onClick={onClose} />
      <div className="wp-modal-wrap">
        <div className="wp-modal" style={{ width }} role="dialog" aria-modal="true" aria-label={label}>
          {children}
        </div>
      </div>
    </>
  );
}

export function CloseButton({ onClick, label = 'Close', size = 20 }: { onClick?: () => void; label?: string; size?: number }) {
  return (
    <button className="wp-icon-btn" onClick={onClick} aria-label={label}>
      <X size={size} />
    </button>
  );
}

export function Toast({ icon, children, action }: { icon?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="wp-toast" role="status">
      {icon}
      <span>{children}</span>
      {action}
    </div>
  );
}

/* ---------- Meter ---------- */
interface MeterProps {
  value: number;
  max: number;
  height?: number;
  tone?: 'route' | 'near' | 'over' | 'muted' | 'success';
  radius?: number;
}

export function Meter({ value, max, height = 10, tone, radius }: MeterProps) {
  const pct = Math.min(100, (value / max) * 100);
  const autoTone = tone ?? (value > max ? 'over' : value / max >= 0.9 ? 'near' : 'route');
  const over = value > max;
  const fillPct = over ? (max / value) * 100 : pct;
  return (
    <div className="wp-meter" style={{ height, borderRadius: radius }} role="meter" aria-valuenow={value} aria-valuemax={max} aria-valuemin={0}>
      <div className={cx('wp-meter__fill', autoTone !== 'route' && `is-${autoTone}`)} style={{ width: `${fillPct}%` }} />
      {over && <div className="wp-meter__over" />}
    </div>
  );
}

/* ---------- Mono helper ---------- */
export function M({ children, w, style }: { children: ReactNode; w?: 400 | 500 | 600 | 700; style?: CSSProperties }) {
  return (
    <span className="mono" style={{ fontWeight: w, ...style }}>
      {children}
    </span>
  );
}
