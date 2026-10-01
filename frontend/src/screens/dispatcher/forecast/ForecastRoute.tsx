import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, ChartNoAxesCombined, CircleAlert, Eye, Info, RefreshCw } from "lucide-react";
import { DEPOT_NAME, type ForecastWeek } from "../../../api/DispatcherApi";
import { AppBar } from "../chrome/AppBar";
import { PageHeader } from "../chrome/PageHeader";
import { Screen } from "../chrome/Screen";
import { useDispatcher } from "../context";
import { useDepot, useLoad } from "../hooks";
import { Banner } from "../ui/Banner";
import { Btn } from "../ui/Btn";
import { Chip } from "../ui/Chip";
import { cx } from "../ui/cx";
import { Skel } from "../ui/Skel";
import { StateBlock } from "../ui/StateBlock";
import styles from "./Forecast.module.css";

/** The bar runs to 140% of usable capacity, so the 100% mark sits at the same place in every row. */
const SCALE = 140;

/** D9: which weeks will be short. A view only: nothing here changes the plan (PRD v3 section 12, D9 baseline). */
export function ForecastRoute() {
  const { api } = useDispatcher();
  const [depot, setDepot] = useDepot();
  const [params, setParams] = useSearchParams();
  const load = useLoad(() => api.getForecast({ depot }), [depot]);
  const view = load.data;
  const [picked, setPicked] = useState<string | null | undefined>(undefined);

  // The week with a gap is open by default (D9.2); `?week=none` shows the list alone (D9.1).
  const fromUrl = params.get("week");
  const defaultWeek = view?.weeks.find((w) => w.gap)?.monday ?? null;
  const open = picked !== undefined ? picked : fromUrl === "none" ? null : (fromUrl ?? defaultWeek);
  const select = (monday: string) => {
    setPicked(open === monday ? null : monday);
    if (params.has("week")) {
      const next = new URLSearchParams(params);
      next.delete("week");
      setParams(next, { replace: true });
    }
  };

  let body;
  if (load.status === "loading") {
    body = (
      <div aria-hidden style={{ display: "contents" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.skelRow}>
            <Skel w={90} h={12} />
            <Skel w={420} h={14} />
            <Skel w={60} h={20} />
          </div>
        ))}
      </div>
    );
  } else if (load.status === "error" && !view) {
    body = (
      <StateBlock
        icon={<CircleAlert size={24} />}
        tone="danger"
        title="Couldn't load the forecast"
        body="Nothing was changed. The plan is safe."
        action={
          <Btn variant="secondary" icon={<RefreshCw size={16} />} onClick={load.reload}>
            Retry
          </Btn>
        }
      />
    );
  } else if (view && view.weeks.length === 0) {
    body = (
      <StateBlock
        icon={<ChartNoAxesCombined size={24} />}
        title="No forecast yet"
        body="The forecast needs a few weeks of delivered orders. Nothing was changed."
      />
    );
  } else if (view) {
    body = (
      <>
        <Banner tone="info" icon={<Info size={19} />} title={view.label + "."}>
          Weeks are ISO weeks labelled by their Monday. Over 100% means some orders will wait unless capacity moves.
        </Banner>
        {view.weeks.map((w) => (
          <Week key={w.monday} week={w} open={open === w.monday} onToggle={() => select(w.monday)} />
        ))}
      </>
    );
  }

  return (
    <Screen
      bar={<AppBar current="forecast" depot={depot} onDepot={setDepot} />}
      offlineNote="Offline. The forecast shows what it had at {time}."
    >
      <div className={styles.page}>
        <PageHeader
          overline={view ? `FORECAST · NEXT 4 WEEKS · ${DEPOT_NAME[depot].toUpperCase()} · AS OF ${view.asOf.toUpperCase()}` : "FORECAST"}
          title="Forecast: which weeks will be short"
          actions={
            <Chip tone="outlineInk" small icon={<Eye size={13} />}>
              View only
            </Chip>
          }
        />
        {body}
      </div>
    </Screen>
  );
}

function Week({ week, open, onToggle }: { week: ForecastWeek; open: boolean; onToggle: () => void }) {
  const tone = week.status === "Short" ? styles.short : styles.tight;
  const hasDetail = Boolean(week.gap || week.days || week.levers);
  return (
    <div className={cx(styles.week, tone)}>
      <button type="button" className={cx(styles.row, open && styles.selected)} aria-expanded={hasDetail ? open : undefined} onClick={onToggle}>
        <span className={styles.weekLabel}>
          <span>Week of</span>
          <b>{week.monday.replace(/^\w+ /, "Mon ")}</b>
        </span>
        <span className={styles.barBlock}>
          <span className={styles.bar} role="meter" aria-valuenow={week.percent} aria-valuemin={0} aria-valuemax={SCALE} aria-label={`Reefer demand ${week.percent}% of usable capacity`}>
            <span className={styles.fill} style={{ display: "block", width: `${Math.min(100, (week.percent / SCALE) * 100)}%` }} />
            <span className={styles.mark} style={{ left: `${(100 / SCALE) * 100}%` }} aria-hidden />
          </span>
          <span className={styles.barLabel}>Reefer demand vs usable capacity</span>
        </span>
        <span className={styles.percent}>{week.percent}%</span>
        <span className={styles.flags}>
          {week.flags.length === 0
            ? "No calendar flags"
            : week.flags.map((f) => (
                <Chip key={f} tone="outlineInk" small icon={<CalendarDays size={13} />}>
                  {f}
                </Chip>
              ))}
        </span>
        <span className={styles.verdict}>
          <b>{week.status}</b>
          {week.lever}
        </span>
      </button>
      {open && hasDetail && (
        <div className={styles.detail}>
          {week.gap && (
            <section className={styles.panel} aria-label="Gap">
              <span className={styles.overline}>Gap</span>
              <span className={styles.gapFigure}>~{week.gap.minutes} min</span>
              <span className={styles.gapNote}>
                <CircleAlert size={14} />
                reefer Fresh minutes short
              </span>
            </section>
          )}
          {week.days && (
            <section className={styles.panel} aria-label="Days">
              <span className={styles.overline}>Days</span>
              <div className={styles.days}>
                {week.days.map((d) => (
                  <span key={d.day} className={cx(styles.day, d.flag && styles.dayFlag)}>
                    {d.day}
                    {d.flag && <small>{d.flag}</small>}
                  </span>
                ))}
              </div>
            </section>
          )}
          {week.levers && (
            <section className={cx(styles.panel, styles.levers)} aria-label="Levers">
              <span className={styles.overline}>Levers (notes: nothing here changes the plan)</span>
              <ul>
                {week.levers.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
