import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, ChartNoAxesCombined, ChevronRight, CircleAlert, Eye, Lock, RefreshCw, Truck, TriangleAlert } from "lucide-react";
import type { CapacityView, DepotId } from "../../../api/DispatcherApi";
import { dayLabel } from "../../../domain/format";
import { Mono } from "../../../shared/ui/Mono";
import { AppBar } from "../chrome/AppBar";
import { PageHeader } from "../chrome/PageHeader";
import { ROUTES, withDepot } from "../chrome/routes";
import { Screen } from "../chrome/Screen";
import { Stepper } from "../chrome/Stepper";
import { useDispatcher } from "../context";
import { useDepot, useLoad } from "../hooks";
import { Banner } from "../ui/Banner";
import { Btn, LinkButton } from "../ui/Btn";
import { Chip } from "../ui/Chip";
import { Skel } from "../ui/Skel";
import { StateBlock } from "../ui/StateBlock";
import { Stat } from "../ui/Stat";
import { BindingCard, PoolCard, SampleCards, SpareCard } from "./CapacityParts";
import { KandyCapacity } from "./KandyCapacity";
import styles from "./Capacity.module.css";

/** D2: supply against demand per scarce resource, naming the binding one (PRD v3 section 3). */
export function CapacityRoute() {
  const { api, scenarioDays } = useDispatcher();
  const navigate = useNavigate();
  const [depot, setDepot] = useDepot();
  const load = useLoad(() => api.getCapacity({ depot }), [depot]);
  const view = load.data;
  const released = view?.plan?.state === "released";
  const planLabel = view?.plan ? `PLAN v${view.plan.number} ${view.plan.state === "released" ? "RELEASED" : "DRAFT"}` : "";
  const overline = `CAPACITY · ${depot.toUpperCase()}${planLabel ? ` · ${planLabel}` : ""}`;

  const toTrips = () => navigate(withDepot(ROUTES.trips, depot));
  const toLive = () => navigate(ROUTES.live);
  const toDeferrals = () => navigate(withDepot(ROUTES.deferrals, depot));

  const header = (
    <PageHeader
      overline={overline}
      title={`Supply vs demand for ${dayLabel(view?.serviceDate ?? scenarioDays.serviceDate)}`}
      actions={
        released ? (
          <Btn variant="routeOutline" iconRight={<ArrowRight size={15} />} onClick={toLive}>
            Open live view
          </Btn>
        ) : (
          <Btn iconRight={<ChevronRight size={16} />} onClick={toTrips} disabled={!view?.plan}>
            Go to trip board
          </Btn>
        )
      }
      reason={
        released ? (
          <>
            <Lock size={13} />
            Released capacity · read-only
          </>
        ) : undefined
      }
    >
      <Stepper current={2} depot={depot} done={released ? [1, 2, 3, 4, 5] : [1]} />
    </PageHeader>
  );

  let body;
  if (load.status === "loading") body = <CapacitySkeleton />;
  else if (load.status === "error" && !view) {
    body = (
      <Banner
        tone="danger"
        icon={<CircleAlert size={20} />}
        title="Capacity couldn't be calculated, fleet data missing."
        actions={
          <Btn variant="secondary" size="sm" icon={<RefreshCw size={15} />} onClick={load.reload}>
            Retry
          </Btn>
        }
      >
        Nothing was changed. The plan and its trips are safe.
      </Banner>
    );
  } else if (view && !view.plan) {
    body = (
      <div className={styles.emptyCard}>
        <StateBlock
          icon={<ChartNoAxesCombined size={23} />}
          title="No plan drafted yet"
          body="Capacity appears after the 16:00 cutoff."
          action={
            <Btn variant="secondary" size="sm" icon={<ArrowLeft size={15} />} onClick={() => navigate(withDepot(ROUTES.queue, depot))}>
              Go to queue
            </Btn>
          }
        />
      </div>
    );
  } else if (view) {
    body = depot === "kandy" ? <KandyCapacity view={view} onPeliyagoda={() => setDepot("peliyagoda")} /> : <PeliyagodaCapacity view={view} onReview={toDeferrals} />;
  }

  return (
    <Screen
      bar={<AppBar current="plan" depot={depot} onDepot={(d: DepotId) => setDepot(d)} {...(released && view?.plan ? { planPill: `Plan v${view.plan.number} · Released` } : {})} />}
      offlineNote="Showing capacity as of {time}, reconnect to refresh."
    >
      <div className={styles.page}>
        {header}
        {body}
      </div>
      {view?.spare && released && (
        <div className={styles.toast} role="status">
          <span className={styles.toastIcon}>
            <Truck size={18} />
          </span>
          <div className={styles.toastText}>
            <b>
              {view.spare.vehicleId} released from workshop at <Mono>{view.spare.since}</Mono>, now available.
            </b>
            <span>{view.spare.label}</span>
          </div>
          <LinkButton onClick={toLive}>Open live view</LinkButton>
        </div>
      )}
    </Screen>
  );
}

