import type { ReactNode } from "react";
import { ThemeContext, type Theme } from "./theme";

export type { Theme } from "./theme";

export type RoleRootProps = {
  theme: Theme;
  children: ReactNode;
  className?: string;
  /** Fill the viewport height (a real role root). A catalogue panel sets this to false. */
  fill?: boolean;
};

/**
 * A role's root element. It sets `data-theme` here, not on <html>, because four roles share one
 * app and each picks its own mode: Dispatch and Store are Light, Load is always Dark, and the
 * driver's mode is decided by the driver's theme rule (prompt 3), which passes it in as `theme`.
 * `color-scheme` follows the mode so native controls, scrollbars and the keyboard match.
 * The theme is also published on a context, for portaled sheets that live outside this element.
 */
export function RoleRoot({ theme, children, className, fill = true }: RoleRootProps) {
  return (
    <ThemeContext.Provider value={theme}>
      <div
        data-theme={theme}
        className={className}
        style={{
          colorScheme: theme === "dark" ? "dark" : "light",
          minHeight: fill ? "100dvh" : undefined,
          background: "var(--surface-0)",
          color: "var(--ink)",
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
