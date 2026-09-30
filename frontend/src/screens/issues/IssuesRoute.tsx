import { useSearchParams } from "react-router-dom";
import { IssuesPage, type IssuesPreview } from "./IssuesPage";

const PREVIEWS: IssuesPreview[] = ["loading", "error", "offline"];

/** /store/issues. `?preview=loading|error|offline` forces S3.S B, D and C. */
export function IssuesRoute() {
  const [params] = useSearchParams();
  const preview = PREVIEWS.find((p) => p === params.get("preview"));
  return <IssuesPage key={preview ?? ""} {...(preview ? { preview } : {})} />;
}
