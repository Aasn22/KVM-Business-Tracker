import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { RouteEntrance } from "./Entrance";
import PinShell from "./PinShell";
import "./style.css";
const platform = ["/", "/business-insight", "/reports"].includes(
  window.location.pathname,
) ? (
  <App publicDemo />
) : (
  <PinShell>
    <App localPin />
  </PinShell>
);
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouteEntrance pathname={window.location.pathname}>
      {platform}
    </RouteEntrance>
  </React.StrictMode>,
);
