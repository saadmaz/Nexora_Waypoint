import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { colomboMs, formatTime } from "../../../field/clock/clock";
import { runDate } from "../../../field/clock/runDate";
import { useNow } from "../../../field/clock/useClock";
import { PinSheet, type ChipStatus } from "../../../field/components";
import {
  compressImage,
  runSync,
  saveBlob,
  useConnectivity,
  useFieldQuery,
  useOutbox,
} from "../../../field/offline";
import { Mono } from "../../../shared/ui/Mono";
import { usePeople } from "../usePeople";
import { useLoader } from "../LoaderContext";
import type { ExceptionView, LoadPlanView } from "../types";
import { FlagSheet, type FlagOrder, type FlagPrefill, type FlagSentModel, type FlagSubmit } from "./FlagSheet";
import { FlagStatus } from "./FlagStatus";
import { flagDetail, flagSummary } from "./flagOptions";

type Props = {
  vehicleId: string;
  trip: 1 | 2;
  view: LoadPlanView;
  /** "Peliyagoda", without "dock": the queued and failed screens print the name that way. */
  dockName: string;
  chip: { status: ChipStatus; time?: string; count?: number };
  /** Close the sheet and go back to the load plan. */
  onClose: () => void;
};

type Delivery = "none" | "sending" | "queued" | "failed" | "sent";

/** Who reviews a flag. Dispatch decides, so the sheet names the desk, not a person. */
const REVIEWER = "Dispatch";

/**
 * Wires L3 to the loader API and the outbox. The flag is saved on the tablet first (`flagException`
 * enqueues it), and what the screen shows follows that outbox record: waiting while online is
 * "sending" (L3.4 C), waiting while offline is "saved on this tablet" (L3.4 A), an error is
 * "couldn't send" (L3.4 B), accepted is "sent" (L3.3 A) and, once Dispatch decides, L3.3 B.
 */
