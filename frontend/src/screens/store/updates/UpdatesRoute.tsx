import { useSearchParams } from "react-router-dom";
import { UpdatesPage, type UpdatesPreview } from "./UpdatesPage";

const PREVIEWS: UpdatesPreview[] = ["loading", "error", "offline"];

/**
 * /store/updates (the feed, S4.1) and /store/history (past delivery days, S4.2).
 * `?preview=loading|error|offline` forces S4.S B, D and C.
 */
export function UpdatesRoute({ view }: { view: "updates" | "history" }) {
  const [params] = useSearchParams();
  const preview = PREVIEWS.find((p) => p === params.get("preview"));
  return <UpdatesPage key={preview ?? ""} view={view} {...(preview ? { preview } : {})} />;
}
