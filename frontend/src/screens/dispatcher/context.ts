import { createContext, useContext } from "react";
import type { DispatcherApi } from "../../api/DispatcherApi";

/** The states a dev address can force (`?state=`), so a frame is reachable without a tap. */
export type PreviewState = "loading" | "empty" | "offline" | "error";

export type DispatcherContextValue = {
  /** The one DispatcherApi every screen talks to, so a move saved on D3 is the plan D4 lists. */
  api: DispatcherApi;
  /** The one clock. Nothing else reads the wall clock. */
  now: () => Date;
  /** Bumped whenever the clock jumps, so screens re-read "now" at once instead of on the next tick. */
  clockVersion: number;
  /** Moves the scenario clock forward (the presenter control); absent when the clock is real time. */
  advanceTo?: (to: Date) => void;
  /** Bumped after every write, so every screen re-reads what it shows. */
  dataVersion: number;
  /** Call after a write. */
  invalidate: () => void;
  /** The presenter control is on (`?presenter=1` or the avatar menu). */
  presenter: boolean;
  setPresenter: (on: boolean) => void;
  /**
   * The dispatcher's own connection is down (the browser reports offline, or `?state=offline`).
   * Screens keep showing what they last loaded, say when it was, and switch their writes off.
   */
  offline: boolean;
  /** "21:10": when the screens last had a live connection, for the offline bar. */
  lastOnline: string;
  /** The state a dev address forces on the first screen, if any. */
  preview: PreviewState | null;
};

export const DispatcherContext = createContext<DispatcherContextValue | null>(null);

export function useDispatcher(): DispatcherContextValue {
  const value = useContext(DispatcherContext);
  if (!value) throw new Error("useDispatcher must be used inside a DispatcherProvider");
  return value;
}
