import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import styles from "./Drawer.module.css";

export type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The accessible name of the drawer (its heading is inside `children`). */
  label: string;
  width?: number;
  children: ReactNode;
};

/** A panel from the right edge (D1.5 order history, D4.2 deferral detail): the page stays visible behind a scrim. */
export function Drawer({ open, onOpenChange, label, width = 480, children }: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.scrim} />
        <Dialog.Content
          className={styles.drawer}
          style={{ width }}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement).focus();
          }}
        >
          <Dialog.Title className={styles.hidden}>{label}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const DrawerClose = Dialog.Close;
