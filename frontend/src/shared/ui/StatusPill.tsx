import { Icon, type IconName } from "./Icon";
import {
  deferredLabel,
  statusLabel,
  statusStyle,
  type DeferralType,
  type OrderStatus,
  type PillKind,
  type Role,
} from "../../domain/status";
import styles from "./StatusPill.module.css";

export type StatusPillProps = {
  status: OrderStatus;
  /** Which role is reading. Stores see "Under review" instead of "Conflict". */
  role?: Role;
  /** For a Deferred pill: the type and the next run, e.g. "policy" and "Wed". */
  deferral?: { type: DeferralType; nextRunShort?: string };
  /** Override the icon. Pass null for no icon. */
  icon?: IconName | null;
  className?: string;
};

const KIND_CLASS: Record<PillKind, string> = {
  neutral: styles.neutral,
  info: styles.info,
  live: styles.live,
  success: styles.success,
  warning: styles.warning,
  danger: styles.danger,
  offline: styles.offline,
  deferred: styles.deferred,
  conflict: styles.conflict,
};

/**
 * A status pill. Status is never shown by colour alone: every pill carries an
 * icon and a word.
 */
export function StatusPill({ status, role = "store", deferral, icon, className }: StatusPillProps) {
  const { kind, icon: defaultIcon } = statusStyle(status);
  const label =
    status === "Deferred" && deferral
      ? deferredLabel(deferral.type, deferral.nextRunShort)
      : statusLabel(status, role);

  const classes = [styles.pill, KIND_CLASS[kind], className].filter(Boolean).join(" ");

  return (
    <span className={classes}>
      {icon !== null && <Icon name={icon ?? defaultIcon} size={14} />}
      {label}
    </span>
  );
}
