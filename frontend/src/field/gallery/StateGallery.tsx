import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { SheetEnvironmentContext } from "../components/sheetEnvironment";
import { ClockProvider } from "../clock/ClockContext";
import { createFixedClock } from "../clock/mockClock";
import styles from "./StateGallery.module.css";

/**
 * One Figma frame of a role, as a state of a screen (field conventions sections 3 and 10). The
 * `render` function draws the real screen with fixture data, a fixed clock and a set connectivity;
 * the registry never holds a copy of a frame's markup.
 */
export type GalleryFrame = {
  /** The frame ID used in `?frame=` and in compare file names, for example "L2.1-A" or "R3.5-C". */
  frameId: string;
  /** The Figma node ID, shown under the label, for example "442:28482". */
  figmaNodeId: string;
  /** The frame name, for example "L2.1 · A · 04:30 · Load plan: in progress". */
  name: string;
  width: number;
  height: number;
  /** Scenario date and time of the frame (Asia/Colombo). The frame's clock is frozen here. */
  clock: { date: string; time: string };
  render: () => ReactNode;
};

export type StateGalleryProps = {
  /** "Waypoint Load" or "Driver". */
  title: string;
  frames: GalleryFrame[];
  /** The `?frame=` value: renders that one frame full-screen, with no label, for the compare script. */
  frameId?: string | null;
  /** Wraps every frame in the role's providers (router, theme root, API). */
  wrap?: (children: ReactNode, frame: GalleryFrame) => ReactNode;
};

/**
 * A frame's box. Sheets inside it portal into the box and are non-modal, so a gallery can show
 * many open sheets at once, each within its own frame.
 */
function FrameBox({ className, style, frameId, children }: { className: string; style: CSSProperties; frameId?: string; children: ReactNode }) {
  const [box, setBox] = useState<HTMLElement | null>(null);
  const environment = useMemo(() => ({ container: box, modal: false }), [box]);
  return (
    <div ref={setBox} className={className} style={style} data-frame={frameId}>
      {box && <SheetEnvironmentContext.Provider value={environment}>{children}</SheetEnvironmentContext.Provider>}
    </div>
  );
}

/**
 * The dev-only state gallery (`/loader/_states`, `/driver/_states`): every frame of a role, drawn
 * at its Figma size with its name and node ID, each under its own fixed clock. `?frame=<id>`
 * renders one frame alone at its size, which the compare script screenshots.
 */
export function StateGallery({ title, frames, frameId, wrap }: StateGalleryProps) {
  const draw = (frame: GalleryFrame) => {
    const inner = (
      <ClockProvider clock={createFixedClock(frame.clock.date, frame.clock.time)} drivesOfflineCore={false}>
        {frame.render()}
      </ClockProvider>
    );
    return wrap ? wrap(inner, frame) : inner;
  };

  if (frameId) {
    const frame = frames.find((f) => f.frameId === frameId);
    if (!frame) {
      return (
        <main className={styles.missing}>
          <p>
            No frame “{frameId}” in {title}.
          </p>
        </main>
      );
    }
    return (
      <FrameBox
        className={styles.single}
        frameId={frame.frameId}
        style={{ width: frame.width, minHeight: frame.height }}
      >
        {draw(frame)}
      </FrameBox>
    );
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{title}: state gallery</h1>
      <p className={styles.lede}>
        {frames.length} frames. Add <code>?frame=ID</code> to see one at its Figma size.
      </p>
      <div className={styles.grid}>
        {frames.map((frame) => (
          <figure key={frame.frameId} className={styles.cell}>
            <figcaption className={styles.caption}>
              <a href={`?frame=${encodeURIComponent(frame.frameId)}`} className={styles.link}>
                {frame.frameId}
              </a>{" "}
              {frame.name}
              <span className={styles.node}>
                {frame.figmaNodeId} · {frame.width} × {frame.height} · {frame.clock.time}
              </span>
            </figcaption>
            <FrameBox className={styles.frame} style={{ width: frame.width, minHeight: frame.height }}>
              {draw(frame)}
            </FrameBox>
          </figure>
        ))}
      </div>
    </main>
  );
}
