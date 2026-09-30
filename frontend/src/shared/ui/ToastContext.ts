import { createContext, type ReactNode } from "react";
import type { IconName } from "./Icon";

export type ToastAction = { label: string; onClick: () => void };

export type ToastContextValue = {
  show: (message: ReactNode, options?: { icon?: IconName; action?: ToastAction }) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);
