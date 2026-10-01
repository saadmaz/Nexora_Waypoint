import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useFieldClock } from "../../../field/clock/useClock";
import { getSetting, setSetting } from "../../../field/offline";
import type { Theme } from "../../../shared/theme";
import { createMockDriverApi, registerDriverHandlers, type MockDriverApiOptions } from "../api/mockDriverApi";
import type { DriverSettings, Language, TextSize } from "../types";
import { DriverContext, type DriverContextValue } from "./DriverContext";

const SETTINGS_KEYS = {
  sunlight: "driver.sunlight",
  textSize: "driver.textSize",
  language: "driver.language",
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
  const api = useMemo(() => createMockDriverApi(clock.nowMs, apiOptions), [clock, apiOptions]);
  const preferredScheme = usePreferredScheme();

  const [settings, setSettings] = useState<DriverSettings>({ ...DEFAULT_SETTINGS, ...initialSettings });

  useEffect(() => {
    registerDriverHandlers();
  }, []);

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
    () => ({ api, settings, setSunlight, setTextSize, setLanguage, theme }),
    [api, settings, setSunlight, setTextSize, setLanguage, theme],
  );

  return <DriverContext.Provider value={value}>{children}</DriverContext.Provider>;
}
