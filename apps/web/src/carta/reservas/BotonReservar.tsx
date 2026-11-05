import { useEffect, useState } from 'react';
import { useEsMovil } from '../useEsMovil';
import { HojaReservar } from './HojaReservar';
import { obtenerOpcionesReserva } from './reservasCartaApi';
import type { OpcionesReserva } from './reservasCartaApi';

const TACTIL = 44;

/**
 * Botón «Reservar» de la cabecera de la carta. Solo aparece si el local tiene las reservas web encendidas
 * (GET /carta/reservas/opciones). Si la consulta falla, no se muestra: la carta sigue funcionando sin él.
 */
export function BotonReservar() {
  const movil = useEsMovil();
  const [opciones, setOpciones] = useState<OpcionesReserva | null>(null);
  const [abierta, setAbierta] = useState(false);

  useEffect(() => {
    let vigente = true;
    obtenerOpcionesReserva()
      .then((o) => {
        if (vigente) setOpciones(o?.activa ? o : null);
      })
      .catch(() => {
        if (vigente) setOpciones(null);
      });
    return () => {
      vigente = false;
    };
  }, []);

  if (!opciones) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        aria-label="Reservar mesa"
        title="Reservar mesa"
        aria-haspopup="dialog"
        style={{
          flex: 'none',
          minWidth: movil ? TACTIL : 0,
          minHeight: TACTIL,
          padding: movil ? 0 : '0 14px',
          width: movil ? TACTIL : undefined,
          boxSizing: 'border-box',
          borderRadius: 12,
          border: '1.5px solid var(--cp-navy)',
          background: 'transparent',
          color: 'var(--cp-navy)',
          fontFamily: 'var(--fuente-titulos)',
          fontWeight: 800,
          fontSize: 13,
          whiteSpace: 'nowrap',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          cursor: 'pointer',
        }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
        {!movil && <span>Reservar</span>}
      </button>
      {abierta && <HojaReservar opciones={opciones} onCerrar={() => setAbierta(false)} />}
    </>
  );
}
