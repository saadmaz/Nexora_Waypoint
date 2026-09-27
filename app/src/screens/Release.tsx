import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowRight, Check, CircleAlert, Clock3, Info, Lock, Phone, RefreshCw, Route, TriangleAlert, WifiOff } from 'lucide-react';
import { AppBar, PageHeader, Screen, Stepper, useFrame, useGo } from '../components/shell';
import type { Depot } from '../components/shell';
import { Button, Checkbox, M, Modal, cx } from '../components/ui';
import './release.css';

type Frame = 'D5.1' | 'D5.2' | 'D5.3' | 'D5.4' | 'D5.4b' | 'D5.S-empty' | 'D5.S-loading' | 'D5.S-offline' | 'D5.S-error';

function Label({ children }: { children: ReactNode }) {
  return <span className="r-label">{children}</span>;
}

function Pill({ tone, icon, children }: { tone: 'neutral' | 'info' | 'success' | 'warning' | 'offline'; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={cx('r-pill', `r-pill--${tone}`)}>
      {icon}
      {children}
    </span>
  );
}

function StatBox({ label, value, foot, warn }: { label: string; value: string; foot: string; warn?: boolean }) {
  return (
    <div className="r-stat">
      <Label>{label}</Label>
      <M w={600} style={{ fontSize: 30 }}>
        {value}
      </M>
      <span className={cx('r-foot', warn && 'is-warn')}>
        {warn && <Clock3 size={14} />}
        {foot}
      </span>
    </div>
  );
}

interface Version {
  v: string;
  when: string;
  state: 'Draft' | 'Released' | 'Current draft';
  note: string;
  current?: boolean;
}

