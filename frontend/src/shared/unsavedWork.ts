import { useEffect } from "react";

/**
 * Work on screen that is not saved anywhere yet, keyed by the screen that holds it. Log out reads
 * this before it clears a session, so it can ask first instead of dropping the work.
 *
 * Only work that would be lost belongs here. Field writes are already on the phone (the outbox
 * keeps them through a log out) and dispatcher moves are saved as they happen.
 */
const entries = new Map<string, string>();

/** Sets or clears one screen's note. Null clears it. */
export function setUnsavedWork(key: string, message: string | null): void {
  if (message === null) entries.delete(key);
  else entries.set(key, message);
}

/** The notes for every screen that has unsaved work right now. */
export function readUnsavedWork(): string[] {
  return [...entries.values()];
}

/** Holds a note while the screen is mounted and the message is not null. */
export function useUnsavedWork(key: string, message: string | null): void {
  useEffect(() => {
    setUnsavedWork(key, message);
    return () => setUnsavedWork(key, null);
  }, [key, message]);
}
