import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { LifeOpsProvider } from "./state/LifeOpsContext";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LifeOpsProvider>
      <App />
    </LifeOpsProvider>
  </React.StrictMode>,
);
