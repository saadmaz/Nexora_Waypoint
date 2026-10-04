import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@fontsource-variable/archivo";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/noto-sans-sinhala/400.css";
import "@fontsource/noto-sans-sinhala/600.css";
import "@fontsource/noto-sans-sinhala/700.css";
import "@fontsource/noto-sans-tamil/400.css";
import "@fontsource/noto-sans-tamil/600.css";
import "@fontsource/noto-sans-tamil/700.css";

import "./styles/tokens.css";
import "./styles/base.css";
import App from "./app/App";
import { ToastProvider } from "./shared/ui/Toast";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root is missing from index.html");

async function start(target: HTMLElement) {
  // The mocks load only when VITE_DATA_SOURCE is not "live" (or a role is set to mock). In a live build this import() is dead
  // code, so they are not shipped.
  // Written out here, not imported, so Vite's literal replacement folds it to a constant (see api/dataSource.ts).
  if (
    import.meta.env.VITE_DATA_SOURCE !== "live" ||
    import.meta.env.VITE_AUTH_API === "mock" ||
    import.meta.env.VITE_STORE_API === "mock" ||
    import.meta.env.VITE_DISPATCHER_API === "mock" ||
    import.meta.env.VITE_LOADER_API === "mock" ||
    import.meta.env.VITE_DRIVER_API === "mock"
  ) {
    const { installDevMocks } = await import("./devMocks/install");
    installDevMocks();
  }
  createRoot(target).render(
    <StrictMode>
      <ToastProvider>
        <App />
      </ToastProvider>
    </StrictMode>,
  );
}

void start(root);
