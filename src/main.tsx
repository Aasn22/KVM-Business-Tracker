import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Entrance from "./Entrance";
import PinShell from "./PinShell";
import "./style.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Entrance>
      {["/", "/business-insight"].includes(window.location.pathname) ? (
        <App publicDemo />
      ) : (
        <PinShell>
          <App localPin />
        </PinShell>
      )}
    </Entrance>
  </React.StrictMode>,
);
