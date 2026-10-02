import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { useTheme } from "../../shared/theme";
import { useSheetEnvironment } from "./sheetEnvironment";
import styles from "./BottomSheet.module.css";

export type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** The sentence under the title. Read out by screen readers as the sheet's description. */
  description?: ReactNode;
  children: ReactNode;
  /** Full-bleed body (R4 Outbox): no side padding or gap, so rows and bars run edge to edge. */
  flush?: boolean;
  /** Right-aligned text on the title row, for example the clock time on the Outbox. */
  headerAside?: ReactNode;
};

/**
 * The field bottom sheet (LIB6, L1.2, L3, R4, R6): scrim, a 36 px grabber, a 22 px title and a 15 px
 * description. Built on Radix Dialog, so it traps focus, closes on Esc and the scrim, and returns
 * focus to the control that opened it. The sheet slides in; reduced motion turns that off.
 * It renders in a portal, so it takes the theme of its role root from context.
 */
export function BottomSheet({ open, onOpenChange, title, description, children, flush, headerAside }: BottomSheetProps) {
  const theme = useTheme();
  const { container, modal } = useSheetEnvironment();
  const place = container ? styles.contained : undefined;
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      <Dialog.Portal container={container ?? undefined}>
        {/* Radix draws its overlay only for modal dialogs; a gallery frame's sheet is non-modal but is still drawn over a scrim. */}
        {modal ? (
          <Dialog.Overlay className={[styles.overlay, place].filter(Boolean).join(" ")} data-theme={theme} />
        ) : (
          open && <div className={[styles.overlay, place].filter(Boolean).join(" ")} data-theme={theme} aria-hidden />
        )}
        <Dialog.Content
          className={[styles.content, place, flush && styles.flush].filter(Boolean).join(" ")}
          data-theme={theme}
          // A tap on the presenter or dev controls is not a tap on the scrim: they carry data-keeps-sheet-open.
          onInteractOutside={(event) => {
            if ((event.target as HTMLElement | null)?.closest?.("[data-keeps-sheet-open]")) event.preventDefault();
          }}
          {...(description ? {} : { "aria-describedby": undefined })}
          // A gallery frame is not a live screen: do not pull focus into it (it would draw a focus ring on the first control).
          // The Outbox holds a switch and several buttons; opening on the sheet itself keeps a
          // focus ring off whichever control happens to come first.
          onOpenAutoFocus={(event) => {
            if (!modal) event.preventDefault();
            else if (flush) {
              event.preventDefault();
              (event.currentTarget as HTMLElement).focus();
            }
          }}
        >
          <div className={styles.grabber} aria-hidden />
          <div className={styles.header}>
            {headerAside ? (
              <div className={styles.titleRow}>
                <Dialog.Title className={styles.title}>{title}</Dialog.Title>
                <span className={styles.aside}>{headerAside}</span>
              </div>
            ) : (
              <Dialog.Title className={styles.title}>{title}</Dialog.Title>
            )}
            {description && <Dialog.Description className={styles.description}>{description}</Dialog.Description>}
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
