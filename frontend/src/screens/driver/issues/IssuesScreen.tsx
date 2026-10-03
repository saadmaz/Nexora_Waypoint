import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNow } from "../../../field/clock/useClock";
import { PinnedActionBar } from "../../../field/components";
import { Button } from "../../../shared/ui/Button";
import { Icon } from "../../../shared/ui/Icon";
import { Mono } from "../../../shared/ui/Mono";
import { Tag } from "../../../shared/ui/Tag";
import { useDriverApi, useT } from "../context/DriverContext";
import { RUN_DATE } from "../fixtures";
import { DriverShell } from "../shell/DriverShell";
import type { ProblemThread } from "../types";
import styles from "./Issues.module.css";

/**
 * R6.4 the Issues tab (PRD v3 section 3 R6, V40, G-14): one thread per problem recorded on the road, newest first, with
 * whether it has reached Dispatch and an Update that adds to the same thread. Read from the phone, so it works offline.
 */
export function IssuesScreen() {
  const t = useT();
  const api = useDriverApi();
  const navigate = useNavigate();
  const now = useNow();
  const [threads, setThreads] = useState<ProblemThread[] | null>(null);

  useEffect(() => {
    let active = true;
    // Re-read on every clock tick, so "Saved on phone" turns into "Waiting for Dispatch" once the sync has run.
    void api.listProblems(RUN_DATE).then((next) => {
      if (active) setThreads(next);
    });
    return () => {
      active = false;
    };
  }, [api, now]);

  return (
    <DriverShell
      title={t("issues.title")}
      pinned={
        <PinnedActionBar>
          <Button icon="alert-triangle" onClick={() => navigate("/driver/issues/new")}>
            {t("issues.record")}
          </Button>
        </PinnedActionBar>
      }
    >
      {threads !== null && threads.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyTile}>
            <Icon name="alert-circle" size={28} />
          </span>
          <h2 className={styles.emptyTitle}>{t("issues.emptyTitle")}</h2>
          <p className={styles.emptyBody}>{t("issues.emptyBody")}</p>
        </div>
      ) : (
        <ul className={styles.list} aria-label={t("issues.title")}>
          {(threads ?? []).map((thread) => (
            <ThreadRow key={thread.parent.clientId} thread={thread} onUpdate={() => navigate(`/driver/issues/new?updates=${thread.parent.clientId}`)} />
          ))}
        </ul>
      )}
    </DriverShell>
  );
}

function ThreadRow({ thread, onUpdate }: { thread: ProblemThread; onUpdate: () => void }) {
  const t = useT();
  const { parent, updates } = thread;
  const latest = updates.at(-1) ?? parent;
  const where = parent.stopId ? `${parent.stopId}${parent.orderIds.length > 0 ? ` · ${parent.orderIds.join(" + ")}` : ""}` : t("issues.stopNone");
  const state =
    thread.state === "seen" ? (
      <Tag kind="success">{t("issues.seen")}</Tag>
    ) : thread.state === "sent" ? (
      <Tag kind="warn">{t("issues.waiting")}</Tag>
    ) : (
      <Tag kind="outline">{t("issues.saved")}</Tag>
    );
  return (
    <li className={styles.item}>
      <div className={styles.itemHead}>
        <span className={styles.tile}>
          <Icon name="alert-triangle" size={20} />
        </span>
        <span className={styles.stack}>
          <span className={styles.rowTitle}>{parent.type}</span>
          <span className={styles.rowBody}>
            <Mono>{where}</Mono>
          </span>
          {latest.note && <span className={styles.rowBody}>{latest.note}</span>}
          {updates.length > 0 && (
            <span className={styles.rowBody}>{updates.length === 1 ? t("issues.updateOne") : t("issues.updates", { count: updates.length })}</span>
          )}
        </span>
        <span className={styles.time}>
          <Mono>{latest.savedAt}</Mono>
        </span>
      </div>
      <div className={styles.itemFoot}>
        {state}
        <Button variant="secondary" size="medium" auto icon="pencil" onClick={onUpdate}>
          {t("issues.update")}
        </Button>
      </div>
    </li>
  );
}
