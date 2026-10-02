import { MemoryRouter } from "react-router-dom";
import { RoleRoot } from "../../../shared/RoleRoot";
import { DispatcherProvider } from "../DispatcherProvider";
import { DispatcherRoutes } from "../DispatcherRoutes";
import { FRAME_GROUPS, findFrame, type Frame } from "./frames";
import styles from "./Gallery.module.css";

/** A frame renders at the desktop size the design was drawn at, and the gallery shows it at half size. */
const WIDTH = 1440;
const HEIGHT = 900;
const SCALE = 0.5;
const GALLERY_PATH = "/dispatcher/_states";

/** One frame full screen, in its own memory router, API and clock, for the compare script. */
function FrameHost({ frame }: { frame: Frame }) {
  return (
    <MemoryRouter initialEntries={[frame.url]}>
      <DispatcherProvider>
        <RoleRoot theme="light">
          <DispatcherRoutes />
        </RoleRoot>
      </DispatcherProvider>
    </MemoryRouter>
  );
}

/**
 * /dispatcher/_states, the dev-only state gallery (PRD v3 section 15): every frame of D1 to D9 with its
 * loading, empty, offline and error states, labelled with its frame name, each in its own iframe so its
 * clock and its data are its own. `?frame=<id>` renders one frame full screen. Nothing in the product links
 * here, and a production build does not serve it.
 */
export function Gallery() {
  const frameId = new URLSearchParams(window.location.search).get("frame");
  const one = findFrame(frameId);
  if (one) return <FrameHost frame={one} />;

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Waypoint Dispatch · state gallery</h1>
      <p className={styles.note}>
        Dev only. Every frame of D1 to D9, opened from an address and the scenario clock, at half size. Open one full
        screen with <code>?frame=d3.4</code>.
      </p>
      <nav className={styles.index} aria-label="Screens">
        {FRAME_GROUPS.map((g) => (
          <a key={g.screen} href={`#${g.screen}`}>
            {g.screen}
          </a>
        ))}
      </nav>
      {FRAME_GROUPS.map((group) => (
        <section key={group.screen} id={group.screen} className={styles.group} aria-label={group.title}>
          <h2 className={styles.groupTitle}>{group.title}</h2>
          <div className={styles.frames}>
            {group.frames.map((f) => (
              <figure key={f.id} className={styles.figure} style={{ width: WIDTH * SCALE }}>
                <figcaption className={styles.caption}>
                  <a href={`${GALLERY_PATH}?frame=${f.id}`}>{f.name}</a>
                </figcaption>
                <div className={styles.clip} style={{ width: WIDTH * SCALE, height: HEIGHT * SCALE }}>
                  <iframe
                    title={f.name}
                    src={`${GALLERY_PATH}?frame=${f.id}`}
                    width={WIDTH}
                    height={HEIGHT}
                    loading="lazy"
                    className={styles.frame}
                    style={{ transform: `scale(${SCALE})` }}
                  />
                </div>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

export { GALLERY_PATH };