function VersionHistory({ versions, links }: { versions: Version[]; links?: boolean }) {
  return (
    <aside className="r-side">
      <div className="r-panel" style={{ padding: '16px 0' }}>
        <div style={{ padding: '0 20px 10px' }}>
          <Label>Version history</Label>
        </div>
        {versions.map((v) => (
          <div key={v.v} className={cx('r-version', v.current && 'is-current')}>
            <div className="wp-col" style={{ gap: 2, flex: 1 }}>
              <div className="wp-row" style={{ gap: 8 }}>
                <M w={600} style={{ fontSize: 14, color: v.current ? 'var(--route)' : undefined }}>
                  {v.v}
                </M>
                <M style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{v.when}</M>
                {v.state === 'Draft' ? (
                  <Pill tone="neutral" icon={<Clock3 size={14} />}>
                    Draft
                  </Pill>
                ) : (
                  <Pill tone="info" icon={<Route size={14} />}>
                    {v.state}
                  </Pill>
                )}
              </div>
              <span className="muted" style={{ fontSize: 12 }}>
                {v.note}
              </span>
            </div>
            {links && (
              <button className="wp-link" style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', alignSelf: 'flex-start', marginTop: 4 }}>
                View changes
              </button>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}

const DRAFT_VERSIONS: Version[] = [
  { v: 'v1', when: 'Mon 16:05', state: 'Draft', note: 'System draft from the closed queue' },
  { v: 'v2', when: 'Mon 21:15', state: 'Draft', note: "Kumari's adjustments after the capacity review" },
  { v: 'v3', when: 'now', state: 'Current draft', note: 'Peliyagoda + Kandy · ready to release', current: true },
];

const V4_VERSIONS: Version[] = [
  { v: 'v4', when: 'Tue 03:00', state: 'Released', note: 'VEH003 → VEH036; ORD1002 deferred (policy)', current: true },
  { v: 'v3', when: 'Mon 23:40', state: 'Released', note: 'Peliyagoda + Kandy' },
  { v: 'v2', when: 'Mon 21:15', state: 'Draft', note: "Kumari's adjustments" },
  { v: 'v1', when: 'Mon 16:05', state: 'Draft', note: 'System draft' },
];

const V5_VERSIONS: Version[] = [
  { v: 'v5', when: 'Tue 05:21', state: 'Released', note: 'ORD2001 + ORD2002 deferred (store request); driver offline since 05:17', current: true },
  { ...V4_VERSIONS[0], current: false },
  ...V4_VERSIONS.slice(1),
];

function DraftBody() {
  const checks = ['All trips pass every rule', '19 deferral notices ready', '0 unplaced orders without a reason', 'Every vehicle has a driver and dock assigned'];
  const rows: Array<[string, string, string, string, string]> = [
    ['Peliyagoda', '212', '193', '19', 'Priya · 8 drivers'],
    ['Kandy', '64', '64', '0', 'Ruwan · 3 drivers'],
  ];
  return (
    <>
      <div className="r-stats">
        <StatBox label="Orders" value="276" foot="Peliyagoda 212 · Kandy 64" />
        <StatBox label="Served" value="257" foot="on 36 trips (Mock)" />
        <StatBox label="Deferred" value="19" foot="1 capacity · 18 policy" warn />
        <StatBox label="Receivers" value="13" foot="2 docks · 11 drivers (Mock)" />
      </div>
      <div className="r-layout">
        <div className="r-main">
          <section className="r-panel" style={{ gap: 12 }}>
            <Label>Before you release</Label>
            {checks.map((c) => (
              <div key={c} className="wp-row" style={{ gap: 10 }}>
                <span className="r-check">
                  <Check size={14} strokeWidth={3} />
                </span>
                <span style={{ fontSize: 14 }}>{c}</span>
              </div>
            ))}
          </section>
          <section className="r-panel" style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
            <div className="r-trow r-trow--head">
              {['Depot', 'Orders', 'Served', 'Deferred', 'Receivers'].map((h, i) => (
                <span key={h} className={cx('r-tcell', i > 0 && 'is-num')}>
                  <Label>{h}</Label>
                </span>
              ))}
            </div>
            {rows.map((r, idx) => (
              <div key={r[0]} className="r-trow" style={{ borderTop: idx ? '1px solid var(--line)' : undefined }}>
                <span className="r-tcell">
                  <b style={{ fontSize: 14, fontWeight: 600 }}>{r[0]}</b>
                </span>
                {r.slice(1).map((v, i) => (
                  <span key={i} className="r-tcell is-num">
                    <M w={500} style={{ fontSize: 14 }}>
                      {v}
                    </M>
                  </span>
                ))}
              </div>
            ))}
          </section>
          <div className="r-alert r-alert--info">
            <Info size={20} />
            <div className="wp-col" style={{ gap: 2 }}>
              <b style={{ fontSize: 14, fontWeight: 600 }}>After release, trips become read-only.</b>
              <span style={{ fontSize: 13 }}>Loaders and drivers must acknowledge v3. Later changes happen in Live and create v4.</span>
            </div>
          </div>
        </div>
        <VersionHistory versions={DRAFT_VERSIONS} />
      </div>
    </>
  );
}

interface Ack {
  initial: string;
  name: string;
  place: string;
  version: string;
  status: ReactNode;
  mock?: boolean;
}

function AckList({ title, count, rows }: { title: string; count: string; rows: Ack[] }) {
  return (
    <section className="r-panel" style={{ padding: '16px 0', gap: 0 }}>
      <div className="wp-row" style={{ padding: '0 20px 8px', justifyContent: 'space-between' }}>
        <Label>{title}</Label>
        <M w={500} style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
          {count}
        </M>
      </div>
      {rows.map((a, i) => (
        <div key={a.name} className="r-ack" style={{ borderTop: i ? '1px solid var(--line)' : undefined }}>
          <span className="r-avatar">{a.initial}</span>
          <div className="wp-col" style={{ gap: 2, flex: 1 }}>
            <b style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</b>
            <span className="muted" style={{ fontSize: 12 }}>
              {a.place}
            </span>
          </div>
          <M w={500} style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
            {a.version}
          </M>
          {a.status}
          {a.mock && <span className="r-mock">Mock data</span>}
        </div>
      ))}
    </section>
  );
}

const ok = (t: string) => (
  <Pill tone="success" icon={<Check size={14} />}>
    {t}
  </Pill>
);
const pending = (
  <Pill tone="warning" icon={<Clock3 size={14} />}>
    Acknowledgement pending
  </Pill>
);

export default function Release() {
  const [frame, setFrame] = useFrame<Frame>('D5.1');
  const go = useGo();
  const [sendNotices, setSendNotices] = useState(true);
  const [releasing, setReleasing] = useState(false);

  // After confirming in the dialog, the releasing state resolves to the released plan.
  useEffect(() => {
    if (!releasing || frame !== 'D5.S-loading') return;
    const t = window.setTimeout(() => {
      setReleasing(false);
      setFrame('D5.3');
    }, 1600);
    return () => window.clearTimeout(t);
  }, [releasing, frame]); // eslint-disable-line react-hooks/exhaustive-deps

  const v4 = frame === 'D5.3' || frame === 'D5.4';
  const v5 = frame === 'D5.4b';
  const released = v4 || v5;
  const offline = frame === 'D5.S-offline';
  const empty = frame === 'D5.S-empty';

  const time = frame === 'D5.3' ? '04:30' : frame === 'D5.4' ? '04:56' : v5 ? '05:22' : empty ? '15:50' : '23:35';
  const context = v5 ? 'Tue 29 Sep · Kandy' : v4 ? 'Tue 29 Sep · Peliyagoda' : 'Mon 28 Sep · Peliyagoda';
  const onDepot = (d: Depot) => d === 'Kandy' && released && setFrame('D5.4b');

  const bar = (
    <AppBar
      current="plan"
      deferrals={released ? 20 : 19}
      time={time}
      context={context}
      depot={v5 ? 'Kandy' : 'Peliyagoda'}
      onDepot={onDepot}
      syncLabel="Live sync"
      offline={offline}
      offlineQuiet
    />
  );

  const overline = v5 ? 'RELEASE · PLAN v5 RELEASED 05:21' : v4 ? 'RELEASE · PLAN v4 RELEASED 03:00' : empty ? 'RELEASE · NO DRAFT' : 'RELEASE · PLAN v3 DRAFT';
  const title = v5 ? 'Plan v5 is live' : v4 ? 'Plan v4 is live' : empty ? 'Release' : 'Release plan v3';

  let actions: ReactNode;
  if (released) {
    actions = (
      <Button variant="secondary" iconRight={<ArrowRight size={16} />} onClick={() => go('/live', v5 ? 'D6.4' : 'D6.1')}>
        Open live view
      </Button>
    );
  } else if (frame === 'D5.S-loading') {
    actions = (
      <Button icon={<RefreshCw size={16} className="spin" />} aria-busy="true" style={{ opacity: 0.8, fontWeight: 700 }}>
        Releasing v3
      </Button>
    );
  } else {
    actions = (
      <>
        {offline && <span className="muted" style={{ fontSize: 13 }}>Reconnect to release</span>}
        <Button icon={<Lock size={16} />} disabled={offline || empty} onClick={() => setFrame('D5.2')} style={{ fontWeight: 700 }}>
          {empty ? 'Release plan' : 'Release plan v3'}
        </Button>
      </>
    );
  }

  let body: ReactNode;
  if (empty) {
    body = (
      <div className="wp-card wp-card--flat d-empty" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>
        <div className="wp-state__tile" style={{ borderRadius: 12 }}>
          <Lock size={24} />
        </div>
        <b style={{ fontSize: 22, fontWeight: 600 }}>Nothing to release</b>
        <span className="muted" style={{ fontSize: 15 }}>
          Draft a plan first, the system drafts v1 after the 16:00 cutoff.
        </span>
        <Button iconRight={<ArrowRight size={16} />} onClick={() => go('/plan/queue', 'D1.1')} style={{ fontWeight: 700 }}>
          Go to queue
        </Button>
      </div>
    );
  } else if (released) {
    const rows: Ack[] =
      frame === 'D5.3'
        ? [
            { initial: 'P', name: 'Priya', place: 'Peliyagoda dock · PIN', version: 'v4', status: ok('03:05') },
            { initial: 'R', name: 'Ruwan', place: 'Kandy dock · PIN', version: 'v4', status: pending },
            { initial: 'N', name: 'Nimal', place: 'VEH039 · driver phone', version: 'v4', status: pending },
            { initial: 'D', name: 'VEH036 driver', place: 'Peliyagoda · driver phone', version: 'v4', status: ok('03:10'), mock: true },
          ]
        : frame === 'D5.4'
          ? [
              { initial: 'P', name: 'Priya', place: 'Peliyagoda dock · PIN', version: 'v4', status: ok('03:05') },
              { initial: 'R', name: 'Ruwan', place: 'Kandy dock · PIN', version: 'v4', status: ok('04:15') },
              { initial: 'N', name: 'Nimal', place: 'VEH039 · driver phone', version: 'v4', status: ok('04:55') },
              { initial: 'D', name: 'VEH036 driver', place: 'Peliyagoda · driver phone', version: 'v4', status: ok('03:10'), mock: true },
            ]
          : [
              { initial: 'P', name: 'Priya', place: 'Peliyagoda dock · PIN', version: 'v4', status: ok('03:05 · no change in v5') },
              { initial: 'R', name: 'Ruwan', place: 'Kandy dock · PIN', version: 'v5', status: ok('05:22 (Mock)') },
              {
                initial: 'N',
                name: 'Nimal',
                place: 'VEH039 · driver phone',
                version: 'v5',
                status: (
                  <Pill tone="offline" icon={<WifiOff size={14} />}>
                    v5 not received · offline since 05:17
                  </Pill>
                ),
              },
              { initial: 'D', name: 'VEH036 driver', place: 'Peliyagoda · driver phone', version: 'v4', status: ok('03:10 · no change in v5'), mock: true },
            ];
    body = (
      <>
        {frame === 'D5.3' && (
          <div className="r-alert r-alert--warning">
            <TriangleAlert size={20} />
            <div className="wp-col" style={{ gap: 2, flex: 1 }}>
              <b style={{ fontSize: 14, fontWeight: 600 }}>Kandy dock hasn't acknowledged v4, the load gate stays blocked for its vehicles.</b>
              <span style={{ fontSize: 13 }}>VEH039 departs 05:10. Ruwan sees v4 on the dock tablet now.</span>
            </div>
            <Button variant="secondary" size="sm" icon={<Phone size={16} />} style={{ height: 32, padding: '0 10px' }}>
              Call Kandy dock
            </Button>
          </div>
        )}
        {frame === 'D5.4' && (
          <div className="r-alert r-alert--success">
            <Check size={20} />
            <div className="wp-col" style={{ gap: 2 }}>
              <b style={{ fontSize: 14, fontWeight: 600 }}>Everyone has plan v4.</b>
              <span style={{ fontSize: 13 }}>Both docks and every driver acknowledged. Load gates are open.</span>
            </div>
          </div>
        )}
        {v5 && (
          <div className="r-alert r-alert--warning">
            <WifiOff size={20} />
            <div className="wp-col" style={{ gap: 2, flex: 1 }}>
              <b style={{ fontSize: 14, fontWeight: 600 }}>VEH039 hasn't received v5, driver offline since 05:17.</b>
              <span style={{ fontSize: 13 }}>v5 defers ORD2001 + ORD2002 at OUT084's request. The phone will get it on next sync.</span>
            </div>
            <Button variant="secondary" size="sm" iconRight={<ArrowRight size={16} />} onClick={() => go('/live', 'D6.4')} style={{ height: 32, padding: '0 10px' }}>
              Open live view
            </Button>
          </div>
        )}
        <div className="r-layout">
          <div className="r-main">
            <AckList
              title={v5 ? 'Who has plan v5' : 'Who has plan v4'}
              count={frame === 'D5.3' ? '2 of 4 acknowledged' : frame === 'D5.4' ? '4 of 4 acknowledged' : '3 of 4 acknowledged'}
              rows={rows}
            />
          </div>
          <VersionHistory versions={v5 ? V5_VERSIONS : V4_VERSIONS} links={frame !== 'D5.3'} />
        </div>
      </>
    );
  } else {
    body = (
      <>
        {frame === 'D5.S-error' && (
          <div className="r-alert r-alert--danger">
            <CircleAlert size={20} />
            <div className="wp-col" style={{ gap: 2, flex: 1 }}>
              <b style={{ fontSize: 14, fontWeight: 600 }}>Release failed: loaders and drivers are still on v2.</b>
              <span style={{ fontSize: 13 }}>Nothing was sent. Plan v3 is saved as a draft.</span>
            </div>
            <Button variant="secondary" size="sm" icon={<RefreshCw size={16} />} onClick={() => setFrame('D5.2')} style={{ height: 32, padding: '0 10px' }}>
              Retry release
            </Button>
          </div>
        )}
        <DraftBody />
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
              <b style={{ fontWeight: 700 }}>Offline.</b>&nbsp;&nbsp;<span style={{ fontWeight: 500 }}>Can't release while offline, plan v3 is saved as a draft.</span>
            </span>
            <M style={{ marginLeft: 'auto', color: 'var(--on-chrome-muted)', fontSize: 12 }}>Last sync 23:33</M>
          </div>
        ) : undefined
      }
      toast={
        frame === 'D5.S-loading' ? (
          <div className="wp-toast" role="status" style={{ fontSize: 13, padding: '12px 16px', gap: 10 }}>
            <RefreshCw size={16} className="spin" />
            Releasing v3 to 2 docks and 11 drivers…
          </div>
        ) : undefined
      }
    >
      <div className="wp-col" style={{ gap: 20 }}>
        <PageHeader overline={overline} title={title} actions={actions}>
          <Stepper current={5} done={released ? [1, 2, 3, 4, 5] : [1, 2, 3, 4]} />
        </PageHeader>
        {body}
      </div>
      {frame === 'D5.2' && (
        <Modal width={520} onClose={() => setFrame('D5.1')} label="Release plan v3?">
          <div className="r-dialog">
            <h2 style={{ fontSize: 22, fontWeight: 600 }}>Release plan v3?</h2>
            <p style={{ fontSize: 15, lineHeight: 1.5 }}>
              Loaders and drivers will see v3 and must acknowledge it. 19 stores will be told their order is deferred. Trips become read-only; later changes create v4.
            </p>
            <div className="r-checkrow">
              <Checkbox checked={sendNotices} onChange={setSendNotices} label={<span style={{ fontSize: 14 }}>Send 19 deferral notices now</span>} />
            </div>
            <div className="wp-row" style={{ gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setFrame('D5.1')} style={{ fontWeight: 600 }}>
                Keep editing
              </Button>
              <Button icon={<Lock size={16} />} onClick={() => {
                  setReleasing(true);
                  setFrame('D5.S-loading');
                }}
                autoFocus style={{ fontWeight: 700 }}>
                Release v3
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Screen>
  );
}
