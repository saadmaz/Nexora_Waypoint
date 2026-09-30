import { Icon } from "../../components/ui/Icon";
import styles from "./PodPhoto.module.css";

export type PodPhotoProps = {
  /**
   * "small" is the 72 px tile beside the review text; "large" fills the desktop side card;
   * "block" spans the card on the receipt, at `height` (140 px on S3.1, 62 px on S3.5).
   * Large and block carry the caption.
   */
  size?: "small" | "large" | "block";
  height?: number;
  /** "Photo · 05:42 · S. Fernando" under the icon on the large tile. */
  caption?: string;
};

/**
 * The proof-of-delivery photo. The prototype has no photo store, so this is the camera-icon
 * tile Figma draws in its place (PRD v3 A13: photo, receiver and device time make the POD).
 */
export function PodPhoto({ size = "small", height = 140, caption }: PodPhotoProps) {
  return (
    <div
      className={[styles.tile, size === "small" ? styles.small : styles.large].join(" ")}
      style={size === "block" ? { height } : undefined}
      role="img"
      aria-label="Proof of delivery photo"
    >
      <Icon name="camera" size={24} color="ink-muted" />
      {size !== "small" && caption && <span className={styles.caption}>{caption}</span>}
    </div>
  );
}
