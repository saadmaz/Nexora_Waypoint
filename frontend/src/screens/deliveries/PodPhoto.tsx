import { Icon } from "../../components/ui/Icon";
import styles from "./PodPhoto.module.css";

export type PodPhotoProps = {
  /** "small" is the 72 px tile on the phone; "large" fills the desktop side card and carries its caption. */
  size?: "small" | "large";
  /** "Photo · 05:42 · S. Fernando" under the icon on the large tile. */
  caption?: string;
};

/**
 * The proof-of-delivery photo. The prototype has no photo store, so this is the camera-icon
 * tile Figma draws in its place (PRD v3 A13: photo, receiver and device time make the POD).
 */
export function PodPhoto({ size = "small", caption }: PodPhotoProps) {
  return (
    <div className={[styles.tile, size === "large" ? styles.large : styles.small].join(" ")} role="img" aria-label="Proof of delivery photo">
      <Icon name="camera" size={24} color="ink-muted" />
      {size === "large" && caption && <span className={styles.caption}>{caption}</span>}
    </div>
  );
}
