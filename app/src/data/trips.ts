import type { Brand } from '../components/ui';

export interface Stop {
  n: number;
  outlet: string;
  order?: string;
  time: string;
  note?: string;
}

export interface Trip {
  id: string;
  vehicle: string;
  trip: number;
  departs: string;
  brand: Brand;
  district: string;
  stops: Stop[];
  totals: Array<{ label: string; value: string; pct?: number }>;
}

export interface Lane {
  vehicle: string;
  typeTag: { label: string; chilled: boolean };
  meters: Array<{ label: string; value: string; pct: number }>;
  trips: Trip[];
  height: number;
}

/** Peliyagoda plan v2 draft (spec §4c, D3.1). */
export const lanes: Lane[] = [
  {
    vehicle: 'VEH003',
    typeTag: { label: 'Reefer / Chilled', chilled: true },
    meters: [
      { label: 'Fresh', value: '241 / 270 min', pct: 89 },
      { label: 'Fuel', value: '74.2 / 480 L', pct: 15 },
    ],
    height: 248,
    trips: [
      {
        id: 'VEH003-1',
        vehicle: 'VEH003',
        trip: 1,
        departs: '03:30',
        brand: 'Fresh',
        district: 'Colombo',
        stops: [
          { n: 1, outlet: 'OUT011', order: 'ORD1014', time: '03:54' },
          { n: 2, outlet: 'OUT006', order: 'ORD1016', time: '04:17' },
          { n: 3, outlet: 'OUT005', order: 'ORD1011', time: '04:41' },
          { n: 4, outlet: 'OUT009', order: 'ORD1002', time: '05:04' },
          { n: 5, outlet: 'OUT012', order: 'ORD1001', time: '05:27', note: 'waits to 05:30' },
        ],
        totals: [
          { label: 'Weight', value: '1,160 / 5,510 kg', pct: 21 },
          { label: 'Volume', value: '7.7 / 26.4 m³', pct: 29 },
          { label: 'Trip', value: '132 min', pct: 46 },
        ],
      },
      {
        id: 'VEH003-2',
        vehicle: 'VEH003',
        trip: 2,
        departs: '06:09',
        brand: 'Fresh',
        district: 'Colombo',
        stops: [
          { n: 1, outlet: 'OUT008', time: '06:33' },
          { n: 2, outlet: 'OUT013', time: '06:56' },
          { n: 3, outlet: 'OUT010', time: '07:19' },
          { n: 4, outlet: 'OUT004', time: '07:42' },
        ],
        totals: [
          { label: 'Weight', value: '340 kg' },
          { label: 'Volume', value: '3.3 m³' },
          { label: 'Trip', value: '109 min', pct: 38 },
        ],
      },
    ],
  },
  {
    vehicle: 'VEH035',
    typeTag: { label: 'Reefer / Chilled', chilled: true },
    meters: [
      { label: 'Fresh', value: '226 / 270 min', pct: 84 },
      { label: 'Fuel', value: '54.3 / 480 L', pct: 11 },
    ],
    height: 216,
    trips: [
      {
        id: 'VEH035-1',
        vehicle: 'VEH035',
        trip: 1,
        departs: '03:30',
        brand: 'Fresh',
        district: 'Colombo',
        stops: [
          { n: 1, outlet: 'OUT026', time: '04:07' },
          { n: 2, outlet: 'OUT028', time: '04:31' },
          { n: 3, outlet: 'OUT032', time: '04:56' },
          { n: 4, outlet: 'OUT034', time: '05:20' },
        ],
        totals: [
          { label: 'Weight', value: '330 / 1,040 kg' },
          { label: 'Volume', value: '3.0 / 7.0 m³' },
          { label: 'Trip', value: '125 min' },
        ],
      },
      {
        id: 'VEH035-2',
        vehicle: 'VEH035',
        trip: 2,
        departs: '06:12',
        brand: 'Fresh',
        district: 'Colombo',
        stops: [
          { n: 1, outlet: 'OUT027', time: '06:49' },
          { n: 2, outlet: 'OUT025', order: 'ORD1003', time: '07:14' },
          { n: 3, outlet: 'OUT029', order: 'ORD1005', time: '07:38' },
        ],
        totals: [
          { label: 'Weight', value: '290 kg', pct: 35 },
          { label: 'Volume', value: '2.5 m³', pct: 36 },
          { label: 'Trip', value: '101 min', pct: 35 },
        ],
      },
    ],
  },
  {
    vehicle: 'VEH011',
    typeTag: { label: 'Ambient · plain', chilled: false },
    meters: [
      { label: 'Style+Tech', value: '83 / 480 min', pct: 15 },
      { label: 'Fuel', value: '68.9 / 600 L', pct: 10 },
    ],
    height: 136,
    trips: [
      {
        id: 'VEH011-1',
        vehicle: 'VEH011',
        trip: 1,
        departs: '08:36',
        brand: 'Style',
        district: 'Colombo',
        stops: [{ n: 1, outlet: 'OUT015', order: 'ORD1007', time: '09:00', note: 'mall window opens 09:00' }],
        totals: [
          { label: 'Weight', value: '450 / 7,200 kg', pct: 1 },
          { label: 'Volume', value: '6.5 / 38.0 m³', pct: 3 },
          { label: 'Trip', value: '83 min', pct: 3 },
        ],
      },
    ],
  },
];

export const deferredPool = [
  { order: 'ORD1020', label: 'Deferred · capacity → Wed', note: 'No legal vehicle' },
  { order: 'ORD1009', label: 'Deferred · policy → Wed' },
  { order: 'ORD1017', label: 'Deferred · policy → Wed' },
  { order: 'ORD1006', label: 'Deferred · policy → Wed' },
];
