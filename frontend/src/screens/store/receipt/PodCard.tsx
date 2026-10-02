import { Card } from "../../../shared/ui/Card";
import { Facts } from "../../../shared/ui/Facts";
import { Mono } from "../../../shared/ui/Mono";
import type { ProofOfDelivery } from "../../../domain/delivery";
import { PodPhoto } from "../deliveries/PodPhoto";
import styles from "./PodCard.module.css";

export type PodCardProps = {
  proof: ProofOfDelivery;
  /** The photo's height: 140 px on S3.1, a 62 px strip on S3.5. */
  photoHeight?: number;
};

/** The proof of delivery the driver recorded: photo, receiver, time, driver and vehicle (A13). */
export function PodCard({ proof, photoHeight = 140 }: PodCardProps) {
  return (
    <Card>
      <div className={styles.card}>
        <PodPhoto size="block" height={photoHeight} caption={`Photo · ${proof.at} · ${proof.receivedBy}`} />
        <Facts
          ruled
          items={[
            { key: "Received by", value: proof.receivedBy },
            { key: "Time", value: <Mono>{proof.at}</Mono> },
            { key: "Driver", value: <Mono>{`${proof.driver} · ${proof.vehicle}`}</Mono> },
          ]}
        />
      </div>
    </Card>
  );
}
