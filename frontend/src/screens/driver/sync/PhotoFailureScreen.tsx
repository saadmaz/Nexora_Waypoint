import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formatTime } from "../../../field/clock/clock";
import { connectivity as connectivityStore, type ConnectivitySnapshot } from "../../../field/offline";
import { Button } from "../../../shared/ui/Button";
import { Facts } from "../../../shared/ui/Facts";
import { Icon } from "../../../shared/ui/Icon";
import { Mono } from "../../../shared/ui/Mono";
import { MonoText } from "../../../shared/ui/MonoText";
import { useOutboxOpen, useT } from "../context/DriverContext";
import { useDriverRun } from "../context/useDriverRun";
import { runDate } from "../../../field/clock/runDate";
import { PHOTO_FAILURE_REFERENCE } from "../api/mockDriverApi";
import { DriverShell } from "../shell/DriverShell";
import styles from "./PhotoFailureScreen.module.css";
import { usePhotoState, type PhotoState } from "./usePhotoState";

export type PhotoFailureScreenProps = {
  /** The state gallery only. */
  connectivityOverride?: ConnectivitySnapshot;
  /** The state gallery only: the photo that failed, instead of the phone's own blobs. */
  photoStateOverride?: PhotoState;
  /** The state gallery only: which photo, instead of the route's `:blobId`. */
  blobIdOverride?: string;
};

/**
 * R8.3 Notification detail: sync failed (driver prompt 4 section 4). Says what failed (a photo),
 * what is safe (the photo stays on the phone and the delivery record is already with Dispatch) and
 * what happens next (the phone retries by itself; Try again does it now), with a reference for
 * support. When the photo gets through, the driver is taken back to the run.
 */
export function PhotoFailureScreen({ connectivityOverride, photoStateOverride, blobIdOverride }: PhotoFailureScreenProps = {}) {
  const t = useT();
  const navigate = useNavigate();
  const params = useParams();
  const outbox = useOutboxOpen();
  const { run } = useDriverRun(runDate());
  const livePhotos = usePhotoState(run);
  const photos = photoStateOverride ?? livePhotos;
  const blobId = blobIdOverride ?? params.blobId;
  const failure = photos.failures.find((f) => f.blobId === blobId);

  useEffect(() => {
    if (!blobIdOverride && photos.loaded && !failure) navigate("/driver/run", { replace: true });
  }, [blobIdOverride, photos.loaded, failure, navigate]);

  if (!failure) return null;

  const lastTry = formatTime(failure.lastTryAt);
  return (
    <DriverShell
      title={t("notice.title")}
      subtitle={<Mono>{lastTry}</Mono>}
      onBack={() => navigate(-1)}
      bareTopBar
      showTabBar={false}
      connectivityOverride={connectivityOverride}
    >
      <div className={styles.content}>
        <span className={styles.tile}>
          <Icon name="alert-circle" size={28} />
        </span>
        <h2 className={styles.title}>{t("notice.photoTitle", { number: failure.stopNumber ?? 1 })}</h2>
        <p className={styles.body}>{t("notice.photoBody")}</p>
        <Facts
          ruled
          items={[
            { key: t("notice.factRecord"), value: <MonoText>{t("notice.factRecordValue", { outletId: failure.outletId ?? "" })}</MonoText> },
            { key: t("notice.factTaken"), value: <Mono>{formatTime(failure.takenAt)}</Mono> },
            { key: t("notice.factLastTry"), value: <Mono>{lastTry}</Mono> },
            ...(failure.deliverySyncedAt !== undefined
              ? [{ key: t("notice.factDelivery"), value: <MonoText>{t("notice.factDeliverySynced", { time: formatTime(failure.deliverySyncedAt) })}</MonoText> }]
              : []),
          ]}
        />
        <p className={styles.note}>
          <Icon name="user" size={16} />
          <span>{t("notice.dispatchHasIt")}</span>
        </p>
        <div className={styles.actions}>
          <Button icon="refresh-cw" onClick={() => void connectivityStore.sendNow()}>
            {t("sync.tryAgain")}
          </Button>
          <Button variant="secondary" icon="cloud" onClick={() => outbox.setOpen(true)}>
            {t("notice.viewOutbox")}
          </Button>
        </div>
        <p className={styles.reference}>
          <MonoText>{t("sync.ref", { reference: PHOTO_FAILURE_REFERENCE, time: lastTry })}</MonoText>
        </p>
      </div>
    </DriverShell>
  );
}
