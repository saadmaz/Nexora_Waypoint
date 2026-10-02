import type { paths } from "../schema";

/**
 * Types that read a route's request and reply out of the generated `schema.ts`, so a call is checked against
 * the backend contract and no screen writes a response type by hand (Contributing section 19).
 */

export type Method = "get" | "post" | "put" | "patch" | "delete";

/** Every path that has a handler for `M`. In the generated file a missing method is `never | undefined`. */
export type PathsFor<M extends Method> = {
  [P in keyof paths]: undefined extends paths[P][M] ? never : P;
}[keyof paths];

type Operation<P extends keyof paths, M extends Method> = Exclude<paths[P][M], undefined>;

type ParametersOf<O> = O extends { parameters: infer P } ? P : never;
type PathOf<O> = ParametersOf<O> extends { path?: infer X } ? NonNullable<X> : never;
type QueryOf<O> = ParametersOf<O> extends { query?: infer X } ? NonNullable<X> : never;
type BodyOf<O> = O extends { requestBody?: { content: infer C } }
  ? C extends { "application/json": infer B }
    ? B
    : C extends { "multipart/form-data": unknown }
      ? FormData
      : never
  : never;

/** What the caller passes for one route: path params, query and body appear only when the route has them. */
export type RequestOptions<O> = ([PathOf<O>] extends [never] ? { path?: undefined } : { path: PathOf<O> }) &
  ([QueryOf<O>] extends [never] ? { query?: undefined } : { query?: QueryOf<O> }) &
  ([BodyOf<O>] extends [never] ? { body?: undefined } : { body: BodyOf<O> }) & {
    /** Aborts the request. A caller's abort is not reported as a network failure. */
    signal?: AbortSignal;
  };

/** The options argument is required only when the route has a required path param or body. */
export type OptionsArgs<O> = {} extends RequestOptions<O> ? [options?: RequestOptions<O>] : [options: RequestOptions<O>];

/** The JSON reply of a route's success response, or `void` for a 204. */
export type ResponseOf<O> = O extends { responses: infer R }
  ? R extends { 200: { content: { "application/json": infer B } } }
    ? B
    : R extends { 201: { content: { "application/json": infer B } } }
      ? B
      : void
  : never;

export type OperationOf<P extends keyof paths, M extends Method> = Operation<P, M>;
