import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { DriverOutcome } from "../../../domain/field";
import { formatTime } from "../../../field/clock/clock";
import { useNow } from "../../../field/clock/useClock";
import { FieldSwitch, FieldTopBar, OfflineBanner, PinnedActionBar, UnitsStepper } from "../../../field/components";
import { saveBlob, useConnectivity, type ConnectivitySnapshot } from "../../../field/offline";
import { Button } from "../../../shared/ui/Button";
import { Icon } from "../../../shared/ui/Icon";
import { Mono } from "../../../shared/ui/Mono";
import { LoadingSkeleton, StateScreen } from "../../../shared/ui/StateScreen";
import { Tag } from "../../../shared/ui/Tag";
import { useDriverApi, useT } from "../context/DriverContext";
import { useDriverRun } from "../context/useDriverRun";
import { RECENT_RECEIVERS, RUN_DATE } from "../fixtures";
import { buildOfflineBanner } from "../offlineBanner";
import { DriverShell } from "../shell/DriverShell";
import type { TFn } from "../stopFormat";
import type { DriverStop, OutcomeInput } from "../types";
import { CameraCapture } from "./CameraCapture";
import styles from "./OutcomeScreen.module.css";
import { ReceiverNameForm } from "./ReceiverNameForm";
import { SignaturePad } from "./SignaturePad";

const WHOLE_OUTCOMES: DriverOutcome[] = ["Delivered", "Damaged", "Refused", "Store closed", "Other"];
const ORDER_OUTCOMES: DriverOutcome[] = ["Delivered", "Damaged", "Refused", "Other"];
const REFUSED_REASONS = ["Wrong items", "Not ordered", "Damaged", "Too late", "Other"];

function outcomeLabel(outcome: DriverOutcome, t: TFn): string {
  switch (outcome) {
    case "Delivered":
      return t("outcome.delivered");
    case "Damaged":
      return t("outcome.damaged");
    case "Refused":
      return t("outcome.refused");
    case "Store closed":
      return t("outcome.storeClosed");
    case "Other":
      return t("outcome.other");
  }
}

type PhotoDraft = { blobId: string; url: string; time: string };
type OrderDraft = { outcome: DriverOutcome; units: number };
type Subview = "form" | "camera" | "receiver" | "signature";

export type OutcomeScreenProps = {
  connectivityOverride?: ConnectivitySnapshot;
  stopIdOverride?: string;
  subviewOverride?: Subview;
  initial?: {
    sameOutcome?: boolean;
    stopOutcome?: DriverOutcome;
    perOrder?: Record<string, OrderDraft>;
    refusedReason?: string;
    receiverName?: string;
    photo?: PhotoDraft | null;
    signatureBlobId?: string;
    showValidation?: boolean;
  };
};

/**
 * R3 Record outcome (field conventions section 3; driver prompt 3 section 6): one outcome for the
 * whole stop by default (R3.1, R3.5 A/B), a per-order switch (R3.4), the camera (R3.2), receiver
 * name (R3.3) and signature (R3.11) sub-views, validation (R3.6) and the saved confirmation, which
 * is the Run screen itself (R3.7, R3.9/3.10 and the R3.5 C failed stop card all live there).
 */
