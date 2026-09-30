/**
 * Every frame of S1 to S4, as an address the app can open (PRD v3 section 15: "a frame is a state
 * of its screen, produced by data and the scenario clock, never a separate page"). Each frame
 * names the route, the scenario time, and any preview or preset that reaches the state without a tap.
 * Names and sizes are Figma's.
 */
export type Frame = {
  /** Lower case, for `?frame=`: "s2.3", "s3.1b", "s4.sa". */
  id: string;
  /** The Figma frame name. */
  name: string;
  width: number;
  height: number;
  /** The address the frame opens at, inside its own memory router. */
  url: string;
};

const D = "2026-09-29";
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

const frame = (id: string, name: string, url: string, size: { width: number; height: number } = PHONE): Frame => ({
  id,
  name,
  url,
  ...size,
});

export const FRAME_GROUPS: { screen: string; title: string; frames: Frame[] }[] = [
  {
    screen: "S1",
    title: "S1 Place order",
    frames: [
      frame("s1.1", "S1.1 · 15:38 · Place order: before cutoff", "/store/orders?at=15:38&state=form"),
      frame("s1.1b", "S1.1 B · 15:48 · Place order: 12 min left", "/store/orders?at=15:48&state=form"),
      frame("s1.2", "S1.2 · 15:39 · Place order: review before submit", "/store/orders?at=15:39&state=review"),
      frame("s1.3", "S1.3 · 15:40 · Received acknowledgement", "/store/orders?at=15:40"),
      frame("s1.3b", "S1.3 B · 15:42 · Edit order", "/store/orders?at=15:42&state=edit"),
      frame("s1.3c", "S1.3 C · 15:44 · Order updated", "/store/orders?at=15:44&preset=order-edited"),
      frame(
        "s1.3d",
        "S1.3 D · 15:45 · Order cancelled",
        "/store/orders?at=15:45&state=cancelled&preset=order-cancelled",
      ),
      frame("s1.4", "S1.4 · 16:07 · After cutoff", "/store/orders?at=16:07&state=form"),
      frame(
        "s1.4b",
        "S1.4 B · 16:08 · After cutoff: placed for Wed",
        "/store/orders?at=16:08&state=form&preset=after-cutoff-placed",
      ),
      frame("s1.5a", "S1.5 · A · Offline: not sent", "/store/orders?at=15:38&state=queued"),
      frame("s1.5b", "S1.5 · B · Error: not received", "/store/orders?at=15:38&state=error"),
      frame("s1.5c", "S1.5 · C · Loading: sending", "/store/orders?at=15:38&state=sending"),
      frame("s1.5d", "S1.5 · D · Empty: no orders yet", "/store/orders?at=15:38&state=empty"),
      frame("s1.6", "S1.6 · 15:38 · Place order: desktop", "/store/orders?at=15:38&state=form", DESKTOP),
      frame("s1.6b", "S1.6 · B · 15:39 · Place order: desktop review", "/store/orders?at=15:39&state=review", DESKTOP),
    ],
  },
  {
    screen: "S2",
    title: "S2 Deliveries",
    frames: [
      frame("s2.1", "S2.1 · 16:01 · Deliveries: Confirmed", `/store/deliveries/${D}?at=16:01`),
      frame("s2.2", "S2.2 · 23:41 · Deliveries: Planned with arrival range", `/store/deliveries/${D}?at=23:41`),
      frame("s2.3", "S2.3 · 04:51 · Deliveries: Loaded", `/store/deliveries/${D}?at=04:51`),
      frame("s2.4", "S2.4 · 05:11 · Deliveries: On the way", `/store/deliveries/${D}?at=05:11`),
      frame("s2.5", "S2.5 · 05:19 · Deliveries: driver out of coverage", `/store/deliveries/${D}?at=05:19`),
      frame("s2.6", "S2.6 · 05:22 · Deliveries: Deferred at your request", `/store/deliveries/${D}?at=05:22`),
      frame("s2.7", "S2.7 · 06:41 · Deliveries: Under review", `/store/deliveries/${D}?at=06:41`),
      frame("s2.8", "S2.8 · 06:45 · Deliveries: Delivered + Deferral withdrawn", `/store/deliveries/${D}?at=06:45`),
      frame(
        "s2.9",
        "S2.9 · 03:01 · Deliveries: Deferred by policy (OUT009)",
        `/store/deliveries/${D}?at=03:01&outlet=OUT009`,
      ),
      frame("s2.10", "S2.10 · 23:41 · Deliveries: recent orders list", "/store/deliveries?at=23:41"),
      frame("s2.11", "S2.11 · 07:28 · Deliveries: desktop", `/store/deliveries/${D}?at=07:28`, DESKTOP),
      frame("s2.sa", "S2.S · A · Empty", "/store/deliveries?at=16:01&state=empty"),
      frame("s2.sb", "S2.S · B · Loading", "/store/deliveries?at=16:01&preview=loading"),
      frame("s2.sc", "S2.S · C · Offline", `/store/deliveries/${D}?at=05:20&preview=offline`),
      frame("s2.sd", "S2.S · D · Error", "/store/deliveries?at=16:01&preview=error"),
    ],
  },
  {
    screen: "S3",
    title: "S3 Receipt and Issues",
    frames: [
      frame("s3.1", "S3.1 · 07:28 · Receipt: to confirm (POD)", `/store/deliveries/${D}/receipt?at=07:28`),
      frame(
        "s3.1b",
        "S3.1 · B · 07:29 · Receipt: confirm with a shortfall",
        `/store/deliveries/${D}/receipt?at=07:29&preview=shortfall`,
      ),
      frame(
        "s3.2",
        "S3.2 · 07:30 · Receipt: confirmed",
        `/store/deliveries/${D}/receipt?at=07:30&preset=receipt-confirmed`,
      ),
      frame("s3.3", "S3.3 · 07:31 · Report issue sheet", `/store/deliveries/${D}/receipt?at=07:31&report=1`),
      frame(
        "s3.4",
        "S3.4 · 07:32 · Receipt: issue reported",
        `/store/deliveries/${D}/receipt?at=07:32&preset=issue-reported`,
      ),
      frame(
        "s3.5",
        "S3.5 · 07:28 · Dispatch asks: did you receive this?",
        `/store/deliveries/${D}/receipt?at=06:41&preview=asked`,
      ),
      frame(
        "s3.6",
        "S3.6 · 07:30 · Receipt confirmed while conflict still open",
        `/store/deliveries/${D}/receipt?at=06:41&preset=receipt-confirmed-review`,
      ),
      frame("s3.7", "S3.7 · 07:35 · Issues", "/store/issues?at=07:35"),
      frame("s3.sa", "S3.S · A · Empty", `/store/deliveries/${D}/receipt?at=16:01`),
      frame("s3.sb", "S3.S · B · Loading", `/store/deliveries/${D}/receipt?at=07:28&preview=loading`),
      frame("s3.sc", "S3.S · C · Offline", `/store/deliveries/${D}/receipt?at=07:30&preview=offline`),
      frame("s3.sd", "S3.S · D · Error", `/store/deliveries/${D}/receipt?at=07:28&preview=error`),
    ],
  },
  {
    screen: "S4",
    title: "S4 Updates and history",
    frames: [
      frame(
        "s4.1",
        "S4.1 · 06:45 · Updates: 2 unread",
        "/store/updates?at=06:45&preset=deferral-seen",
        { width: 390, height: 1563 },
      ),
      frame(
        "s4.1b",
        "S4.1 · B · 06:46 · Updates: all read",
        "/store/updates?at=06:46&preset=deferral-seen,read-all",
        { width: 390, height: 1563 },
      ),
      frame("s4.2", "S4.2 · 07:31 · History", "/store/history?at=07:31&preset=receipt-confirmed", {
        width: 390,
        height: 911,
      }),
      frame("s4.sa", "S4.S · A · Empty", "/store/updates?at=16:01&state=empty"),
      frame("s4.sb", "S4.S · B · Loading", "/store/updates?at=06:44&preview=loading"),
      frame("s4.sc", "S4.S · C · Offline", "/store/updates?at=06:44&preview=offline"),
      frame("s4.sd", "S4.S · D · Error", "/store/updates?at=06:44&preview=error"),
    ],
  },
];

export const FRAMES: Frame[] = FRAME_GROUPS.flatMap((group) => group.frames);

export function findFrame(id: string | null): Frame | undefined {
  return id ? FRAMES.find((f) => f.id === id.toLowerCase()) : undefined;
}
