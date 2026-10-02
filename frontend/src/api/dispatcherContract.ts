import type { components } from "./schema";
import type * as View from "./DispatcherApi";

/**
 * A compile-time check that the screens' view types (`DispatcherApi.ts`) and the backend contract (the generated
 * `schema.ts`) still describe the same fields (Contributing section 19). Nothing here runs: if the backend
 * renames, drops or retypes a field a screen reads, `npm run typecheck` fails on the line that names it.
 *
 * What it compares: every field a screen type needs must exist in the generated type with the same kind of value
 * (text, number, flag, list, record), at every depth. What it leaves to the client: the literal values of enum
 * fields. The backend sends machine values (`store_request`, `ordered`) and `httpDispatcherApi` turns them into
 * the screens' display text in one place.
 */

type Schemas = components["schemas"];

/** The paths (dotted) of fields `View` needs that `Wire` does not provide. `never` means they agree. */
export type Missing<Wire, Need, Path extends string> = [NonNullable<Need>] extends [never]
  ? never
  : [NonNullable<Need>] extends [string]
    ? [NonNullable<Wire>] extends [string]
      ? never
      : Path
    : [NonNullable<Need>] extends [number]
      ? [NonNullable<Wire>] extends [number]
        ? never
        : Path
      : [NonNullable<Need>] extends [boolean]
        ? [NonNullable<Wire>] extends [boolean]
          ? never
          : Path
        : [NonNullable<Need>] extends [readonly (infer NeedItem)[]]
          ? [NonNullable<Wire>] extends [readonly (infer WireItem)[]]
            ? Missing<WireItem, NeedItem, `${Path}[]`>
            : Path
          : [NonNullable<Need>] extends [object]
            ? Fields<NonNullable<Wire>, NonNullable<Need>, Path>
            : never;

type Fields<Wire, Need, Path extends string> = {
  [K in keyof Need & string]-?: K extends keyof Wire
    ? Missing<Wire[K], Need[K], `${Path}.${K}`>
    : undefined extends Need[K]
      ? never
      : `${Path}.${K}`;
}[keyof Need & string];

/** Fails to compile, naming the offending field paths, unless `T` is `never`. */
type Agrees<T extends never> = T;

// What each operation returns: the wire type must give the screen type everything it reads.
export type ResponseContract = [
  Agrees<Missing<Schemas["QueueView"], View.QueueView, "QueueView">>,
  Agrees<Missing<Schemas["OrderHistory"], View.OrderHistory, "OrderHistory">>,
  Agrees<Missing<Schemas["CapacityView"], View.CapacityView, "CapacityView">>,
  Agrees<Missing<Schemas["PlanView"], View.PlanView, "PlanView">>,
  Agrees<Missing<Schemas["MoveResult"], View.MoveResult, "MoveResult">>,
  Agrees<Missing<Schemas["DeferralsView"], View.DeferralsView, "DeferralsView">>,
  Agrees<Missing<Schemas["NotifyDeferralsOut"], { sent: number }, "NotifyDeferralsOut">>,
  Agrees<Missing<Schemas["AcknowledgementsView"], View.AcknowledgementsView, "AcknowledgementsView">>,
  Agrees<Missing<Schemas["LiveBoardView"], View.LiveBoardView, "LiveBoardView">>,
  Agrees<Missing<Schemas["DeferStopResult"], View.DeferStopResult, "DeferStopResult">>,
  Agrees<Missing<Schemas["InboxView"], View.InboxView, "InboxView">>,
  Agrees<Missing<Schemas["ConflictView"], View.ConflictView, "ConflictView">>,
  Agrees<Missing<Schemas["ExceptionView"], View.ExceptionView, "ExceptionView">>,
  Agrees<Missing<Schemas["ForecastView"], View.ForecastView, "ForecastView">>,
];

// What the screens send: the screen's request must give the wire type every field it requires.
export type RequestContract = [
  Agrees<Missing<{ depot: View.DepotId }, Schemas["NotifyDeferralsIn"], "NotifyDeferralsIn">>,
  Agrees<Missing<{ sendNotices: boolean }, Schemas["ReleasePlanIn"], "ReleasePlanIn">>,
  Agrees<Missing<View.DeferStopRequest, Schemas["DeferStopIn"], "DeferStopIn">>,
  Agrees<Missing<View.DecideExceptionRequest, Schemas["DecideExceptionIn"], "DecideExceptionIn">>,
  Agrees<Missing<{ resolution: View.ConflictResolution }, Schemas["ResolveConflictIn"], "ResolveConflictIn">>,
  // `SaveMovesIn` and `validateMove` carry each move's `to`, which is a union on the screens ({vehicleId, trip} or
  // "deferred"). The client converts it, so those two are checked where the conversion is written, not here.
];
