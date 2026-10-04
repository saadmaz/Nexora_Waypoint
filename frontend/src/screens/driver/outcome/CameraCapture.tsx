import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { formatTime } from "../../../field/clock/clock";
import { useNow } from "../../../field/clock/useClock";
import { compressImage } from "../../../field/offline";
import { Button } from "../../../shared/ui/Button";
import { Icon } from "../../../shared/ui/Icon";
import { Mono } from "../../../shared/ui/Mono";
import { useT } from "../context/DriverContext";
import styles from "./CameraCapture.module.css";

export type CameraCaptureProps = {
  title: string;
  subtitle: string;
  helper: string;
  onCancel: () => void;
  onCapture: (blob: Blob, capturedAt: string) => void;
};

/**
 * R3.2 A/B: a full-screen viewfinder (`getUserMedia`, rear camera), shutter, then Retake / Use
 * photo. Falls back to a file input when the camera is unavailable or permission is refused
 * (field conventions section 6). The stream is released on unmount either way.
 */
export function CameraCapture({ title, subtitle, helper, onCancel, onCapture }: CameraCaptureProps) {
  const t = useT();
  const now = useNow();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [captured, setCaptured] = useState<{ blob: Blob; url: string } | null>(null);
  const [unavailable, setUnavailable] = useState(() => !navigator.mediaDevices?.getUserMedia);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) return undefined;
    let active = true;
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        if (!active) {
          s.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = s;
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setUnavailable(true));
    return () => {
      active = false;
      streamRef.current = null;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Retake swaps the preview back for a new <video>, which starts without a source: give it the open stream again.
  useEffect(() => {
    if (!captured && videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
  }, [captured]);

  function shutter() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 960;
    const context = canvas.getContext("2d");
    context?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) setCaptured({ blob, url: URL.createObjectURL(blob) });
      },
      "image/jpeg",
      0.92,
    );
  }

  function onFilePicked(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) setCaptured({ blob: file, url: URL.createObjectURL(file) });
  }

  async function usePhoto() {
    if (!captured) return;
    setSaving(true);
    try {
      const compressed = await compressImage(captured.blob);
      onCapture(compressed, formatTime(now));
    } finally {
      setSaving(false);
    }
  }

  if (unavailable && !captured) {
    return (
      <div className={styles.screen} style={{ color: "var(--ink)", background: "var(--surface-0)" }}>
        <div className={styles.bar} style={{ color: "var(--ink)" }}>
          <button type="button" className={styles.back} style={{ color: "var(--ink)" }} onClick={onCancel} aria-label="Back">
            <Icon name="chevron-left" size={24} />
          </button>
          <div className={styles.titles}>
            <p className={styles.title} style={{ color: "var(--ink)" }}>
              {title}
            </p>
            <p className={styles.subtitle} style={{ color: "var(--ink-muted)" }}>
              {subtitle}
            </p>
          </div>
        </div>
        <div className={styles.fallback}>
          <Icon name="camera" size={28} />
          <p>{helper}</p>
          <Button onClick={() => fileInputRef.current?.click()}>{t("camera.usePhoto")}</Button>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" hidden onChange={onFilePicked} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.bar}>
        <button type="button" className={styles.back} onClick={onCancel} aria-label="Back">
          <Icon name="chevron-left" size={24} color="on-chrome" />
        </button>
        <div className={styles.titles}>
          <p className={styles.title}>{title}</p>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
      </div>
      <div className={styles.viewfinder}>
        {captured ? (
          <img src={captured.url} alt="" className={styles.preview} />
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className={styles.video} />
        )}
        {captured ? (
          <span className={styles.stamp}>
            <Mono>{formatTime(now)}</Mono>
          </span>
        ) : (
          <p className={styles.helper}>{helper}</p>
        )}
      </div>
      <div className={styles.controls}>
        {captured ? (
          <>
            <Button variant="secondary" onClick={() => setCaptured(null)}>
              {t("camera.retake")}
            </Button>
            <Button busy={saving} onClick={usePhoto}>
              {t("camera.usePhoto")}
            </Button>
          </>
        ) : (
          <button type="button" className={styles.shutter} onClick={shutter} aria-label={t("action.recordOutcome")} />
        )}
      </div>
    </div>
  );
}
