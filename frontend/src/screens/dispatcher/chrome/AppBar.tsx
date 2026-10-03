import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChartNoAxesCombined, ClipboardList, ClockArrowDown, Lock, Radio, WifiOff } from "lucide-react";
import { DEPOT_NAME, type DepotId } from "../../../api/DispatcherApi";
import { dayLabel } from "../../../domain/format";
import { toIsoDate } from "../../../domain/schedule";
import { clockTime } from "../../../domain/format";
import { AccountMenu } from "../../auth/AccountMenu";
import { useDispatcher } from "../context";
import { useLoad, useNow } from "../hooks";
import { cx } from "../ui/cx";
import styles from "./AppBar.module.css";
import { ROUTES, withDepot } from "./routes";

export type NavKey = "plan" | "live" | "deferrals" | "forecast";

type DepotOption = DepotId | "both";

export type AppBarProps = {
  current: NavKey;
  depot: DepotId;
  onDepot: (next: DepotId) => void;
  /** Live shows both depots at once, so its switch has a third choice. */
  depotChoice?: { value: DepotOption; onChange: (next: DepotOption) => void };
  /** Released-plan frames show the plan in place of the depot switch. */
  planPill?: string;
  /** What follows the date: "Peliyagoda", "Kandy", or nothing on Live. */
  place?: string;
};

function Diamond() {
  return <img className={styles.diamond} src="/nexora-logo.svg" alt="" aria-hidden="true" />;
}

/** The Deferrals badge counts what the current plan defers at the depot. */
function useDeferralCount(depot: DepotId): number {
  const { api } = useDispatcher();
  const load = useLoad(() => api.listDeferrals({ depot }), [depot]);
  return load.data?.counts.total ?? 0;
}

/** Waypoint Dispatch: the desktop app bar (PRD v3 section 3). The mark names this app, never Waypoint Store or Load (cross-role X3). */
export function AppBar({ current, depot, onDepot, depotChoice, planPill, place }: AppBarProps) {
  const now = useNow();
  const { offline } = useDispatcher();
  const deferrals = useDeferralCount(depot);

  const nav: { key: NavKey; label: string; to: string; icon: ReactNode }[] = [
    { key: "plan", label: "Plan", to: withDepot(ROUTES.queue, depot), icon: <ClipboardList size={16} /> },
    { key: "live", label: "Live", to: ROUTES.live, icon: <Radio size={16} /> },
    { key: "deferrals", label: "Deferrals", to: withDepot(ROUTES.deferrals, depot), icon: <ClockArrowDown size={16} /> },
    { key: "forecast", label: "Forecast", to: withDepot(ROUTES.forecast, depot), icon: <ChartNoAxesCombined size={16} /> },
  ];

  const context = `${clockTime(now)} ${dayLabel(toIsoDate(now))}${place === "" ? "" : ` · ${place ?? DEPOT_NAME[depot]}`}`;
  const choices: { value: DepotOption; label: string }[] = depotChoice
    ? [
        { value: "both", label: "Both" },
        { value: "peliyagoda", label: "Peliyagoda" },
        { value: "kandy", label: "Kandy" },
      ]
    : [
        { value: "peliyagoda", label: "Peliyagoda" },
        { value: "kandy", label: "Kandy" },
      ];
  const selected: DepotOption = depotChoice ? depotChoice.value : depot;

  return (
    <header className={styles.appbar}>
      <Link to={ROUTES.queue} className={styles.brand} aria-label="Waypoint Dispatch home">
        <Diamond />
        <span>
          <b>Waypoint</b> Dispatch
        </span>
      </Link>
      <nav className={styles.nav} aria-label="Primary">
        {nav.map((item) => (
          <Link
            key={item.key}
            to={item.to}
            className={cx(styles.navItem, current === item.key && styles.current)}
            aria-current={current === item.key ? "page" : undefined}
          >
            <span className={styles.navLabel}>
              {item.icon}
              {item.label}
              {item.key === "deferrals" && deferrals > 0 ? <span className={styles.count}>{deferrals}</span> : null}
            </span>
            <span className={styles.navBar} />
          </Link>
        ))}
      </nav>
      <div className={styles.context}>
        <span className={styles.meta}>{context}</span>
        {planPill ? (
          <span className={styles.planPill}>
            <Lock size={13} />
            {planPill}
          </span>
        ) : (
          <div className={styles.depot} role="radiogroup" aria-label="Depot">
            {choices.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={selected === c.value}
                className={cx(selected === c.value && styles.depotOn)}
                onClick={() => {
                  if (depotChoice) depotChoice.onChange(c.value);
                  else if (c.value !== "both") onDepot(c.value);
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
        {offline ? (
          <span className={cx(styles.sync, styles.syncOffline)}>
            <WifiOff size={13} />
            Offline
          </span>
        ) : (
          <span className={styles.sync}>
            <span className={styles.syncDot} />
            Live sync
          </span>
        )}
        <AvatarMenu />
      </div>
    </header>
  );
}

/** The avatar menu: where the presenter control is switched on (PRD v3 section 16, open decision O-5), and Log out. */
function AvatarMenu() {
  const { presenter, setPresenter } = useDispatcher();
  return (
    <AccountMenu role="dispatcher">
      <label className={styles.menuItem} role="menuitemcheckbox" aria-checked={presenter}>
        <input type="checkbox" checked={presenter} onChange={(event) => setPresenter(event.target.checked)} />
        Presenter control
      </label>
    </AccountMenu>
  );
}
