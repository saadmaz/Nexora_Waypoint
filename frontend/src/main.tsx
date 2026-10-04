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
  // The mocks exist only in development. In a production build this import() is dead code, so they are not shipped.
  if (import.meta.env.DEV) {
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
