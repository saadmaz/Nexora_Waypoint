import { Link } from 'react-router-dom';
import { SECTIONS, frameHref } from '../frames';

const FIGMA = 'https://www.figma.com/design/0qCle1zCrSImSou4lVlvmL/NEXORA---TRIATHLON?node-id=';

/** Index of every dispatcher frame, for review against the Figma file. */
export default function ScreenIndex() {
  return (
    <div className="wp-app">
      <main className="wp-workspace" style={{ gap: 24, paddingTop: 32 }}>
        <div className="wp-header__title-block">
          <span className="wp-overline">Waypoint Dispatch · Dispatcher</span>
          <h1 className="wp-h1">All screens</h1>
          <p className="muted" style={{ fontSize: 14 }}>
            Every frame on the Figma “Dispatcher” page. Each link opens the live screen in that state; actions inside a screen move between states.
          </p>
        </div>
        {SECTIONS.map((s) => (
          <section key={s.key} className="wp-card" style={{ padding: 20 }}>
            <div className="wp-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="wp-col" style={{ gap: 2 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>{s.title}</h2>
                <span className="muted" style={{ fontSize: 13 }}>
                  {s.subtitle}
                </span>
              </div>
            </div>
            <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
              {s.frames.map((fr) => (
                <li key={fr.id} className="wp-row" style={{ gap: 10, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8 }}>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 600, width: 88, flexShrink: 0 }}>
                    {fr.id}
                  </span>
                  <Link to={frameHref(fr)} className="wp-link" style={{ fontSize: 13, flex: 1 }}>
                    {fr.title}
                  </Link>
                  <a href={FIGMA + fr.node.replace(':', '-')} target="_blank" rel="noreferrer" className="muted" style={{ fontSize: 12 }}>
                    Figma
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
