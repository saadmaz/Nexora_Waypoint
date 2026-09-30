import { useSearchParams } from "react-router-dom";
import { useStore } from "../../app/StoreContext";
import { UpdatesPage, type UpdatesPreview } from "./UpdatesPage";

const PREVIEWS: UpdatesPreview[] = ["loading", "error", "offline"];

/**
 * /store/updates (the feed, S4.1) and /store/history (past delivery days, S4.2).
 * `?preview=loading|error|offline` forces S4.S B, D and C. Interim, until the phase 7 gallery.
 */
export function UpdatesRoute({ view }: { view: "updates" | "history" }) {
  const [params] = useSearchParams();
  const { api, now } = useStore();
  const preview = PREVIEWS.find((p) => p === params.get("preview"));
  return <UpdatesPage key={preview ?? ""} api={api} now={now} view={view} {...(preview ? { preview } : {})} />;
}
