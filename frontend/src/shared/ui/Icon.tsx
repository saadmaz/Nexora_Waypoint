import {
  AlertCircle,
  AlertTriangle,
  Archive,
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
  Database,
  Delete,
  Flag,
  Globe,
  History,
  Image,
  Inbox,
  Info,
  Lock,
  MapPin,
  Minus,
  Navigation,
  Package,
  Pen,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Route,
  Snowflake,
  Store,
  Sun,
  Trash2,
  Truck,
  Type,
  User,
  Wifi,
  WifiOff,
  Wrench,
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
  archive: Archive,
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
  database: Database,
  delete: Delete,
  flag: Flag,
  globe: Globe,
  history: History,
  image: Image,
  inbox: Inbox,
  info: Info,
  lock: Lock,
  "map-pin": MapPin,
  minus: Minus,
  navigation: Navigation,
  package: Package,
  pen: Pen,
  pencil: Pencil,
  phone: Phone,
  plus: Plus,
  "refresh-cw": RefreshCw,
  route: Route,
  snowflake: Snowflake,
  store: Store,
  sun: Sun,
  trash: Trash2,
  truck: Truck,
  type: Type,
  user: User,
  wifi: Wifi,
  "wifi-off": WifiOff,
  wrench: Wrench,
  x: X,
} satisfies Record<string, ComponentType<{ size?: number; strokeWidth?: number; color?: string }>>;

export type IconName = keyof typeof ICONS;

export type IconProps = {
  name: IconName;
  /** Rendered size in px. The grid is 24; screens use 14, 16 and 20, and the field frames also 22 and 28. */
  size?: 14 | 16 | 20 | 22 | 24 | 28;
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
