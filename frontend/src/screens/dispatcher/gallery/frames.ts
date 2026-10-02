/**
 * Every frame of D1 to D9, as an address the app can open (PRD v3 section 15: "a frame is a state of its
 * screen, produced by data and the scenario clock, never a separate page"). Each frame names the route,
 * the scenario time, and any preview, preset or `ui` value that reaches the state without a click. The
 * frame names are Figma's. The four state frames per screen (loading, empty, offline, error) follow each group.
 */
export type Frame = {
  /** Lower case, for `?frame=`: "d3.4", "d6.s-offline". */
  id: string;
  /** The Figma frame name. */
  name: string;
  /** The address the frame opens at, inside its own memory router. */
  url: string;
};

const frame = (id: string, name: string, url: string): Frame => ({ id, name, url });

/** The loading, empty, offline and error states of one route. */
function states(screen: string, label: string, url: string): Frame[] {
  const at = url.includes("?") ? `${url}&` : `${url}?`;
  return [
    frame(`${screen}.s-loading`, `${screen.toUpperCase()}.S · Loading · ${label}`, `${at}state=loading`),
    frame(`${screen}.s-empty`, `${screen.toUpperCase()}.S · Empty · ${label}`, `${at}state=empty`),
    frame(`${screen}.s-offline`, `${screen.toUpperCase()}.S · Offline · ${label}`, `${at}state=offline`),
    frame(`${screen}.s-error`, `${screen.toUpperCase()}.S · Error · ${label}`, `${at}state=error`),
  ];
}

