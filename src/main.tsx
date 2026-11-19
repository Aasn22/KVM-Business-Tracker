import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Entrance from "./Entrance";
import "./style.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Entrance>
      <App />
    </Entrance>
  </React.StrictMode>,
);
