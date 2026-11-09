import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { RutaProtegida } from "./comun/RutaProtegida";
import { Ingresar } from "./admin/Ingresar";
import { CambiarClave } from "./admin/CambiarClave";
import { AdminShell } from "./admin/AdminShell";
import { MODULOS } from "./admin/modulos";
import { Escritorio } from "./admin/escritorio";
import { Perfil } from "./admin/Perfil";
import { CartaPublica } from "./carta/CartaPublica";
import {
  TerminosPage,
  PrivacidadPage,
  ReclamosPublicoPage,
} from "./carta/legal";
import { PantallaCocinaView } from "./pantalla/PantallaCocinaView";
import { PaginaMascota } from "./mascota/PaginaMascota";
import { MarcarConClavePage, PantallaAsistenciaPublica } from "./admin/asistencia";

/** El título estático de index.html es el de la carta (SEO); el panel lo cambia en el cliente. */
function TituloPanel() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (
      pathname === "/admin" ||
      pathname.startsWith("/admin/") ||
      pathname.startsWith("/pantalla")
    ) {
      document.title = "Caprichos - Panel del Local";
    }
  }, [pathname]);
  return null;
}

export function RutasApp() {
  return (
    <>
      <TituloPanel />
      <Routes>
        {/* 1. Carta pública */}
        <Route path="/" element={<CartaPublica />} />
        <Route path="/legal/terminos" element={<TerminosPage />} />
        <Route path="/legal/privacidad" element={<PrivacidadPage />} />
        <Route path="/reclamos" element={<ReclamosPublicoPage />} />
        <Route path="/mascota" element={<PaginaMascota />} />
        {/* Marcar sin celular con usuario y contraseña: sin sesión previa, no abre sesión */}
        <Route path="/asistencia/marcar" element={<MarcarConClavePage />} />
        {/* Pantalla del QR de asistencia del local: sin sesión, el enlace secreto va en la ruta */}
        <Route
          path="/asistencia/pantalla/:token"
          element={<PantallaAsistenciaPublica />}
        />

        {/* 2. Pantallas de cocina y TV */}
        <Route
          path="/pantalla/*"
          element={
            <RutaProtegida permiso="cocina/ver">
              <PantallaCocinaView />
            </RutaProtegida>
          }
        />

        {/* 3. Autenticación administrativa */}
        <Route path="/admin/ingresar" element={<Ingresar />} />
        <Route
          path="/admin/cambiar-clave"
          element={
            <RutaProtegida>
              <CambiarClave />
            </RutaProtegida>
          }
        />

        {/* 4. Panel Administrativo */}
        <Route
          path="/admin"
          element={
            <RutaProtegida>
              <AdminShell />
            </RutaProtegida>
          }
        >
          <Route index element={<Escritorio />} />
          <Route path="escritorio" element={<Navigate to="/admin" replace />} />
          <Route path="perfil" element={<Perfil />} />

          {MODULOS.filter((m) => m.ruta !== "/admin").map((m) => {
            const rutaRelativa = m.ruta.replace(/^\/admin\/?/, "");
            const Componente = m.componente;
            return (
              <Route
                key={m.clave}
                path={rutaRelativa}
                element={
                  <RutaProtegida permiso={m.permisoMinimo}>
                    <Componente />
                  </RutaProtegida>
                }
              />
            );
          })}
        </Route>

        {/* 5. Ruta no encontrada */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
