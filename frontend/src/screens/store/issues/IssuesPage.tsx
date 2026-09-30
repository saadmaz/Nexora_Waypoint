import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppBar } from "../../../shared/chrome/AppBar";
import { ConnectivityBar } from "../../../shared/chrome/ConnectivityBar";
import { PhoneLayout } from "../../../shared/chrome/PhoneLayout";
import { SyncChip, type SyncState } from "../../../shared/chrome/TopBar";
import { Alert } from "../../../shared/ui/Alert";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { Icon } from "../../../shared/ui/Icon";
import { Mono } from "../../../shared/ui/Mono";
import { StateScreen } from "../../../shared/ui/StateScreen";
import { Tag } from "../../../shared/ui/Tag";
import { clockTime, dayLabel } from "../../../domain/format";
import { affectedText, issueTagFor, type Issue } from "../../../domain/issue";
import { OUTLET } from "../../../domain/outlet";
import { toIsoDate } from "../../../domain/schedule";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { useNow } from "../../../hooks/useNow";
import { useOnline } from "../../../hooks/useOnline";
import { useStore } from "../../../app/StoreContext";
import { DeliveriesSkeleton } from "../deliveries/DeliveriesSkeleton";
import styles from "./IssuesPage.module.css";

/** Forces S3.S B, D and C for the dev server and the gallery. Empty is the default: nothing reported yet. */
export type IssuesPreview = "loading" | "error" | "offline";

export type IssuesPageProps = {
  outletId?: string;
  preview?: IssuesPreview;
};

/** The Issues tab (S3.7): the problems the store has reported, or "No open issues". */
export function IssuesPage({ outletId = OUTLET.id, preview }: IssuesPageProps) {
  const navigate = useNavigate();
  const { api, now, unread } = useStore();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const currentTime = useNow();
  const browserOnline = useOnline();
  const online = browserOnline && preview !== "offline";

  const [issues, setIssues] = useState<{ list: Issue[]; at: string } | null>(null);
  const [failed, setFailed] = useState(preview === "error");
  const [attempt, setAttempt] = useState(0);
  const loadedOnce = useRef(false);
  const minute = clockTime(currentTime);

  useEffect(() => {
    if (preview === "loading" || preview === "error") return;
    if (!online && loadedOnce.current) return;
    let alive = true;
    void (async () => {
      try {
        const list = await api.listIssues(outletId);
        if (!alive) return;
        loadedOnce.current = true;
        setIssues({ list, at: clockTime(now()) });
        setFailed(false);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [api, outletId, minute, online, attempt, preview, now]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const syncState: SyncState = !online ? "offline" : "synced";
  const offlineNote =
    !online && issues ? (
      <>
        Showing issues as of <Mono>{issues.at}</Mono>, reconnect for updates.
      </>
    ) : undefined;

  const list = issues?.list ?? [];
  const content = failed ? (
    <Alert tone="danger" icon="alert-circle" title="Couldn't load issues.">
      <div className={styles.retry}>
        <Button variant="secondary" size="medium" auto icon="refresh-cw" onClick={reload}>
          Retry
        </Button>
      </div>
    </Alert>
  ) : !issues ? (
    <DeliveriesSkeleton label="Loading issues…" />
  ) : list.length === 0 ? (
    <StateScreen icon="inbox" bg="surface-2" fg="ink-muted" title="No open issues" />
  ) : (
    <>
      <h1 className={styles.title}>Issues</h1>
      <Card padded={false}>
        <ul className={styles.list}>
          {list.map((issue) => (
            <li key={issue.id}>
              <button
                type="button"
                className={styles.row}
                onClick={() => navigate(`/store/deliveries/${issue.date}/receipt`)}
              >
                <span className={styles.body}>
                  <span className={styles.top}>
                    {issue.lines.map((line, i) => (
                      <span key={line.orderId}>
                        {i > 0 && " + "}
                        <Mono>{line.orderId}</Mono>
                      </span>
                    ))}
                    <Tag kind="danger">{issueTagFor(issue.type, issue.lines[0] ?? { units: 0, orderUnits: 0 })}</Tag>
                  </span>
                  <span className={styles.line}>
                    {issue.lines.map((line) => affectedText(issue.type, line)).join(" · ")}
                    {issue.photo ? " · photo attached" : ""}
                  </span>
                  <span className={styles.line}>
                    {dayLabel(issue.date)} · reported <Mono>{issue.reportedAt}</Mono> · Dispatch will follow up.
                  </span>
                </span>
                <Icon name="chevron-right" size={16} />
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );

  if (!desktop) {
    return (
      <PhoneLayout sync={syncState} bell={{ unread }} {...(offlineNote ? { connectivity: offlineNote } : {})}>
        {content}
      </PhoneLayout>
    );
  }

  return (
    <div className={styles.desktop}>
      <AppBar
        bell={{ unread }}
        right={
          <>
            <span className={styles.today}>
              {dayLabel(toIsoDate(currentTime))} · {outletId}
            </span>
            <SyncChip state={syncState} />
          </>
        }
      />
      {offlineNote && <ConnectivityBar>{offlineNote}</ConnectivityBar>}
      <main className={styles.column}>{content}</main>
    </div>
  );
}
