import { useCallback } from "react";
import { useToast } from "../../shared/ui/useToast";
import type { ContactRequest } from "../../api/DispatcherApi";
import { useDispatcher } from "./context";

/**
 * The "Call" buttons on D5 and D7. The dataset has no phone numbers and none is invented (Contributing section 29), so a call
 * is a request to call Dispatch back, sent to the feed that person already reads. The toast says who was asked, or that it
 * did not go through, so a tap never looks like a call that was made.
 */
export function useContact(): (request: ContactRequest) => Promise<void> {
  const { api } = useDispatcher();
  const toast = useToast();
  return useCallback(
    async (request: ContactRequest) => {
      try {
        const out = await api.contact(request);
        toast.show(`Asked ${out.recipient} to call Dispatch.`, { icon: "check" });
      } catch (error) {
        toast.show(error instanceof Error && error.message ? `Couldn't send that: ${error.message}` : "Couldn't send that. Try again.", { icon: "alert-circle" });
      }
    },
    [api, toast],
  );
}
