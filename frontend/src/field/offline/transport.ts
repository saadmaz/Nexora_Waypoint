import { connectivity } from "./connectivity";

/** Thrown when the device cannot reach the server: real offline, Simulate offline, a closed coverage gate. */
export class NetworkError extends Error {
  constructor(message = "No connection") {
    super(message);
    this.name = "NetworkError";
  }
}

/** One operation of a role's API, as the real backend will expose it. */
export type Transport = {
  send(op: string, payload: unknown): Promise<unknown>;
};

/** Handlers of the mock server, registered per operation by each role's mock API. */
export type MockHandler = (payload: unknown) => unknown | Promise<unknown>;

const handlers = new Map<string, MockHandler>();

/** A role's mock server registers the operations it answers, for example "loader.getDock". */
export function registerMockHandler(op: string, handler: MockHandler): void {
  handlers.set(op, handler);
}

export function clearMockHandlers(): void {
  handlers.clear();
}

/** Artificial latency of the mock transport, in ms. 300 to 600 in the app, 0 in tests. */
let latency: [number, number] = import.meta.env.MODE === "test" ? [0, 0] : [300, 600];

export function setMockLatency(min: number, max: number): void {
  latency = [min, max];
}

function wait(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

/**
 * The mock transport: adds 300 to 600 ms of latency, throws a NetworkError when the device is
 * offline, and answers from the mock server handlers (field conventions section 10).
 */
export const mockTransport: Transport = {
  async send(op, payload) {
    if (!connectivity.isConnected()) throw new NetworkError();
    await wait(latency[0] + Math.random() * (latency[1] - latency[0]));
    // The connection may have dropped while the request was in flight.
    if (!connectivity.isConnected()) throw new NetworkError();
    const handler = handlers.get(op);
    if (!handler) throw new Error(`No mock handler for ${op}`);
    return handler(payload);
  },
};

let active: Transport = mockTransport;

/** Swaps the transport: the real `fetch` one replaces the mock when a role is wired to the API. */
export function setTransport(next: Transport): void {
  active = next;
}

/**
 * Every API call of a field role goes through here, never `fetch` directly. A NetworkError marks
 * the connection as failed; a reply clears that mark.
 */
export async function request<T>(op: string, payload?: unknown): Promise<T> {
  try {
    const result = (await active.send(op, payload)) as T;
    connectivity.markNetworkSuccess();
    return result;
  } catch (error) {
    if (error instanceof NetworkError) connectivity.markNetworkFailure();
    throw error;
  }
}