export function FlagContainer({ vehicleId, trip, view, dockName, chip, onClose }: Props) {
  const { api, dockId, currentPerson, setCurrentPerson } = useLoader();
  const people = usePeople();
  const navigate = useNavigate();
  const now = useNow();
  const connectivity = useConnectivity();
  const outbox = useOutbox();
  const prefill = (useLocation().state as FlagPrefill | null) ?? undefined;

  const [pinOpen, setPinOpen] = useState(false);
  const [pending, setPending] = useState<FlagSubmit | null>(null);
  const [submitted, setSubmitted] = useState<{ submit: FlagSubmit; by: string; at: string } | null>(null);
  const [exceptionId, setExceptionId] = useState<string | null>(null);
  const [exception, setException] = useState<ExceptionView | undefined>();

  // What a failed vehicle check covers: every order on the vehicle across its trips (L3.2 A).
  const dock = useFieldQuery(`loader:dock:${dockId}`, useCallback(() => api.getDock(dockId), [api, dockId]));
  const summary = dock.status === "ready" ? dock.value.vehicles.find((v) => v.vehicle.id === vehicleId) : undefined;
  const scope = { orders: summary?.orderCount ?? view.orders.length, trips: summary?.trips ?? 1 };

  const orders: FlagOrder[] = view.orders.map((o) => ({
    orderId: o.orderId,
    outletId: o.outletId,
    units: o.unitsExpected,
    chilled: o.temperature === "chilled",
  }));

  // Dispatch's side changes over time (seen, decided), so the sheet follows it. Plain polling, not
  // `useFieldQuery.retry`, which would blank the sheet on every read.
  useEffect(() => {
    if (!exceptionId) return;
    let alive = true;
    const read = () =>
      void api
        .getException(exceptionId)
        .then((next) => alive && setException(next))
        .catch(() => undefined);
    read();
    const id = window.setInterval(read, 2000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [api, exceptionId]);

  const record = exceptionId
    ? outbox.find((r) => r.type === "loader.exception" && (r.payload as { id?: string } | null)?.id === exceptionId)
    : undefined;
  const online = connectivity.status !== "offline";

  let delivery: Delivery = "none";
  if (exceptionId) {
    if (!record) delivery = "sending";
    else if (record.status === "accepted" || record.status === "conflict") delivery = "sent";
    else if (record.status === "error" || connectivity.status === "failed") delivery = "failed";
    else delivery = online ? "sending" : "queued";
  }

  // The flag as it stands: Dispatch's copy once read, the loader's own words until then.
  const shown: ExceptionView | undefined =
    exception ??
    (submitted
      ? {
          id: exceptionId ?? "",
          type: submitted.submit.type,
          vehicleId,
          trip,
          orderIds: submitted.submit.orderIds,
          unitsShort: submitted.submit.unitsShort,
          note: submitted.submit.note,
          reason: submitted.submit.reason,
          raisedBy: submitted.by,
          raisedAt: submitted.at,
          status: "reviewing",
        }
      : undefined);

  const decided = shown?.status === "decided";
  const sent: FlagSentModel | undefined = shown
    ? {
        at: shown.raisedAt ?? formatTime(now),
        summary: flagSummary(shown),
        held: shown.type === "Vehicle check failed",
        vehicleId,
        reviewer: REVIEWER,
        seenAt: shown.seenAt,
        decidedVersion: decided ? shown.decidedVersion : undefined,
      }
    : undefined;

  const minutes = Math.max(0, Math.round((colomboMs(runDate(), view.departsAt) - now) / 60_000));
  const overlay = delivery === "queued" || delivery === "failed";

  const send = async (submit: FlagSubmit, personId: string, personName: string) => {
    let blobIds: string[] | undefined;
    if (submit.photo) {
      try {
        const blob = await compressImage(submit.photo);
        blobIds = [await saveBlob({ kind: "photo", blob })];
      } catch {
        // A photo that will not compress must not stop the flag itself reaching Dispatch.
        blobIds = undefined;
      }
    }
    setSubmitted({ submit, by: personName, at: formatTime(now) });
    const id = await api.flagException({
      type: submit.type,
      vehicleId,
      trip,
      orderIds: submit.orderIds,
      unitsShort: submit.unitsShort,
      note: submit.note,
      reason: submit.reason,
      blobIds,
      personId,
      personName,
    });
    setExceptionId(id);
  };

  const toDock = () => navigate("/loader/dock");

  return (
    <>
      <FlagSheet
        // The PIN sheet takes over while it is open. Radix would read its opening as an outside tap and dismiss this
        // sheet, so hide it instead: the form keeps what was filled in, and a cancelled PIN comes back to it.
        open={!overlay && !pinOpen}
        onOpenChange={() => undefined}
        vehicleId={vehicleId}
        trip={trip}
        time={formatTime(now)}
        orders={orders}
        scope={scope}
        prefill={prefill}
        phase={delivery === "sending" ? "sending" : delivery === "sent" ? (decided ? "decided" : "sent") : "form"}
        sent={sent}
        onSend={(submit) => {
          setPending(submit);
          setPinOpen(true);
        }}
        onCancel={onClose}
        onBackToList={toDock}
        onReview={() => navigate("/loader/changes")}
      />

      <PinSheet
        open={pinOpen}
        onOpenChange={setPinOpen}
        title={`Send flag for ${vehicleId}`}
        whoLabel="Who's flagging?"
        people={people}
        verify={(personId, pin, otherName) => api.verifyPin(personId, pin, otherName)}
        onConfirmed={(personId, name) => {
          setCurrentPerson({ id: personId, name });
          setPinOpen(false);
          if (pending) void send(pending, personId, name);
        }}
        confirmedText={(name) => `Flag from ${name}`}
        initialPersonId={currentPerson?.id}
      />

      {overlay && shown && (
        <FlagStatus
          kind={delivery === "queued" ? "queued" : "failed"}
          vehicleId={vehicleId}
          dockName={dockName}
          departsAt={view.departsAt}
          planVersion={view.planVersion}
          connectivity={chip}
          minutesToDeparture={minutes}
          typeLabel={shown.type}
          detail={detailNode(shown, scope)}
          held={shown.type === "Vehicle check failed"}
          onRetry={() => void runSync({ force: true })}
          onCallDispatch={() => undefined}
          onKeepWaiting={toDock}
        />
      )}
    </>
  );
}

/** "Reefer not holding temperature · All 9 orders on VEH003 (2 trips)", with the vehicle ID in Plex Mono as drawn. */
function detailNode(ex: ExceptionView, scope: { orders: number; trips: number }) {
  if (ex.type !== "Vehicle check failed") return flagDetail(ex, scope);
  return (
    <>
      {ex.reason} · All {scope.orders} orders on <Mono>{ex.vehicleId}</Mono> ({scope.trips} trip{scope.trips === 1 ? "" : "s"})
    </>
  );
}
