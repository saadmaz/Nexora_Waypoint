import * as RadixToast from "@radix-ui/react-toast";
import { useCallback, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { ToastContext, type ToastAction } from "./ToastContext";
import styles from "./Toast.module.css";

type ToastItem = {
  id: number;
  message: ReactNode;
  icon: IconName;
  action?: ToastAction;
};

let nextId = 1;

/** Wrap the app once with this so any screen can call useToast().show(...). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((message: ReactNode, options?: { icon?: IconName; action?: ToastAction }) => {
    const id = nextId++;
    setItems((prev) => [
      ...prev,
      { id, message, icon: options?.icon ?? "check", ...(options?.action ? { action: options.action } : {}) },
    ]);
  }, []);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      <RadixToast.Provider swipeDirection="down" duration={4000}>
        {children}
        {items.map((item) => (
          <RadixToast.Root
            key={item.id}
            className={styles.toast}
            onOpenChange={(open) => {
              if (!open) remove(item.id);
            }}
          >
            <Icon name={item.icon} size={16} color="signal" />
            <RadixToast.Description>{item.message}</RadixToast.Description>
            {item.action && (
              <RadixToast.Action asChild altText={item.action.label}>
                <button type="button" className={styles.action} onClick={item.action.onClick}>
                  {item.action.label}
                </button>
              </RadixToast.Action>
            )}
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className={styles.viewport} />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}
