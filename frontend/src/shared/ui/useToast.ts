import { useContext } from "react";
import { ToastContext } from "./ToastContext";

/** Slide-in toasts from anywhere in the tree: useToast().show("Order updated"). */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside a ToastProvider");
  return ctx;
}
