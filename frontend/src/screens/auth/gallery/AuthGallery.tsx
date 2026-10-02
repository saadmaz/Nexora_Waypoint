import { RoleRoot } from "../../../shared/RoleRoot";
import { AUTH_FRAMES, type AuthFrame } from "./frames";
import styles from "./AuthGallery.module.css";

/**
 * The dev-only state gallery for the app shell (`/auth/_states`): every frame at its Figma size
 * with its name and node ID. `?frame=<id>` draws one frame alone at its size, which
 * `npm run compare -- auth <id>` screenshots. Judges never see it.
 */
export function AuthGallery() {
  const frameId = new URLSearchParams(window.location.search).get("frame");

  if (frameId) {
    const frame = AUTH_FRAMES.find((f) => f.frameId === frameId);
    if (!frame) {
      return (
        <main className={styles.missing}>
          <p>No frame “{frameId}” in the app shell gallery.</p>
        </main>
      );
    }
    return <FrameBox frame={frame} className={styles.single} />;
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>App shell: state gallery</h1>
      <p className={styles.lede}>
        {AUTH_FRAMES.length} frames. Add <code>?frame=ID</code> to see one at its Figma size.
      </p>
      <div className={styles.grid}>
        {AUTH_FRAMES.map((frame) => (
          <figure key={frame.frameId} className={styles.cell}>
            <figcaption className={styles.caption}>
              <a href={`?frame=${encodeURIComponent(frame.frameId)}`} className={styles.link}>
                {frame.frameId}
              </a>{" "}
              {frame.name}
              <span className={styles.node}>
                {frame.figmaNodeId} · {frame.width} × {frame.height}
              </span>
            </figcaption>
            <FrameBox frame={frame} className={styles.frame} />
          </figure>
        ))}
      </div>
    </main>
  );
}

/** A frame's box at its Figma size, in the theme the frame is drawn in. */
function FrameBox({ frame, className }: { frame: AuthFrame; className: string }) {
  return (
    <div className={className} data-frame={frame.frameId} style={{ width: frame.width, minHeight: frame.height }}>
      <RoleRoot theme={frame.theme} fill={false} className={styles.root}>
        {frame.render()}
      </RoleRoot>
    </div>
  );
}
