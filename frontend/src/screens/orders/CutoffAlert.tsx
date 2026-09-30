import type { ReactNode } from "react";
import { Alert } from "../../components/ui/Alert";
import { Mono } from "../../components/ui/Mono";

/** "Orders close at 16:00 · 22 min left", with an optional line under it. */
export function CutoffAlert({ minutesLeft, children }: { minutesLeft: number; children?: ReactNode }) {
  return (
    <Alert
      tone="warning"
      live
      title={
        <>
          Orders close at <Mono>16:00</Mono> · {minutesLeft} min left
        </>
      }
    >
      {children}
    </Alert>
  );
}
