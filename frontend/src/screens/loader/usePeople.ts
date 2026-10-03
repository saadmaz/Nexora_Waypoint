import { useEffect, useState } from "react";
import type { LoaderPerson } from "./LoaderContext";
import { useLoader } from "./LoaderContext";

/** The people the PIN sheet offers at this dock, from the API (the database in api mode). Empty until they arrive. */
export function usePeople(): LoaderPerson[] {
  const { api, dockId } = useLoader();
  const [people, setPeople] = useState<LoaderPerson[]>([]);
  useEffect(() => {
    let active = true;
    void api.getPeople(dockId).then(
      (next) => {
        if (active) setPeople(next);
      },
      () => {
        // A dock that cannot be read leaves the sheet without people; the screen's own read shows the error.
      },
    );
    return () => {
      active = false;
    };
  }, [api, dockId]);
  return people;
}
