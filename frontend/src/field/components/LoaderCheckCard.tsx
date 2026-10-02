import type { ReactNode } from "react";
import { ordinal } from "../format";
import { Icon } from "../../shared/ui/Icon";
import { Mono } from "../../shared/ui/Mono";
import { Tag } from "../../shared/ui/Tag";
import styles from "./LoaderCheckCard.module.css";

export type LoaderCheckState = "todo" | "checked" | "short" | "planned";

export type LoaderCheckCardProps = {
  outletId: string;
  orderId: string;
  /** L2.1 A prints the order ID in the quantity line for the first row and in the heading for the others. */
  orderIdIn?: "heading" | "quantity";
  /** 1 means "Load 1st". */
  loadNumber: number;
  stopNumber: number;
  brand: "Fresh" | "Style" | "Tech";
  chilled: boolean;
  /** "Rear dock", "Street", "Mall bay". */
  dock: string;
  unitsLoaded: number;
  unitsExpected: number;
  /** "planned" is the held vehicle's read-only row (L2.5): never checked, a Planned pill, no action. */
  state: LoaderCheckState;
  /** OUT012 on L2.5: a lock tag replaces the brand tag (deferred yesterday, protected this run). */
  protectedOrder?: boolean;
  /** The action under the row, for example the 56 px "Load 12 units" button. */
  children?: ReactNode;
  /** Words for the screen: "Loaded", "Short". */
  labels?: { loaded: string; short: string; planned: string; chilledZone: string; ambient: string; load: string; stop: string };
};

const DEFAULT_LABELS = {
  loaded: "Loaded",
  short: "Short",
  planned: "Planned",
  chilledZone: "Chilled zone",
  ambient: "Ambient",
  load: "Load",
  stop: "Stop",
};

const BRAND_KIND = { Fresh: "fresh", Style: "outline", Tech: "outline" } as const;

/**
 * The loader's check row, "loaderCheck" density of the Master Order Component (LIB1, L2.1 A): a
 * 48 px disc carrying the stop number (or a tick once loaded), load position and brand tags, the
 * temperature zone, units and a Loaded pill. A chilled order gets a 4 px chilled accent on its
 * left edge. State is never colour alone: a loaded row has a tick and a word.
 */
export function LoaderCheckCard({
  outletId,
  orderId,
  orderIdIn = "heading",
  loadNumber,
  stopNumber,
  brand,
  chilled,
  dock,
  unitsLoaded,
  unitsExpected,
  state,
  protectedOrder,
  children,
  labels = DEFAULT_LABELS,
}: LoaderCheckCardProps) {
  const done = state === "checked";
  return (
    <article className={[styles.card, state === "short" && styles.short].filter(Boolean).join(" ")}>
      {chilled && <span className={styles.accent} aria-hidden />}
      <div className={styles.body}>
        <div className={styles.row}>
          <span className={[styles.disc, done && styles.discDone].filter(Boolean).join(" ")}>
            {done ? <Icon name="check" size={24} /> : <Mono>{stopNumber}</Mono>}
          </span>
          <div className={styles.info}>
            <h3 className={[styles.heading, done && styles.muted].filter(Boolean).join(" ")}>
              <Mono>{outletId}</Mono>
              {orderIdIn === "heading" && (
                <>
                  {" · "}
                  <Mono>{orderId}</Mono>
                </>
              )}
            </h3>
            <div className={styles.tags}>
              <span className={[styles.position, done && styles.muted].filter(Boolean).join(" ")}>
                {labels.load} <Mono>{ordinal(loadNumber)}</Mono> · {labels.stop} <Mono>{stopNumber}</Mono>
              </span>
              {protectedOrder ? (
                <Tag kind="outline" icon="lock">
                  Protected
                </Tag>
              ) : (
                <Tag kind={BRAND_KIND[brand]} noDot={brand !== "Fresh"}>
                  {brand}
                </Tag>
              )}
              {state === "short" && (
                <Tag kind="danger" icon={null}>
                  {unitsExpected - unitsLoaded} short
                </Tag>
              )}
            </div>
            <p className={[styles.zone, chilled && styles.chilledZone].filter(Boolean).join(" ")}>
              {chilled && <Icon name="snowflake" size={16} />}
              {chilled ? labels.chilledZone : labels.ambient} · {dock}
            </p>
            <div className={styles.quantity}>
              <span className={[styles.units, done && styles.muted].filter(Boolean).join(" ")}>
                {orderIdIn === "quantity" && <>{orderId} · </>}
                {unitsLoaded} / {unitsExpected} units
              </span>
              {done && (
                <span className={styles.loadedPill}>
                  <Icon name="check" size={14} />
                  {labels.loaded}
                </span>
              )}
              {state === "short" && (
                <span className={styles.shortPill}>
                  <Icon name="alert-circle" size={14} />
                  {labels.short}
                </span>
              )}
              {state === "planned" && (
                <span className={styles.plannedPill}>
                  <Icon name="route" size={14} />
                  {labels.planned}
                </span>
              )}
            </div>
          </div>
        </div>
        {children}
      </div>
    </article>
  );
}
