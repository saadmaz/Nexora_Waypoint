import { useEffect, useState } from "react";
import { ChoiceChips, FieldSwitch } from "../../../field/components";
import { Card } from "../../../shared/ui/Card";
import { Facts } from "../../../shared/ui/Facts";
import { Tag } from "../../../shared/ui/Tag";
import { LogOutButton } from "../../auth/AccountMenu";
import { accountName } from "../../auth/accountName";
import { runDate } from "../../../field/clock/runDate";
import { VEHICLE } from "../fixtures";
import { useDriverRun } from "../context/useDriverRun";
import { useDriverSettings, useT } from "../context/DriverContext";
import { DriverShell } from "../shell/DriverShell";
import type { Language, TextSize } from "../types";
import styles from "./MeScreen.module.css";

async function readStorageUsed(): Promise<string> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return "0 MB used";
  const { usage = 0 } = await navigator.storage.estimate();
  const mb = usage / (1024 * 1024);
  const value = mb < 10 ? mb.toFixed(1) : Math.round(mb).toString();
  return `${value} MB used`;
}

export type MeScreenProps = {
  /** The state gallery's fixed value, so R1.9 always shows "3.2 MB used" there. */
  storageOverride?: string;
};

/** R1.9: the Me tab. Sunlight screen, text size, language, distance tracking, offline storage and Log out. */
export function MeScreen({ storageOverride }: MeScreenProps) {
  const t = useT();
  const { settings, setSunlight, setTextSize, setLanguage } = useDriverSettings();
  const [storage, setStorage] = useState(storageOverride ?? "…");
  // Who is signed in, and the vehicle of the run the phone holds (the server's in API mode); the fixture only until it loads.
  const { run } = useDriverRun(runDate());
  const name = accountName("driver");
  const vehicleId = run?.vehicle.id ?? VEHICLE.id;

  useEffect(() => {
    if (storageOverride) return;
    let active = true;
    void readStorageUsed().then((value) => {
      if (active) setStorage(value);
    });
    return () => {
      active = false;
    };
  }, [storageOverride]);

  const textSizeOptions: { key: TextSize; label: string }[] = [
    { key: "standard", label: t("me.standard") },
    { key: "large", label: t("me.large") },
  ];
  const languageOptions: { key: Language; label: string; lang?: string }[] = [
    { key: "en", label: "English" },
    { key: "si", label: "සිංහල", lang: "si" },
    { key: "ta", label: "தமிழ்", lang: "ta" },
  ];

  return (
    <DriverShell title={t("me.title")} subtitle={`Run ${run?.runNo ?? 1} · ${vehicleId}`}>
      <p className={styles.identity}>
        {name} · {vehicleId}
      </p>

      <Card padded>
        <div className={styles.section}>
          <div className={styles.row}>
            <div>
              <p className={styles.label}>{t("me.sunlight")}</p>
              <p className={styles.helper}>{t("me.sunlightHelper")}</p>
            </div>
            <FieldSwitch checked={settings.sunlight} onCheckedChange={setSunlight} label={t("me.sunlight")} />
          </div>
          <p className={styles.caption}>{t("me.themeFollows")}</p>
        </div>
      </Card>

      <Card padded>
        <div className={styles.section}>
          <p className={styles.heading}>{t("me.textSize")}</p>
          <ChoiceChips options={textSizeOptions} value={settings.textSize} onChange={setTextSize} label={t("me.textSize")} fill />
        </div>
      </Card>

      <Card padded>
        <div className={styles.section}>
          <p className={styles.heading}>{t("me.language")}</p>
          <ChoiceChips options={languageOptions} value={settings.language} onChange={setLanguage} label={t("me.language")} />
        </div>
      </Card>

      <Card padded>
        <div className={styles.section}>
          <Facts
            items={[
              {
                key: t("me.distanceTracking"),
                value: (
                  <Tag kind="success" icon="check">
                    {t("me.alwaysOn")}
                  </Tag>
                ),
              },
            ]}
          />
          <p className={styles.helper}>{t("me.gpsNote")}</p>
        </div>
      </Card>

      <Card padded>
        <div className={styles.section}>
          <Facts items={[{ key: t("me.offlineStorage"), value: storage }]} />
        </div>
      </Card>

      <LogOutButton role="driver" label={t("me.logOut")} />
    </DriverShell>
  );
}
