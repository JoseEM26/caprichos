import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { RutaProtegida } from "./comun/RutaProtegida";
import { Ingresar } from "./admin/Ingresar";
import { CambiarClave } from "./admin/CambiarClave";
import { AdminShell } from "./admin/AdminShell";
import { MODULOS } from "./admin/modulos";
import { Escritorio } from "./admin/escritorio";
import { Perfil } from "./admin/Perfil";
import { useSesion } from "./comun/sesion";
import { esSoloMarketing } from "./comun/rolesUsuario";
import { CartaPublica } from "./carta/CartaPublica";
import {
  TerminosPage,
  PrivacidadPage,
  ReclamosPublicoPage,
} from "./carta/legal";
import { PantallaCocinaView } from "./pantalla/PantallaCocinaView";
const PantallaLocal = lazy(() => import("./pantalla-local/PantallaLocal"));
const SalonVivoTv = lazy(() => import("./admin/salon-vivo/SalonVivoView").then((m) => ({ default: () => <m.SalonVivoView tv /> })));
import { PaginaMascota } from "./mascota/PaginaMascota";
import { PantallaAsistenciaPublica } from "./admin/asistencia";

/** Inicio del panel: Marketing y diseño no tiene Escritorio; va a su primer módulo permitido (no a una pantalla sin permiso). */
export function InicioAdmin() {
  const { usuario, tiene } = useSesion();
  if (esSoloMarketing(usuario)) {
    const primero = MODULOS.find(
      (m) => m.permisoMinimo && !["mi-asistencia", "notificaciones"].includes(m.clave) && tiene(m.permisoMinimo),
    );
    if (primero) return <Navigate to={primero.ruta} replace />;
  }
  return <Escritorio />;
}

/** El título estático de index.html es el de la carta (SEO); el panel lo cambia en el cliente. */
function TituloPanel() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (
      pathname === "/admin" ||
      pathname.startsWith("/admin/") ||
      pathname.startsWith("/pantalla") ||
      pathname.startsWith("/tv/")
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
        {/* Pantalla del QR de asistencia del local: sin sesión, el enlace secreto va en la ruta */}
        <Route
          path="/asistencia/pantalla/:token"
          element={<PantallaAsistenciaPublica />}
        />

        {/* 2. Pantalla pública de pedidos del local (TV, sin sesión) */}
        <Route
          path="/pantalla-local"
          element={
            <Suspense fallback={null}>
              <PantallaLocal />
            </Suspense>
          }
        />

        {/* Salón en vivo 3D para la TV del local: pantalla propia, sin el panel del admin (pide sesión con permiso) */}
        <Route
          path="/tv/salon-vivo"
          element={
            <RutaProtegida permiso="salon_vivo/ver">
              <Suspense fallback={null}>
                <SalonVivoTv />
              </Suspense>
            </RutaProtegida>
          }
        />

        {/* Pantallas de cocina y TV */}
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
          <Route index element={<InicioAdmin />} />
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