export const FRAME_GROUPS: { screen: string; title: string; frames: Frame[] }[] = [
  {
    screen: "D1",
    title: "D1 Order queue",
    frames: [
      frame("d1.1", "D1.1 · 15:40 · Queue: before cutoff", "/dispatcher/queue?at=15:40"),
      frame("d1.2", "D1.2 · 16:07 · Queue: after cutoff", "/dispatcher/queue?at=16:07"),
      frame("d1.3", "D1.3 · 16:06 · Queue: Kandy", "/dispatcher/queue?at=16:06&depot=kandy"),
      frame("d1.4", "D1.4 · 16:06 · Queue: filters open", "/dispatcher/queue?at=16:06&panel=filters&filter=Fresh,chilled"),
      frame("d1.5", "D1.5 · 16:06 · Order history drawer", "/dispatcher/queue?at=16:06&order=ORD1001"),
      ...states("d1", "Queue", "/dispatcher/queue?at=16:06"),
    ],
  },
  {
    screen: "D2",
    title: "D2 Capacity",
    frames: [
      frame("d2.1", "D2.1 · 21:10 · Capacity: Peliyagoda", "/dispatcher/capacity?at=21:10"),
      frame("d2.2", "D2.2 · 21:10 · Capacity: Kandy", "/dispatcher/capacity?at=21:10&depot=kandy"),
      frame("d2.3", "D2.3 · 02:45 · Capacity: spare reefer back", "/dispatcher/capacity?at=02:45"),
      frame("d2.4", "D2.4 · 23:41 · Capacity: released", "/dispatcher/capacity?at=23:41"),
      ...states("d2", "Capacity", "/dispatcher/capacity?at=21:10"),
    ],
  },
  {
    screen: "D3",
    title: "D3 Trips",
    frames: [
      frame("d3.1", "D3.1 · 21:15 · Trips: plan v2", "/dispatcher/trips?at=21:15"),
      frame("d3.2", "D3.2 · Move accepted", "/dispatcher/trips?at=21:15&ui=accept"),
      frame("d3.3", "D3.3 · Move refused: window 08:06", "/dispatcher/trips?at=21:15&ui=refuse-window"),
      frame("d3.4", "D3.4 · Move refused: two violations", "/dispatcher/trips?at=21:15&ui=refuse-two"),
      frame("d3.5", "D3.5 · Move refused: continuity guard", "/dispatcher/trips?at=21:15&ui=refuse-guard"),
      frame("d3.6", "D3.6 · Move to dialog", "/dispatcher/trips?at=21:15&ui=moveto"),
      frame("d3.7", "D3.7 · Why this vehicle", "/dispatcher/trips?at=21:15&ui=why"),
      frame("d3.8", "D3.8 · 23:41 · Trips: released, read-only", "/dispatcher/trips?at=23:41"),
      frame("d3.save-error", "D3.S · Error · Save failed", "/dispatcher/trips?at=21:15&ui=save-error"),
      ...states("d3", "Trips", "/dispatcher/trips?at=21:15"),
    ],
  },
  {
    screen: "D4",
    title: "D4 Deferrals",
    frames: [
      frame("d4.1", "D4.1 · 23:32 · Deferrals: plan v3 draft", "/dispatcher/deferrals?at=23:32"),
      frame("d4.2", "D4.2 · 23:32 · Deferral detail drawer", "/dispatcher/deferrals/ORD1009?at=23:32"),
      frame("d4.3", "D4.3 · 03:02 · Deferrals: plan v4", "/dispatcher/deferrals?at=03:02"),
      frame("d4.4", "D4.4 · 05:22 · Deferrals: Kandy store request", "/dispatcher/deferrals?at=05:22&depot=kandy"),
      frame("d4.5", "D4.5 · 23:58 · Deferrals: released, notices sent", "/dispatcher/deferrals?at=23:58"),
      frame("d4.notice-error", "D4.S · Error · Notice failed", "/dispatcher/deferrals?at=23:32&ui=notice-error&open=ORD1009"),
      ...states("d4", "Deferrals", "/dispatcher/deferrals?at=23:32"),
    ],
  },
  {
    screen: "D5",
    title: "D5 Release",
    frames: [
      frame("d5.1", "D5.1 · 23:35 · Release plan v3", "/dispatcher/release?at=23:35"),
      frame("d5.2", "D5.2 · 23:35 · Release confirmation", "/dispatcher/release?at=23:35&ui=confirm"),
      frame("d5.3a", "D5.3 A · 23:41 · Plan v3 is live", "/dispatcher/release?at=23:41"),
      frame("d5.3b", "D5.3 B · 04:10 · Plan v4 is live", "/dispatcher/release?at=04:10"),
      frame("d5.4a", "D5.4 A · 04:56 · Everyone has v4", "/dispatcher/release?at=04:56"),
      frame("d5.4b", "D5.4 B · 05:22 · Plan v5, VEH039 offline", "/dispatcher/release?at=05:22&depot=kandy"),
      ...states("d5", "Release", "/dispatcher/release?at=23:35"),
    ],
  },
  {
    screen: "D6",
    title: "D6 Live operations",
    frames: [
      frame("d6.1", "D6.1 · 05:12 · Live: nothing needs a decision", "/dispatcher/live?at=05:12"),
      frame("d6.2", "D6.2 · 05:20 · Live: VEH039 offline", "/dispatcher/live?at=05:20"),
      frame("d6.3", "D6.3 · 05:21 · Defer stop", "/dispatcher/live?at=05:21&ui=defer"),
      frame("d6.4", "D6.4 · 05:30 · Live: change pending", "/dispatcher/live?at=05:30"),
      frame("d6.5", "D6.5 · 06:40 · Live: conflict", "/dispatcher/live?at=06:40"),
      frame("d6.6", "D6.6 · 07:31 · Live: conflict resolved", "/dispatcher/live?at=07:31&preset=resolved"),
      frame("d6.7", "D6.7 · 02:56 · Live: VEH003 held", "/dispatcher/live?at=02:56"),
      frame("d6.8", "D6.8 · 06:15 · Live: calm", "/dispatcher/live?at=06:15&state=calm"),
      ...states("d6", "Live", "/dispatcher/live?at=05:12"),
    ],
  },
  {
    screen: "D7",
    title: "D7 Conflict",
    frames: [
      frame("d7.1", "D7.1 · 06:44 · Two records", "/dispatcher/conflicts/c1?at=06:44"),
      frame("d7.2", "D7.2 · 06:46 · Asked the store", "/dispatcher/conflicts/c1?at=06:46&preset=asked"),
      frame("d7.3", "D7.3 · 07:05 · Store reported a shortage", "/dispatcher/conflicts/c1?at=07:05&preset=asked"),
      frame("d7.4a", "D7.4 A · 06:44 · Resolved: kept delivery", "/dispatcher/conflicts/c1?at=06:44&preset=resolved"),
      frame("d7.4b", "D7.4 B · 07:05 · Resolved: kept as Partial", "/dispatcher/conflicts/c1?at=07:05&preset=resolved-partial"),
      ...states("d7", "Conflict", "/dispatcher/conflicts/c1?at=06:44"),
    ],
  },
  {
    screen: "D8",
    title: "D8 Loading exception",
    frames: [
      frame("d8.1", "D8.1 · 02:58 · Working out the options", "/dispatcher/exceptions/x1?at=02:58"),
      frame("d8.2", "D8.2 · 03:00 · Recommendation", "/dispatcher/exceptions/x1?at=03:00"),
      frame("d8.3", "D8.3 · 03:01 · Adjust manually: protected order refused", "/dispatcher/exceptions/x1?at=03:01&ui=refuse"),
      frame("d8.4", "D8.4 · 03:06 · Replaced, plan v4", "/dispatcher/exceptions/x1?at=03:06&preset=swap"),
      ...states("d8", "Exception", "/dispatcher/exceptions/x1?at=03:00"),
    ],
  },
  {
    screen: "D9",
    title: "D9 Forecast",
    frames: [
      frame("d9.1", "D9.1 · 21:15 · Forecast: four weeks", "/dispatcher/forecast?at=21:15&week=none"),
      frame("d9.2", "D9.2 · 21:15 · Forecast: week 19 Oct open", "/dispatcher/forecast?at=21:15"),
      ...states("d9", "Forecast", "/dispatcher/forecast?at=21:15"),
    ],
  },
];

export function findFrame(id: string | null): Frame | undefined {
  if (!id) return undefined;
  const wanted = id.toLowerCase();
  for (const group of FRAME_GROUPS) {
    const hit = group.frames.find((f) => f.id === wanted);
    if (hit) return hit;
  }
  return undefined;
}
