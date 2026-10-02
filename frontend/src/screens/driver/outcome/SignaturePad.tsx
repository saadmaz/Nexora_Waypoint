import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "../../../shared/ui/Button";
import { useT } from "../context/DriverContext";
import styles from "./SignaturePad.module.css";

export type SignaturePadProps = {
  receiverName: string;
  deviceTime: string;
  onSave: (blob: Blob) => void;
};

/** R3.11: a canvas with pointer events. "Save signature" stores a PNG blob and returns to R3.1. */
export function SignaturePad({ receiverName, deviceTime, onSave }: SignaturePadProps) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  function point(event: ReactPointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    drawing.current = true;
    const { x, y } = point(event, canvas);
    const ctx = canvas.getContext("2d");
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = point(event, canvas);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#15191c";
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  }

  function endStroke() {
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) onSave(blob);
    }, "image/png");
  }

  return (
    <div className={styles.body}>
      <h2>{t("signature.ask")}</h2>
      <p className={styles.helper}>{t("signature.helper")}</p>
      <div className={styles.padWrap}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          width={358}
          height={220}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
        />
        {!hasInk && <span className={styles.placeholderX}>×</span>}
      </div>
      <p className={styles.stamp}>{t("signature.stamp", { name: receiverName, time: deviceTime })}</p>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={clear}>
          {t("signature.clear")}
        </Button>
        <Button onClick={save} disabled={!hasInk}>
          {t("signature.save")}
        </Button>
      </div>
    </div>
  );
}
