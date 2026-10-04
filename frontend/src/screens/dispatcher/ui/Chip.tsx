import type { ReactNode } from "react";
import { Snowflake } from "lucide-react";
import type { Brand, OrderTemp } from "../../../api/DispatcherApi";
import { cx } from "./cx";
import styles from "./Chip.module.css";
import { tempLabel } from "./temp";

export type ChipTone =
  | "neutral"
  | "ambient"
  | "outline"
  | "outlineInk"
  | "outlineMuted"
  | "dashed"
  | "fresh"
  | "style"
  | "tech"
  | "chilled"
  | "info"
  | "infoOutline"
  | "success"
  | "warning"
  | "warningOutline"
  | "danger"
  | "signal"
  | "live"
  | "offline"
  | "offlineOutline"
  | "conflict"
  | "selected";

export type ChipProps = {
  tone?: ChipTone;
  icon?: ReactNode;
  dot?: boolean;
  pill?: boolean;
  small?: boolean;
  mono?: boolean;
  children: ReactNode;
};

/**
 * A dispatcher tag. Tags state a fixed attribute and are not interactive. They are the desktop
 * density (24 px); the shared Tag is 28 px for the phone roles.
 */
export function Chip({ tone = "neutral", icon, dot, pill, small, mono, children }: ChipProps) {
  return (
    <span className={cx(styles.chip, styles[tone], small && styles.small, pill && styles.pill, mono && styles.mono)}>
      {dot && <span className={styles.dot} />}
      {icon}
      {children}
    </span>
  );
}

export function BrandChip({ brand, small, dot = true }: { brand: Brand; small?: boolean; dot?: boolean }) {
  const tone = brand === "Fresh" ? "fresh" : brand === "Style" ? "style" : "tech";
  return (
    <Chip tone={tone} dot={dot} {...(small ? { small } : {})}>
      {brand}
    </Chip>
  );
}

export function TempChip({ temp, small, dry }: { temp: OrderTemp; small?: boolean; dry?: boolean }) {
  if (temp !== "ambient") {
    return (
      <Chip tone="chilled" icon={<Snowflake size={13} />} {...(small ? { small } : {})}>
        {tempLabel(temp)}
      </Chip>
    );
  }
  return (
    <Chip tone={dry ? "ambient" : "neutral"} {...(small ? { small } : {})}>
      Ambient
      {dry && <span style={{ fontWeight: 400, color: "var(--ink-muted)" }}>&nbsp;(dry)</span>}
    </Chip>
  );
}
