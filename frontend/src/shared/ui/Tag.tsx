import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import styles from "./Tag.module.css";

export type TagKind =
  | "fresh"
  | "chilled"
  | "ambient"
  | "outline"
  | "warn"
  | "danger"
  | "success"
  | "info"
  | "review";

export type TagProps = {
  kind?: TagKind;
  /** Pass null to suppress the default icon. */
  icon?: IconName | null;
  /** Hide the square brand dot on a Fresh tag. */
  noDot?: boolean;
  children: ReactNode;
};

const KIND_CLASS: Record<TagKind, string> = {
  fresh: styles.fresh,
  chilled: styles.chilled,
  ambient: styles.ambient,
  outline: styles.outline,
  warn: styles.warn,
  danger: styles.danger,
  success: styles.success,
  info: styles.info,
  review: styles.review,
};

/**
 * A square tag. Store screens use: Fresh, Chilled, Ambient, Rear dock,
 * After cutoff, Deferral withdrawn, Receipt confirmed, and the issue types
 * Missing, Short, Damaged, Wrong item, Late, Arrived warm, Other.
 */
export function Tag({ kind = "outline", icon, noDot, children }: TagProps) {
  const glyph = icon === null ? undefined : (icon ?? (kind === "chilled" ? "snowflake" : undefined));
  const showDot = !noDot && kind === "fresh";

  return (
    <span className={[styles.tag, KIND_CLASS[kind]].join(" ")}>
      {showDot && <span className={styles.dot} />}
      {glyph && <Icon name={glyph} size={14} />}
      {children}
    </span>
  );
}
