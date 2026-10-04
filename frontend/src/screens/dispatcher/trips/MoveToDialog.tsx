import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, CircleDot, Search, X } from "lucide-react";
import type { DeferredCard, DispatcherApi, MoveResult, MoveTarget, PlanView } from "../../../api/DispatcherApi";
import { Modal } from "../../../shared/ui/Modal";
import { Btn } from "../ui/Btn";
import { BrandChip, Chip, TempChip } from "../ui/Chip";
import { Mono } from "../../../shared/ui/Mono";
import { cx } from "../ui/cx";
import styles from "./MoveToDialog.module.css";
import { newTripOf, tripKey } from "./types";

/** "Window: planned arrival 08:06 is after OUT007's window closes at 08:00." as the dialog says it: one short line per refusal. */
function shortReason(text: string): string {
  const m = /arrival (\d\d:\d\d) is after (\S+)'s window closes at (\d\d:\d\d)/.exec(text);
  return m ? `Arrives ${m[1]}: after ${m[2]}'s ${m[3]} window close` : text;
}

type Option = { key: string; target: MoveTarget; title: string; result: MoveResult | null; current: boolean };

export type MoveToDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  api: DispatcherApi;
  plan: PlanView;
  orderId: string;
  /** The order's card if it is deferred; otherwise the trip it is on. */
  deferred: DeferredCard | undefined;
  onMove: (target: MoveTarget) => void;
};

/**
 * D3.6: the keyboard path for a move. Every trip is checked against the order, each refusal is shown with its
 * reason, and arrow keys and Enter choose. Nothing moves until a legal option is confirmed.
 */
export function MoveToDialog({ open, onOpenChange, api, plan, orderId, deferred, onMove }: MoveToDialogProps) {
  const currentTrip = useMemo(() => {
    for (const lane of plan.lanes) for (const t of lane.trips) if (t.stops.some((s) => s.orderIds.includes(orderId))) return t;
    return undefined;
  }, [plan, orderId]);
  const currentKey = currentTrip ? tripKey(currentTrip.vehicleId, currentTrip.trip) : "deferred";

  const [options, setOptions] = useState<Option[]>([]);
  const [selected, setSelected] = useState(currentKey);
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const targets: { key: string; target: MoveTarget; title: string }[] = [];
    for (const lane of plan.lanes) {
      // "VEH003 · Nimal · Trip 1": each vehicle has one driver, so the run is theirs.
      const who = lane.driver ? `${lane.vehicleId} · ${lane.driver}` : lane.vehicleId;
      for (const trip of lane.trips) {
        const key = tripKey(trip.vehicleId, trip.trip);
        if (key !== currentKey) targets.push({ key, target: { vehicleId: trip.vehicleId, trip: trip.trip }, title: `${who} · Trip ${trip.trip}` });
      }
      // A run the planner did not make: the vehicle's next trip, checked like any other target.
      const next = newTripOf(lane);
      if (next !== null) targets.push({ key: tripKey(lane.vehicleId, next), target: { vehicleId: lane.vehicleId, trip: next }, title: `${who} · New trip ${next}` });
    }
    // An order on a trip can also wait for the next run; the reason is asked before it is saved.
    if (currentTrip) targets.push({ key: "deferred", target: "deferred", title: "Defer to the next run" });
    void Promise.all(targets.map((t) => api.validateMove({ orderId, to: t.target }))).then((results) => {
      if (!alive) return;
      const list: Option[] = targets.map((t, i) => ({ ...t, result: results[i] ?? null, current: false }));
      list.push({ key: currentKey, target: currentTrip ? { vehicleId: currentTrip.vehicleId, trip: currentTrip.trip } : "deferred", title: currentTrip ? `Keep on ${currentTrip.vehicleId} · Trip ${currentTrip.trip}` : "Keep deferred", result: null, current: true });
      setOptions(list);
      setSelected(currentKey);
    });
    return () => {
      alive = false;
    };
  }, [open, api, plan, orderId, currentKey, currentTrip]);

  const shown = options.filter((o) => o.title.toLowerCase().includes(query.trim().toLowerCase()));
  const chosen = options.find((o) => o.key === selected);
  const allowed = chosen ? chosen.current || chosen.result?.ok === true : false;

  const move = (delta: number) => {
    if (shown.length === 0) return;
    const index = Math.max(0, shown.findIndex((o) => o.key === selected));
    const next = shown[(index + delta + shown.length) % shown.length];
    if (next) setSelected(next.key);
  };

  const confirm = () => {
    if (!chosen || !allowed) return;
    if (chosen.current) onOpenChange(false);
    else {
      onMove(chosen.target);
      onOpenChange(false);
    }
  };

  const order = deferred;
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Move ${orderId} to…`}>
      <div
        className={styles.content}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            move(1);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            move(-1);
          } else if (event.key === "Enter" && (event.target as HTMLElement).tagName !== "BUTTON") {
            event.preventDefault();
            confirm();
          }
        }}
      >
        <div className={styles.meta}>
          {order ? (
            <>
              <BrandChip brand={order.brand} small />
              <TempChip temp={order.temp} small />
              <Chip tone="outlineInk" small>
                {order.dock === "Rear dock" ? "Rear dock" : order.dock}
              </Chip>
              <Mono>
                <span className={styles.figures}>
                  {order.outletId} · {order.window.start}–{order.window.end} · {order.kg} kg · {order.m3.toFixed(1)} m³
                </span>
              </Mono>
            </>
          ) : (
            <span className={styles.figures}>
              On <Mono>{currentTrip?.vehicleId} · Trip {currentTrip?.trip}</Mono>
            </span>
          )}
        </div>
        <label className={styles.search}>
          <Search size={18} />
          <input autoFocus placeholder="Search trips or vehicles" aria-label="Search trips or vehicles" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <ul className={styles.list} ref={listRef} role="listbox" aria-label="Where to move">
          {options.length === 0 && <li className={styles.loading}>Checking each trip against the rules…</li>}
          {shown.map((o) => {
            const refused = !o.current && o.result?.ok === false;
            const on = o.key === selected;
            return (
              <li key={o.key} role="option" aria-selected={on} aria-disabled={refused} className={cx(styles.option, refused && styles.refused, on && styles.on, o.current && styles.currentOption)} onClick={() => setSelected(o.key)}>
                <span className={styles.icon}>{refused ? <X size={18} /> : on ? <CircleDot size={20} /> : <Circle size={20} />}</span>
                <span className={styles.text}>
                  <Mono>
                    <b className={styles.optionTitle}>{o.title}</b>
                  </Mono>
                  {refused && <span className={styles.reason}>{o.result?.violations.map((v) => shortReason(v.text)).join(" · ")}</span>}
                  {o.current && <span className={styles.sub}>Current · {deferred ? `Deferred · ${deferred.kind} → ${deferred.nextRun}` : "On this trip"}</span>}
                  {!o.current && !refused && o.result?.ok && <span className={styles.allowed}>{o.result.summary}</span>}
                </span>
                {refused && <span className={styles.notAllowed}>Not allowed</span>}
              </li>
            );
          })}
        </ul>
        <div className={styles.footer}>
          <span className={styles.keys}>↑↓ to move · Enter to choose · Esc to close</span>
          <div className={styles.actions}>
            <Btn variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Btn>
            <Btn onClick={confirm} disabled={!allowed}>
              {chosen?.current ? (deferred ? "Keep deferred" : "Keep here") : "Move here"}
            </Btn>
          </div>
        </div>
      </div>
    </Modal>
  );
}
