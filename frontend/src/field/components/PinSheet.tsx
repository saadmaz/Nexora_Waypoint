import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "../../shared/ui/Icon";
import { BottomSheet } from "./BottomSheet";
import styles from "./PinSheet.module.css";

export const OTHER_PERSON_ID = "other";

export type PinPerson = { id: string; name: string };

export type PinSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** For example "Acknowledge plan v4 at Kandy dock". */
  title: ReactNode;
  description?: ReactNode;
  /** The named people on this tablet (Priya, Ruwan). "Other…" is added after them. */
  people: PinPerson[];
  /** The label over the person choice, for example "Who's acknowledging?". */
  whoLabel: string;
  /** Hide "Other…" where a typed name makes no sense. */
  allowOther?: boolean;
  /** Checks the PIN against the chosen person. For "Other…" the typed name is the third argument. */
  verify: (personId: string, pin: string, otherName?: string) => Promise<boolean>;
  /** Called once the success state has been shown for `confirmedDelayMs`. */
  onConfirmed: (personId: string, name: string) => void;
  /** The success line, for example `Acknowledged by ${name} · 04:15`. */
  confirmedText: (name: string) => ReactNode;
  /** A card above the choice, for example the vehicle being cleared. */
  context?: ReactNode;
  initialPersonId?: string;
  confirmedDelayMs?: number;
};

const PIN_LENGTH = 4;
const CLEAR_AFTER_WRONG_MS = 450;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

type Phase = "entry" | "checking" | "wrong" | "ok";

/**
 * The PIN sheet (L1.2 A, B, C, L2.3 B, L4): who is acting, then their 4-digit PIN on a large
 * keypad. It knows nothing about plans: the caller supplies `verify` and gets `onConfirmed`.
 * A wrong PIN fills the dots in the danger colour, shakes them for 120 ms (not at all under
 * reduced motion), shows "PIN not recognised. Try again." and clears them. A right PIN turns
 * the dots green and names the person. Digits on a physical keyboard work too.
 */
export function PinSheet(props: PinSheetProps) {
  const { open, onOpenChange, title, description = DEFAULT_DESCRIPTION } = props;
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <PinBody {...props} onCancel={() => onOpenChange(false)} />
    </BottomSheet>
  );
}

const DEFAULT_DESCRIPTION = "Enter your 4-digit PIN. Your name is recorded with this action.";

function PinBody({
  people,
  whoLabel,
  allowOther = true,
  verify,
  onConfirmed,
  confirmedText,
  context,
  initialPersonId,
  confirmedDelayMs = 1200,
  onCancel,
}: PinSheetProps & { onCancel: () => void }) {
  const [personId, setPersonId] = useState<string | undefined>(initialPersonId);
  const [otherName, setOtherName] = useState("");
  const [digits, setDigits] = useState("");
  const [phase, setPhase] = useState<Phase>("entry");
  const [shakeKey, setShakeKey] = useState(0);
  const [needsPerson, setNeedsPerson] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const choices: PinPerson[] = allowOther ? [...people, { id: OTHER_PERSON_ID, name: "Other…" }] : people;
  const isOther = personId === OTHER_PERSON_ID;
  const displayName = isOther ? otherName.trim() : (people.find((p) => p.id === personId)?.name ?? "");

  const submit = useCallback(
    async (pin: string) => {
      if (!personId) return;
      setPhase("checking");
      let ok = false;
      try {
        ok = await verify(personId, pin, isOther ? otherName.trim() : undefined);
      } catch {
        ok = false;
      }
      if (ok) {
        setPhase("ok");
        later(() => onConfirmed(personId, displayName), confirmedDelayMs);
      } else {
        setPhase("wrong");
        setShakeKey((k) => k + 1);
        later(() => setDigits(""), CLEAR_AFTER_WRONG_MS);
      }
    },
    [personId, verify, isOther, otherName, onConfirmed, displayName, confirmedDelayMs, later],
  );

  const press = (digit: string) => {
    if (phase === "checking" || phase === "ok") return;
    if (!personId || (isOther && otherName.trim() === "")) {
      setNeedsPerson(true);
      return;
    }
    setNeedsPerson(false);
    const base = phase === "wrong" ? "" : digits;
    if (base.length >= PIN_LENGTH) return;
    const next = base + digit;
    setPhase("entry");
    setDigits(next);
    if (next.length === PIN_LENGTH) void submit(next);
  };

  const backspace = () => {
    if (phase === "checking" || phase === "ok") return;
    setPhase("entry");
    setDigits((d) => d.slice(0, -1));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).tagName === "INPUT") return;
    if (/^[0-9]$/.test(event.key)) press(event.key);
    else if (event.key === "Backspace") backspace();
  };

  const filled = phase === "wrong" ? PIN_LENGTH : digits.length;
  const dotTone = phase === "wrong" ? styles.wrongDot : phase === "ok" ? styles.okDot : styles.fillDot;

  return (
    <div className={styles.body} onKeyDown={onKeyDown}>
      {context}

      <div className={styles.who}>
        <p className={styles.label}>{whoLabel}</p>
        <div className={styles.choices} role="radiogroup" aria-label={whoLabel}>
          {choices.map((person) => (
            <button
              type="button"
              key={person.id}
              role="radio"
              aria-checked={person.id === personId}
              className={[styles.choice, person.id === personId && styles.chosen].filter(Boolean).join(" ")}
              onClick={() => {
                setPersonId(person.id);
                setNeedsPerson(false);
                setPhase("entry");
                setDigits("");
              }}
            >
              {person.name}
            </button>
          ))}
        </div>
        {isOther && (
          <label className={styles.otherField}>
            <span className={styles.label}>Your name</span>
            <input
              className={styles.input}
              value={otherName}
              onChange={(event) => setOtherName(event.target.value)}
              autoComplete="off"
              enterKeyHint="done"
            />
          </label>
        )}
      </div>

      <div
        key={shakeKey}
        className={[styles.dots, phase === "wrong" && styles.shake].filter(Boolean).join(" ")}
        role="img"
        aria-label={`${digits.length} of ${PIN_LENGTH} digits entered`}
      >
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <span key={index} className={[styles.dot, index < filled ? dotTone : styles.emptyDot].join(" ")} />
        ))}
      </div>

      <div className={styles.status} aria-live="polite">
        {phase === "wrong" ? (
          <p className={styles.error}>
            <Icon name="alert-circle" size={20} />
            PIN not recognised. Try again.
          </p>
        ) : phase === "ok" ? (
          <p className={styles.ok}>
            <Icon name="circle-check" size={20} />
            {confirmedText(displayName)}
          </p>
        ) : needsPerson ? (
          <p className={styles.error}>
            <Icon name="alert-circle" size={20} />
            {isOther ? "Type your name first." : "Choose your name first."}
          </p>
        ) : (
          <p className={styles.count}>
            {digits.length} of {PIN_LENGTH} digits
          </p>
        )}
      </div>

      <div className={styles.keypad}>
        {KEYS.map((key) => (
          <button type="button" key={key} className={styles.key} onClick={() => press(key)}>
            {key}
          </button>
        ))}
        <span aria-hidden />
        <button type="button" className={styles.key} onClick={() => press("0")}>
          0
        </button>
        <button type="button" className={styles.key} onClick={backspace} aria-label="Delete last digit">
          <Icon name="delete" size={28} />
        </button>
      </div>

      <button type="button" className={styles.cancel} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

