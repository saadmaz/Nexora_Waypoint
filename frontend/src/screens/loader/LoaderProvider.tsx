import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { DepotId } from "../../domain/field";
import { useFieldClock } from "../../field/clock/useClock";
import { getSetting, setSetting } from "../../field/offline";
import { LoaderContext, type LoaderPerson } from "./LoaderContext";
import { createMockLoaderApi } from "./mockLoaderApi";

const DOCK_SETTING_KEY = "dock";

function dockFromUrl(): DepotId | null {
  const value = new URLSearchParams(window.location.search).get("dock");
  return value === "peliyagoda" || value === "kandy" ? value : null;
}

/**
 * Creates the one LoaderApi for this tablet session and resolves which dock it is at: `?dock=` in
 * the URL (the state gallery and dev links), else what was saved last time, else the dock picker
 * (loader prompt section 3: "a small dock picker on first run is fine; keep it out of the main UI").
 */
export function LoaderProvider({ children }: { children: ReactNode }) {
  const clock = useFieldClock();
  const [api] = useState(() => createMockLoaderApi(clock.nowMs));
  const urlDock = useMemo(() => dockFromUrl(), []);
  const [dockId, setDockId] = useState<DepotId | null | undefined>(urlDock ?? undefined);
  const [currentPerson, setCurrentPerson] = useState<LoaderPerson | null>(null);

  useEffect(() => {
    if (urlDock) {
      void setSetting(DOCK_SETTING_KEY, urlDock);
      return;
    }
    void getSetting<DepotId | null>(DOCK_SETTING_KEY, null).then(setDockId);
  }, [urlDock]);

  if (dockId === undefined) return null;
  if (dockId === null) {
    return (
      <DockPicker
        onPick={(id) => {
          void setSetting(DOCK_SETTING_KEY, id);
          setDockId(id);
        }}
      />
    );
  }

  return <LoaderContext.Provider value={{ api, dockId, currentPerson, setCurrentPerson }}>{children}</LoaderContext.Provider>;
}

/** First-run only: which dock this shared tablet sits at. Not part of the designed screens. */
function DockPicker({ onPick }: { onPick: (id: DepotId) => void }) {
  const navigate = useNavigate();
  const pick = (id: DepotId) => {
    onPick(id);
    navigate("/loader/dock", { replace: true });
  };
  return (
    <div style={pickerStyle}>
      <h1 style={{ font: "var(--text-h2)" }}>Which dock is this tablet at?</h1>
      <button type="button" onClick={() => pick("peliyagoda")} style={dockButtonStyle}>
        Peliyagoda
      </button>
      <button type="button" onClick={() => pick("kandy")} style={dockButtonStyle}>
        Kandy
      </button>
    </div>
  );
}

const pickerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
  padding: 24,
  alignItems: "stretch",
  maxWidth: 360,
  margin: "0 auto",
};

const dockButtonStyle: CSSProperties = {
  minHeight: 56,
  borderRadius: 12,
  border: "1px solid var(--line-strong)",
  background: "var(--surface-1)",
  color: "var(--ink)",
  font: "var(--text-button-lg)",
};
