import { useState, type ReactNode } from "react";
import { RoleRoot, type Theme } from "../../shared/RoleRoot";
import { Alert, type AlertTone } from "../../shared/ui/Alert";
import { Button } from "../../shared/ui/Button";
import { Mono } from "../../shared/ui/Mono";
import { StateScreen, LoadingSkeleton } from "../../shared/ui/StateScreen";
import { StatusPill } from "../../shared/ui/StatusPill";
import { Tag } from "../../shared/ui/Tag";
import {
  BottomSheet,
  ChoiceChips,
  ConnectivityChip,
  DriverStopCard,
  FieldSwitch,
  FieldTabBar,
  FieldTopBar,
  LoaderCheckCard,
  NotificationBell,
  OfflineBanner,
  PinnedActionBar,
  PinSheet,
  UnitsStepper,
} from "../components";
import styles from "./ComponentGallery.module.css";

const THEMES: { theme: Theme; name: string }[] = [
  { theme: "dark", name: "Dark · pre-dawn" },
  { theme: "field", name: "Field · sunlight" },
  { theme: "light", name: "Light · office" },
];

const PEOPLE = [
  { id: "priya", name: "Priya" },
  { id: "ruwan", name: "Ruwan" },
];

/** The two demo PINs of the loader tablet (README of the loader app). The gallery stands in for the server. */
const DEMO_PINS: Record<string, string> = { priya: "1234", ruwan: "5678", other: "0000" };

const ALERT_TONES: AlertTone[] = ["info", "success", "warning", "issue", "offline", "conflict"];

/**
 * Dev-only: every field component, every variant, in all three themes side by side
 * (`/field/_components`). Not linked from the product. The sample values are the hero data of the
 * frames (field conventions section 9), typed here because this page is a catalogue, not a screen.
 */
export function ComponentGallery() {
  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>Field components</h1>
      <p className={styles.lede}>
        Top bar, connectivity chip, banner, tab bar, sheets, PIN sheet, pinned action bar, steppers, order cards,
        switch, choice chips, alerts, pills, tags and states. Shown in Dark, Field and Light.
      </p>
      <div className={styles.columns}>
        {THEMES.map(({ theme, name }) => (
          <section key={theme} className={styles.column} aria-label={name}>
            <h2 className={styles.themeName}>{name}</h2>
            <RoleRoot theme={theme} className={styles.panel} fill={false}>
              <ThemePanel />
            </RoleRoot>
          </section>
        ))}
      </div>
    </main>
  );
}

