import { useCallback, useEffect, useState } from "react";
import { useNow } from "../../../field/clock/useClock";
import { useDriverApi } from "../context/DriverContext";
import { RUN_DATE } from "../fixtures";
import type { DriverNotice } from "../types";

const REFRESH_MS = 5_000;

export type NoticesState = {
  /** Newest first. */
  notices: DriverNotice[];
  unread: number;
  /** False until the phone's notices have been read once. */
  loaded: boolean;
  markRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
};

/**
 * The driver's notifications, from the phone (R8.1, and the count on the bell). They live in the
 * phone's own cache, so they are there offline. Re-read every few seconds of scenario time, and at
 * once after the driver reads one.
 */
export function useNotices(): NoticesState {
  const api = useDriverApi();
  const now = useNow();
  const [notices, setNotices] = useState<DriverNotice[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState(0);
  const tick = Math.floor(now / REFRESH_MS);

  useEffect(() => {
    let active = true;
    void api.getNotices(RUN_DATE).then((next) => {
      if (!active) return;
      setNotices(next);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [api, tick, version]);

  const markRead = useCallback(
    async (ids: string[]) => {
      await api.markNoticesRead(RUN_DATE, ids);
      setVersion((v) => v + 1);
    },
    [api],
  );
  const markAllRead = useCallback(async () => {
    await api.markNoticesRead(RUN_DATE);
    setVersion((v) => v + 1);
  }, [api]);

  return { notices, unread: notices.filter((n) => !n.read).length, loaded, markRead, markAllRead };
}
