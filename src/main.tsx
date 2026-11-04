import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "./styles/styles.css";
import "./styles/dark.css";
import "./styles/controls.css";
import "./styles/history.css";
import "./styles/ux.css";
import "./styles/currency-portfolio.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

import "./styles/platform.css";
