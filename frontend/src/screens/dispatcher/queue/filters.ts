import { NO_FILTERS, type QueueFilters } from "../../../api/DispatcherApi";

type WindowBucket = QueueFilters["window"][number];

export const WINDOWS: { value: WindowBucket; label: string }[] = [
  { value: "early", label: "Start before 05:00" },
  { value: "mid", label: "05:00–06:00" },
  { value: "late", label: "After 06:00" },
];

/** The chips a set of filters draws above the table ("Fresh", "Chilled"), each with its way to remove it. */
export function activeChips(filters: QueueFilters, set: (next: QueueFilters) => void): { label: string; remove: () => void }[] {
  return [
    ...filters.brand.map((b) => ({ label: b, remove: () => set({ ...filters, brand: filters.brand.filter((x) => x !== b) }) })),
    ...filters.temp.map((t) => ({ label: t === "chilled" ? "Chilled" : "Ambient", remove: () => set({ ...filters, temp: filters.temp.filter((x) => x !== t) }) })),
    ...filters.status.map((s) => ({ label: s, remove: () => set({ ...filters, status: filters.status.filter((x) => x !== s) }) })),
    ...filters.window.map((w) => ({ label: WINDOWS.find((x) => x.value === w)?.label ?? w, remove: () => set({ ...filters, window: filters.window.filter((x) => x !== w) }) })),
    ...filters.tags.map((t) => ({ label: t, remove: () => set({ ...filters, tags: filters.tags.filter((x) => x !== t) }) })),
    ...filters.district.map((d) => ({ label: d, remove: () => set({ ...filters, district: filters.district.filter((x) => x !== d) }) })),
  ];
}

export function isFiltering(filters: QueueFilters): boolean {
  return JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);
}

