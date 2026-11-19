import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Entrance from "./Entrance";
import AuthShell from "./AuthShell";
import "./style.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthShell>
      <Entrance>
        <App />
      </Entrance>
    </AuthShell>
  </React.StrictMode>,
);
