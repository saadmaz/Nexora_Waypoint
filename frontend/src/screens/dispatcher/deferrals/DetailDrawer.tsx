import { Clock3, History, Lock, Send, User, X } from "lucide-react";
import type { DeferralCard } from "../../../api/DispatcherApi";
import { Mono } from "../../../shared/ui/Mono";
import { Btn } from "../ui/Btn";
import { BrandChip, Chip, TempChip } from "../ui/Chip";
import { Drawer, DrawerClose } from "../ui/Drawer";
import { DeferredChip } from "./DeferralCard";
import styles from "./DetailDrawer.module.css";

export type DetailDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: DeferralCard | undefined;
  onHistory: () => void;
  onResend: () => void;
  readOnly: boolean;
};

/** D4.2: everything about one deferral, and why the planner did not choose the others. */
export function DetailDrawer({ open, onOpenChange, card, onHistory, onResend, readOnly }: DetailDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} label={`Deferral detail ${card?.orderId ?? ""}`} width={480}>
      <div className={styles.drawer}>
        {card ? (
          <>
            <section className={styles.head}>
              <div className={styles.top}>
                <DeferredChip kind={card.kind} />
                <DrawerClose className={styles.close} aria-label="Close deferral detail">
                  <X size={20} />
                </DrawerClose>
              </div>
              <h2>
                <Mono>
                  {card.orderId} · {card.outletId}
                </Mono>
              </h2>
              <div className={styles.chips}>
                <BrandChip brand={card.brand} dot={false} />
                <TempChip temp={card.temp} />
                {card.access.map((a) => (
                  <Chip key={a} tone="outlineInk">
                    {a}
                  </Chip>
                ))}
                <Mono>
                  <span className={styles.figures}>
                    {card.detail.window.start}–{card.detail.window.end} · {card.detail.kg} kg · {card.detail.m3.toFixed(1)} m³
                  </span>
                </Mono>
              </div>
            </section>
            <div className={styles.rule} />
            <section className={styles.grid}>
              <div>
                <span className={styles.label}>Type</span>
                <Chip tone="outlineInk">{card.detail.type}</Chip>
              </div>
              <div>
                <span className={styles.label}>Binding</span>
                <Chip tone="outlineInk">{card.detail.bindingText}</Chip>
              </div>
              <div>
                <span className={styles.label}>Impact on store</span>
                <span className={styles.value}>{card.impact}</span>
              </div>
              <div>
                <span className={styles.label}>Capacity freed</span>
                <Mono>
                  <b className={styles.freed}>{card.detail.freed}</b>
                </Mono>
              </div>
              <div>
                <span className={styles.label}>Next run</span>
                <Mono>
                  <span className={styles.value}>{card.detail.nextRun}</span>
                </Mono>
              </div>
              <div>
                <span className={styles.label}>Store told</span>
                <span className={styles.told}>
                  <Clock3 size={15} />
                  {card.storeTold.state === "not sent" ? "Not sent" : `${card.storeTold.state === "seen" ? "Seen" : "Sent"} ${card.storeTold.at}${card.storeTold.note ? ` · ${card.storeTold.note}` : ""}`}
                </span>
              </div>
            </section>
            {card.detail.whyNotOthers.length > 0 && (
              <>
                <div className={styles.rule} />
                <section className={styles.why}>
                  <span className={styles.label}>Why not the others</span>
                  {card.detail.whyNotOthers.map((o) => (
                    <div key={o.orderId} className={styles.other}>
                      <Mono>
                        <b>
                          {o.outletId} · {o.orderId}
                        </b>
                      </Mono>
                      <span className={styles.otherText}>{o.text}</span>
                      {o.protected && (
                        <Chip tone="outlineInk" small icon={<Lock size={12} />}>
                          Protected
                        </Chip>
                      )}
                    </div>
                  ))}
                </section>
              </>
            )}
            <div className={styles.spacer} />
            <footer className={styles.foot}>
              <div className={styles.decided}>
                <User size={16} />
                {card.detail.decidedLine}
              </div>
              <div className={styles.actions}>
                <Btn variant="ghost" icon={<History size={16} />} onClick={onHistory}>
                  Open order history
                </Btn>
                {!readOnly && (
                  <Btn variant="secondary" icon={<Send size={16} />} onClick={onResend}>
                    Resend notice
                  </Btn>
                )}
              </div>
            </footer>
          </>
        ) : (
          <section className={styles.head}>
            <h2>Deferral not found</h2>
            <span className={styles.value}>It may have been served instead. Nothing was changed.</span>
            <DrawerClose className={styles.closeText}>Close</DrawerClose>
          </section>
        )}
      </div>
    </Drawer>
  );
}
