import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useNow } from "../../../field/clock/useClock";
import { PinnedActionBar } from "../../../field/components";
import { Button } from "../../../shared/ui/Button";
import { Icon } from "../../../shared/ui/Icon";
import { Mono } from "../../../shared/ui/Mono";
import { Tag } from "../../../shared/ui/Tag";
import { useDriverApi, useT } from "../context/DriverContext";
import { runDate } from "../../../field/clock/runDate";
import { DriverShell } from "../shell/DriverShell";
import type { ProblemThread } from "../types";
import styles from "./Issues.module.css";

/** What the problem form hands the list when it has just saved a record (R6.3): which one, and the stop to go on to. */
export type JustSavedProblem = { clientId: string; goOn: string | null };

/**
 * R6.4 the Issues tab (PRD v3 section 3 R6, V40, G-14): one thread per problem recorded on the road, newest first, with
 * whether it has reached Dispatch and an Update that adds to the same thread. Read from the phone, so it works offline.
 */
export function IssuesScreen() {
  const t = useT();
  const api = useDriverApi();
  const navigate = useNavigate();
  const location = useLocation();
  const now = useNow();
  const [threads, setThreads] = useState<ProblemThread[] | null>(null);
  // R6.3: read once from the navigation, then cleared, so going Back to this page later does not say "saved" again.
  const [justSaved] = useState<JustSavedProblem | null>(() => (location.state as { justSaved?: JustSavedProblem } | null)?.justSaved ?? null);
  useEffect(() => {
    if (justSaved) navigate(location.pathname, { replace: true, state: null });
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;
    // Re-read on every clock tick, so "Saved on phone" turns into "Waiting for Dispatch" once the sync has run.
    void api.listProblems(runDate()).then((next) => {
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
      {justSaved && (
        <div className={styles.savedBanner} role="status">
          <span className={styles.savedBannerIcon}>
            <Icon name="circle-check" size={20} />
          </span>
          <span className={styles.stack}>
            <span className={styles.rowTitle}>{t("issues.savedTitle")}</span>
            <span className={styles.rowBody}>{t("issues.savedBody")}</span>
            {justSaved.goOn && <span className={styles.rowBody}>{t("issues.goOn", { outletId: justSaved.goOn })}</span>}
          </span>
        </div>
      )}
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
