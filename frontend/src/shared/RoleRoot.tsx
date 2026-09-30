import type { ReactNode } from "react";

/** The three colour modes of the Figma collection "Waypoint colour" (field conventions section 6). */
export type Theme = "light" | "dark" | "field";

export type RoleRootProps = {
  theme: Theme;
  children: ReactNode;
  className?: string;
};

/**
 * A role's root element. It sets `data-theme` here, not on <html>, because four roles share one
 * app and each picks its own mode: Dispatch and Store are Light, Load is always Dark, and the
 * driver's mode is decided by the driver's theme rule (prompt 3), which passes it in as `theme`.
 * `color-scheme` follows the mode so native controls, scrollbars and the keyboard match.
 */
export function RoleRoot({ theme, children, className }: RoleRootProps) {
  return (
    <div
      data-theme={theme}
      className={className}
      style={{
        colorScheme: theme === "dark" ? "dark" : "light",
        minHeight: "100dvh",
        background: "var(--surface-0)",
        color: "var(--ink)",
      }}
    >
      {children}
    </div>
  );
}
