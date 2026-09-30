import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { createScenarioClock } from "../../app/scenarioClock";
import { clockTime } from "../../domain/format";
import { useOnline } from "../../hooks/useOnline";
import { DispatcherContext, type PreviewState } from "./context";
import { createMockDispatcherApi, isPreset, type MockMode } from "./mock/mockDispatcherApi";

const PREVIEW_STATES: readonly string[] = ["loading", "empty", "offline", "error"];

/** The scenario starts Mon 28 Sep 15:30 (A38); a dispatcher opened with no `?at=` begins there and the clock keeps ticking. */
const DEFAULT_START = "15:30";

function isPreview(value: string | null): value is PreviewState {
  return value !== null && PREVIEW_STATES.includes(value);
}

/**
 * Creates the mock API and the scenario clock once, from the address the app was opened at
 * (`?at=HH:MM`, `?date=`, `?state=` for loading, empty, offline and error, `?preset=` for decisions
 * the design has already taken, `?presenter=1`). They are created once so the clock keeps ticking and the
 * plan edited on one screen is the plan the next one shows. Must sit inside a router: the state gallery gives
 * each frame its own memory router and provider.
 */
export function DispatcherProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [base] = useState(() => {
    const params = new URLSearchParams(location.search);
    const state = params.get("state");
    const preview = isPreview(state) ? state : null;
    const clock = createScenarioClock(params.get("at") ?? DEFAULT_START, params.get("date"));
    const mode: MockMode = preview === "loading" || preview === "error" || preview === "empty" ? preview : "normal";
    const api = createMockDispatcherApi(clock.now, { mode, calm: state === "calm" });
    for (const name of (params.get("preset") ?? "").split(",").filter(isPreset)) api.applyPreset(name);
    const opened = clock.now();
    return {
      api,
      now: clock.now,
      advanceTo: clock.advanceTo,
      preview,
      presenter: params.get("presenter") === "1",
      // When the screens last had a connection: a few minutes before they were opened.
      lastOnline: clockTime(new Date(opened.getTime() - 4 * 60_000)),
    };
  });

  const [clockVersion, setClockVersion] = useState(0);
  const [dataVersion, setDataVersion] = useState(0);
  const [presenter, setPresenter] = useState(base.presenter);
  const browserOnline = useOnline();
  const offline = base.preview === "offline" || !browserOnline;

  const advanceTo = useMemo(
    () =>
      base.advanceTo
        ? (to: Date) => {
            base.advanceTo?.(to);
            setClockVersion((v) => v + 1);
          }
        : undefined,
    [base],
  );
  const invalidate = useCallback(() => setDataVersion((v) => v + 1), []);

  // A clock that only moves by the passing minute still changes what the screens show: refresh them each minute.
  useEffect(() => {
    const id = window.setInterval(() => setClockVersion((v) => v + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const value = useMemo(
    () => ({
      api: base.api,
      now: base.now,
      clockVersion,
      dataVersion,
      invalidate,
      presenter,
      setPresenter,
      offline,
      lastOnline: base.lastOnline,
      preview: base.preview,
      ...(advanceTo ? { advanceTo } : {}),
    }),
    [base, clockVersion, dataVersion, invalidate, presenter, offline, advanceTo],
  );
  return <DispatcherContext.Provider value={value}>{children}</DispatcherContext.Provider>;
}
