import { Icon } from "../../../shared/ui/Icon";
import { deferredLabel, statusStyle, type DeferralType, type OrderStatus, type PillKind } from "../../../domain/status";
import { Chip, type ChipTone } from "./Chip";

const TONE: Record<PillKind, ChipTone> = {
  neutral: "neutral",
  info: "info",
  live: "live",
  success: "success",
  warning: "warning",
  danger: "danger",
  offline: "offline",
  deferred: "dashed",
  conflict: "conflict",
};

export type StatusChipProps = {
  status: OrderStatus;
  small?: boolean;
  /** A Deferred chip names its type and next run: "Deferred · policy → Wed". */
  deferral?: { type: DeferralType; nextRunShort?: string };
  pill?: boolean;
  label?: string;
};

/**
 * An order status at the desktop's density. The colour, icon and word come from `domain/status`, the one
 * place statuses are defined, so a status reads the same on every role's screen. Never colour alone.
 */
export function StatusChip({ status, small, deferral, pill, label }: StatusChipProps) {
  const { kind, icon } = statusStyle(status);
  const text = label ?? (status === "Deferred" && deferral ? deferredLabel(deferral.type, deferral.nextRunShort) : status);
  return (
    <Chip tone={TONE[kind]} icon={<Icon name={icon} size={14} />} {...(small ? { small } : {})} {...(pill ? { pill } : {})}>
      {text}
    </Chip>
  );
}
