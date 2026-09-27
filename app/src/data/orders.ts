import type { Brand } from '../components/ui';

export interface QueueOrder {
  id: string;
  outlet: string;
  brand: Brand;
  district: string;
  temp: 'Chilled' | 'Ambient';
  access: string[];
  window: string;
  /** Mall windows render as an outline tag instead of plain mono text. */
  windowTag?: boolean;
  units: number;
  kg: string;
  m3: string;
  carryOver?: boolean;
  justIn?: boolean;
}

/** Peliyagoda sample rows shown on D1 (spec §4c). */
export const peliyagodaQueue: QueueOrder[] = [
  { id: 'ORD1001', outlet: 'OUT012', brand: 'Fresh', district: 'Colombo', temp: 'Chilled', access: ['Rear dock'], window: '05:30–08:00', units: 37, kg: '220', m3: '1.5', carryOver: true },
  { id: 'ORD1005', outlet: 'OUT029', brand: 'Fresh', district: 'Gampaha', temp: 'Chilled', access: ['Rear dock'], window: '05:30–08:00', units: 13, kg: '80', m3: '0.7', carryOver: true },
  { id: 'ORD1002', outlet: 'OUT009', brand: 'Fresh', district: 'Colombo', temp: 'Chilled', access: [], window: '04:00–07:45', units: 35, kg: '210', m3: '1.4' },
  { id: 'ORD1020', outlet: 'OUT001', brand: 'Fresh', district: 'Colombo', temp: 'Chilled', access: ['Street', 'Van only'], window: '05:00–07:30', units: 208, kg: '1,250', m3: '8.6', justIn: true },
  { id: 'ORD1007', outlet: 'OUT015', brand: 'Style', district: 'Colombo', temp: 'Ambient', access: ['Mall bay', 'Mall dock'], window: 'Mall 09:00–11:00', windowTag: true, units: 30, kg: '450', m3: '6.5' },
];

export interface KandyOrder {
  id: string;
  temp: 'Chilled' | 'Ambient';
  window: string;
  units: number;
  kg: string;
  m3: string;
  received?: string;
}

export const kandyGroups: Array<{ outlet: string; name?: string; brand?: Brand; access?: string; window?: string; note?: string; orders: KandyOrder[] }> = [
  {
    outlet: 'OUT084',
    name: 'Waypoint Fresh · Kandy',
    brand: 'Fresh',
    access: 'Rear dock',
    window: '05:30–08:00',
    note: '2 orders · tracked separately',
    orders: [
      { id: 'ORD2001', temp: 'Chilled', window: '05:30–08:00', units: 12, kg: '70', m3: '0.7', received: '15:40' },
      { id: 'ORD2002', temp: 'Ambient', window: '05:30–08:00', units: 8, kg: '45', m3: '0.6', received: '15:40' },
    ],
  },
  {
    outlet: 'OUT087',
    orders: [{ id: 'ORD2003', temp: 'Ambient', window: '03:00–08:00', units: 9, kg: '55', m3: '0.6' }],
  },
];
