import { useSyncExternalStore } from "react";

/** Below this width sign-in is the phone layout, in Dark · pre-dawn; at or above it, the desktop card in Light · office. */
export const PHONE_QUERY = "(max-width: 639px)";

function subscribe(onChange: () => void): () => void {
  const list = window.matchMedia(PHONE_QUERY);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

/** True at phone width. Follows a window resize or a rotation. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}
