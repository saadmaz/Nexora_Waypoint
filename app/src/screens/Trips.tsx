import { useState } from 'react';
import type { DragEvent, ReactNode } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleX,
  GripVertical,
  List,
  Lock,
  Move,
  CirclePlus,
  RefreshCw,
  Search,
  Snowflake,
  Truck,
  WifiOff,
  Wrench,
  X,
} from 'lucide-react';
import { AppBar, PageHeader, Screen, Stepper, useFrame, useGo } from '../components/shell';
import { Alert, Button, CloseButton, M, MockTag, Modal, Tag, cx } from '../components/ui';
import { deferredPool, lanes } from '../data/trips';
import type { Lane, Stop, Trip } from '../data/trips';
import './trips.css';

type Frame = 'D3.1' | 'D3.2' | 'D3.3' | 'D3.4' | 'D3.5' | 'D3.6' | 'D3.7' | 'D3.8' | 'D3.S-empty' | 'D3.S-loading' | 'D3.S-offline' | 'D3.S-error';

interface BoardMode {
  frame: Frame;
  readOnly: boolean;
  disabled: boolean;
  onFrame: (f: Frame) => void;
}

/** Drag rules: which drops the prototype recognises and the frame each produces. */
function dropResult(dragged: string, target: string): Frame | null {
  if (dragged === 'OUT025' && target === 'VEH035-1') return 'D3.2';
  if (dragged === 'ORD1009' && target === 'VEH003-2') return 'D3.3';
  if (dragged === 'OUT009' && target === 'VEH011-1') return 'D3.4';
  if (dragged === 'OUT012' && target === 'pool') return 'D3.5';
  return null;
}

function StopRow({ stop, trip, mode, slot }: { stop: Stop; trip: Trip; mode: BoardMode; slot?: ReactNode }) {
  if (slot) return <>{slot}</>;
  const draggable = !mode.readOnly && !mode.disabled;
  const onDragStart = (e: DragEvent) => {
    e.dataTransfer.setData('text/plain', stop.outlet);
    e.dataTransfer.effectAllowed = 'move';
  };
  const whyOpen = mode.frame === 'D3.7' && trip.id === 'VEH003-1' && stop.n === 1;
  return (
    <div className={cx('t-stop', mode.readOnly && 'is-readonly')} draggable={draggable} onDragStart={onDragStart}>
      {!mode.readOnly && <GripVertical size={14} className="t-grip" aria-hidden="true" />}
      <span className="t-stopnum">{stop.n}</span>
      <button
        className="t-stop__details"
        onClick={() => trip.id === 'VEH003-1' && stop.n === 1 && mode.onFrame(whyOpen ? 'D3.1' : 'D3.7')}
        aria-label={`${stop.outlet} arrives ${stop.time}${trip.id === 'VEH003-1' && stop.n === 1 ? ', why this vehicle' : ''}`}
      >
        <M w={700}>{stop.outlet}</M>
        <M style={{ color: 'var(--ink-muted)' }}>{stop.time}</M>
        {stop.note && <span className="muted">{stop.note}</span>}
      </button>
      {!mode.readOnly && (
        <button className="t-moveto" disabled={mode.disabled} onClick={() => mode.onFrame('D3.6')}>
          Move to…
        </button>
      )}
    </div>
  );
}

