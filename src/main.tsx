import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { BrowserRouter } from "react-router";
import { Toaster } from "sonner";
import App from "./App";
import "./index.css";

function convexUrl(): string {
  const fromEnv = import.meta.env.VITE_CONVEX_URL as string | undefined;
  if (fromEnv) return fromEnv;
  // Served from <name>.convex.site: the backend is the matching .convex.cloud host.
  const host = window.location.hostname;
  if (host.endsWith(".convex.site")) {
    return `https://${host.replace(".convex.site", ".convex.cloud")}`;
  }
  throw new Error("VITE_CONVEX_URL is not set. Run `npm run dev` so Convex writes .env.local.");
}

const convex = new ConvexReactClient(convexUrl());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <BrowserRouter>
        <App />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--color-card)",
              color: "var(--color-ink)",
              border: "1px solid var(--color-line-strong)",
              fontFamily: "var(--font-sans)",
            },
          }}
        />
      </BrowserRouter>
    </ConvexAuthProvider>
  </StrictMode>,
);
