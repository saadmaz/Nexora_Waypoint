import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  CalendarClock,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  Clock,
  Cloud,
  Image,
  Inbox,
  Info,
  Lock,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Route,
  Snowflake,
  Store,
  Trash2,
  Truck,
  User,
  WifiOff,
  X,
} from "lucide-react";
import type { ComponentType } from "react";
import { tokenColor } from "./tokens";

/**
 * Lucide line icons on a 24 px grid, shown at 14, 16 and 20 px.
 * Each name has one fixed meaning (PRD v2 section 6 and the store build brief),
 * so a reader learns the vocabulary once:
 *
 *   clock          Ordered            lock            Confirmed
 *   route          Planned            check           Loaded / Delivered
 *   truck          Departed           alert-triangle  Partial / Under review
 *   alert-circle   Issue              cloud           Pending sync
 *   wifi-off       Offline            snowflake       Chilled / Arrived warm
 *   calendar-clock Deferred           user            Receivers cue
 *   camera         Photo
 *   bell           Updates (S4), with an unread-count dot
 *   circle-check   Received
 *   info            Why you're seeing this
 *   image           Proof-of-delivery photo
 *   arrow-right     Confirm receipt
 *   inbox           Nothing here yet (No open issues)
 *   store           Dispatch asks the store
 */
const ICONS = {
  "alert-circle": AlertCircle,
  "alert-triangle": AlertTriangle,
  "arrow-right": ArrowRight,
  bell: Bell,
  calendar: Calendar,
  "calendar-clock": CalendarClock,
  camera: Camera,
  check: Check,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "circle-check": CircleCheck,
  "clipboard-list": ClipboardList,
  clock: Clock,
  cloud: Cloud,
  image: Image,
  inbox: Inbox,
  info: Info,
  lock: Lock,
  minus: Minus,
  pencil: Pencil,
  plus: Plus,
  "refresh-cw": RefreshCw,
  route: Route,
  snowflake: Snowflake,
  store: Store,
  trash: Trash2,
  truck: Truck,
  user: User,
  "wifi-off": WifiOff,
  x: X,
} satisfies Record<string, ComponentType<{ size?: number; strokeWidth?: number; color?: string }>>;

export type IconName = keyof typeof ICONS;

export type IconProps = {
  name: IconName;
  /** Rendered size in px. The grid is 24; screens use 14, 16 and 20. */
  size?: 14 | 16 | 20 | 24;
  /** A design token name, such as "route" or "ink-muted". Defaults to the inherited colour. */
  color?: string;
  className?: string;
};

export function Icon({ name, size = 16, color, className }: IconProps) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      size={size}
      strokeWidth={2}
      color={color ? tokenColor(color) : "currentColor"}
      aria-hidden
      className={className}
    />
  );
}
