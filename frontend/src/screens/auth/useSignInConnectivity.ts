import { useEffect } from "react";
import { connectivity, useConnectivity } from "../../field/offline/connectivity";

/**
 * Whether sign-in can reach the network. The field runtime listens for the browser's `online`
 * and `offline` events, but it does not run on `/sign-in`, so this feeds them into the same
 * `connectivity` store the rest of the app reads. A new sign-in needs a connection; an existing
 * session never does (PRD v3 section 15).
 */
export function useSignInConnectivity(): boolean {
  useEffect(() => {
    connectivity.setBrowserOnline(navigator.onLine !== false);
    const onOnline = () => connectivity.setBrowserOnline(true);
    const onOffline = () => connectivity.setBrowserOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);
  return useConnectivity().connected;
}
