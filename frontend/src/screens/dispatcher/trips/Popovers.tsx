import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Check, ChevronDown, CircleAlert, CircleCheck, Lock, Truck, X } from "lucide-react";
import type { DeferredCard, MoveResult, PlanTrip } from "../../../api/DispatcherApi";
import { Mono } from "../../../shared/ui/Mono";
import { Btn } from "../ui/Btn";
import { Chip } from "../ui/Chip";
import { tempLabel } from "../ui/temp";
import { Meter } from "../ui/Meter";
import { cx } from "../ui/cx";
import styles from "./Trips.module.css";

/**
 * A popover that sits beside the card it is about, not on top of it (design fix D-4): to the right of the
 * anchor with a 12 px gap, or to its left when the anchor is in the last column.
 */
export function AnchoredPopover({
  anchor,
  container,
  width,
  tone = "plain",
  children,
  label,
}: {
  anchor: string;
  container: RefObject<HTMLElement | null>;
  width: number;
  tone?: "plain" | "danger";
  children: ReactNode;
  label: string;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const self = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const place = () => {
      const box = container.current;
      const target = box?.querySelector(`[data-anchor="${anchor}"]`);
      if (!box || !target) return;
      const b = box.getBoundingClientRect();
      const a = target.getBoundingClientRect();
      const room = b.right - a.right;
      const left = room > width + 24 ? a.right - b.left + 12 : a.left - b.left - width - 12;
      // Stay on the screen: slide up when the popover would run off the bottom of the window.
      const height = self.current?.offsetHeight ?? 0;
      const viewportTop = Math.max(64, Math.min(a.top, window.innerHeight - height - 16));
      setPos({ top: viewportTop - b.top, left: Math.max(8, left) });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [anchor, container, width]);

  return (
    <div ref={self} className={cx(styles.popover, tone === "danger" && styles.popoverDanger)} style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, width, visibility: pos ? "visible" : "hidden" }} role="dialog" aria-label={label}>
      {children}
    </div>
  );
}

function Bar({ before, after, limit }: { before: number; after: number; limit: number }) {
  return (
    <div className={styles.previewBar}>
      <Meter value={Math.max(before, after)} max={limit} height={5} tone="route" />
      <span className={styles.previewBarFrom} style={{ width: `${Math.min(100, (before / limit) * 100)}%` }} />
    </div>
  );
}

/** D3.2: what the move would do, shown over a legal target before the drop. */
export function MovePreview({ result }: { result: MoveResult }) {
  const p = result.preview;
  if (!p) return null;
  return (
    <>
      <div className={styles.popHead}>
        <h3>{p.headline}</h3>
        <CircleCheck size={22} color="var(--success)" />
      </div>
      <ul className={styles.previewRows}>
        {p.rows.map((row) => (
          <li key={row.label}>
            <Check size={16} className={styles.okIcon} />
            <div>
              <span className={styles.previewRowText}>
                {row.label === "Weight" || row.label === "Volume" ? (
                  <>
                    {row.label} <Mono>{row.text.replace(`${row.label} `, "")}</Mono>
                  </>
                ) : (
                  row.text
                )}
              </span>
              {row.before !== undefined && row.after !== undefined && row.limit ? <Bar before={row.before} after={row.after} limit={row.limit} /> : null}
            </div>
          </li>
        ))}
      </ul>
      {p.source && (
        <div className={styles.previewSource}>
          <Mono>
            <b>{p.source.title}</b>
          </Mono>
          <span>{p.source.frees}</span>
        </div>
      )}
      <div className={styles.previewNote}>
        <span className={styles.plus}>+</span>
        {p.note}
      </div>
      <b className={styles.verdict}>{p.verdict}</b>
    </>
  );
}

export type RefusalProps = {
  result: MoveResult;
  card: DeferredCard | undefined;
  trip: PlanTrip | undefined;
  onKeep: () => void;
  onTryAnother: () => void;
  keepLabel: string;
};

const PASS_RULES = ["Reefer", "Capacity", "Depot", "One brand + district", "Fuel"];

