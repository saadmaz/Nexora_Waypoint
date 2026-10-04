import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PinnedActionBar } from "../../../field/components";
import { db, saveBlob } from "../../../field/offline";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { Icon } from "../../../shared/ui/Icon";
import { Mono } from "../../../shared/ui/Mono";
import { useDriverApi, useT } from "../context/DriverContext";
import { useDriverRun } from "../context/useDriverRun";
import { runDate } from "../../../field/clock/runDate";
import { CameraCapture } from "../outcome/CameraCapture";
import { DriverShell } from "../shell/DriverShell";
import { PROBLEM_TYPES, problemPhotoIds, type ProblemRecord, type ProblemType } from "../types";
import { ProblemPhotos } from "./ProblemPhotos";
import type { JustSavedProblem } from "./IssuesScreen";
import styles from "./Issues.module.css";

type Step = "choose" | "record" | "photo";

/**
 * R6 Problem (PRD v3 section 3 R6, V30, V40): R6.1 choose what happened, R6.2 record it (stop, orders, note, optional photo),
 * R6.3 saved on the phone, shown as a banner on the Issues list (R6.4) above the new record. `?updates=<clientId>` adds an
 * update to that problem's thread instead. A problem is a fact: it saves offline at once and Dispatch decides what happens next.
 * `?type=<one of PROBLEM_TYPES>&stop=<outletId>&note=<text>` opens the form already filled in: the "Ask Dispatch to call" and
 * "Can't reach the store" buttons use it, since the dataset has no phone numbers and none is invented (Contributing section 29).
 */
