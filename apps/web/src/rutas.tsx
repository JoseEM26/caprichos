import { Routes, Route, Navigate } from 'react-router-dom';
import { RutaProtegida } from './comun/RutaProtegida';
import { Ingresar } from './admin/Ingresar';
import { CambiarClave } from './admin/CambiarClave';
import { AdminShell } from './admin/AdminShell';
import { MODULOS } from './admin/modulos';
import { Escritorio } from './admin/Escritorio';
import { CartaPublica } from './carta/CartaPublica';
import { PantallaPlaceholder } from './pantalla/PantallaPlaceholder';

export function RutasApp() {
  return (
    <Routes>
      {/* 1. Carta pública */}
      <Route path="/" element={<CartaPublica />} />

      {/* 2. Pantallas de cocina y TV */}
      <Route path="/pantalla/*" element={<PantallaPlaceholder />} />

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
        <Route path="escritorio" element={<Escritorio />} />

        {MODULOS.filter((m) => m.ruta !== '/admin').map((m) => {
          const rutaRelativa = m.ruta.replace(/^\/admin\/?/, '');
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
  );
}
