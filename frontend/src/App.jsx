import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Negocio from "./pages/Negocio.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Demo: al entrar a la raíz, vamos al negocio de ejemplo. */}
        <Route path="/" element={<Navigate to="/barberia-demo" replace />} />
        <Route path="/:slug" element={<Negocio />} />
      </Routes>
    </BrowserRouter>
  );
}
