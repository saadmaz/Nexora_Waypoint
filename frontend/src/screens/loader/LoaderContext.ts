import { createContext, useContext } from "react";
import type { DepotId } from "../../domain/field";
import type { LoaderApi } from "./LoaderApi";

export type LoaderContextValue = {
  api: LoaderApi;
  dockId: DepotId;
};

export const LoaderContext = createContext<LoaderContextValue | null>(null);

export function useLoader(): LoaderContextValue {
  const value = useContext(LoaderContext);
  if (!value) throw new Error("useLoader must be used inside a LoaderProvider");
  return value;
}