function ThemePanel() {
  const [pinOpen, setPinOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [units, setUnits] = useState(12);
  const [sunlight, setSunlight] = useState(false);
  const [size, setSize] = useState<"standard" | "large">("standard");
  const [language, setLanguage] = useState<"en" | "si" | "ta">("en");
  const [tab, setTab] = useState("run");
  const [confirmed, setConfirmed] = useState<string | null>(null);

  return (
    <div className={styles.stack}>
      <Block title="Top bar">
        <FieldTopBar
          title="Load lists"
          subtitle={
            <>
              Kandy dock · <Mono>04:14</Mono>
            </>
          }
        >
          <ConnectivityChip status="synced" size="tablet" />
        </FieldTopBar>
        <FieldTopBar
          title="Deliver · Stop 1"
          subtitle={<Mono>OUT084</Mono>}
          onBack={() => undefined}
        >
          <NotificationBell count={2} />
          <ConnectivityChip status="offline" count={1} onClick={() => undefined} />
        </FieldTopBar>
      </Block>

      <Block title="Connectivity chip">
        <div className={styles.wrap}>
          <ChromeStrip>
            <ConnectivityChip status="online" />
            <ConnectivityChip status="synced" time="04:54" />
            <ConnectivityChip status="offline" />
            <ConnectivityChip status="offline" count={5} />
            <ConnectivityChip status="syncing" />
            <ConnectivityChip status="failed" time="06:42" />
          </ChromeStrip>
          <ChromeStrip>
            <ConnectivityChip status="synced" time="04:54" size="tablet" />
            <ConnectivityChip status="offline" count={5} size="tablet" />
            <ConnectivityChip status="syncing" size="tablet" />
          </ChromeStrip>
        </div>
      </Block>

      <Block title="Offline banner">
        <OfflineBanner detail={<>Last sync <Mono>05:17</Mono></>}>
          Offline · <Mono>1</Mono> saved on phone
        </OfflineBanner>
        <OfflineBanner compact>
          Offline · last sync <Mono>05:17</Mono> · <Mono>0</Mono> waiting
        </OfflineBanner>
        <OfflineBanner tone="online">Back online · all changes sent <Mono>05:44</Mono></OfflineBanner>
        <OfflineBanner tone="syncing">Reconnecting… sending 3 changes</OfflineBanner>
        <OfflineBanner tone="waiting" action={{ label: "Retry now", onClick: () => undefined }}>
          2 changes waiting to send
        </OfflineBanner>
        <OfflineBanner tone="conflict" action={{ label: "Review", onClick: () => undefined }}>
          <Mono>ORD2001</Mono> + <Mono>ORD2002</Mono> changed at the office while you were offline
        </OfflineBanner>
      </Block>

      <Block title="Tab bar">
        <FieldTabBar
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "run", label: "Run", icon: "route" },
            { key: "issues", label: "Issues", icon: "alert-circle", badge: 1 },
            { key: "history", label: "History", icon: "history" },
            { key: "me", label: "Me", icon: "user" },
          ]}
        />
      </Block>

      <Block title="Order cards: loader check">
        <div className={styles.cards}>
          <LoaderCheckCard
            outletId="OUT087"
            orderId="ORD2003"
            orderIdIn="quantity"
            loadNumber={1}
            stopNumber={2}
            brand="Fresh"
            chilled={false}
            dock="Rear dock"
            unitsLoaded={9}
            unitsExpected={9}
            state="checked"
          />
          <LoaderCheckCard
            outletId="OUT084"
            orderId="ORD2001"
            loadNumber={3}
            stopNumber={1}
            brand="Fresh"
            chilled
            dock="Rear dock"
            unitsLoaded={0}
            unitsExpected={12}
            state="todo"
          >
            <Button icon="check">Load 12 units</Button>
          </LoaderCheckCard>
          <LoaderCheckCard
            outletId="OUT084"
            orderId="ORD2001"
            loadNumber={3}
            stopNumber={1}
            brand="Fresh"
            chilled
            dock="Rear dock"
            unitsLoaded={10}
            unitsExpected={12}
            state="short"
          />
        </div>
      </Block>

      <Block title="Order card: driver stop">
        <div className={styles.cards}>
          <DriverStopCard
            current
            stopNumber={1}
            outletId="OUT084"
            outletName="Waypoint Fresh"
            schedule={
              <>
                ETA <Mono>05:26</Mono> · Window <Mono>05:30-08:00</Mono>
              </>
            }
            place="Kandy · Rear dock · normal parking"
            tags={
              <>
                <Tag kind="warn" icon="clock">
                  Will wait 4 min
                </Tag>
                <Tag kind="chilled">Chilled</Tag>
              </>
            }
            orders={
              <>
                2 orders · <Mono>ORD2001</Mono> 12 · <Mono>ORD2002</Mono> 8
              </>
            }
            actions={
              <>
                <Button icon="map-pin">Arrive</Button>
                <div className={styles.pair}>
                  <Button variant="secondary" size="medium" icon="navigation">
                    Navigate
                  </Button>
                  <Button variant="secondary" size="medium" icon="alert-triangle">
                    Problem
                  </Button>
                </div>
              </>
            }
          />
          <DriverStopCard
            stopNumber={2}
            outletId="OUT087"
            outletName="Waypoint Fresh"
            schedule={
              <>
                ETA <Mono>06:06</Mono> · Window <Mono>03:00-08:00</Mono>
              </>
            }
            place="Kandy · Rear dock · normal parking"
            orders={
              <>
                1 order · <Mono>ORD2003</Mono> 9
              </>
            }
          />
        </div>
      </Block>

      <Block title="Units stepper">
        <UnitsStepper value={units} onChange={setUnits} expected={12} label="units of ORD2001" />
      </Block>

      <Block title="Switch and choice chips (R1.9)">
        <div className={styles.settings}>
          <div className={styles.settingRow}>
            <span>Screen for bright sunlight</span>
            <FieldSwitch checked={sunlight} onCheckedChange={setSunlight} label="Screen for bright sunlight" />
          </div>
          <ChoiceChips
            label="Text size"
            fill
            value={size}
            onChange={setSize}
            options={[
              { key: "standard", label: "Standard" },
              { key: "large", label: "Large" },
            ]}
          />
          <ChoiceChips
            label="Language"
            value={language}
            onChange={setLanguage}
            options={[
              { key: "en", label: "English", lang: "en" },
              { key: "si", label: "සිංහල", lang: "si" },
              { key: "ta", label: "தமிழ்", lang: "ta" },
            ]}
          />
        </div>
      </Block>

      <Block title="Alerts">
        <div className={styles.cards}>
          {ALERT_TONES.map((tone) => (
            <Alert key={tone} tone={tone}>
              {tone === "conflict" ? "Office changed this, review" : `A ${tone} alert, in one or two lines.`}
            </Alert>
          ))}
        </div>
      </Block>

      <Block title="Status pills and tags">
        <div className={styles.wrap}>
          <StatusPill status="Planned" role="loader" />
          <StatusPill status="Loaded" role="loader" />
          <StatusPill status="Departed" role="driver" />
          <StatusPill status="Delivered" role="driver" />
          <StatusPill status="Issue" role="driver" />
          <StatusPill status="Pending sync" role="driver" />
          <StatusPill status="Conflict" role="driver" />
          <StatusPill status="Deferred" role="loader" deferral={{ type: "policy", nextRunShort: "Wed" }} />
        </div>
        <div className={styles.wrap}>
          <Tag kind="danger" icon="alert-circle">
            Held
          </Tag>
          <Tag kind="warn" icon="clock">
            Waiting
          </Tag>
          <Tag kind="info" icon="lock">
            Protected
          </Tag>
          <Tag kind="chilled">Chilled zone</Tag>
          <Tag kind="fresh">Fresh</Tag>
          <Tag kind="ambient">Ambient</Tag>
        </div>
      </Block>

      <Block title="States">
        <StateScreen
          icon="wifi-off"
          bg="offline-soft"
          fg="offline"
          title="You are offline"
          body="Your checks are saved on this tablet and send when the connection returns."
          actions={<Button variant="secondary">Retry now</Button>}
        />
        <LoadingSkeleton rows={3} />
      </Block>

      <Block title="Pinned action bar">
        <PinnedActionBar helper={<>Check <Mono>ORD2001</Mono> or flag an issue first</>}>
          <Button variant="dangerOutline" icon="flag">
            Flag issue
          </Button>
          <Button variant="secondary" icon="check" disabled>
            Confirm loaded: clear to depart
          </Button>
        </PinnedActionBar>
      </Block>

      <Block title="Sheets">
        <div className={styles.wrap}>
          <Button auto variant="secondary" size="medium" onClick={() => setSheetOpen(true)}>
            Open bottom sheet
          </Button>
          <Button auto size="medium" onClick={() => setPinOpen(true)}>
            Open PIN sheet
          </Button>
        </div>
        {confirmed && <p className={styles.note}>Confirmed: {confirmed}</p>}
        <BottomSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title="Stop 1 · OUT084"
          description="Arrive 05:26 · window 05:30-08:00"
        >
          <Button variant="secondary" icon="phone">
            Call store
          </Button>
          <Button variant="secondary" icon="alert-triangle">
            Report issue
          </Button>
          <Button variant="ghost" onClick={() => setSheetOpen(false)}>
            Close
          </Button>
        </BottomSheet>
        <PinSheet
          open={pinOpen}
          onOpenChange={setPinOpen}
          title="Acknowledge plan v4 at Kandy dock"
          people={PEOPLE}
          whoLabel="Who's acknowledging?"
          verify={async (personId, pin) => DEMO_PINS[personId] === pin}
          confirmedText={(name) => (
            <>
              Acknowledged by {name} · <Mono>04:15</Mono>
            </>
          )}
          onConfirmed={(_id, name) => {
            setConfirmed(name);
            setPinOpen(false);
          }}
        />
      </Block>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.block}>
      <h3 className={styles.blockTitle}>{title}</h3>
      {children}
    </section>
  );
}

function ChromeStrip({ children }: { children: ReactNode }) {
  return <div className={styles.chrome}>{children}</div>;
}
