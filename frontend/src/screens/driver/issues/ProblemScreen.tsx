import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PinnedActionBar } from "../../../field/components";
import { saveBlob } from "../../../field/offline";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { Icon } from "../../../shared/ui/Icon";
import { Mono } from "../../../shared/ui/Mono";
import { useDriverApi, useT } from "../context/DriverContext";
import { useDriverRun } from "../context/useDriverRun";
import { RUN_DATE } from "../fixtures";
import { CameraCapture } from "../outcome/CameraCapture";
import { DriverShell } from "../shell/DriverShell";
import { PROBLEM_TYPES, type ProblemRecord, type ProblemType } from "../types";
import styles from "./Issues.module.css";

type Step = "choose" | "record" | "photo" | "saved";

/**
 * R6 Problem (PRD v3 section 3 R6, V30, V40): R6.1 choose what happened, R6.2 record it (stop, orders, note, optional photo),
 * R6.3 saved on the phone and back on the run. `?updates=<clientId>` adds an update to that problem's thread instead. A
 * problem is a fact: it saves offline at once and Dispatch decides what happens next.
 */
export function ProblemScreen() {
  const t = useT();
  const api = useDriverApi();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const updatesClientId = params.get("updates") ?? undefined;
  const { run } = useDriverRun(RUN_DATE);
  const [parent, setParent] = useState<ProblemRecord | null>(null);
  const [step, setStep] = useState<Step>(updatesClientId ? "record" : "choose");
  const [type, setType] = useState<ProblemType | null>(null);
  const [stopId, setStopId] = useState<string>("");
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<{ blobId: string; time: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<ProblemRecord | null>(null);

  // An update keeps the thread's type, stop and orders; only the note and photo are new.
  useEffect(() => {
    if (!updatesClientId) return;
    let active = true;
    void api.listProblems(RUN_DATE).then((threads) => {
      const thread = threads.find((th) => th.parent.clientId === updatesClientId);
      if (!active || !thread) return;
      setParent(thread.parent);
      setType(thread.parent.type);
      setStopId(thread.parent.stopId ?? "");
      setOrderIds(thread.parent.orderIds);
    });
    return () => {
      active = false;
    };
  }, [api, updatesClientId]);

  const stops = useMemo(() => run?.stops ?? [], [run]);
  const stop = stops.find((s) => s.outletId === stopId);
  // The stop the driver can go on to: the first one not yet done, other than the one with the problem (R6.3).
  const nextStop = stops.find((s) => s.outletId !== (saved?.stopId ?? stopId) && !s.orders.every((o) => s.outcomes[o.id]));

  function chooseStop(next: string) {
    setStopId(next);
    setOrderIds(stops.find((s) => s.outletId === next)?.orders.map((o) => o.id) ?? []);
  }

  function toggleOrder(id: string) {
    setOrderIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function save() {
    if (!type) return;
    setSaving(true);
    try {
      const record = await api.recordProblem(RUN_DATE, {
        type,
        ...(stopId ? { stopId } : {}),
        orderIds: stopId ? orderIds : [],
        note: note.trim(),
        ...(photo ? { photoBlobId: photo.blobId } : {}),
        ...(updatesClientId ? { updatesClientId } : {}),
      });
      setSaved(record);
      setStep("saved");
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
        onCapture={(blob, capturedAt) => {
          void saveBlob({ kind: "photo", blob }).then((blobId) => {
            setPhoto({ blobId, time: capturedAt });
            setStep("record");
          });
        }}
      />
    );
  }

  if (step === "saved") {
    return (
      <DriverShell
        title={t("issues.title")}
        pinned={
          <PinnedActionBar>
            <Button icon="route" onClick={() => navigate("/driver/run")}>
              {t("issues.backToRun")}
            </Button>
          </PinnedActionBar>
        }
      >
        <div className={styles.saved} role="status">
          <span className={styles.savedTile}>
            <Icon name="circle-check" size={28} />
          </span>
          <h2 className={styles.emptyTitle}>{t("issues.savedTitle")}</h2>
          <p className={styles.emptyBody}>{t("issues.savedBody")}</p>
          {nextStop && <p className={styles.emptyBody}>{t("issues.goOn", { outletId: nextStop.outletId })}</p>}
        </div>
      </DriverShell>
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

  const canSave = Boolean(type) && !saving && (!updatesClientId || note.trim().length > 0 || photo !== null);
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

      <Button variant="secondary" icon="camera" onClick={() => setStep("photo")}>
        {photo ? t("issues.photoAdded", { time: photo.time }) : t("issues.photo")}
      </Button>
    </DriverShell>
  );
}
