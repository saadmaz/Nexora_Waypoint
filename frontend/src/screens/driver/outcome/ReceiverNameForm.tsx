import { useState } from "react";
import { Button } from "../../../shared/ui/Button";
import { useT } from "../context/DriverContext";
import styles from "./ReceiverNameForm.module.css";

export type ReceiverNameFormProps = {
  outletId: string;
  initialName: string;
  recentNames: string[];
  onSave: (name: string) => void;
};

/** R3.3: a text field plus recent-name suggestion chips for the outlet. */
export function ReceiverNameForm({ outletId, initialName, recentNames, onSave }: ReceiverNameFormProps) {
  const t = useT();
  const [name, setName] = useState(initialName);

  return (
    <div className={styles.body}>
      <label className={styles.label}>
        {t("outcome.receivedBy")}
        <input
          className={styles.input}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          autoComplete="off"
          enterKeyHint="done"
        />
      </label>
      {recentNames.length > 0 && (
        <>
          <p className={styles.caption}>{t("receiver.recentNames", { outletId })}</p>
          <div className={styles.chipsRow}>
            {recentNames.map((recent) => (
              <button type="button" key={recent} className={styles.chip} onClick={() => setName(recent)}>
                {recent}
              </button>
            ))}
          </div>
        </>
      )}
      <Button disabled={name.trim() === ""} onClick={() => onSave(name.trim())}>
        {t("receiver.save")}
      </Button>
    </div>
  );
}