export function OutcomeScreen({ connectivityOverride, stopIdOverride, subviewOverride, initial }: OutcomeScreenProps = {}) {
  const params = useParams<{ stopId: string }>();
  const stopId = stopIdOverride ?? params.stopId;
  const t = useT();
  const api = useDriverApi();
  const navigate = useNavigate();
  const liveConnectivity = useConnectivity();
  const connectivity = connectivityOverride ?? liveConnectivity;
  const now = useNow();
  const { run } = useDriverRun(RUN_DATE);

  const [subview, setSubview] = useState<Subview>(subviewOverride ?? "form");
  const [sameOutcome, setSameOutcome] = useState(initial?.sameOutcome ?? true);
  const [stopOutcome, setStopOutcome] = useState<DriverOutcome>(initial?.stopOutcome ?? "Delivered");
  const [perOrder, setPerOrder] = useState<Record<string, OrderDraft>>(initial?.perOrder ?? {});
  const [refusedReason, setRefusedReason] = useState(initial?.refusedReason ?? "");
  const [receiverName, setReceiverName] = useState(initial?.receiverName ?? "");
  const [photo, setPhoto] = useState<PhotoDraft | null>(initial?.photo ?? null);
  const [signatureBlobId, setSignatureBlobId] = useState<string | undefined>(initial?.signatureBlobId);
  const [showValidation, setShowValidation] = useState(initial?.showValidation ?? false);
  const [saving, setSaving] = useState(false);
  const proofRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showValidation) proofRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [showValidation]);

  function orderDraft(stop: DriverStop, orderId: string): OrderDraft {
    const order = stop.orders.find((o) => o.id === orderId);
    return perOrder[orderId] ?? { outcome: "Delivered", units: order?.units ?? 0 };
  }

  function setOrderDraft(orderId: string, patch: Partial<OrderDraft>, fallbackUnits: number) {
    setPerOrder((prev) => ({ ...prev, [orderId]: { ...(prev[orderId] ?? { outcome: "Delivered", units: fallbackUnits }), ...patch } }));
  }

  async function handlePhotoCapture(blob: Blob, capturedAt: string) {
    const blobId = await saveBlob({ kind: "photo", blob });
    setPhoto({ blobId, url: URL.createObjectURL(blob), time: capturedAt });
    setSubview("form");
  }

  async function handleSignatureSave(blob: Blob) {
    const blobId = await saveBlob({ kind: "signature", blob });
    setSignatureBlobId(blobId);
    setSubview("form");
  }

  async function handleSave(stop: DriverStop) {
    let inputs: OutcomeInput[];

    if (sameOutcome) {
      const needsProof = stopOutcome === "Delivered" || stopOutcome === "Damaged";
      const needsClosedPhoto = stopOutcome === "Store closed";
      if ((needsProof && (!photo || receiverName.trim() === "")) || (needsClosedPhoto && !photo)) {
        setShowValidation(true);
        return;
      }
      inputs = stop.orders.map((order) => {
        const draft = orderDraft(stop, order.id);
        return {
          orderId: order.id,
          outcome: stopOutcome,
          unitsDelivered: needsProof ? draft.units : 0,
          reason: stopOutcome === "Refused" || stopOutcome === "Other" ? refusedReason || undefined : undefined,
          receiverName: needsProof || stopOutcome === "Refused" || stopOutcome === "Other" ? receiverName || undefined : undefined,
          photoBlobId: photo?.blobId,
          signatureBlobId,
        };
      });
    } else {
      const anyNeedsProof = stop.orders.some((o) => {
        const oc = orderDraft(stop, o.id).outcome;
        return oc === "Delivered" || oc === "Damaged";
      });
      if (anyNeedsProof && (!photo || receiverName.trim() === "")) {
        setShowValidation(true);
        return;
      }
      inputs = stop.orders.map((order) => {
        const draft = orderDraft(stop, order.id);
        const needsProof = draft.outcome === "Delivered" || draft.outcome === "Damaged";
        return {
          orderId: order.id,
          outcome: draft.outcome,
          unitsDelivered: needsProof ? draft.units : 0,
          reason: draft.outcome === "Refused" || draft.outcome === "Other" ? refusedReason || undefined : undefined,
          receiverName: needsProof ? receiverName : undefined,
          photoBlobId: photo?.blobId,
          signatureBlobId,
        };
      });
    }

    setSaving(true);
    try {
      await api.recordOutcome(RUN_DATE, stop.outletId, inputs);
    } finally {
      setSaving(false);
    }
    navigate("/driver/run");
  }

  if (!run) {
    return (
      <DriverShell title={t("outcome.title", { number: "" })} connectivityOverride={connectivityOverride}>
        <LoadingSkeleton />
      </DriverShell>
    );
  }

  const stop = run.stops.find((s) => s.outletId === stopId);
  if (!stop) {
    return (
      <DriverShell title={t("stop.loadingTitle")} onBack={() => navigate("/driver/run")} connectivityOverride={connectivityOverride}>
        <StateScreen
          icon="map-pin"
          bg="offline-soft"
          fg="offline"
          title={t("stop.notOnRoute")}
          body={t("stop.notOnRouteBody", { runNo: run.runNo })}
          actions={<Button onClick={() => navigate("/driver/run")}>{t("action.backToRun")}</Button>}
        />
      </DriverShell>
    );
  }

  if (subview === "camera") {
    return (
      <CameraCapture
        title={t("camera.title")}
        subtitle={t("camera.subtitle", { outletId: stop.outletId })}
        helper={stopOutcome === "Store closed" ? t("outcome.closedPhotoHelper") : t("camera.helper")}
        onCancel={() => setSubview("form")}
        onCapture={handlePhotoCapture}
      />
    );
  }

  if (subview === "receiver") {
    return (
      <div>
        <FieldTopBar title={t("outcome.receivedBy")} onBack={() => setSubview("form")} />
        <ReceiverNameForm
          outletId={stop.outletId}
          initialName={receiverName}
          recentNames={RECENT_RECEIVERS[stop.outletId] ?? []}
          onSave={(name) => {
            setReceiverName(name);
            setSubview("form");
          }}
        />
      </div>
    );
  }

  if (subview === "signature") {
    return (
      <div>
        <FieldTopBar title={t("signature.title")} onBack={() => setSubview("form")} />
        <SignaturePad receiverName={receiverName || "—"} deviceTime={photo?.time ?? formatTime(now)} onSave={handleSignatureSave} />
      </div>
    );
  }

  const banner = buildOfflineBanner(
    connectivity,
    t,
    <OfflineBanner tone="offline">
      {t("banner.offlineWaiting", { time: connectivity.lastSyncAt ? formatTime(connectivity.lastSyncAt) : "--:--", count: 0 })}
    </OfflineBanner>,
  );

  const needsProofChosen = sameOutcome ? stopOutcome === "Delivered" || stopOutcome === "Damaged" : stop.orders.some((o) => {
    const oc = orderDraft(stop, o.id).outcome;
    return oc === "Delivered" || oc === "Damaged";
  });

  const proofSection = (
    <div className={styles.card} ref={proofRef}>
      <p className={styles.heading}>{t("outcome.proof")}</p>
      {photo ? (
        <div className={styles.photoTile}>
          <img src={photo.url} className={styles.photoImg} alt="" />
          <div className={styles.photoMeta}>
            <p className={styles.label}>{t("outcome.photoTaken")}</p>
            <p className={styles.caption}>
              <Mono>{photo.time}</Mono>
            </p>
          </div>
          <Button variant="ghost" size="medium" auto onClick={() => setSubview("camera")}>
            {t("outcome.retakePhoto")}
          </Button>
        </div>
      ) : (
        <div className={styles.photoTile}>
          <span className={styles.photoEmpty}>
            <Icon name="camera" size={24} />
          </span>
          <p className={styles.photoMeta}>{t("camera.title")}</p>
          <Button variant="secondary" size="medium" auto onClick={() => setSubview("camera")}>
            {t("outcome.takePhoto")}
          </Button>
        </div>
      )}
      <button type="button" className={styles.receiverRow} onClick={() => setSubview("receiver")}>
        <span>
          <span className={styles.label}>{t("outcome.receivedBy")}</span>{" "}
          {receiverName ? <strong>{receiverName}</strong> : <span className={styles.placeholder}>Receiver's name</span>}
        </span>
        <Icon name="chevron-right" size={20} />
      </button>
      <p className={styles.caption}>{t("outcome.deviceTime", { time: photo?.time ?? formatTime(now) })}</p>
      <Button variant="ghost" onClick={() => setSubview("signature")}>
        {signatureBlobId ? t("signature.save") : t("outcome.addSignature")}
      </Button>
      {showValidation && needsProofChosen && (!photo || receiverName.trim() === "") && (
        <p className={styles.validation}>{t("outcome.validationMissing")}</p>
      )}
    </div>
  );

  function whatHappensNext(outcome: DriverOutcome) {
    return (
      <div className={styles.card}>
        <p className={styles.heading}>{t("outcome.whatHappensNext")}</p>
        <div className={styles.chipsRow}>
          <Tag kind="danger">Issue</Tag>
          <Tag kind="outline">{outcomeLabel(outcome, t)}</Tag>
        </div>
        <p className={styles.body}>{t("outcome.dispatchWillDecide")}</p>
      </div>
    );
  }

  const title = t("outcome.title", { number: stop.number });
  const saveLabel =
    sameOutcome && stopOutcome === "Store closed"
      ? t("outcome.saveStoreClosed")
      : sameOutcome && (stopOutcome === "Refused" || stopOutcome === "Other")
        ? t("outcome.saveRefused")
        : t("outcome.save");

  return (
    <DriverShell
      title={title}
      subtitle={stop.outletId}
      onBack={() => navigate(`/driver/stops/${stop.outletId}`)}
      banner={banner}
      connectivityOverride={connectivityOverride}
      pinned={
        <PinnedActionBar helper={t("outcome.savesOffline")}>
          <Button busy={saving} onClick={() => handleSave(stop)}>
            {saveLabel}
          </Button>
        </PinnedActionBar>
      }
    >
      {stop.orders.length > 1 && (
        <div className={styles.switchRow}>
          <span className={styles.label}>{t("outcome.sameOutcome")}</span>
          <FieldSwitch checked={sameOutcome} onCheckedChange={setSameOutcome} label={t("outcome.sameOutcome")} />
        </div>
      )}

      {sameOutcome ? (
        <>
          <p className={styles.heading}>{t("outcome.outcome")}</p>
          <div className={styles.chipsRow}>
            {WHOLE_OUTCOMES.map((outcome) => (
              <button
                type="button"
                key={outcome}
                className={[styles.chip, stopOutcome === outcome && styles.chipChosen].filter(Boolean).join(" ")}
                onClick={() => setStopOutcome(outcome)}
              >
                {stopOutcome === outcome && <Icon name="check" size={16} />}
                {outcomeLabel(outcome, t)}
              </button>
            ))}
          </div>

          {(stopOutcome === "Delivered" || stopOutcome === "Damaged") && (
            <>
              <p className={styles.heading}>{t("outcome.unitsDelivered")}</p>
              {stop.orders.map((order) => {
                const draft = orderDraft(stop, order.id);
                const damaged = order.units - draft.units;
                return (
                  <div key={order.id} className={styles.card}>
                    <div className={styles.orderHeading}>
                      <span className={styles.orderTitle}>
                        <Mono>{order.id}</Mono>
                      </span>
                      <Tag kind={order.temperature === "chilled" ? "chilled" : "ambient"}>
                        {order.temperature === "chilled" ? t("tag.chilled") : "Ambient"}
                      </Tag>
                    </div>
                    {stopOutcome === "Damaged" && damaged > 0 && <p className={styles.body}>{t("outcome.damagedHelper", { count: damaged })}</p>}
                    <div className={styles.stepperRow}>
                      <span className={styles.orderMeta}>{t("outcome.unitsDelivered")}</span>
                      <UnitsStepper
                        value={draft.units}
                        onChange={(value) => setOrderDraft(order.id, { units: value }, order.units)}
                        expected={order.units}
                        label={`units of ${order.id}`}
                      />
                    </div>
                  </div>
                );
              })}
              {proofSection}
            </>
          )}

          {stopOutcome === "Store closed" && (
            <>
              <p className={styles.heading}>{t("outcome.closedPhotoRequired")}</p>
              <p className={styles.body}>{t("outcome.closedPhotoHelper")}</p>
              {photo ? (
                <div className={styles.photoTile} ref={proofRef}>
                  <img src={photo.url} className={styles.photoImg} alt="" />
                  <div className={styles.photoMeta}>
                    <p className={styles.label}>{t("outcome.photoTaken")}</p>
                    <p className={styles.caption}>
                      <Mono>{photo.time}</Mono>
                    </p>
                  </div>
                  <Button variant="ghost" size="medium" auto onClick={() => setSubview("camera")}>
                    {t("outcome.retakePhoto")}
                  </Button>
                </div>
              ) : (
                <div ref={proofRef}>
                  <Button onClick={() => setSubview("camera")}>{t("outcome.takePhoto")}</Button>
                  {showValidation && <p className={styles.validation}>{t("outcome.validationMissing")}</p>}
                </div>
              )}
              <p className={styles.caption}>{t("outcome.closedNoReceiver")}</p>
              {whatHappensNext("Store closed")}
            </>
          )}

          {(stopOutcome === "Refused" || stopOutcome === "Other") && (
            <>
              {refusedReason === "Other" && <p className={styles.body}>{t("outcome.refusedOtherNote")}</p>}
              <p className={styles.heading}>{t("outcome.refusedReason")}</p>
              <div className={styles.chipsRow}>
                {REFUSED_REASONS.map((reason) => (
                  <button
                    type="button"
                    key={reason}
                    className={[styles.chip, refusedReason === reason && styles.chipChosen].filter(Boolean).join(" ")}
                    onClick={() => setRefusedReason(reason)}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <label className={styles.heading} htmlFor="refused-by">
                {t("outcome.refusedBy")}
              </label>
              <input
                id="refused-by"
                className={styles.chip}
                style={{ width: "100%", textAlign: "left" }}
                value={receiverName}
                onChange={(event) => setReceiverName(event.target.value)}
              />
              {whatHappensNext(stopOutcome)}
            </>
          )}
        </>
      ) : (
        <>
          <p className={styles.heading}>{t("outcome.result")}</p>
          <p className={styles.resultLine}>
            {stop.orders.map((order, index) => (
              <span key={order.id}>
                {index > 0 && " · "}
                <Mono>{order.id}</Mono> {outcomeLabel(orderDraft(stop, order.id).outcome, t)}
              </span>
            ))}
          </p>
          {stop.orders.map((order) => {
            const draft = orderDraft(stop, order.id);
            const damaged = order.units - draft.units;
            return (
              <div key={order.id} className={styles.card}>
                <div className={styles.orderHeading}>
                  <span className={styles.orderTitle}>
                    <Mono>{order.id}</Mono>
                  </span>
                  <span className={styles.orderMeta}>{t("stop.units", { count: order.units })}</span>
                </div>
                <Tag kind={order.temperature === "chilled" ? "chilled" : "ambient"}>
                  {order.temperature === "chilled" ? t("tag.chilled") : "Ambient"}
                </Tag>
                <div className={styles.chipsRow}>
                  {ORDER_OUTCOMES.map((outcome) => (
                    <button
                      type="button"
                      key={outcome}
                      className={[styles.chip, styles.chipSmall, draft.outcome === outcome && styles.chipChosen].filter(Boolean).join(" ")}
                      onClick={() => setOrderDraft(order.id, { outcome }, order.units)}
                    >
                      {outcomeLabel(outcome, t)}
                    </button>
                  ))}
                </div>
                {draft.outcome === "Damaged" && (
                  <>
                    {damaged > 0 && <p className={styles.body}>{t("outcome.damagedHelper", { count: damaged })}</p>}
                    <div className={styles.stepperRow}>
                      <span className={styles.orderMeta}>{t("outcome.unitsDelivered")}</span>
                      <UnitsStepper
                        value={draft.units}
                        onChange={(value) => setOrderDraft(order.id, { units: value }, order.units)}
                        expected={order.units}
                        label={`units of ${order.id}`}
                      />
                    </div>
                  </>
                )}
                {(draft.outcome === "Refused" || draft.outcome === "Other") && <p className={styles.caption}>{t("outcome.dispatchWillDecide")}</p>}
              </div>
            );
          })}
          {proofSection}
        </>
      )}
    </DriverShell>
  );
}
