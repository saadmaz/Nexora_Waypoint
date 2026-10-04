import { useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import { NO_FILTERS, type Brand, type DepotId, type OrderTemp, type QueueFilterTag, type QueueFilters } from "../../../api/DispatcherApi";
import type { OrderStatus } from "../../../domain/status";
import { Btn, IconButton, LinkButton } from "../ui/Btn";
import { cx } from "../ui/cx";
import { WINDOWS } from "./filters";
import styles from "./FiltersPanel.module.css";

const BRANDS: Brand[] = ["Fresh", "Style", "Tech"];
const TEMPS: { value: OrderTemp; label: string }[] = [
  { value: "chilled", label: "Chilled" },
  { value: "ambient", label: "Ambient" },
  { value: "frozen", label: "Frozen" },
];
const STATUSES: OrderStatus[] = ["Ordered", "Confirmed", "Planned", "Deferred"];
const TAGS: QueueFilterTag[] = ["Carry-over", "After cutoff", "Van only", "Mall dock"];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export type FiltersPanelProps = {
  filters: QueueFilters;
  depot: DepotId;
  onApply: (filters: QueueFilters) => void;
  onDepot: (depot: DepotId) => void;
  onClose: () => void;
};

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" className={cx(styles.choice, on && styles.on)} aria-pressed={on} onClick={onClick}>
      {on && <Check size={15} />}
      {children}
    </button>
  );
}

/** D1.4: the filters a dispatcher narrows the queue with. Nothing changes until "Apply filters". */
export function FiltersPanel({ filters, depot, onApply, onDepot, onClose }: FiltersPanelProps) {
  const [draft, setDraft] = useState<QueueFilters>(filters);
  return (
    <aside className={styles.panel} aria-label="Filters">
      <div className={styles.body}>
        <div className={styles.top}>
          <h2>Filters</h2>
          <IconButton label="Close filters" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        <Group label="Brand">
          {BRANDS.map((b) => (
            <Choice key={b} on={draft.brand.includes(b)} onClick={() => setDraft({ ...draft, brand: toggle(draft.brand, b) })}>
              {b}
            </Choice>
          ))}
        </Group>
        <Group label="Depot">
          {(["peliyagoda", "kandy"] as DepotId[]).map((d) => (
            <Choice key={d} on={depot === d} onClick={() => onDepot(d)}>
              {d === "peliyagoda" ? "Peliyagoda" : "Kandy"}
            </Choice>
          ))}
        </Group>
        <Group label="Temperature">
          {TEMPS.map((t) => (
            <Choice key={t.value} on={draft.temp.includes(t.value)} onClick={() => setDraft({ ...draft, temp: toggle(draft.temp, t.value) })}>
              {t.label}
            </Choice>
          ))}
        </Group>
        <Group label="Status">
          {STATUSES.map((s) => (
            <Choice key={s} on={draft.status.includes(s)} onClick={() => setDraft({ ...draft, status: toggle(draft.status, s) })}>
              {s}
            </Choice>
          ))}
        </Group>
        <Group label="Window">
          {WINDOWS.map((w) => (
            <Choice key={w.value} on={draft.window.includes(w.value)} onClick={() => setDraft({ ...draft, window: toggle(draft.window, w.value) })}>
              {w.label}
            </Choice>
          ))}
        </Group>
        <Group label="Tags">
          {TAGS.map((t) => (
            <Choice key={t} on={draft.tags.includes(t)} onClick={() => setDraft({ ...draft, tags: toggle(draft.tags, t) })}>
              {t}
            </Choice>
          ))}
        </Group>
      </div>
      <div className={styles.footer}>
        <LinkButton onClick={() => setDraft(NO_FILTERS)}>Clear all</LinkButton>
        <Btn size="lg" onClick={() => onApply(draft)}>
          Apply filters
        </Btn>
      </div>
    </aside>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.group}>
      <span className={styles.label}>{label}</span>
      <div className={styles.choices}>{children}</div>
    </div>
  );
}
