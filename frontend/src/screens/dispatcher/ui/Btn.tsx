import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import styles from "./Btn.module.css";

export type BtnVariant = "primary" | "secondary" | "ghost" | "routeOutline" | "warningOutline" | "dangerOutline" | "signal";

export type BtnProps = {
  variant?: BtnVariant;
  size?: "xs" | "sm" | "md" | "lg";
  icon?: ReactNode;
  iconRight?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">;

/** A dispatcher button. Verb plus object: "Go to capacity board", "Release plan v3". */
export function Btn({ variant = "primary", size = "md", icon, iconRight, children, type = "button", ...rest }: BtnProps) {
  return (
    <button {...rest} type={type} className={cx(styles.btn, styles[variant], size !== "md" && styles[size])}>
      {icon}
      {children}
      {iconRight}
    </button>
  );
}

/** A text link that does something on this screen (not navigation): "Show all", "Switch to Peliyagoda". */
export function LinkButton({ children, ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">) {
  return (
    <button type="button" {...rest} className={styles.link}>
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  ...rest
}: { label: string; children: ReactNode } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "aria-label">) {
  return (
    <button type="button" {...rest} aria-label={label} className={styles.iconButton}>
      {children}
    </button>
  );
}
