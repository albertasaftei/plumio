import "virtual:uno.css";

import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import { DemoBanner } from "./components/DemoBanner";
import "./styles/globals.css";

export default function App() {
  return (
    <Router
      root={(props) => (
        <>
          <DemoBanner />
          <Suspense>{props.children}</Suspense>
        </>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
