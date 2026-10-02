import { createContext, useContext } from "react";
import type { DepotId } from "../../domain/field";
import type { LoaderApi } from "./LoaderApi";

export type LoaderPerson = { id: string; name: string };

export type LoaderContextValue = {
  api: LoaderApi;
  dockId: DepotId;
  /** The last person who entered a PIN this session: the default actor for writes the frames
   * never re-prompt for, such as a per-order count confirm (L2.1 B). */
  currentPerson: LoaderPerson | null;
  setCurrentPerson: (person: LoaderPerson) => void;
};

export const LoaderContext = createContext<LoaderContextValue | null>(null);

export function useLoader(): LoaderContextValue {
  const value = useContext(LoaderContext);
  if (!value) throw new Error("useLoader must be used inside a LoaderProvider");
  return value;
}
