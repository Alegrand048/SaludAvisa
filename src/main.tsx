
import { createRoot } from "react-dom/client";
import { Capacitor, registerPlugin } from "@capacitor/core";
import App from "./app/App.tsx";
import { ErrorBoundary } from "./app/components/ErrorBoundary.tsx";
import "./styles/index.css";

interface StatusBarPlugin {
  setOverlaysWebView(options: { overlay: boolean }): Promise<void>;
  setStyle(options: { style: "LIGHT" | "DARK" | "DEFAULT" }): Promise<void>;
  setBackgroundColor(options: { color: string }): Promise<void>;
}

const StatusBar = registerPlugin<StatusBarPlugin>("StatusBar");

async function configureMobileSystemBars() {
  if (Capacitor.getPlatform() !== "android") {
    return;
  }

  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: "LIGHT" });
    await StatusBar.setBackgroundColor({ color: "#1f2937" });
  } catch (error) {
    console.warn("No se pudo configurar la barra de estado:", error);
  }
}

void configureMobileSystemBars();

// Error handler for uncaught errors
window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error);
});

// Error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

const root = document.getElementById("root");
if (!root) {
  console.error("Root element not found!");
  document.body.innerHTML = "<h1>Error: Root element not found!</h1>";
} else {
  try {
    createRoot(root).render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
  } catch (error) {
    console.error("Failed to render App:", error);
    root.innerHTML = `<h1>Error loading app</h1><p>${error instanceof Error ? error.message : String(error)}</p><pre>${error instanceof Error ? error.stack : ""}</pre>`;
  }
}
  