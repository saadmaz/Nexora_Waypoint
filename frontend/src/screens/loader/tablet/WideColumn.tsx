import type { ReactNode } from "react";
import { useMediaQuery } from "../../../hooks/useMediaQuery";

/**
 * Screens with no tablet frame (L4 Plan changed) at 1024 px and above: the phone layout in a
 * centred column rather than stretched across the tablet.
 */
export function WideColumn({ children }: { children: ReactNode }) {
  const wide = useMediaQuery("(min-width: 1024px)");
  if (!wide) return <>{children}</>;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        maxWidth: 720,
        minHeight: "100dvh",
        margin: "0 auto",
        borderInline: "1px solid var(--line)",
      }}
    >
      {children}
    </div>
  );
}