export function ProblemScreen() {
  const t = useT();
  const api = useDriverApi();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const updatesClientId = params.get("updates") ?? undefined;
  const presetType = PROBLEM_TYPES.find((p) => p === params.get("type")) ?? null;
  const presetStop = params.get("stop") ?? "";
  const { run } = useDriverRun(runDate());
  const [parent, setParent] = useState<ProblemRecord | null>(null);
  const [step, setStep] = useState<Step>(updatesClientId || presetType ? "record" : "choose");
  const [type, setType] = useState<ProblemType | null>(presetType);
  const [stopId, setStopId] = useState<string>("");
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [note, setNote] = useState(params.get("note") ?? "");
  const [photos, setPhotos] = useState<string[]>([]);
  // An update's earlier photos (the thread's records): shown, never removed, since they are part of what was saved.
  const [earlierPhotos, setEarlierPhotos] = useState<string[]>([]);
  // Photos taken on this form and not yet saved with a record. They are deleted from the phone if the driver removes
  // them or leaves without saving, so a discarded photo never uploads on its own.
  const unsaved = useRef(new Set<string>());
  const [saving, setSaving] = useState(false);

  // An update keeps the thread's type, stop and orders; only the note and photo are new.
  useEffect(() => {
    if (!updatesClientId) return;
    let active = true;
    void api.listProblems(runDate()).then((threads) => {
      const thread = threads.find((th) => th.parent.clientId === updatesClientId);
      if (!active || !thread) return;
      setParent(thread.parent);
      setType(thread.parent.type);
      setStopId(thread.parent.stopId ?? "");
      setOrderIds(thread.parent.orderIds);
      setEarlierPhotos([thread.parent, ...thread.updates].flatMap(problemPhotoIds));
    });
    return () => {
      active = false;
    };
  }, [api, updatesClientId]);

  useEffect(() => {
    const pending = unsaved.current;
    return () => {
      for (const id of pending) void discardPhoto(id);
      pending.clear();
    };
  }, []);

  const stops = useMemo(() => run?.stops ?? [], [run]);
  const stop = stops.find((s) => s.outletId === stopId);
  // The stop the driver can go on to: the first one not yet done, other than the one with the problem (R6.3).
  const nextStop = stops.find((s) => s.outletId !== stopId && !s.orders.every((o) => s.outcomes[o.id]));

  // A preset stop picks its orders once the run has loaded, the same as choosing it by hand.
  const presetApplied = useRef(false);
  useEffect(() => {
    if (presetApplied.current || !presetStop || updatesClientId || stops.length === 0) return;
    presetApplied.current = true;
    if (stops.some((s) => s.outletId === presetStop)) chooseStop(presetStop);
    // chooseStop only reads `stops`, which is a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, presetStop, updatesClientId]);

  function chooseStop(next: string) {
    setStopId(next);
    setOrderIds(stops.find((s) => s.outletId === next)?.orders.map((o) => o.id) ?? []);
  }

  function toggleOrder(id: string) {
    setOrderIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function removePhoto(blobId: string) {
    setPhotos((ids) => ids.filter((id) => id !== blobId));
    unsaved.current.delete(blobId);
    void discardPhoto(blobId);
  }

  async function save() {
    if (!type) return;
    setSaving(true);
    try {
      const record = await api.recordProblem(runDate(), {
        type,
        ...(stopId ? { stopId } : {}),
        orderIds: stopId ? orderIds : [],
        note: note.trim(),
        ...(photos.length > 0 ? { photoBlobIds: photos } : {}),
        ...(updatesClientId ? { updatesClientId } : {}),
      });
      unsaved.current.clear();
      // Replace the form in history, so Back from the list never reopens a problem that is already saved.
      const justSaved: JustSavedProblem = { clientId: record.clientId, goOn: nextStop?.outletId ?? null };
      navigate("/driver/issues", { replace: true, state: { justSaved } });
    } finally {
      setSaving(false);
    }
  }

  if (step === "photo") {
    return (
      <CameraCapture
        title={t("issues.photoTitle")}
        subtitle={stopId || t("issues.stopNone")}
        helper={t("issues.photoHelper")}
        onCancel={() => setStep("record")}
        onCapture={(blob) => {
          void saveBlob({ kind: "photo", blob }).then((blobId) => {
            unsaved.current.add(blobId);
            setPhotos((ids) => [...ids, blobId]);
            setStep("record");
          });
        }}
      />
    );
  }

  if (step === "choose") {
    return (
      <DriverShell title={t("issues.chooseTitle")} onBack={() => navigate(-1)} showTabBar={false}>
        <p className={styles.sub}>{t("issues.chooseSub")}</p>
        <ul className={styles.choices}>
          {PROBLEM_TYPES.map((choice) => (
            <li key={choice}>
              <button
                type="button"
                className={styles.choice}
                onClick={() => {
                  setType(choice);
                  setStep("record");
                }}
              >
                <Icon name="alert-triangle" size={20} />
                {choice}
              </button>
            </li>
          ))}
        </ul>
      </DriverShell>
    );
  }

  const canSave = Boolean(type) && !saving && (!updatesClientId || note.trim().length > 0 || photos.length > 0);
  return (
    <DriverShell
      title={updatesClientId ? t("issues.updateTitle") : t("issues.recordTitle")}
      onBack={() => (updatesClientId ? navigate("/driver/issues") : setStep("choose"))}
      showTabBar={false}
      pinned={
        <PinnedActionBar>
          <Button busy={saving} disabled={!canSave} onClick={() => void save()}>
            {t("issues.save")}
          </Button>
        </PinnedActionBar>
      }
    >
      <Card padded>
        <p className={styles.chosen}>
          <Icon name="alert-triangle" size={20} />
          {type ?? parent?.type ?? ""}
        </p>
      </Card>

      {updatesClientId ? (
        parent?.stopId && (
          <p className={styles.sub}>
            <Mono>{[parent.stopId, ...parent.orderIds].join(" · ")}</Mono>
          </p>
        )
      ) : (
        <Card padded>
          <fieldset className={styles.field}>
            <legend className={styles.label}>{t("issues.stop")}</legend>
            <label className={styles.check}>
              <input type="radio" name="stop" checked={stopId === ""} onChange={() => chooseStop("")} />
              {t("issues.stopNone")}
            </label>
            {stops.map((s) => (
              <label key={s.outletId} className={styles.check}>
                <input type="radio" name="stop" checked={stopId === s.outletId} onChange={() => chooseStop(s.outletId)} />
                <Mono>{s.outletId}</Mono> · {s.outletName}
              </label>
            ))}
          </fieldset>
          {stop && (
            <fieldset className={styles.field}>
              <legend className={styles.label}>{t("issues.orders")}</legend>
              {stop.orders.map((order) => (
                <label key={order.id} className={styles.check}>
                  <input type="checkbox" checked={orderIds.includes(order.id)} onChange={() => toggleOrder(order.id)} />
                  <Mono>{order.id}</Mono> · {t("stop.units", { count: order.units })}
                </label>
              ))}
            </fieldset>
          )}
        </Card>
      )}

      <Card padded>
        <label className={styles.field}>
          <span className={styles.label}>{t("issues.note")}</span>
          <textarea className={styles.note} value={note} placeholder={t("issues.notePlaceholder")} onChange={(e) => setNote(e.target.value)} />
        </label>
      </Card>

      {earlierPhotos.length > 0 && (
        <Card padded>
          <div className={styles.field}>
            <span className={styles.label}>{t("issues.photosEarlier")}</span>
            <ProblemPhotos blobIds={earlierPhotos} />
          </div>
        </Card>
      )}

      <Card padded>
        <div className={styles.field}>
          <span className={styles.label}>{updatesClientId ? t("issues.photosThisUpdate") : t("issues.photos")}</span>
          <ProblemPhotos blobIds={photos} onRemove={removePhoto} onAdd={() => setStep("photo")} />
        </div>
      </Card>
    </DriverShell>
  );
}

/** Deletes a photo from the phone, but only one no record has claimed: a saved record's photo is never touched. */
async function discardPhoto(blobId: string): Promise<void> {
  const blob = await db.blobs.get(blobId);
  if (blob && !blob.recordClientId) await db.blobs.delete(blobId);
}
