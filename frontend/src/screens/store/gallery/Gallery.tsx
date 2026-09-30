import { MemoryRouter } from "react-router-dom";
import { StoreProvider } from "../../../app/StoreProvider";
import { StoreRoot } from "../../../app/StoreRoot";
import { StoreRoutes } from "../../../app/StoreRoutes";
import { FRAME_GROUPS, findFrame, type Frame } from "./frames";
import styles from "./Gallery.module.css";

/** One frame full screen, in its own memory router and store, for the compare script. */
function FrameHost({ frame }: { frame: Frame }) {
  return (
    <MemoryRouter initialEntries={[frame.url]}>
      <StoreProvider>
        <StoreRoot>
          <StoreRoutes />
        </StoreRoot>
      </StoreProvider>
    </MemoryRouter>
  );
}

/**
 * /store/_states, the dev-only state gallery (PRD v3 section 15): every frame of S1 to S4 at its
 * Figma size, labelled with its frame name, each in its own iframe so its media queries and its
 * clock are its own. `?frame=<id>` renders one frame full screen. Nothing in the product links here.
 */
export function Gallery() {
  const frameId = new URLSearchParams(window.location.search).get("frame");
  const one = findFrame(frameId);
  if (one) return <FrameHost frame={one} />;

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Waypoint Store · state gallery</h1>
      <p className={styles.note}>
        Dev only. Every frame of S1 to S4 at its Figma size, opened from an address and the scenario clock. Open one
        full screen with <code>?frame=s2.3</code>.
      </p>
      {FRAME_GROUPS.map((group) => (
        <section key={group.screen} className={styles.group} aria-label={group.title}>
          <h2 className={styles.groupTitle}>{group.title}</h2>
          <div className={styles.frames}>
            {group.frames.map((f) => (
              <figure key={f.id} className={styles.figure}>
                <figcaption className={styles.caption}>
                  <a href={`/store/_states?frame=${f.id}`}>{f.name}</a>
                </figcaption>
                <iframe
                  title={f.name}
                  src={`/store/_states?frame=${f.id}`}
                  width={f.width}
                  height={f.height}
                  loading="lazy"
                  className={styles.frame}
                />
              </figure>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
