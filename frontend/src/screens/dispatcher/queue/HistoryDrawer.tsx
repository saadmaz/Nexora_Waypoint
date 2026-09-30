import { Check, Clock3, LockKeyhole, NotebookPen, TriangleAlert, X } from "lucide-react";
import type { OrderHistory } from "../../../api/DispatcherApi";
import { Mono } from "../../../shared/ui/Mono";
import { BrandChip, Chip, TempChip } from "../ui/Chip";
import { cx } from "../ui/cx";
import { Drawer, DrawerClose } from "../ui/Drawer";
import { Skel } from "../ui/Skel";
import styles from "./HistoryDrawer.module.css";

export type HistoryDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
  history: OrderHistory | undefined;
  failed: boolean;
};

const STEP_ROWS: [number, number][] = [
  [0, 4],
  [4, 7],
];

/** D1.5: one order's history. Who sent it, when it is served, where it is in its journey. */
export function HistoryDrawer({ open, onOpenChange, orderId, history, failed }: HistoryDrawerProps) {
  const order = history?.order;
  return (
    <Drawer open={open} onOpenChange={onOpenChange} label={`Order history ${orderId ?? ""}`}>
      <div className={styles.drawer}>
        {failed ? (
          <section className={styles.section}>
            <h3>Couldn't load this order's history</h3>
            <p className={styles.muted}>Nothing was changed. Close this panel and try again.</p>
            <DrawerClose className={styles.closeText}>Close</DrawerClose>
          </section>
        ) : !history || !order ? (
          <section className={styles.section}>
            <Skel w={260} h={24} />
            <Skel w={340} h={14} />
            <Skel w="100%" h={60} />
          </section>
        ) : (
          <>
            <section className={styles.head}>
              <div className={styles.titleRow}>
                <h2>
                  <Mono>
                    {order.id} · {order.outletId}
                  </Mono>
                </h2>
                <DrawerClose className={styles.close} aria-label="Close order history drawer">
                  <X size={20} />
                </DrawerClose>
              </div>
              <div className={styles.chips}>
                <BrandChip brand={order.brand} dot={false} />
                <TempChip temp={order.temp} />
                {order.access.map((a) => (
                  <Chip key={a} tone="outline">
                    {a}
                  </Chip>
                ))}
                {order.tags.includes("Protected") && (
                  <Chip tone="outline" icon={<LockKeyhole size={13} />}>
                    Protected
                  </Chip>
                )}
              </div>
              <Mono>
                <span className={styles.figures}>
                  {order.window.start}–{order.window.end} · {order.units} units · {order.kg.toLocaleString("en-US")} kg · {order.m3.toFixed(1)} m³
                </span>
              </Mono>
              <span className={styles.muted}>{history.summary}</span>
            </section>
            <div className={styles.rule} />
            <section className={styles.section}>
              <h3>Outlet continuity</h3>
              {history.continuity.protected ? (
                <div className={styles.continuity}>
                  <TriangleAlert size={18} />
                  <span>{history.continuity.text}</span>
                </div>
              ) : (
                <span className={styles.muted}>{history.continuity.text}</span>
              )}
            </section>
            <div className={styles.rule} />
            <section className={styles.section}>
              <h3>Last 5 runs</h3>
              <div className={styles.runs}>
                {history.lastRuns.map((r) => (
                  <div key={r.date} className={styles.run}>
                    <span className={cx(styles.runMark, styles[r.outcome])}>
                      {r.outcome === "served" && <Check size={17} />}
                      {r.outcome === "deferred" && <Clock3 size={16} />}
                      {r.outcome === "pending" && <span className={styles.runDot} />}
                    </span>
                    <span className={styles.runLabel}>{r.label}</span>
                  </div>
                ))}
              </div>
            </section>
            <div className={styles.rule} />
            <section className={styles.section}>
              <h3>Order journey</h3>
              {STEP_ROWS.map(([from, to]) => (
                <ol key={from} className={styles.journey} style={{ gridTemplateColumns: `repeat(${to - from}, 1fr)` }}>
                  {history.journey.slice(from, to).map((step) => (
                    <li key={step.step} className={cx(styles.step, styles[`step_${step.state}`])}>
                      <span className={styles.marker} />
                      <b>{step.step}</b>
                      {step.by && <span className={styles.by}>{step.by}</span>}
                    </li>
                  ))}
                </ol>
              ))}
            </section>
            <div className={styles.rule} />
            <section className={styles.section}>
              <h3>Notes</h3>
              <div className={styles.notes}>
                <NotebookPen size={16} />
                {history.notes.length === 0 ? "No notes" : history.notes.join(" · ")}
              </div>
            </section>
          </>
        )}
      </div>
    </Drawer>
  );
}
