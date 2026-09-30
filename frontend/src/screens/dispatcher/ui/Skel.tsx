import type { CSSProperties } from "react";
import styles from "./Skel.module.css";

/** One grey block that pulses while a screen loads. Reduced motion holds it still. */
export function Skel({ w = "100%", h = 10, style }: { w?: number | string; h?: number; style?: CSSProperties }) {
  return <span className={styles.skel} style={{ width: w, height: h, ...style }} aria-hidden />;
}
