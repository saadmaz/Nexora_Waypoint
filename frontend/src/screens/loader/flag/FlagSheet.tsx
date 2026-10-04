import { useRef, useState, type ReactNode } from "react";
import { BottomSheet } from "../../../field/components";
import { Alert } from "../../../shared/ui/Alert";
import { Button } from "../../../shared/ui/Button";
import { Icon } from "../../../shared/ui/Icon";
import { Mono } from "../../../shared/ui/Mono";
import { EXCEPTION_TYPES, type ExceptionType } from "../types";
import {
  FLAG_TYPE_ICON,
  ORDER_TYPES,
  PHOTO_TYPES,
  UNITS_LABEL,
  VEHICLE_CHECK_REASONS,
} from "./flagOptions";
import styles from "./FlagSheet.module.css";

export type FlagOrder = { orderId: string; outletId: string; units: number; chilled: boolean };

/** What the loader chose, handed to the container when "Send to Dispatch" is tapped. */
export type FlagSubmit = {
  type: ExceptionType;
  reason?: string;
  orderIds: string[];
  unitsShort?: number;
  note?: string;
  photo?: File;
};

export type FlagPrefill = { type?: ExceptionType; orderId?: string; unitsShort?: number; reason?: string; note?: string };

/** The "Sent to Dispatch" sheet (L3.3). */
export type FlagSentModel = {
  at: string;
  summary: string;
  /** A failed vehicle check puts the vehicle on hold; every other flag only reaches Dispatch (PRD v3.1 G-14). */
  held: boolean;
  vehicleId: string;
  reviewer: string;
  /** Set once Dispatch opened a non-vehicle flag: it stays as sent, no plan version follows. */
  seenAt?: string;
  /** Set once Dispatch decided a failed vehicle check (L3.3 B). */
  decidedVersion?: number;
};

export type FlagSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  trip: 1 | 2;
  /** Scenario time, "02:55": the clock in the L3.1 subtitle. */
  time: string;
  /** Every order on this trip, in load order. */
  orders: FlagOrder[];
  /** "All 9 orders on VEH003 (2 trips)": what a failed vehicle check covers. */
  scope: { orders: number; trips: number };
  prefill?: FlagPrefill;
  /** form: choosing and filling in. sending: L3.4 C. sent and decided: L3.3 A and B. */
  phase: "form" | "sending" | "sent" | "decided";
  sent?: FlagSentModel;
  onSend: (submit: FlagSubmit) => void;
  onCancel: () => void;
  onBackToList: () => void;
  onReview: () => void;
};

type Step = "choose" | "details";

/**
 * L3 Flag exception, a bottom sheet over the load plan (loader prompt section 3). It chooses one
 * of six types (L3.1), asks for that type's details (L3.2 A for a vehicle check, L3.2 B for an
 * order), then follows the flag: sending (L3.4 C), sent with "Kumari is reviewing" (L3.3 A) and
 * the decision (L3.3 B). Queued offline (L3.4 A) and failed (L3.4 B) are their own screens.
 */
