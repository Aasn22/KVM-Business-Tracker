import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Entrance from "./Entrance";
import AuthShell from "./AuthShell";
import "./style.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Entrance>
      <AuthShell
        publicDashboard={
          window.location.pathname === "/" ? <App publicDemo /> : undefined
        }
      >
        <App />
      </AuthShell>
    </Entrance>
  </React.StrictMode>,
);
