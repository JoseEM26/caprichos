import { useNavigate } from 'react-router-dom';
import { useSesion } from '../comun/sesion';
import { Confirmar } from '../comun/Confirmar';
import { useState } from 'react';
import { MODULOS } from './modulos';

const NOMBRE_ROL: Record<string, string> = {
  ADMIN: 'Administrador',
  CAJERO: 'Cajero',
  COCINA: 'Cocina y barra',
  MOZO: 'Mozo',
  CALLCENTER: 'Call center',
  ALMACEN: 'Almacén',
  PRODUCCION: 'Producción',
  REPARTIDOR: 'Repartidor',
};

const dato = (etiqueta: string, valor: string) => (
  <div style={{ flex: '1 1 180px', background: 'var(--cp-cream)', border: '1px solid var(--cp-line)', borderRadius: 12, padding: '8px 12px' }}>
    <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 700, fontSize: 12, letterSpacing: '0.04em' }}>{etiqueta.toUpperCase()}</div>
    <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 15 }}>{valor}</div>
  </div>
);

/** Mi perfil (mockup Admin ▸ Mi perfil): cuenta, rol y módulos con acceso. */
export function Perfil() {
  const { usuario, tiene, salir } = useSesion();
  const navigate = useNavigate();
  const [confirmar, setConfirmar] = useState(false);

  const rol = (usuario?.rol || '').toUpperCase();
  const iniciales = (usuario?.nombres || 'U').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  const accesibles = MODULOS.filter((m) => !m.permisoMinimo || tiene(m.permisoMinimo));

  return (
    <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 20, padding: 24, display: 'flex', flexWrap: 'wrap', gap: 24 }}>
      <div style={{ flex: '0 0 auto', width: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 120, height: 120, borderRadius: 60, background: 'var(--cp-orange)', color: 'var(--cp-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 44 }}>
          {iniciales}
        </span>
      </div>
      <div style={{ flex: '1 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 24, lineHeight: '28px' }}>{usuario?.nombres}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {dato('Rol', NOMBRE_ROL[rol] ?? usuario?.rol ?? '')}
          {dato('Local', 'CAPRICHOS')}
        </div>
        <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', color: 'var(--cp-soft)' }}>MÓDULOS CON ACCESO</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {accesibles.map((m) => (
            <span key={m.clave} style={{ background: 'var(--cp-navy)', color: 'var(--cp-cream)', borderRadius: 9999, padding: '4px 14px', fontFamily: 'var(--fuente-titulos)', fontWeight: 700, fontSize: 12 }}>
              {m.nombre}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
          <button
            type="button"
            onClick={() => navigate('/admin/cambiar-clave')}
            style={{ minHeight: 48, padding: '0 20px', border: '1.5px solid var(--cp-navy)', borderRadius: 12, background: 'var(--cp-white)', color: 'var(--cp-navy)', fontFamily: 'var(--fuente-titulos)', fontWeight: 800 }}
          >
            Cambiar mi contraseña
          </button>
          <button
            type="button"
            onClick={() => setConfirmar(true)}
            style={{ minHeight: 48, padding: '0 20px', border: 0, borderRadius: 12, background: 'var(--cp-orange)', color: 'var(--cp-navy)', fontFamily: 'var(--fuente-titulos)', fontWeight: 800 }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
      <Confirmar
        abierto={confirmar}
        titulo="Cerrar sesión"
        mensaje="¿Seguro que quieres cerrar tu sesión en el panel de Caprichos?"
        textoSi="Sí, cerrar sesión"
        textoNo="No, quedarme"
        alConfirmar={async () => {
          await salir();
          navigate('/admin/ingresar', { replace: true });
        }}
        alCancelar={() => setConfirmar(false)}
      />
    </div>
  );
}
