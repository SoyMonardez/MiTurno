import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { DialogProvider } from "./components/Dialog.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <DialogProvider>
      <App />
    </DialogProvider>
  </React.StrictMode>
);

// PWA: registramos el service worker (solo en producción, para no
// interferir con el hot-reload de Vite en desarrollo).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  });
}
