/** Every dispatcher frame from the Figma "Dispatcher" page, mapped to its route. */
export interface FrameRef {
  id: string;
  title: string;
  path: string;
  node: string;
}

export interface FrameSection {
  key: string;
  title: string;
  subtitle: string;
  frames: FrameRef[];
}

const f = (id: string, title: string, path: string, node: string): FrameRef => ({ id, title, path, node });

export const SECTIONS: FrameSection[] = [
  {
    key: 'D1',
    title: 'D1 · Order queue',
    subtitle: 'Before and after the 16:00 cutoff',
    frames: [
      f('D1.1', 'Queue before cutoff', '/plan/queue', '54:1244'),
      f('D1.2', 'Queue after cutoff', '/plan/queue', '56:570'),
      f('D1.3', 'Kandy depot queue', '/plan/queue', '56:1133'),
      f('D1.4', 'Queue filters open', '/plan/queue', '56:2407'),
      f('D1.5', 'Order history drawer', '/plan/queue', '56:4655'),
      f('D1.S-empty', 'Empty', '/plan/queue', '56:5171'),
      f('D1.S-loading', 'Loading', '/plan/queue', '56:5275'),
      f('D1.S-offline', 'Offline', '/plan/queue', '56:5649'),
      f('D1.S-error', 'Error', '/plan/queue', '56:5934'),
    ],
  },
  {
    key: 'D2',
    title: 'D2 · Capacity',
    subtitle: 'How short is the fleet tonight',
    frames: [
      f('D2.1', 'Capacity draft: Peliyagoda', '/plan/capacity', '56:7266'),
      f('D2.2', 'Capacity: Kandy', '/plan/capacity', '56:8202'),
      f('D2.3', 'Capacity, spare reefer appears', '/plan/capacity', '56:9444'),
      f('D2.4', 'Capacity, released read-only', '/plan/capacity', '56:10498'),
      f('D2.S-empty', 'Empty', '/plan/capacity', '56:13152'),
      f('D2.S-loading', 'Loading', '/plan/capacity', '56:13242'),
      f('D2.S-offline', 'Offline', '/plan/capacity', '56:13386'),
      f('D2.S-error', 'Error', '/plan/capacity', '56:13565'),
    ],
  },
  {
    key: 'D3',
    title: 'D3 · Trip board',
    subtitle: 'Who carries what · moves, refusals, release',
    frames: [
      f('D3.1', 'Trip board, system draft', '/plan/trips', '56:15069'),
      f('D3.2', 'Accepted move with consequence preview', '/plan/trips', '71:1792'),
      f('D3.3', 'Refused move, window rule', '/plan/trips', '71:5831'),
      f('D3.4', 'Refused move, two rules broken', '/plan/trips', '71:7745'),
      f('D3.5', 'Refused move, continuity guard', '/plan/trips', '71:12332'),
      f('D3.6', '‘Move to…’ dialog (keyboard path)', '/plan/trips', '85:2'),
      f('D3.7', '‘Why this vehicle’ checklist popover', '/plan/trips', '88:2'),
      f('D3.8', 'Trip board, released (read-only)', '/plan/trips', '90:2'),
      f('D3.S-empty', 'Empty', '/plan/trips', '90:572'),
      f('D3.S-loading', 'Loading', '/plan/trips', '90:692'),
      f('D3.S-offline', 'Offline', '/plan/trips', '90:864'),
      f('D3.S-error', 'Error', '/plan/trips', '90:1376'),
    ],
  },
  {
    key: 'D4',
    title: 'D4 · Deferrals',
    subtitle: 'Who waits, typed and explained',
    frames: [
      f('D4.1', 'Deferrals, plan v3 (forced vs chosen)', '/plan/deferrals', '91:14'),
      f('D4.2', 'Deferral detail drawer (ORD1002)', '/plan/deferrals', '92:59'),
      f('D4.3', 'Deferrals, v4 adds ORD1002', '/plan/deferrals', '93:2'),
      f('D4.4', 'Deferrals, store-request group (Kandy)', '/plan/deferrals', '99:8'),
      f('D4.5', 'Deferrals, all stores notified', '/plan/deferrals', '115:2'),
      f('D4.S-empty', 'Empty', '/plan/deferrals', '115:391'),
      f('D4.S-loading', 'Loading', '/plan/deferrals', '115:509'),
      f('D4.S-offline', 'Offline', '/plan/deferrals', '115:626'),
      f('D4.S-error', 'Error', '/plan/deferrals', '115:954'),
    ],
  },
  {
    key: 'D5',
    title: 'D5 · Release',
    subtitle: 'Lock the plan and collect acknowledgements',
    frames: [
      f('D5.1', 'Release, draft ready to lock', '/plan/release', '115:1281'),
      f('D5.2', 'Release confirmation dialog', '/plan/release', '118:2'),
      f('D5.3', 'Released, acknowledgements pending', '/plan/release', '118:267'),
      f('D5.4', 'All acknowledged (04:56)', '/plan/release', '119:2'),
      f('D5.4b', 'v5 released, driver offline (05:22)', '/plan/release', '119:259'),
      f('D5.S-empty', 'Empty', '/plan/release', '121:8'),
      f('D5.S-loading', 'Loading (releasing)', '/plan/release', '121:115'),
      f('D5.S-offline', 'Offline', '/plan/release', '121:368'),
      f('D5.S-error', 'Error', '/plan/release', '121:622'),
    ],
  },
  {
    key: 'D6',
    title: 'D6 · Live operations',
    subtitle: 'Vehicles on the road',
    frames: [
      f('D6.1', 'Normal morning board', '/live', '121:887'),
      f('D6.2', 'Driver offline (known coverage gap)', '/live', '123:2'),
      f('D6.3', '‘Defer stop’ dialog with offline warning', '/live', '123:306'),
      f('D6.4', 'Change pending (driver offline)', '/live', '125:2'),
      f('D6.5', 'Conflict in inbox', '/live', '125:348'),
      f('D6.6', 'Resolved + receipt confirmed', '/live', '125:700'),
      f('D6.7', 'VEH003 held (loading exception)', '/live', '129:2'),
      f('D6.8', 'Nothing needs attention', '/live', '129:370'),
      f('D6.S-loading', 'Loading', '/live', '132:2'),
      f('D6.S-offline', 'Offline (dispatcher’s connection)', '/live', '132:126'),
      f('D6.S-error', 'Error (vehicle events)', '/live', '132:433'),
    ],
  },
  {
    key: 'D7',
    title: 'D7 · Reconciliation',
    subtitle: 'Two true records, a person decides',
    frames: [
      f('D7.1', 'Needs decision (hero degradation)', '/live/conflict', '132:749'),
      f('D7.2', 'Awaiting store', '/live/conflict', '133:2'),
      f('D7.3', 'Store reported an issue', '/live/conflict', '133:241'),
      f('D7.4', 'Resolved', '/live/conflict', '133:496'),
      f('D7.S-empty', 'Empty', '/live/conflict', '133:756'),
      f('D7.S-loading', 'Loading', '/live/conflict', '133:821'),
      f('D7.S-offline', 'Offline', '/live/conflict', '133:894'),
      f('D7.S-error', 'Error', '/live/conflict', '133:1125'),
    ],
  },
  {
    key: 'D8',
    title: 'D8 · Loading exception',
    subtitle: 'Reefer swap at the dock',
    frames: [
      f('D8.1', 'Held (working out options)', '/live/exception', '140:2'),
      f('D8.2', 'Recommendation', '/live/exception', '137:9'),
      f('D8.3', 'Adjust manually', '/live/exception', '140:307'),
      f('D8.4', 'Confirmed (plan v4)', '/live/exception', '140:650'),
      f('D8.S-empty', 'Empty', '/live/exception', '140:979'),
      f('D8.S-offline', 'Offline', '/live/exception', '140:1044'),
      f('D8.S-error', 'Error', '/live/exception', '140:1337'),
    ],
  },
  {
    key: 'D9',
    title: 'D9 · Capacity outlook',
    subtitle: 'Is next week short too',
    frames: [
      f('D9.1', 'Capacity outlook, 4 weeks', '/forecast', '140:1639'),
      f('D9.2', 'Short week flagged (expanded)', '/forecast', '140:1793'),
      f('D9.S-empty', 'Empty', '/forecast', '140:1978'),
      f('D9.S-loading', 'Loading', '/forecast', '140:2037'),
      f('D9.S-offline', 'Offline', '/forecast', '140:2116'),
      f('D9.S-error', 'Error', '/forecast', '140:2281'),
    ],
  },
];

export const ALL_FRAMES = SECTIONS.flatMap((s) => s.frames);

export const frameHref = (fr: FrameRef) => `${fr.path}?frame=${encodeURIComponent(fr.id)}`;
