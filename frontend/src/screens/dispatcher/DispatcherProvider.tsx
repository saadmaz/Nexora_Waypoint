import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { NetworkError, type DispatcherApi } from "../../api/DispatcherApi";
import { createDispatcherDemo, createHttpDispatcherApi, type DispatcherDemo } from "../../api/httpDispatcherApi";
import { roleApiMode } from "../../api/http/config";
import { createScenarioClock } from "../../app/scenarioClock";
import { clockTime } from "../../domain/format";
import { useOnline } from "../../hooks/useOnline";
import { DispatcherContext, type PreviewState } from "./context";
import { createMockDispatcherApi, isPreset, type MockMode } from "./mock/mockDispatcherApi";

const PREVIEW_STATES: readonly string[] = ["loading", "empty", "offline", "error"];

/** The scenario starts Mon 28 Sep 15:30 (A38); a dispatcher opened with no `?at=` begins there and the clock keeps ticking. */
const DEFAULT_START = "15:30";

/** Where the clock stands until the server has answered `GET /clock`: the scenario's start, Mon 28 Sep 2026 15:30. */
const API_FALLBACK_NOW = () => new Date(2026, 8, 28, 15, 30);

/** How often the screens ask the server again, while a request has failed with no answer, whether it is back. */
const RECONNECT_MS = 8_000;

function isPreview(value: string | null): value is PreviewState {
  return value !== null && PREVIEW_STATES.includes(value);
}

/** What the provider holds once, whichever API it runs on. */
type Base = {
  api: DispatcherApi;
  now: () => Date;
  /** Mock: the scenario clock's jump. Absent in real time. Api mode has its own, below. */
  advanceTo: ((to: Date) => void) | undefined;
  preview: PreviewState | null;
  presenter: boolean;
  lastOnline: string;
  /** Api mode only: the server's clock and the presenter control's routes. */
  demo: DispatcherDemo | null;
  /** Api mode only: moves the clock `now` reads. */
  setNow: ((to: Date) => void) | null;
};

/**
 * Creates the dispatcher's API and the scenario clock once. The API is the mock unless `VITE_DISPATCHER_API=api`.
 *
 * Mock: from the address the app was opened at (`?at=HH:MM`, `?date=`, `?state=` for loading, empty, offline and error,
 * `?preset=` for decisions the design has already taken, `?presenter=1`). They are created once so the clock keeps ticking
 * and the plan edited on one screen is the plan the next one shows.
 *
 * Api: the real `DispatcherApi`. `?state=`, `?preset=`, `?at=` and `?date=` do nothing, since there is no fixture to seed and
 * the clock belongs to the server. The scenario clock is read once from `GET /clock` and then holds still until the presenter
 * control moves it (`POST /demo/advance`), because the server's clock does not tick and every time the server computes
 * (minutes to the cutoff, an ETA) is for that instant. `?presenter=1` still works: "Go to next step" advances the server and
 * "Reset demo" resets it. A request that gets no answer puts the screens in their offline behaviour (they keep what they last
 * loaded and switch writes off) until the server answers again.
 *
 * Must sit inside a router: the state gallery gives each frame its own memory router and provider.
 */
export function DispatcherProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const onApi = roleApiMode("dispatcher") === "api";
  const [networkDown, setNetworkDown] = useState(false);
  // Api mode: the scenario time of the last answer from the server, for the offline bar.
  const [apiLastOnline, setApiLastOnline] = useState(() => clockTime(API_FALLBACK_NOW()));
  const [base] = useState<Base>(() => {
    const params = new URLSearchParams(location.search);
    if (onApi) {
      let current = API_FALLBACK_NOW();
      return {
        api: createHttpDispatcherApi(undefined, {
          onConnection: (online) => {
            setNetworkDown(!online);
            if (online) setApiLastOnline(clockTime(current));
          },
        }),
        now: () => new Date(current.getTime()),
        advanceTo: undefined,
        preview: null,
        presenter: params.get("presenter") === "1",
        lastOnline: clockTime(current),
        demo: createDispatcherDemo(),
        setNow: (to) => {
          current = to;
        },
      };
    }
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
      demo: null,
      setNow: null,
    };
  });

  const [clockVersion, setClockVersion] = useState(0);
  const [dataVersion, setDataVersion] = useState(0);
  const [presenter, setPresenter] = useState(base.presenter);
  const browserOnline = useOnline();
  const offline = base.preview === "offline" || !browserOnline || networkDown;
  const invalidate = useCallback(() => setDataVersion((v) => v + 1), []);

  // Api mode: the server's clock. The screens draw nothing until the first answer (or the first failure), so they never ask
  // for data against a clock that is about to move. A failure keeps the fallback start and lets the screens show their own
  // error state.
  const [clockReady, setClockReady] = useState(!onApi);
  const syncClock = useCallback(
    (to: Date) => {
      base.setNow?.(to);
      setApiLastOnline(clockTime(to));
      setClockVersion((v) => v + 1);
      invalidate();
    },
    [base, invalidate],
  );
  useEffect(() => {
    const demo = base.demo;
    if (!demo) return;
    let alive = true;
    demo
      .readClock()
      .then((to) => {
        if (!alive) return;
        base.setNow?.(to);
        setApiLastOnline(clockTime(to));
        setNetworkDown(false);
      })
      .catch((error: unknown) => {
        if (alive && error instanceof NetworkError) setNetworkDown(true);
      })
      .finally(() => {
        if (alive) setClockReady(true);
      });
    return () => {
      alive = false;
    };
  }, [base]);

  // While a request has failed with no answer, ask for the clock now and then: the first answer ends the offline state and
  // the screens load again.
  useEffect(() => {
    const demo = base.demo;
    if (!demo || !networkDown) return;
    const id = window.setInterval(() => {
      demo
        .readClock()
        .then((to) => {
          setNetworkDown(false);
          syncClock(to);
        })
        .catch(() => undefined);
    }, RECONNECT_MS);
    return () => window.clearInterval(id);
  }, [base, networkDown, syncClock]);

  const advanceTo = useMemo(() => {
    const demo = base.demo;
    if (demo) {
      // The presenter control moves the server's clock. A refusal (it never goes backwards) or a failure leaves the clock where it was.
      return (to: Date) => {
        demo.advance(to).then(syncClock, () => undefined);
      };
    }
    return base.advanceTo
      ? (to: Date) => {
          base.advanceTo?.(to);
          setClockVersion((v) => v + 1);
        }
      : undefined;
  }, [base, syncClock]);

  const resetDemo = useMemo(() => {
    const demo = base.demo;
    return demo ? () => demo.reset().then(syncClock) : undefined;
  }, [base, syncClock]);

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
      lastOnline: onApi ? apiLastOnline : base.lastOnline,
      preview: base.preview,
      ...(advanceTo ? { advanceTo } : {}),
      ...(resetDemo ? { resetDemo } : {}),
    }),
    [base, clockVersion, dataVersion, invalidate, presenter, offline, onApi, apiLastOnline, advanceTo, resetDemo],
  );
  return <DispatcherContext.Provider value={value}>{clockReady ? children : null}</DispatcherContext.Provider>;
}
