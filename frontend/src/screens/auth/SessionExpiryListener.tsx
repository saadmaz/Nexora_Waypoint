import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SESSION_EXPIRED_EVENT, type SessionExpiredDetail } from "../../api/http/tokens";

/**
 * Sends a person to sign-in when the server rejects their session (`api/http/tokens.ts` fires the event after a real
 * 401 and has already cleared that role). Only the role whose area the person is in matters: a Store session that
 * expires in another tab must not move a driver. Mount it once, inside the router.
 *
 * An offline-recorded outbox is untouched. It lives in IndexedDB, and it syncs after the person signs in again.
 */
export function SessionExpiryListener() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    function onExpired(event: Event) {
      const { role } = (event as CustomEvent<SessionExpiredDetail>).detail;
      const prefix = `/${role}`;
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) navigate("/sign-in", { replace: true });
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [navigate, pathname]);

  return null;
}