function PeliyagodaCapacity({ view, onReview }: { view: CapacityView; onReview: () => void }) {
  const released = view.plan?.state === "released";
  const binding = view.binding;
  return (
    <>
      {released && !view.spare && (
        <Banner
          tone="info"
          icon={<Lock size={17} />}
          title={
            <>
              Released <Mono>v{view.plan?.number ?? 3}</Mono> at <Mono>{view.released?.at ?? "23:40"}</Mono>, changes now go through Live.
            </>
          }
          actions={
            <Chip tone="infoOutline" icon={<Eye size={13} />}>
              Read-only
            </Chip>
          }
        />
      )}
      <Banner
        tone="warning"
        icon={<TriangleAlert size={19} />}
        title={
          view.spare ? (
            <>
              Capacity forced <Mono>{view.deferrals.total}</Mono> deferrals in released plan v3.
            </>
          ) : (
            <>
              Capacity forces <Mono>{view.deferrals.total}</Mono> deferrals at Peliyagoda.
              {released && (
                <>
                  {" "}
                  <Mono>{view.deferrals.capacity}</Mono> has no legal vehicle; policy chose the other <Mono>{view.deferrals.policy}</Mono>.
                </>
              )}
            </>
          )
        }
        actions={
          released ? (
            <Chip tone="warningOutline" icon={view.spare ? undefined : <Lock size={13} />}>
              Released snapshot
            </Chip>
          ) : (
            <Btn variant="warningOutline" size="sm" onClick={onReview}>
              Review deferrals
            </Btn>
          )
        }
      >
        {view.spare ? (
          <span>The new spare is visible, but released trips and deferral choices remain unchanged.</span>
        ) : released ? undefined : (
          <>
            <Mono>{view.deferrals.capacity}</Mono> has no legal vehicle; policy chose the other <Mono>{view.deferrals.policy}</Mono>.
          </>
        )}
      </Banner>
      {released && view.released && !view.spare && (
        <div className={styles.releasedTotals}>
          <Mono>
            <b>
              {view.released.orders} orders · {view.released.served} served · {view.released.deferred} deferred
            </b>
          </Mono>
          <span className={styles.rule} />
          <span className={styles.reason}>
            <Lock size={13} />
            Final released capacity
          </span>
        </div>
      )}
      <div className={styles.stats}>
        <Stat
          label="Reefer Fresh minutes"
          value={binding ? `${binding.percent}%` : "OK"}
          valueTone={binding ? "bad" : undefined}
          foot={binding ? `${binding.overBy} min short` : "Within supply"}
          footTone={binding ? "bad" : undefined}
          footMono
          footIcon={binding ? <CircleAlert size={14} /> : undefined}
        />
        <Stat label="Reefers available" value={`${view.reefers.available} / ${view.reefers.total}`} foot={view.reefers.note} />
        <Stat label="Vehicles available" value={`${view.vehicles.available} / ${view.vehicles.total}`} foot={`${view.vehicles.inWorkshop} in workshop`} footMono />
        <Stat label="Deferrals" value={view.deferrals.total} foot={`${view.deferrals.capacity} capacity · ${view.deferrals.policy} policy`} footMono />
      </div>
      <div className={styles.main}>
        <div className={styles.column}>
          {binding && <BindingCard binding={binding} {...(released ? { snapshot: true } : {})} />}
          <SampleCards view={view} {...(released ? { recorded: true } : {})} />
        </div>
        {view.spare ? (
          <div className={styles.rightStack}>
            <SpareCard spare={view.spare} />
            <PoolCard pool={view.pool} compact />
          </div>
        ) : (
          <PoolCard pool={view.pool} {...(released ? { released: true } : {})} {...(released && view.plan ? { releasedPlan: view.plan.number } : {})} />
        )}
      </div>
    </>
  );
}

function CapacitySkeleton() {
  return (
    <div className={styles.skeleton} aria-busy="true">
      <div className={styles.loadingCaption}>
        <RefreshCw size={17} className={styles.spin} />
        Calculating supply vs demand…
      </div>
      <div className={styles.skelBanner}>
        <Skel w={20} h={20} />
        <div className={styles.skelCol}>
          <Skel w={420} h={11} />
          <Skel w={310} />
        </div>
        <Skel w={96} h={30} />
      </div>
      <div className={styles.stats}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.skelStat}>
            <Skel w={150} />
            <Skel w={112} h={28} />
            <Skel w={205} />
          </div>
        ))}
      </div>
      <div className={styles.main}>
        <div className={styles.column}>
          <div className={styles.skelBinding}>
            <div className={styles.skelRow}>
              <Skel w={230} h={16} />
              <Skel w={64} h={22} />
            </div>
            <Skel w={360} h={12} />
            <Skel w={280} h={28} />
            <div className={styles.skelMeter} />
            <Skel w="100%" h={12} />
          </div>
          <div className={styles.samples}>
            {[0, 1].map((i) => (
              <div key={i} className={styles.skelSample}>
                <div className={styles.skelRow}>
                  <Skel w={170} h={16} />
                  <Skel w={64} h={22} />
                </div>
                <Skel w={190} h={12} />
                <Skel w={150} h={23} />
                <div className={styles.skelMeter} style={{ height: 10 }} />
              </div>
            ))}
          </div>
        </div>
        <div className={styles.skelSide}>
          <div className={styles.skelRow}>
            <Skel w={170} h={11} />
            <Skel w={60} h={18} />
          </div>
          <Skel w={230} h={24} />
          <Skel w={142} h={28} />
          <Skel w="100%" h={12} />
          <Skel w={248} h={12} />
        </div>
      </div>
    </div>
  );
}
