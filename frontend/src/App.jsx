import { useEffect, useState } from "react";
import { apiGet } from "./api/client.js";

export default function App() {
  const [status, setStatus] = useState("conectando...");

  useEffect(() => {
    apiGet("/health")
      .then((data) => setStatus(`${data.status} — ${data.service}`))
      .catch((err) => setStatus(`error: ${err.message}`));
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800">
      <h1 className="text-4xl font-bold mb-2">MiTurno</h1>
      <p className="text-slate-500 mb-6">Sistema de turnos</p>
      <div className="rounded-lg border border-slate-200 bg-white px-6 py-3 shadow-sm">
        <span className="text-sm text-slate-400">API:</span>{" "}
        <span className="font-mono">{status}</span>
      </div>
    </div>
  );
}
