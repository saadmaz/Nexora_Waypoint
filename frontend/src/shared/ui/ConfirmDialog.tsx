import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { useTheme } from "../theme";
import { Button } from "./Button";
import styles from "./ConfirmDialog.module.css";

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  /** The destructive action, verb plus object: "Log out anyway". */
  confirmLabel: string;
  /** The safe way back: "Keep working". */
  cancelLabel: string;
  onConfirm: () => void;
  busy?: boolean;
};

/**
 * The one "are you sure" dialog for every role. It renders in a portal, so it takes its role's
 * theme from context, as the field bottom sheet does; otherwise it would draw in Light on the
 * dark loader and the driver's field theme. Cancel takes focus first, so Enter never confirms
 * a destructive action by accident.
 */
export function ConfirmDialog({ open, onOpenChange, title, children, confirmLabel, cancelLabel, onConfirm, busy }: ConfirmDialogProps) {
  const theme = useTheme();
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} data-theme={theme} />
        <Dialog.Content className={styles.content} data-theme={theme} role="alertdialog">
          <Dialog.Title className={styles.title}>{title}</Dialog.Title>
          <Dialog.Description asChild>
            <div className={styles.body}>{children}</div>
          </Dialog.Description>
          <div className={styles.actions}>
            <Dialog.Close asChild>
              <Button variant="secondary" size="medium" auto disabled={busy}>
                {cancelLabel}
              </Button>
            </Dialog.Close>
            <Button variant="dangerOutline" size="medium" auto busy={busy} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
