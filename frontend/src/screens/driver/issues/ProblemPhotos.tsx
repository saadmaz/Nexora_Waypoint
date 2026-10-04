import { useEffect, useState } from "react";
import { getBlob } from "../../../field/offline";
import { Icon } from "../../../shared/ui/Icon";
import { Modal } from "../../../shared/ui/Modal";
import { useT } from "../context/DriverContext";
import styles from "./Issues.module.css";

/** An object URL for a photo kept on this phone, revoked when the photo leaves the screen. `null` while reading or when it is not here. */
function usePhotoUrl(blobId: string): { url: string | null; missing: boolean } {
  const [state, setState] = useState<{ url: string | null; missing: boolean }>({ url: null, missing: false });
  useEffect(() => {
    let active = true;
    let url: string | null = null;
    void getBlob(blobId).then((record) => {
      if (!active) return;
      if (!record) {
        setState({ url: null, missing: true });
        return;
      }
      url = URL.createObjectURL(record.blob);
      setState({ url, missing: false });
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [blobId]);
  return state;
}

function PhotoTile({ blobId, index, onOpen, onRemove }: { blobId: string; index: number; onOpen: (blobId: string) => void; onRemove?: (blobId: string) => void }) {
  const t = useT();
  const { url, missing } = usePhotoUrl(blobId);
  return (
    <li className={styles.photoTile}>
      {missing ? (
        // A photo saved on another phone: the record lists it, but the picture is only with Dispatch.
        <span className={styles.photoMissing}>
          <Icon name="image" size={20} />
          <span>{t("issues.photoNotHere")}</span>
        </span>
      ) : (
        <button type="button" className={styles.photoOpen} onClick={() => onOpen(blobId)} disabled={!url} aria-label={t("issues.photoOpen", { n: index + 1 })}>
          {url && <img src={url} alt="" className={styles.photoImg} />}
        </button>
      )}
      {onRemove && (
        <button type="button" className={styles.photoRemove} onClick={() => onRemove(blobId)} aria-label={t("issues.photoRemove", { n: index + 1 })}>
          <Icon name="x" size={16} />
        </button>
      )}
    </li>
  );
}

function PhotoViewer({ blobId, onClose }: { blobId: string; onClose: () => void }) {
  const t = useT();
  const { url } = usePhotoUrl(blobId);
  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={t("issues.photoTitle")}>
      {url && <img src={url} alt="" className={styles.photoFull} />}
    </Modal>
  );
}

export type ProblemPhotosProps = {
  blobIds: string[];
  /** Shown as a remove button on each photo; left out for photos that are already part of the record. */
  onRemove?: (blobId: string) => void;
  /** A last tile that opens the camera. */
  onAdd?: () => void;
};

/** R6.2 photos: thumbnails read from this phone, tap to see one full size; optionally removable, with an Add tile. */
export function ProblemPhotos({ blobIds, onRemove, onAdd }: ProblemPhotosProps) {
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <ul className={styles.photoGrid}>
        {blobIds.map((id, index) => (
          <PhotoTile key={id} blobId={id} index={index} onOpen={setOpen} {...(onRemove ? { onRemove } : {})} />
        ))}
        {onAdd && (
          <li className={styles.photoTile}>
            <button type="button" className={styles.photoAdd} onClick={onAdd}>
              <Icon name="camera" size={20} />
              <span>{t("issues.photo")}</span>
            </button>
          </li>
        )}
      </ul>
      {open && <PhotoViewer blobId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
