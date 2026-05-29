import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Negocio from "./pages/Negocio.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import AdminPanel from "./pages/AdminPanel.jsx";
import SuperAdmin from "./pages/SuperAdmin.jsx";
import CancelarReserva from "./pages/CancelarReserva.jsx";
import { getToken } from "./api/client.js";

function RequireAuth({ children }) {
  return getToken() ? children : <Navigate to="/admin/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/barberia-demo" replace />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/cancelar/:token" element={<CancelarReserva />} />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminPanel />
            </RequireAuth>
          }
        />
        <Route
          path="/super-admin"
          element={
            <RequireAuth>
              <SuperAdmin />
            </RequireAuth>
          }
        />
        <Route path="/:slug" element={<Negocio />} />
      </Routes>
    </BrowserRouter>
  );
}
