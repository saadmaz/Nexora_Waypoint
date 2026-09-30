import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { Icon } from "./Icon";
import styles from "./Sheet.module.css";

export type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  /** Rendered inline, so a trigger element does not have to wrap this. */
  trigger?: ReactNode;
};

/**
 * A bottom sheet, built on Radix Dialog: traps focus, closes on Esc and on
 * the scrim, and returns focus to the control that opened it. Used for
 * S1.2 review, S1.3 B edit order, S3.3 report issue.
 */
export function Sheet({ open, onOpenChange, title, children, trigger }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.content}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            // Focus the sheet, not its close button, so no ring is drawn on open; Tab still reaches everything.
            event.preventDefault();
            (event.currentTarget as HTMLElement).focus();
          }}
        >
          <div className={styles.grip} aria-hidden />
          <div className={styles.header}>
            <Dialog.Title className={styles.title}>{title}</Dialog.Title>
            <Dialog.Close className={styles.close} aria-label="Close">
              <Icon name="x" size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
