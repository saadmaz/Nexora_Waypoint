import { Mono } from "./Mono";

/** IDs (ORD2001, VEH039, OUT084) and clock times (05:42) inside a sentence. */
const TOKEN = /(\b(?:ORD|VEH|OUT)\d+\b|\b\d{2}:\d{2}\b)/;

/**
 * A sentence with its IDs and times set in Plex Mono, as the type rules require (Archivo for
 * sentences, Plex Mono only for IDs, times and figures). For copy that arrives as one string,
 * such as the updates feed.
 */
export function MonoText({ children }: { children: string }) {
  return (
    <>
      {children.split(TOKEN).map((part, i) => (i % 2 === 1 ? <Mono key={i}>{part}</Mono> : part))}
    </>
  );
}
