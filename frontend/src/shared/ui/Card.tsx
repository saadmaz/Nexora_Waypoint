import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Card.module.css";

export type CardProps = {
  /** 16 px of padding inside. Off when the card lays out its own rows. */
  padded?: boolean;
  /** Drop shadow-1, for a card nested inside another surface. */
  flat?: boolean;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "className">;

/** A resting surface: radius 12, hairline border, shadow-1. */
export function Card({ padded = true, flat, children, ...rest }: CardProps) {
  const classes = [styles.card, padded && styles.padded, flat && styles.flat]
    .filter(Boolean)
    .join(" ");
  return (
    <div {...rest} className={classes}>
      {children}
    </div>
  );
}