/** D3.3 to D3.5: a refused move lists every rule it breaks, in the screen voice, and what stays as it was. */
export function RefusalPopover({ result, card, onKeep, onTryAnother, keepLabel }: RefusalProps) {
  const [open, setOpen] = useState(false);
  const guard = result.protectedReason;
  const passes = result.checks.filter((c) => c.ok);
  const fails = result.checks.filter((c) => !c.ok);
  return (
    <>
      <div className={styles.refuseHead}>
        {guard ? <Lock size={20} /> : <CircleAlert size={20} />}
        <h3>{result.summary}</h3>
      </div>
      {guard && (
        <div className={styles.guardLine}>
          <Mono>
            <b>{result.orderId}</b>
          </Mono>
          <Chip tone="outlineInk" small icon={<Lock size={12} />}>
            Protected
          </Chip>
        </div>
      )}
      {!guard && result.violations.length > 1 && card && (
        <p className={styles.orderLine}>
          <Mono>
            {card.orderId} · {card.outletId} ·
          </Mono>{" "}
          {card.brand} · {card.district} · {tempLabel(card.temp)} ·{" "}
          <Mono>
            {card.kg} kg · {card.m3.toFixed(1)} m³
          </Mono>
        </p>
      )}
      {!guard && (
        <ul className={styles.violations}>
          {result.violations.map((v) => (
            <li key={v.rule}>
              <X size={16} className={styles.badIcon} />
              <span>{v.text}</span>
            </li>
          ))}
        </ul>
      )}
      {!guard && fails.length > 0 && result.violations.length > 1 && (
        <>
          <b className={styles.whySmall}>Why this vehicle</b>
          <div className={styles.whyGrid}>
            {result.checks
              .filter((c) => PASS_RULES.includes(c.rule) || c.rule === "Window")
              .map((c) => (
                <span key={c.rule} className={c.ok ? styles.whyOk : styles.whyBad}>
                  {c.ok ? <Check size={14} /> : <X size={14} />}
                  {c.rule === "One brand + district" ? "One brand" : c.rule}
                </span>
              ))}
          </div>
        </>
      )}
      {!guard && result.violations.length === 1 && passes.length > 0 && (
        <div className={styles.passBox}>
          <button type="button" className={styles.passToggle} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <CircleCheck size={16} color="var(--success)" />
            <b>Rules that pass</b>
            <ChevronDown size={16} />
          </button>
          {open ? (
            <ul className={styles.passList}>
              {passes.map((c) => (
                <li key={c.rule}>
                  <b>{c.rule}</b> {c.detail}
                </li>
              ))}
            </ul>
          ) : (
            <span className={styles.passShort}>{passes.map((c) => `${c.rule === "One brand + district" ? "One brand + district" : c.rule}✓`).join(" · ")}</span>
          )}
        </div>
      )}
      {guard && <p className={styles.guardText}>{guard}</p>}
      <div className={styles.refuseActions}>
        <Btn size="sm" onClick={onKeep}>
          {keepLabel}
        </Btn>
        {!guard && (
          <Btn variant="ghost" size="sm" onClick={onTryAnother}>
            Try another trip
          </Btn>
        )}
      </div>
    </>
  );
}

/** D3.7: every rule a vehicle passes for an order, with the figures, so the dispatcher can trust or question the draft. */
export function WhyPopover({ result, trip }: { result: MoveResult; trip: PlanTrip | undefined }) {
  const passed = result.checks.filter((c) => c.ok).length;
  return (
    <>
      <div className={styles.whyHead}>
        <Truck size={20} />
        <h3>
          Why {trip ? `${trip.vehicleId} · Trip ${trip.trip}` : "this vehicle"} for {result.orderId}
        </h3>
      </div>
      <ul className={styles.whyList}>
        {result.checks.map((c) => (
          <li key={c.rule}>
            {c.ok ? <Check size={18} className={styles.okIcon} /> : <X size={18} className={styles.badIcon} />}
            <div>
              <b>{c.rule}</b>
              <span>{c.detail}</span>
            </div>
          </li>
        ))}
      </ul>
      <Chip tone={passed === result.checks.length ? "success" : "danger"} pill icon={<Check size={14} />}>
        {passed} of {result.checks.length} rules pass
      </Chip>
    </>
  );
}

