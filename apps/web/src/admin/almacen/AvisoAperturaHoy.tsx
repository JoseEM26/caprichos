import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSesion } from '../../comun/sesion';
import { almacenApi, productoPendienteApertura } from './almacenApi';

function useSesionSegura() {
  try {
    return useSesion();
  } catch {
    return null;
  }
}

/** Franja en Cocina y Almacén: productos con control de stock propio sin conteo de apertura hoy. */
export function AvisoAperturaHoy() {
  const sesion = useSesionSegura();
  const puede = sesion ? sesion.tiene('almacen/apertura') : true;
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    if (!puede) return;
    let vivo = true;
    almacenApi
      .obtenerApertura()
      .then((r) => {
        if (vivo) setPendientes(r.productos.filter(productoPendienteApertura).length);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [puede]);

  if (!puede || pendientes === 0) return null;
  return (
    <div
      role="status"
      data-testid="aviso-apertura-hoy"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        background: 'var(--cp-cream)',
        border: '1.5px solid var(--cp-orange)',
        borderRadius: 12,
        padding: '10px 14px',
        fontSize: 14,
        color: 'var(--cp-navy)',
      }}
    >
      <span>
        <b>Falta el conteo de apertura de hoy ({pendientes} {pendientes === 1 ? 'producto' : 'productos'})</b>
      </span>
      <Link
        to="/admin/apertura"
        style={{
          minHeight: 44,
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0 14px',
          borderRadius: 10,
          background: 'var(--cp-navy)',
          color: 'var(--cp-cream)',
          fontWeight: 800,
          textDecoration: 'none',
        }}
      >
        Contar ahora
      </Link>
    </div>
  );
}
