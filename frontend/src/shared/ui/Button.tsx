import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "dangerOutline";

export type ButtonProps = {
  variant?: ButtonVariant;
  /** Large is 56 px (the pinned action), medium is 44 px. */
  size?: "large" | "medium";
  /** Shrink to fit the label instead of filling the row. */
  auto?: boolean;
  icon?: IconName;
  iconRight?: IconName;
  /** Show a spinning sync icon and block further presses. */
  busy?: boolean;
  children?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">;

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  ghost: styles.ghost,
  dangerOutline: styles.dangerOutline,
};

/** Buttons read as verb plus object: "Place 2 orders", "Confirm receipt". */
export function Button({
  variant = "primary",
  size = "large",
  auto,
  icon,
  iconRight,
  busy,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    VARIANT_CLASS[variant],
    size === "medium" && styles.medium,
    auto && styles.auto,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button {...rest} type={type} className={classes} disabled={disabled ?? busy}>
      {busy ? (
        <span className={styles.spinner}>
          <Icon name="refresh-cw" size={20} />
        </span>
      ) : (
        icon && <Icon name={icon} size={20} />
      )}
      {children}
      {iconRight && <Icon name={iconRight} size={20} />}
    </button>
  );
}
