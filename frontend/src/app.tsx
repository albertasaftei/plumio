import "virtual:uno.css";

import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense, onMount } from "solid-js";
import { DemoBanner } from "./components/DemoBanner";
import { AuthenticatedLayout } from "./components/AuthenticatedLayout";
import { initializeTheme } from "./lib/theme";
import "./styles/globals.css";

export default function App() {
  onMount(() => {
    // Initialize theme on app mount
    initializeTheme();
  });

  return (
    <Router
      root={(props) => (
        <>
          <DemoBanner />
          <AuthenticatedLayout>
            <Suspense>{props.children}</Suspense>
          </AuthenticatedLayout>
        </>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
