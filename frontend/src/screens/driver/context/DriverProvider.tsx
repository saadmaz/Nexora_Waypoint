import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { roleApiMode } from "../../../api/http/config";
import { useFieldClock } from "../../../field/clock/useClock";
import { connectivity, getSetting, setSetting } from "../../../field/offline";
import type { Theme } from "../../../shared/theme";
import { createApiDriverApi, registerApiDeviceNotices, registerApiDriverHandlers } from "../api/apiDriverApi";
import { devMocks } from "../../../devMocks/registry";
import type { MockDriverApiOptions } from "../api/mockDriverApi";
import { colomboMs } from "../../../field/clock/clock";
import { runDate } from "../../../field/clock/runDate";
import { startSyncViewTracking } from "../sync/syncView";
import type { DriverSettings, Language, TextSize } from "../types";
import { DriverContext, type DriverContextValue } from "./DriverContext";

/**
 * Tue 29 Sep 05:17 to 06:40: the Kandy corridor coverage gap (PRD H9, H16). Off by default, since
 * real `navigator.onLine` already reflects a real device's coverage; "Kandy corridor coverage gap"
 * is a dev/demo setting (driver prompt 4 section 4) for showing the degradation story on a desktop
 * without airplane mode. The Simulate offline switch (R4, driver prompt 4) and a real disconnect
 * still apply on top: `connectivity.isConnected()` requires every gate open and the browser online.
 */
const CORRIDOR_GATE = "kandy-corridor";
/** The scripted coverage profile (PRD v3 section 13): the corridor drops at 05:17 and returns at 06:40 on the run's day. */
const CORRIDOR_DROPS = "05:17";
const CORRIDOR_RETURNS = "06:40";

const SETTINGS_KEYS = {
  sunlight: "driver.sunlight",
  textSize: "driver.textSize",
  language: "driver.language",
  coverageGap: "driver.coverageGapEnabled",
} as const;

const DEFAULT_SETTINGS: DriverSettings = { sunlight: false, textSize: "standard", language: "en" };

/** "dark" when the phone prefers dark or states no preference, "light" when it prefers light (R1.9 copy). */
function usePreferredScheme(): "dark" | "light" {
  const query = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : undefined;
  const [light, setLight] = useState(() => query?.matches ?? false);
  useEffect(() => {
    if (!query) return;
    const onChange = () => setLight(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [query]);
  return light ? "light" : "dark";
}

export type DriverProviderProps = {
  children: ReactNode;
  /** Testing and the state gallery only: overrides the loader confirmation and settings. */
  apiOptions?: MockDriverApiOptions;
  initialSettings?: Partial<DriverSettings>;
};

/**
 * Provides the Driver role's one API instance and its persisted settings (sunlight, text size,
 * language) to every screen. The theme rule (driver prompt 3 section 3): the sunlight switch wins;
 * otherwise the phone's own colour scheme preference decides Dark or Light.
 */
export function DriverProvider({ children, apiOptions, initialSettings }: DriverProviderProps) {
  const clock = useFieldClock();
  // The state gallery passes `apiOptions` to draw a frame of its own; only the real app can run on the API.
  const onApi = apiOptions === undefined && roleApiMode("driver") === "api";
  const api = useMemo(() => (onApi ? createApiDriverApi(clock.nowMs) : devMocks().driver.createMockDriverApi(clock.nowMs, apiOptions)), [clock, apiOptions, onApi]);
  const preferredScheme = usePreferredScheme();

  const [settings, setSettings] = useState<DriverSettings>({ ...DEFAULT_SETTINGS, ...initialSettings });
  const [coverageGapEnabled, setCoverageGapEnabledState] = useState(false);
  const [outboxOpen, setOutboxOpen] = useState(false);

  useEffect(() => {
    // Device-made notices ("N records synced", a photo that failed to send) are kept on the phone, on either API.
    if (onApi) {
      registerApiDriverHandlers(clock.nowMs);
      registerApiDeviceNotices(runDate(), clock.nowMs);
    } else {
      devMocks().driver.registerDriverHandlers(clock.nowMs);
      devMocks().driver.registerDeviceNoticeSync(runDate(), clock.nowMs);
    }
  }, [clock, onApi]);

  useEffect(() => {
    // The state gallery draws its own frames; only the real app watches for finished syncs.
    if (clock.fixed) return;
    return startSyncViewTracking();
  }, [clock]);

  useEffect(() => {
    if (initialSettings) return; // the gallery fixes its own state; never read or persist this either.
    void getSetting(SETTINGS_KEYS.coverageGap, false).then(setCoverageGapEnabledState);
  }, [initialSettings]);

  useEffect(() => {
    // The state gallery fakes its own connectivity per frame on a fixed clock; never fight it.
    if (clock.fixed) return;
    const update = () => {
      const nowMs = clock.nowMs();
      const day = runDate();
      const inGap = coverageGapEnabled && nowMs >= colomboMs(day, CORRIDOR_DROPS) && nowMs < colomboMs(day, CORRIDOR_RETURNS);
      connectivity.setGate(CORRIDOR_GATE, !inGap);
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [clock, coverageGapEnabled]);

  const setCoverageGapEnabled = useCallback(
    (enabled: boolean) => {
      setCoverageGapEnabledState(enabled);
      if (initialSettings === undefined) void setSetting(SETTINGS_KEYS.coverageGap, enabled);
    },
    [initialSettings],
  );

  useEffect(() => {
    if (initialSettings) return; // the state gallery fixes its own settings; never read or persist them.
    let active = true;
    void Promise.all([
      getSetting(SETTINGS_KEYS.sunlight, DEFAULT_SETTINGS.sunlight),
      getSetting(SETTINGS_KEYS.textSize, DEFAULT_SETTINGS.textSize),
      getSetting(SETTINGS_KEYS.language, DEFAULT_SETTINGS.language),
    ]).then(([sunlight, textSize, language]) => {
      if (active) setSettings({ sunlight, textSize, language });
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = initialSettings === undefined;

  const setSunlight = useCallback(
    (on: boolean) => {
      setSettings((s) => ({ ...s, sunlight: on }));
      if (persist) void setSetting(SETTINGS_KEYS.sunlight, on);
    },
    [persist],
  );
  const setTextSize = useCallback(
    (size: TextSize) => {
      setSettings((s) => ({ ...s, textSize: size }));
      if (persist) void setSetting(SETTINGS_KEYS.textSize, size);
    },
    [persist],
  );
  const setLanguage = useCallback(
    (language: Language) => {
      setSettings((s) => ({ ...s, language }));
      if (persist) void setSetting(SETTINGS_KEYS.language, language);
    },
    [persist],
  );

  const theme: Theme = settings.sunlight ? "field" : preferredScheme;

  const value = useMemo<DriverContextValue>(
    () => ({ api, settings, setSunlight, setTextSize, setLanguage, theme, coverageGapEnabled, setCoverageGapEnabled, outboxOpen, setOutboxOpen }),
    [api, settings, setSunlight, setTextSize, setLanguage, theme, coverageGapEnabled, setCoverageGapEnabled, outboxOpen],
  );

  return <DriverContext.Provider value={value}>{children}</DriverContext.Provider>;
}
