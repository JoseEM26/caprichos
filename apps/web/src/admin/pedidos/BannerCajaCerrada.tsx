import { useEffect, useState } from 'react';
import { useSesion } from '../../comun/sesion';
import { pedidosApi, Pedido } from './pedidosApi';

export const TEXTO_CAJA_CERRADA = 'La caja está cerrada. Abre caja para cobrar y aprobar pagos.';

/**
 * Estado de la caja de hoy: null mientras carga o si no puede verla. Quien no tiene caja/ver
 * no pide el estado. Abrir la caja se hace en «Caja y cierres» (/admin/cierre).
 */
export function useEstadoCajaHoy(): { abierta: boolean | null; puedeAbrir: boolean } {
  const { tiene } = useSesion();
  const puedeVer = tiene('caja/ver');
  const puedeAbrir = tiene('caja/abrir');
  const [abierta, setAbierta] = useState<boolean | null>(null);

  useEffect(() => {
    if (!puedeVer) return;
    let vigente = true;
    (async () => {
      try {
        const r = await pedidosApi.obtenerCajaActual();
        if (vigente) setAbierta(Boolean(r.abierta));
      } catch {
        if (vigente) setAbierta(null);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [puedeVer]);

  return { abierta, puedeAbrir };
}

/** Un pedido sin cobrar espera caja: con la caja cerrada se marca «Caja cerrada» (no cambia su estado). */
export function esperaCajaCerrada(pedido: Pick<Pedido, 'estado' | 'pago_estado'>, cajaAbierta: boolean | null): boolean {
  if (cajaAbierta !== false) return false;
  if (String(pedido.estado || '').toUpperCase() === 'ANULADO') return false;
  return String(pedido.pago_estado || '').toUpperCase() !== 'PAGADO';
}

export function EtiquetaCajaCerrada() {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        borderRadius: 9999,
        padding: '2px 10px',
        background: '#B3261E',
        color: '#FFFFFF',
      }}
    >
      Caja cerrada
    </span>
  );
}

/**
 * Franja roja: aparece mientras la caja de hoy no está abierta y quien mira puede abrirla.
 * `compacto`: una sola línea (chip) para la barra de Pedidos y caja; el texto completo queda en el tooltip.
 */
export function BannerCajaCerrada({ compacto = false }: { compacto?: boolean }) {
  const { abierta, puedeAbrir } = useEstadoCajaHoy();
  if (!puedeAbrir || abierta !== false) return null;

  if (compacto) {
    return (
      <div
        role="alert"
        title={TEXTO_CAJA_CERRADA}
        style={{
          display: 'inline-flex',
          alignItems: 'stretch',
          minHeight: 44,
          borderRadius: 12,
          background: '#B3261E',
          color: '#FFFFFF',
          fontWeight: 700,
          fontSize: 13,
          overflow: 'hidden',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', padding: '0 12px' }}>Caja cerrada</span>
        <a
          href="/admin/cierre"
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
            background: '#FFFFFF',
            color: '#B3261E',
            textDecoration: 'none',
            fontWeight: 800,
          }}
        >
          Abrir caja
        </a>
      </div>
    );
  }

  return (
    <div
      role="alert"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '10px 16px',
        background: '#B3261E',
        color: '#FFFFFF',
        fontWeight: 700,
        fontSize: 14,
      }}
    >
      <span>{TEXTO_CAJA_CERRADA}</span>
      <a
        href="/admin/cierre"
        style={{
          background: '#FFFFFF',
          color: '#B3261E',
          borderRadius: 8,
          padding: '6px 14px',
          textDecoration: 'none',
          fontWeight: 800,
        }}
      >
        Abrir caja
      </a>
    </div>
  );
}