export function FlagSheet(props: FlagSheetProps) {
  const { open, onOpenChange, vehicleId, trip, time, phase, sent } = props;
  const prefillType = props.prefill?.type;
  const [step, setStep] = useState<Step>(prefillType ? "details" : "choose");
  const [type, setType] = useState<ExceptionType | undefined>(prefillType);
  const [reason, setReason] = useState<string>(props.prefill?.reason ?? VEHICLE_CHECK_REASONS[0]);
  const firstOrder = props.orders[0]?.orderId;
  const [orderId, setOrderId] = useState<string | undefined>(props.prefill?.orderId ?? firstOrder);
  const [units, setUnits] = useState<number>(props.prefill?.unitsShort ?? 1);
  const [note, setNote] = useState(props.prefill?.note ?? "");
  const [photo, setPhoto] = useState<File | undefined>();

  const chosenOrder = props.orders.find((o) => o.orderId === orderId);
  const maxUnits = chosenOrder?.units ?? 1;
  const locked = phase === "sending";

  const afterSend = phase === "sent" || phase === "decided";
  const close = (next: boolean) => {
    if (next) return onOpenChange(true);
    if (afterSend) return props.onBackToList();
    if (step === "details" && !prefillType && !locked) return setStep("choose");
    props.onCancel();
  };

  const canSend =
    !!type &&
    (type === "Vehicle check failed"
      ? !!reason
      : type === "Other"
        ? note.trim().length >= 3
        : !!chosenOrder && units >= 1 && units <= maxUnits);

  const send = () => {
    if (!type || !canSend) return;
    props.onSend({
      type,
      reason: type === "Vehicle check failed" ? reason : undefined,
      orderIds: ORDER_TYPES.includes(type) && orderId ? [orderId] : [],
      unitsShort: ORDER_TYPES.includes(type) ? units : undefined,
      note: type === "Other" ? note.trim() : undefined,
      photo,
    });
  };

  const pickOrder = (id: string) => {
    setOrderId(id);
    const next = props.orders.find((o) => o.orderId === id);
    if (next) setUnits((u) => Math.min(Math.max(u, 1), next.units));
  };

  if (afterSend && sent) {
    return (
      <BottomSheet
        open={open}
        onOpenChange={close}
        title={
          <span className={styles.headingColumn}>
            <span className={styles.tile} aria-hidden>
              <Icon name="flag" size={28} />
            </span>
            <span>
              Sent to Dispatch · <Mono>{sent.at}</Mono>
            </span>
          </span>
        }
      >
        <SentBody sent={sent} onBackToList={props.onBackToList} onReview={props.onReview} />
      </BottomSheet>
    );
  }

  if (step === "choose" || !type) {
    return (
      <BottomSheet open={open} onOpenChange={close} title="What's wrong?">
        <div className={styles.stack}>
          <p className={styles.sub}>
            <Mono>{vehicleId}</Mono> · trip <Mono>{trip}</Mono> · <Mono>{time}</Mono>
          </p>
          <div className={styles.typeGrid}>
            {EXCEPTION_TYPES.map((option) => (
              <button
                key={option}
                type="button"
                className={styles.typeButton}
                onClick={() => {
                  setType(option);
                  setStep("details");
                }}
              >
                <Icon name={FLAG_TYPE_ICON[option]} size={28} />
                {option}
              </button>
            ))}
          </div>
          <p className={styles.helper}>Pick what&apos;s wrong.</p>
          <Button variant="ghost" onClick={props.onCancel}>
            Cancel
          </Button>
        </div>
      </BottomSheet>
    );
  }

  const heading = (
    <span className={styles.headingRow}>
      <Icon name={FLAG_TYPE_ICON[type]} size={24} />
      {type}
    </span>
  );

  return (
    <BottomSheet open={open} onOpenChange={close} title={heading}>
      <div className={styles.stack} aria-busy={locked}>
        {type === "Vehicle check failed" && (
          <>
            <p className={styles.label}>Reason</p>
            <ReasonChoices value={reason} onChange={setReason} disabled={locked} />
            <p className={styles.label}>Affected orders</p>
            <div className={styles.card} role="checkbox" aria-checked="true" aria-disabled="true">
              <span className={styles.checkbox} aria-hidden>
                <Icon name="check" size={16} />
              </span>
              <span>
                All <Mono>{props.scope.orders}</Mono> orders on VEH<Mono>{vehicleId.replace("VEH", "")}</Mono> (<Mono>{props.scope.trips}</Mono>{" "}
                {props.scope.trips === 1 ? "trip" : "trips"})
              </span>
            </div>
          </>
        )}

        {ORDER_TYPES.includes(type) && (
          <>
            <p className={styles.label}>Which order?</p>
            <div className={styles.orderList} role="radiogroup" aria-label="Which order?">
              {props.orders.map((o) => {
                const on = o.orderId === orderId;
                return (
                  <button
                    key={o.orderId}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={locked}
                    className={[styles.orderRow, on && styles.orderRowChosen].filter(Boolean).join(" ")}
                    onClick={() => pickOrder(o.orderId)}
                  >
                    <span className={[styles.radio, on && styles.radioOn].filter(Boolean).join(" ")} aria-hidden />
                    <span className={styles.orderInfo}>
                      <span className={styles.orderId}>
                        <Mono>{o.outletId}</Mono> · <Mono>{o.orderId}</Mono>
                      </span>
                      <span className={styles.orderUnits}>{o.units} units</span>
                    </span>
                    {o.chilled && (
                      <span className={styles.chilled}>
                        <Icon name="snowflake" size={14} />
                        Chilled
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className={styles.label}>{UNITS_LABEL[type]}</p>
            <div className={styles.unitsRow}>
              <div className={styles.stepper} role="group" aria-label={`${UNITS_LABEL[type]} for ${orderId ?? "the order"}`}>
                <button
                  type="button"
                  className={styles.step}
                  aria-label="One less"
                  disabled={locked || units <= 1}
                  onClick={() => setUnits((u) => Math.max(1, u - 1))}
                >
                  −
                </button>
                <output className={styles.stepValue} aria-live="polite">
                  {units}
                </output>
                <button
                  type="button"
                  className={styles.step}
                  aria-label="One more"
                  disabled={locked || units >= maxUnits}
                  onClick={() => setUnits((u) => Math.min(maxUnits, u + 1))}
                >
                  +
                </button>
              </div>
              <span className={styles.unitsOf}>of {maxUnits}</span>
            </div>
          </>
        )}

        {type === "Other" && (
          <>
            <p className={styles.label}>What happened?</p>
            <textarea
              className={styles.note}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Tell Dispatch in a sentence."
              aria-label="What happened?"
              disabled={locked}
              rows={3}
            />
          </>
        )}

        {PHOTO_TYPES.includes(type) && <PhotoTile photo={photo} onPick={setPhoto} disabled={locked} />}

        <Button
          icon={locked ? undefined : "flag"}
          busy={locked}
          disabled={!locked && !canSend}
          onClick={send}
        >
          {locked ? "Sending to Dispatch" : "Send to Dispatch"}
        </Button>
        <p className={styles.helperCenter}>{locked ? "Keep the tablet open. This takes a few seconds." : "You'll enter your PIN"}</p>
      </div>
    </BottomSheet>
  );
}

function ReasonChoices({ value, onChange, disabled }: { value: string; onChange: (next: string) => void; disabled?: boolean }) {
  const [first, second, third, fourth] = VEHICLE_CHECK_REASONS;
  const choice = (label: string) => {
    const on = label === value;
    return (
      <button
        key={label}
        type="button"
        role="radio"
        aria-checked={on}
        disabled={disabled}
        className={[styles.choice, on && styles.choiceChosen].filter(Boolean).join(" ")}
        onClick={() => onChange(label)}
      >
        {on && <Icon name="check" size={20} />}
        {label}
      </button>
    );
  };
  return (
    <div className={styles.choices} role="radiogroup" aria-label="Reason">
      {choice(first)}
      <div className={styles.choiceRow}>
        {choice(second)}
        {choice(third)}
      </div>
      {choice(fourth)}
    </div>
  );
}

/** "Add photo (optional)": the device camera where there is one, the file picker where there is not (A58). */
function PhotoTile({ photo, onPick, disabled }: { photo?: File; onPick: (file: File | undefined) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        className={[styles.photo, photo && styles.photoTaken].filter(Boolean).join(" ")}
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        <Icon name={photo ? "check" : "camera"} size={24} />
        {photo ? "Photo added. Tap to retake" : "Add photo (optional)"}
      </button>
      <input
        ref={input}
        className={styles.hiddenInput}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="Add photo"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
    </>
  );
}

function SentBody({ sent, onBackToList, onReview }: { sent: FlagSentModel; onBackToList: () => void; onReview: () => void }) {
  const decided = sent.decidedVersion !== undefined;
  let status: ReactNode;
  if (decided) {
    status = (
      <Alert tone="info" icon="info" title={`Decision made: plan changed to v${sent.decidedVersion}`}>
        <Button iconRight="chevron-right" onClick={onReview}>
          Review change
        </Button>
      </Alert>
    );
  } else if (sent.seenAt) {
    status = (
      <p className={styles.knowsRow}>
        <span className={styles.knowsDone}>
          <Icon name="circle-check" size={20} />
        </span>
        {sent.reviewer} has seen this · <Mono>{sent.seenAt}</Mono>
      </p>
    );
  } else {
    status = (
      <p className={styles.live}>
        <span className={[styles.liveIcon, styles.spin].join(" ")}>
          <Icon name="refresh-cw" size={20} />
        </span>
        {sent.reviewer} is reviewing…
      </p>
    );
  }

  return (
    <div className={styles.stack}>
      <p className={styles.sub}>{sent.summary}</p>
      <p className={styles.body17}>
        {sent.held ? (
          <>
            <Mono>{sent.vehicleId}</Mono> is Held. Don&apos;t load further until Dispatch decides.
          </>
        ) : (
          <>Dispatch has your flag. You can keep loading the other orders.</>
        )}
      </p>
      <div className={styles.knows}>
        <p className={styles.label}>Who already knows</p>
        <p className={styles.knowsRow}>
          <span className={styles.knowsDone}>
            <Icon name="circle-check" size={20} />
          </span>
          {sent.reviewer} · Dispatch · <Mono>{sent.at}</Mono>
        </p>
      </div>
      {status}
      {!decided && (
        <Button variant="ghost" onClick={onBackToList}>
          Back to load list
        </Button>
      )}
    </div>
  );
}
