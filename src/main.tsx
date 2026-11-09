import React from "react";
import ReactDOM from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/appearance.css";
import "./styles/globals.css";
import "./styles/finish.css";
import App from "./app/App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
