import { useNavigate } from "react-router-dom";
import { ArrowRight, CircleX } from "lucide-react";
import type { DeferredCard, DepotId } from "../../../api/DispatcherApi";
import { Mono } from "../../../shared/ui/Mono";
import { ROUTES, withDepot } from "../chrome/routes";
import { BrandChip, Chip, TempChip } from "../ui/Chip";
import { cx } from "../ui/cx";
import styles from "./Trips.module.css";

export type DeferredPanelProps = {
  cards: DeferredCard[];
  total: number;
  depot: DepotId;
  readOnly: boolean;
  /** A dragged order is over the panel (to defer it), or the panel is where the refusal applies. */
  dropState: "none" | "accept" | "refuse";
  /** A returned card, after a refused move: its detail is shown (D3.3). */
  returned: string | null;
  onMoveTo: (orderId: string) => void;
  onDragStart: (orderId: string) => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
};

/** The deferred pool: what the plan left out, each with the resource that bound it. Drag one back onto a trip to serve it instead. */
export function DeferredPanel(props: DeferredPanelProps) {
  const navigate = useNavigate();
  const more = Math.max(0, props.total - props.cards.length);
  return (
    <aside
      className={cx(styles.pool, props.dropState === "refuse" && styles.poolRefuse)}
      aria-label="Unplaced and deferred orders"
      data-anchor="deferred"
      onDragOver={(event) => {
        if (props.readOnly) return;
        event.preventDefault();
        props.onDragOver();
      }}
      onDragLeave={props.onDragLeave}
      onDrop={(event) => {
        if (props.readOnly) return;
        event.preventDefault();
        props.onDrop();
      }}
    >
      <h2 className={styles.poolTitle}>Unplaced / deferred · {props.total}</h2>
      <div className={styles.poolCards}>
        {props.cards.map((card) => {
          const returned = props.returned === card.orderId;
          return (
            <div
              key={card.orderId}
              className={cx(styles.deferred, returned && styles.deferredReturned)}
              draggable={!props.readOnly}
              tabIndex={props.readOnly ? -1 : 0}
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", card.orderId);
                event.dataTransfer.effectAllowed = "move";
                props.onDragStart(card.orderId);
              }}
              onDragEnd={props.onDragEnd}
              aria-label={`${card.orderId}, ${card.outletId}, deferred`}
            >
              <div className={styles.deferredTop}>
                <span className={styles.deferredTitle}>
                  <CircleX size={16} />
                  <Mono>
                    <b>
                      {card.orderId} · {card.outletId}
                    </b>
                  </Mono>
                </span>
                {returned && (
                  <Chip tone="info" small>
                    Returned
                  </Chip>
                )}
              </div>
              {returned ? (
                <p className={styles.returnedLine}>
                  <Mono>
                    {card.orderId} · {card.outletId} ·
                  </Mono>{" "}
                  {card.brand} · {card.district} · {card.temp === "chilled" ? "Chilled" : "Ambient"} · {card.dock} ·{" "}
                  <Mono>
                    {card.window.start}–{card.window.end} · {card.kg} kg · {card.m3.toFixed(1)} m³
                  </Mono>
                </p>
              ) : (
                <div className={styles.deferredChips}>
                  <BrandChip brand={card.brand} small />
                  <TempChip temp={card.temp} small />
                </div>
              )}
              <div className={styles.deferredBottom}>
                <span className={styles.binding}>Binding: {card.binding}</span>
                <Chip tone="dashed" small>
                  Deferred · {card.kind} → {card.nextRun}
                </Chip>
              </div>
              {!props.readOnly && (
                <button type="button" className={styles.serve} onClick={() => props.onMoveTo(card.orderId)}>
                  Move to…
                </button>
              )}
            </div>
          );
        })}
      </div>
      {more > 0 && (
        <button type="button" className={styles.more} onClick={() => navigate(withDepot(ROUTES.deferrals, props.depot))}>
          +{more} more
          <ArrowRight size={15} />
        </button>
      )}
    </aside>
  );
}
