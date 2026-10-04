import { ApiError, NetworkError } from "../../../api/DispatcherApi";

/**
 * Why a presenter action failed, in the presenter's own terms. A 404 is the one worth spelling out: the four `/demo`
 * routes are only mounted when the API runs with `DEMO_MODE=true`, so on a deployment that does not set it every
 * button answers 404 and the panel would otherwise look dead (README, "Running the hosted demo").
 */
export function presenterFailure(error: unknown): string {
  if (error instanceof NetworkError) return "No answer from the API. The clock is where it was.";
  if (error instanceof ApiError) {
    if (error.code === "not_found") return "This API does not have the presenter routes. It needs DEMO_MODE=true and a restart.";
    return error.message;
  }
  return "The presenter action failed. The clock is where it was.";
}
