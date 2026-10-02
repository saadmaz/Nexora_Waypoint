import { createContext, useCallback, useContext } from "react";
import type { Theme } from "../../../shared/theme";
import type { DriverApi } from "../api/DriverApi";
import { translate } from "../i18n";
import type { DriverSettings, Language, TextSize } from "../types";

export type DriverContextValue = {
  api: DriverApi;
  settings: DriverSettings;
  setSunlight: (on: boolean) => void;
  setTextSize: (size: TextSize) => void;
  setLanguage: (language: Language) => void;
  /** The resolved role theme: "field" when the sunlight switch is on, else the phone's preference. */
  theme: Theme;
  /** The Kandy corridor coverage gap dev setting (driver prompt 4 section 4), off by default. */
  coverageGapEnabled: boolean;
  setCoverageGapEnabled: (enabled: boolean) => void;
  /** The R4 Outbox sheet. Lifted here so "View" on R1.7 can open it from the run screen. */
  outboxOpen: boolean;
  setOutboxOpen: (open: boolean) => void;
};

export const DriverContext = createContext<DriverContextValue | undefined>(undefined);

export function useDriverContext(): DriverContextValue {
  const context = useContext(DriverContext);
  if (!context) throw new Error("useDriverContext needs a DriverProvider above it");
  return context;
}

export function useDriverApi(): DriverApi {
  return useDriverContext().api;
}

export function useDriverSettings() {
  const { settings, setSunlight, setTextSize, setLanguage, theme } = useDriverContext();
  return { settings, setSunlight, setTextSize, setLanguage, theme };
}

export function useCoverageGap(): { enabled: boolean; setEnabled: (enabled: boolean) => void } {
  const { coverageGapEnabled, setCoverageGapEnabled } = useDriverContext();
  return { enabled: coverageGapEnabled, setEnabled: setCoverageGapEnabled };
}

export function useOutboxOpen(): { open: boolean; setOpen: (open: boolean) => void } {
  const { outboxOpen, setOutboxOpen } = useDriverContext();
  return { open: outboxOpen, setOpen: setOutboxOpen };
}

/** Bound to the current language; falls back to English, then the key itself. */
export function useT(): (key: string, params?: Record<string, string | number>) => string {
  const { settings } = useDriverContext();
  return useCallback((key: string, params?: Record<string, string | number>) => translate(settings.language, key, params), [settings.language]);
}