function TripCard({ trip, mode, variant, slots, extra }: { trip: Trip; mode: BoardMode; variant?: 'ok' | 'bad'; slots?: Record<number, ReactNode>; extra?: ReactNode }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={cx('t-card', variant === 'ok' && 'is-ok', variant === 'bad' && 'is-bad', mode.readOnly && 'is-flat', over && 'is-over')}
      onDragOver={(e) => {
        if (mode.readOnly || mode.disabled) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = dropResult(e.dataTransfer.getData('text/plain'), trip.id);
        if (f) mode.onFrame(f);
      }}
    >
      <div className={cx('t-card__head', variant === 'ok' && 'is-ok')}>
        <M w={700} style={{ fontSize: 13 }}>
          {trip.vehicle} · Trip {trip.trip} · departs {trip.departs}
        </M>
        <div className="wp-row" style={{ gap: 5 }}>
          <Tag tone={trip.brand.toLowerCase() as 'fresh'} className="t-tag">
            {trip.brand}
          </Tag>
          <Tag tone="outline-muted" className="t-tag t-tag--ol">
            {trip.district}
          </Tag>
          <Tag tone="outline-muted" className="t-tag t-tag--ol">
            One brand · one district
          </Tag>
        </div>
      </div>
      <div className="wp-col">
        {trip.stops.map((s) => (
          <StopRow key={s.n} stop={s} trip={trip} mode={mode} slot={slots?.[s.n]} />
        ))}
        {extra}
      </div>
      <div className="t-totals">
        {trip.totals.map((t) => (
          <div key={t.label} className="t-total">
            <span className="t-total__label">{t.label}</span>
            <M w={600}>{t.value}</M>
            <span className="t-total__track">{t.pct ? <span style={{ width: `${t.pct}%` }} /> : null}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LaneHeader({ lane }: { lane: Lane }) {
  return (
    <div className="t-lanehead">
      <div className="wp-row" style={{ justifyContent: 'space-between' }}>
        <M w={700} style={{ fontSize: 14 }}>
          {lane.vehicle}
        </M>
        {lane.typeTag.chilled ? (
          <Tag tone="chilled" className="t-tag">
            {lane.typeTag.label}
          </Tag>
        ) : (
          <Tag tone="outline-muted" className="t-tag t-tag--ol">
            {lane.typeTag.label}
          </Tag>
        )}
      </div>
      {lane.meters.map((m) => (
        <div key={m.label} className="wp-col" style={{ gap: 3 }}>
          <div className="wp-row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
            <b className="muted">{m.label}</b>
            <M w={600}>{m.value}</M>
          </div>
          <span className="t-lanemeter">
            <span style={{ width: `${m.pct}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Overlays anchored on the board ---------- */
function ConsequencePanel() {
  const rows: Array<[ReactNode, ReactNode?]> = [
    [
      <>
        Weight 330 → 450 / 1,040 kg
      </>,
      <span className="t-before-after">
        <span style={{ width: '32%' }} />
        <span className="is-added" style={{ width: '11%' }} />
      </span>,
    ],
    [
      <>
        Volume 3.0 → 4.0 / 7.0 m³
      </>,
      <span className="t-before-after">
        <span style={{ width: '43%' }} />
        <span className="is-added" style={{ width: '14%' }} />
      </span>,
    ],
  ];
  return (
    <div className="t-consequence" role="status" aria-label="Consequence preview">
      <div className="wp-row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700 }}>If you move ORD1003 here</h3>
        <CircleCheck size={18} color="var(--success)" />
      </div>
      {rows.map(([label, meter], i) => (
        <div key={i} className="t-cq-row">
          <CircleCheck size={17} />
          <div className="wp-col" style={{ gap: 4, flex: 1 }}>
            <M w={500} style={{ fontSize: 13 }}>
              {label}
            </M>
            {meter}
          </div>
        </div>
      ))}
      <div className="t-cq-row">
        <CircleCheck size={17} />
        <M w={500} style={{ fontSize: 13, flex: 1 }}>
          Window: last arrival
          <br />
          within 07:30
        </M>
        <MockTag />
      </div>
      <div className="t-cq-row">
        <CircleCheck size={17} />
        <div className="wp-col" style={{ gap: 2 }}>
          <M w={500} style={{ fontSize: 13 }}>
            Fresh minutes 226 → 226 / 270
          </M>
          <span className="muted" style={{ fontSize: 12 }}>
            Stop moved, not added
          </span>
        </div>
      </div>
      <div className="wp-divider" />
      <div className="wp-col" style={{ gap: 4 }}>
        <M w={500} style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
          VEH035 · Trip 2
        </M>
        <M style={{ fontSize: 12, color: 'var(--ink-muted)' }}>Frees 120 kg / 1.0 m³</M>
      </div>
      <span className="wp-row" style={{ gap: 6, color: 'var(--success)', fontSize: 12, fontWeight: 600 }}>
        <CirclePlus size={14} />
        New stop added at the end
      </span>
      <b style={{ color: 'var(--success)', fontSize: 13 }}>All rules pass: drop to accept</b>
    </div>
  );
}

function RefusalWindow({ onKeep, onTry }: { onKeep: () => void; onTry: () => void }) {
  return (
    <div className="t-refusal" style={{ left: 668, top: 128, width: 320 }} role="alertdialog" aria-label="Move refused">
      <div className="t-refusal__title">
        <CircleAlert size={18} />
        <span>Can't move ORD1009 to VEH003 · Trip 2</span>
      </div>
      <div className="wp-divider" style={{ background: 'rgba(180,35,24,0.2)' }} />
      <div className="t-rule is-bad">
        <X size={16} />
        <span>
          Window: planned arrival <M w={600}>08:06</M> is after OUT014's window closes at <M w={600}>08:00</M>.
        </span>
      </div>
      <details className="t-pass" open>
        <summary>
          <CircleCheck size={16} />
          Rules that pass
          <ChevronDown size={16} style={{ marginLeft: 'auto' }} />
        </summary>
        <p>Reefer ✓ · Capacity ✓ · Depot ✓ · One brand + district ✓ · Fuel ✓</p>
      </details>
      <div className="wp-row" style={{ gap: 16 }}>
        <Button onClick={onKeep} style={{ height: 34, padding: '0 13px', fontSize: 13, fontWeight: 700 }}>
          Keep deferred
        </Button>
        <Button variant="ghost" size="sm" onClick={onTry} style={{ padding: 0 }}>
          Try another trip
        </Button>
      </div>
    </div>
  );
}

function RefusalTwoRules() {
  return (
    <div className="t-refusal" style={{ left: 668, top: 144, width: 320 }} role="alertdialog" aria-label="Move refused">
      <div className="t-refusal__title">
        <CircleAlert size={18} />
        <span>Can't move ORD1002 to VEH011 · Trip 1</span>
      </div>
      <div className="wp-divider" style={{ background: 'rgba(180,35,24,0.2)' }} />
      <M style={{ fontSize: 12, lineHeight: 1.35 }}>ORD1002 · OUT009 · Fresh · Colombo · Chilled · 210 kg · 1.4 m³</M>
      <div className="t-rule is-bad">
        <X size={16} />
        <span>
          <Snowflake size={14} color="var(--chilled)" style={{ verticalAlign: -2, marginRight: 4 }} />
          Chilled order needs a reefer
          <br />
          VEH011 is ambient.
        </span>
      </div>
      <div className="t-rule is-bad" style={{ fontSize: 12 }}>
        <X size={16} />
        <span className="wp-row" style={{ gap: 4, flexWrap: 'wrap' }}>
          Trip would carry two brands (
          <Tag tone="style" className="t-tag">
            Style
          </Tag>
          <Tag tone="fresh" className="t-tag">
            Fresh
          </Tag>
          ).
        </span>
      </div>
      <b style={{ fontSize: 13 }}>Why this vehicle</b>
      <div className="t-checkgrid">
        {[
          ['Reefer', false],
          ['Capacity', true],
          ['One brand', false],
          ['Depot', true],
          ['Window', true],
          ['Fuel', true],
        ].map(([l, ok]) => (
          <span key={l as string} className={cx('t-check', ok ? 'is-ok' : 'is-bad')}>
            {ok ? <Check size={15} /> : <X size={15} />}
            {l}
          </span>
        ))}
      </div>
      <span className="t-refusal__stem" style={{ left: 264, height: 22 }} />
    </div>
  );
}

function RefusalGuard({ onKeep }: { onKeep: () => void }) {
  return (
    <div className="t-refusal" style={{ left: 668, top: 226, width: 352 }} role="alertdialog" aria-label="Deferral refused">
      <div className="t-refusal__title">
        <Lock size={18} />
        <span>Can't defer ORD1001</span>
      </div>
      <div className="wp-divider" style={{ background: 'rgba(180,35,24,0.2)' }} />
      <div className="wp-row" style={{ gap: 8 }}>
        <M w={600} style={{ fontSize: 12 }}>
          ORD1001 · OUT012
        </M>
        <Tag tone="danger" icon={<Lock size={12} />} className="t-tag" style={{ background: 'var(--surface-1)', borderColor: 'var(--danger)' }}>
          Protected
        </Tag>
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.45 }}>
        OUT012 was deferred yesterday and a legal vehicle exists today (VEH003 · Trip 1). The continuity guard protects outlets from being skipped twice.
      </p>
      <Button onClick={onKeep} style={{ height: 34, padding: '0 13px', fontSize: 13, fontWeight: 700, alignSelf: 'flex-start' }}>
        Keep on VEH003 · Trip 1
      </Button>
    </div>
  );
}

function WhyVehicle({ onClose }: { onClose: () => void }) {
  const rows: Array<[string, ReactNode]> = [
    ['Reefer', 'VEH003 is a reefer truck; ORD1014 is chilled'],
    ['Capacity', '1,160 / 5,510 kg · 7.7 / 26.4 m³'],
    ['Depot', 'Peliyagoda = Peliyagoda'],
    ['Access', 'Rear dock · normal access'],
    ['Window', 'Arrives 03:54 · window 03:00–08:00'],
    ['Fuel', '74.2 / 480 L this week incl. tonight'],
    ['One brand + district', 'Fresh · Colombo'],
    ['Trips', 'Trip 1 of 2 · Fresh 241 / 270 min'],
  ];
  return (
    <div className="t-why" role="dialog" aria-label="Why this vehicle">
      <div className="wp-row" style={{ justifyContent: 'space-between' }}>
        <h3 className="wp-row" style={{ gap: 9, fontSize: 17, fontWeight: 700 }}>
          <Truck size={19} color="var(--route)" />
          Why VEH003 · Trip 1 for ORD1014
        </h3>
      </div>
      <span className="muted" style={{ fontSize: 12 }}>
        OUT011 · Fresh · Colombo · chilled · 240 kg · 1.6 m³
      </span>
      <div className="wp-divider" />
      {rows.map(([label, evidence]) => (
        <div key={label} className="t-why__row">
          <Check size={18} color="var(--success)" />
          <div className="wp-col" style={{ gap: 1 }}>
            <b style={{ fontSize: 14, fontWeight: 600 }} className="wp-row">
              {label}
              {label === 'Reefer' && <Snowflake size={14} color="var(--chilled)" style={{ marginLeft: 6 }} />}
            </b>
            <span className="muted" style={{ fontSize: 12 }}>
              {evidence}
            </span>
          </div>
        </div>
      ))}
      <Tag tone="success" icon={<Check size={14} />} style={{ height: 28, padding: '0 10px', alignSelf: 'flex-start' }}>
        8 of 8 rules pass
      </Tag>
      <span style={{ position: 'absolute', top: 12, right: 12 }}>
        <CloseButton onClick={onClose} label="Close why this vehicle" size={16} />
      </span>
    </div>
  );
}

function MoveToDialog({ onClose }: { onClose: () => void }) {
  const [sel, setSel] = useState(4);
  const options: Array<[string, string]> = [
    ['VEH003 · Trip 2', 'Arrives 08:06: after OUT014’s 08:00 window close'],
    ['VEH035 · Trip 2', 'Different district (Gampaha)'],
    ['VEH011 · Trip 1', 'Needs a reefer · would carry two brands'],
    ['VEH003 · Trip 1', 'Fresh minutes over 270 (Mock)'],
  ];
  return (
    <Modal width={560} onClose={onClose} label="Move ORD1017 to">
      <div
        className="t-moveto-dialog"
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setSel((s) => Math.min(4, s + 1));
          if (e.key === 'ArrowUp') setSel((s) => Math.max(0, s - 1));
          if (e.key === 'Enter' && sel === 4) onClose();
        }}
      >
        <div className="wp-row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 22, fontWeight: 600 }}>Move ORD1017 to…</h2>
          <CloseButton onClick={onClose} label="Close move dialog" />
        </div>
        <div className="wp-row" style={{ gap: 6 }}>
          <Tag tone="fresh" className="t-tag" icon={<span style={{ width: 7, height: 7, background: 'currentColor', borderRadius: 1 }} />}>
            Fresh
          </Tag>
          <Tag tone="chilled" className="t-tag" icon={<Snowflake size={12} />}>
            Chilled
          </Tag>
          <Tag tone="outline-ink" className="t-tag">
            Street
          </Tag>
          <M style={{ fontSize: 12, color: 'var(--ink-muted)' }}>OUT007 · 05:30–08:00 · 65 kg · 0.6 m³</M>
        </div>
        <label className="wp-search" style={{ width: '100%', borderColor: 'var(--line-strong)', height: 40 }}>
          <Search size={17} />
          <input placeholder="Search trips or vehicles" aria-label="Search trips or vehicles" autoFocus style={{ fontSize: 14 }} />
        </label>
        <div className="t-options" role="listbox" aria-label="Trips">
          {options.map(([label, reason], i) => (
            <div key={label} role="option" aria-selected={false} aria-disabled="true" className={cx('t-option', sel === i && 'is-cursor')}>
              <X size={18} color="var(--danger)" />
              <div className="wp-col" style={{ gap: 2, flex: 1 }}>
                <M style={{ fontSize: 14 }}>{label}</M>
                <span style={{ fontSize: 12, color: 'var(--danger)' }}>{reason}</span>
              </div>
              <span className="muted" style={{ fontSize: 12 }}>
                Not allowed
              </span>
            </div>
          ))}
          <div role="option" aria-selected={sel === 4} className={cx('t-option is-current', sel === 4 && 'is-cursor')} onClick={() => setSel(4)}>
            <span className="t-radio" />
            <div className="wp-col" style={{ gap: 2 }}>
              <b style={{ fontSize: 14, fontWeight: 600, color: 'var(--route)' }}>Keep deferred</b>
              <span className="muted" style={{ fontSize: 12 }}>
                Current · Deferred · policy → Wed 30 Sep
              </span>
            </div>
          </div>
        </div>
        <div className="wp-row" style={{ justifyContent: 'space-between' }}>
          <span className="muted" style={{ fontSize: 12 }}>
            ↑ ↓ to move · Enter to choose · Esc to close
          </span>
          <div className="wp-row" style={{ gap: 8 }}>
            <Button variant="secondary" onClick={onClose} style={{ fontWeight: 700 }}>
              Cancel
            </Button>
            <Button onClick={onClose} style={{ fontWeight: 700 }}>
              Keep deferred
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Pool ---------- */
function Pool({ mode }: { mode: BoardMode }) {
  const [over, setOver] = useState(false);
  const guard = mode.frame === 'D3.5';
  return (
    <aside
      className={cx('t-pool', (over || guard) && 'is-refusing')}
      onDragOver={(e) => {
        if (mode.readOnly || mode.disabled) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = dropResult(e.dataTransfer.getData('text/plain'), 'pool');
        if (f) mode.onFrame(f);
      }}
      aria-label="Unplaced and deferred orders"
    >
      <div className="wp-row" style={{ justifyContent: 'space-between' }}>
        <b className="muted" style={{ fontSize: 13 }}>
          UNPLACED / DEFERRED · 19
        </b>
        <MockTag />
      </div>
      <div className="wp-divider" />
      <div className={cx('wp-col', guard && 't-pool__dim')} style={{ gap: 12 }}>
        {deferredPool.map((d) => {
          const returned = mode.frame === 'D3.3' && d.order === 'ORD1009';
          return (
            <div
              key={d.order}
              className={cx('t-defcard', returned && 'is-returned')}
              draggable={!mode.readOnly && !mode.disabled}
              onDragStart={(e) => e.dataTransfer.setData('text/plain', d.order)}
              onClick={() => d.order === 'ORD1017' && !mode.readOnly && mode.onFrame('D3.6')}
            >
              <div className="wp-row" style={{ justifyContent: 'space-between' }}>
                <span className="wp-row" style={{ gap: 8 }}>
                  <CircleX size={16} color="var(--warning)" />
                  <M w={700} style={{ fontSize: 13 }}>
                    {d.order}
                  </M>
                </span>
                {returned ? (
                  <Tag tone="info" pill style={{ height: 24 }}>
                    Returned
                  </Tag>
                ) : (
                  <span className="t-defpill">{d.label}</span>
                )}
              </div>
              {d.note && (
                <span className="muted" style={{ fontSize: 12 }}>
                  {d.note}
                </span>
              )}
              {returned && (
                <>
                  <M style={{ fontSize: 12, lineHeight: 1.45 }}>ORD1009 · OUT014 · Fresh · Colombo · Chilled · Street · 05:30–08:00 · 95 kg · 0.9 m³</M>
                  <span className="t-defpill" style={{ alignSelf: 'flex-end' }}>
                    {d.label}
                  </span>
                </>
              )}
            </div>
          );
        })}
        <button className="wp-link wp-row" style={{ gap: 6, fontSize: 14, height: 30, padding: '0 4px' }}>
          +15 more
          <ArrowRight size={16} />
        </button>
      </div>
    </aside>
  );
}

/* ---------- Board ---------- */
function Board({ mode }: { mode: BoardMode }) {
  const f = mode.frame;
  const cardVariant = (id: string): 'ok' | 'bad' | undefined => {
    if (f === 'D3.2' && id === 'VEH035-1') return 'ok';
    if (f === 'D3.3' && id === 'VEH003-2') return 'bad';
    if (f === 'D3.4' && id === 'VEH011-1') return 'bad';
    return undefined;
  };
  const slotsFor = (id: string): Record<number, ReactNode> | undefined => {
    if (f === 'D3.2' && id === 'VEH035-2')
      return {
        2: (
          <div key="lifted" className="t-slot">
            <GripVertical size={14} />
            Order lifted from this position
          </div>
        ),
      };
    if (f === 'D3.5' && id === 'VEH003-1')
      return {
        5: (
          <div key="lifted" className="t-slot is-route">
            <Lock size={14} />
            Protected stop lifted
          </div>
        ),
      };
    return undefined;
  };
  const extraFor = (id: string) =>
    f === 'D3.2' && id === 'VEH035-1' ? (
      <div className="t-slot is-ok">
        <CirclePlus size={15} />
        New stop added at the end
      </div>
    ) : undefined;

  return (
    <div className="t-board">
      <div className="t-lanes">
        {lanes.map((lane) => (
          <div key={lane.vehicle} className="t-lane" style={{ minHeight: lane.height }}>
            <LaneHeader lane={lane} />
            <div className="t-trips">
              {lane.trips.map((t) => (
                <TripCard key={t.id} trip={t} mode={mode} variant={cardVariant(t.id)} slots={slotsFor(t.id)} extra={extraFor(t.id)} />
              ))}
            </div>
          </div>
        ))}
        <div className="t-lane t-lane--workshop">
          <M w={700} style={{ fontSize: 14, color: 'var(--ink-muted)', width: 170 }}>
            VEH036
          </M>
          <span className="wp-row" style={{ gap: 8, fontSize: 14, fontWeight: 600, color: 'var(--ink-muted)' }}>
            <Wrench size={18} />
            In workshop until 02:45
          </span>
        </div>
        {f === 'D3.2' && (
          <div className="t-dragged" style={{ left: 544, top: 214 }}>
            <GripVertical size={16} color="var(--route)" />
            <div className="wp-col" style={{ gap: 3, flex: 1 }}>
              <M w={600} style={{ fontSize: 13 }}>
                ORD1003 · OUT025 · Fresh · Gampaha
              </M>
              <M style={{ fontSize: 12, color: 'var(--ink-muted)' }}>Chilled · 120 kg · 1.0 m³</M>
            </div>
            <Tag tone="info" pill icon={<Move size={13} />} style={{ height: 26, fontWeight: 700 }}>
              Moving
            </Tag>
          </div>
        )}
        {f === 'D3.3' && <RefusalWindow onKeep={() => mode.onFrame('D3.1')} onTry={() => mode.onFrame('D3.6')} />}
        {f === 'D3.4' && <RefusalTwoRules />}
        {f === 'D3.5' && <RefusalGuard onKeep={() => mode.onFrame('D3.1')} />}
        {f === 'D3.7' && <WhyVehicle onClose={() => mode.onFrame('D3.1')} />}
      </div>
      <div style={{ position: 'relative' }}>
        <Pool mode={mode} />
        {f === 'D3.2' && <ConsequencePanel />}
        {f === 'D3.5' && (
          <div className="t-dragged t-dragged--guard">
            <GripVertical size={16} color="var(--route)" />
            <div className="wp-col" style={{ gap: 6, flex: 1 }}>
              <div className="wp-row" style={{ justifyContent: 'space-between' }}>
                <M w={600} style={{ fontSize: 13 }}>
                  ORD1001&nbsp;&nbsp;OUT012
                </M>
                <M style={{ fontSize: 12, color: 'var(--ink-muted)' }}>05:27 · waits to 05:30</M>
              </div>
              <div className="wp-row" style={{ gap: 6 }}>
                <Tag tone="info" className="t-tag" style={{ background: 'transparent', borderColor: 'var(--route)', fontWeight: 700 }}>
                  Carry-over
                </Tag>
                <Tag tone="info" className="t-tag" icon={<Lock size={12} />} style={{ background: 'transparent', borderColor: 'var(--route)', fontWeight: 700 }}>
                  Protected
                </Tag>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingBoard() {
  return (
    <div className="t-board">
      <div className="wp-col" style={{ gap: 16, flex: 1 }}>
        <span className="wp-loading-caption" style={{ fontSize: 14, fontWeight: 500 }}>
          <RefreshCw size={16} className="spin" />
          Drafting plan v1…
        </span>
        {[2, 2, 2, 1].map((n, i) => (
          <div key={i} className="t-skel-lane">
            <div className="wp-col" style={{ gap: 8, width: 150 }}>
              <span className="t-bar is-line" style={{ width: 80 }} />
              <span className="t-bar is-line" style={{ width: 130 }} />
              <span className="t-bar is-line" style={{ width: 110 }} />
            </div>
            {Array.from({ length: n }, (_, j) => (
              <div key={j} className="t-skel-card">
                {[220, 160, 300, 300, 260].map((w, k) => (
                  <span key={k} className="t-bar" style={{ width: w }} />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="t-pool" style={{ gap: 12, padding: 16, alignSelf: 'flex-start' }}>
        <span className="wp-label" style={{ fontWeight: 600, letterSpacing: '0.48px' }}>
          Unplaced / deferred
        </span>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="t-skel-def">
            <span className="t-bar" style={{ width: 120 }} />
            <span className="t-bar" style={{ width: 200 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Screen ---------- */
export default function Trips() {
  const [frame, setFrame] = useFrame<Frame>('D3.1');
  const go = useGo();
  const released = frame === 'D3.8';
  const offline = frame === 'D3.S-offline';
  const noDraft = frame === 'D3.S-empty' || frame === 'D3.S-loading';

  const time = frame === 'D3.8' ? '23:41' : frame === 'D3.S-empty' ? '15:52' : frame === 'D3.S-loading' ? '16:05' : '21:15';
  const bar = <AppBar current="plan" deferrals={19} time={time} context="Mon 28 Sep · Peliyagoda" syncLabel="Live sync" offline={offline} offlineQuiet />;

  const overline = released
    ? 'TRIPS · PELIYAGODA · PLAN v3 RELEASED 23:40'
    : frame === 'D3.S-empty'
      ? 'TRIPS · PELIYAGODA · NO DRAFT YET'
      : frame === 'D3.S-loading'
        ? 'TRIPS · PELIYAGODA · PLAN v1'
        : 'TRIPS · PELIYAGODA · PLAN v2 DRAFT';

  const mode: BoardMode = { frame, readOnly: released, disabled: offline, onFrame: setFrame };

  const action = released ? (
    <Button variant="secondary" iconRight={<ArrowRight size={16} />} onClick={() => go('/live', 'D6.1')} style={{ fontWeight: 600 }}>
      Open live view
    </Button>
  ) : (
    <Button iconRight={<ArrowRight size={16} />} disabled={noDraft} onClick={() => go('/plan/deferrals', 'D4.1')} style={{ fontWeight: 700 }}>
      Review deferrals
    </Button>
  );

  let body: ReactNode;
  if (frame === 'D3.S-empty') {
    body = (
      <div className="wp-card wp-card--flat t-empty">
        <div className="wp-state__tile" style={{ borderRadius: 12 }}>
          <List size={24} />
        </div>
        <b style={{ fontSize: 22, fontWeight: 600 }}>No trips yet</b>
        <span className="muted" style={{ fontSize: 15 }}>
          The draft appears after the cutoff.
        </span>
        <div className="t-facts">
          <div>
            <span>Cutoff</span>
            <M w={500}>16:00</M>
          </div>
          <div>
            <span>Confirmed orders</span>
            <M w={500}>0</M>
          </div>
        </div>
        <Button variant="ghost" iconRight={<ArrowRight size={16} />} onClick={() => go('/plan/queue', 'D1.1')} style={{ fontWeight: 600, padding: '0 16px' }}>
          Go to queue
        </Button>
      </div>
    );
  } else if (frame === 'D3.S-loading') {
    body = <LoadingBoard />;
  } else {
    body = (
      <>
        {released && (
          <Alert
            tone="info"
            icon={<Lock size={20} />}
            title={<span style={{ fontWeight: 600 }}>Plan v3 released at 23:40, the board is read-only.</span>}
            style={{ minHeight: 54 }}
            actions={
              <Button variant="ghost" size="sm" iconRight={<ArrowRight size={16} />} onClick={() => go('/live', 'D6.1')} style={{ fontWeight: 600 }}>
                Open live view
              </Button>
            }
          >
            <span style={{ color: 'var(--ink)' }}>Changes after release happen in Live and create a new version.</span>
          </Alert>
        )}
        {frame === 'D3.S-error' && (
          <Alert
            tone="danger"
            icon={<CircleAlert size={20} />}
            title={<span style={{ fontWeight: 600 }}>Move not saved: ORD1003 is back on VEH035 · Trip 2.</span>}
            style={{ minHeight: 54 }}
            actions={
              <Button variant="secondary" size="sm" icon={<RefreshCw size={15} />} onClick={() => setFrame('D3.1')} style={{ fontWeight: 700 }}>
                Try again
              </Button>
            }
          >
            <span style={{ color: 'var(--ink)' }}>Your other edits are safe. This was a save failure, not a rule refusal.</span>
          </Alert>
        )}
        <Board mode={mode} />
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
              <b style={{ fontWeight: 700 }}>Offline.</b>&nbsp;&nbsp;<span style={{ fontWeight: 500 }}>Edits paused. Last saved change 21:14.</span>
            </span>
            <M style={{ marginLeft: 'auto', color: 'var(--on-chrome-muted)', fontSize: 12 }}>Last sync 21:14</M>
          </div>
        ) : undefined
      }
    >
      <div className="wp-col" style={{ gap: 12, flex: 1 }}>
        <PageHeader overline={overline} title="Trip board" actions={action}>
          <Stepper current={3} done={released ? [1, 2, 3, 4, 5] : [1, 2]} />
        </PageHeader>
        {body}
      </div>
      {frame === 'D3.6' && <MoveToDialog onClose={() => setFrame('D3.1')} />}
    </Screen>
  );
}
