import { useSearchParams } from "react-router-dom";
import { useStore } from "../../app/StoreContext";
import { IssuesPage, type IssuesPreview } from "./IssuesPage";

const PREVIEWS: IssuesPreview[] = ["loading", "error", "offline"];

/** /store/issues. `?preview=loading|error|offline` forces S3.S B, D and C. Interim, until the phase 7 gallery. */
export function IssuesRoute() {
  const [params] = useSearchParams();
  const { api, now } = useStore();
  const preview = PREVIEWS.find((p) => p === params.get("preview"));
  return <IssuesPage key={preview ?? ""} api={api} now={now} {...(preview ? { preview } : {})} />;
}
