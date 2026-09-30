import { Icon } from "../../components/ui/Icon";
import { Mono } from "../../components/ui/Mono";
import type { ArrivalRange, Delivery } from "../../domain/delivery";
import { WINDOW_LABEL } from "../../domain/outlet";
import styles from "./ArrivalTile.module.css";

export type ArrivalTileProps = {
  arrival: ArrivalRange;
  vehicle?: string;
  /** Once the truck is out: "Arrives about 05:26" and "Unloading from 05:30" replace the range. */
  onTheWay?: Delivery["onTheWay"];
};

/** The teal tile on a delivery card: "ARRIVES from 05:30", or "ON THE WAY Arrives about 05:26". */
export function ArrivalTile({ arrival, vehicle, onTheWay }: ArrivalTileProps) {
  const windowLine = (
    <p className={styles.window}>
      Window <Mono>{WINDOW_LABEL}</Mono>
      {vehicle && (
        <>
          {" "}
          · <Mono>{vehicle}</Mono>
        </>
      )}
    </p>
  );

  if (onTheWay) {
    return (
      <div className={styles.tile}>
        <p className={styles.label}>
          <Icon name="truck" size={16} />
          On the way
        </p>
        <p className={styles.big}>
          Arrives about <Mono>{onTheWay.arrivesAbout}</Mono>
        </p>
        <p className={styles.unloading}>
          Unloading from <Mono>{onTheWay.unloadingFrom}</Mono>
        </p>
        {windowLine}
      </div>
    );
  }

  return (
    <div className={styles.tile}>
      <p className={styles.label}>Arrives</p>
      <p className={styles.big}>
        from <Mono>{arrival.from}</Mono>
      </p>
      {windowLine}
    </div>
  );
}
