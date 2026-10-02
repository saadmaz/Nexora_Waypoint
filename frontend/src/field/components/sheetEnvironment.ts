import { createContext, useContext } from "react";

/**
 * Where sheets render and whether they trap focus. In the app a sheet portals to <body> and is
 * modal. In the state gallery every frame draws its own open sheet inside the frame's box, and
 * several can be open at once, so each is non-modal and portals into its frame.
 */
export type SheetEnvironment = {
  container: HTMLElement | null;
  modal: boolean;
};

export const SheetEnvironmentContext = createContext<SheetEnvironment>({ container: null, modal: true });

export function useSheetEnvironment(): SheetEnvironment {
  return useContext(SheetEnvironmentContext);
}
