import { useState } from 'react';
import { BarraFiltros, FiltroCombo } from '../../comun/FiltroCombo';

export interface HistorialMovimiento {
  t: string;
  who: string;
  what: string;
  tag: string;
  bg: string;
  fg: string;
}

const TAG_STYLES: Record<string, { bg: string; fg: string }> = {
  Emisión: { bg: '#DDF1E3', fg: '#14502B' },
  Canje: { bg: '#E8E0F7', fg: '#4B2E8A' },
  Anulación: { bg: '#FDECE8', fg: '#8A2A18' },
  Creación: { bg: '#E3EEFB', fg: '#1B4B8A' },
  Edición: { bg: '#FFF1C9', fg: '#7A5C00' },
  Estado: { bg: 'var(--cp-sand)', fg: 'var(--cp-navy)' },
  Orden: { bg: 'var(--cp-sand)', fg: 'var(--cp-navy)' },
};

const CHIPS_HISTORIAL = [
  { clave: 'all', label: 'Todo' },
  { clave: 'Emisión', label: 'Emisiones' },
  { clave: 'Canje', label: 'Canjes' },
  { clave: 'Creación', label: 'Creaciones' },
  { clave: 'Edición', label: 'Ediciones' },
  { clave: 'Estado', label: 'Activar o desactivar' },
  { clave: 'Orden', label: 'Orden y límite' },
  { clave: 'Anulación', label: 'Anulaciones' },
];

const MOVIMIENTOS_DEFECTO: HistorialMovimiento[] = [];

interface ModalHistorialCuponesProps {
  abierto: boolean;
  onCerrar: () => void;
  movimientos?: HistorialMovimiento[];
}

export function ModalHistorialCupones({
  abierto,
  onCerrar,
  movimientos = MOVIMIENTOS_DEFECTO,
}: ModalHistorialCuponesProps) {
  const [filtroTag, setFiltroTag] = useState('all');
  const [busqueda, setBusqueda] = useState('');

  if (!abierto) return null;

  const filasFiltradas = movimientos.filter((m) => {
    const matchTag = filtroTag === 'all' || m.tag === filtroTag;
    const matchBusqueda =
      !busqueda.trim() ||
      `${m.what} ${m.who} ${m.t}`.toLowerCase().includes(busqueda.trim().toLowerCase());
    return matchTag && matchBusqueda;
  });

  const conteoTexto = `${filasFiltradas.length} ${
    filasFiltradas.length === 1 ? 'movimiento' : 'movimientos'
  }${filasFiltradas.length !== movimientos.length ? ` de ${movimientos.length}` : ''} · lo más reciente primero`;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      {/* Fondo clickeable */}
      <div
        onClick={onCerrar}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(11, 44, 62, 0.55)',
          zIndex: 60,
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Historial de cupones"
        style={{
          position: 'absolute',
          zIndex: 65,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(980px, calc(100% - 24px))',
          height: 'min(760px, calc(100% - 24px))',
          backgroundColor: 'var(--cp-cream)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <div>
            <div
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '22px',
                lineHeight: '27px',
                color: 'var(--cp-navy)',
              }}
            >
              Historial de cupones
            </div>
            <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>{conteoTexto}</div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            style={{
              flex: 'none',
              width: '44px',
              height: '44px',
              borderRadius: '22px',
              border: '1.5px solid var(--cp-navy)',
              backgroundColor: 'transparent',
              color: 'var(--cp-navy)',
              fontSize: '20px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        <BarraFiltros>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por cupón, código, pedido o persona"
            aria-label="Buscar en el historial"
            style={{
              flex: '2 1 220px',
              minWidth: 0,
              width: '100%',
              boxSizing: 'border-box',
              minHeight: '48px',
              borderRadius: '12px',
              border: '1.5px solid var(--cp-line)',
              backgroundColor: 'var(--cp-white)',
              padding: '0 14px',
              fontSize: '15px',
            }}
          />

          <FiltroCombo
            etiqueta="Movimiento"
            valor={filtroTag}
            opciones={CHIPS_HISTORIAL.map((c) => ({ valor: c.clave, etiqueta: c.label }))}
            alCambiar={setFiltroTag}
          />
        </BarraFiltros>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            backgroundColor: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '6px 14px',
          }}
        >
          {filasFiltradas.length === 0 ? (
            <div style={{ padding: '16px 0', fontSize: '14px', color: 'var(--cp-soft)' }}>
              No hay movimientos con ese filtro.
            </div>
          ) : (
            filasFiltradas.map((h, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  borderBottom: '1px solid var(--cp-sand)',
                  padding: '10px 0',
                }}
              >
                <span
                  style={{
                    flex: 'none',
                    minWidth: '96px',
                    fontSize: '13px',
                    fontWeight: 800,
                    color: 'var(--cp-soft)',
                  }}
                >
                  {h.t}
                </span>
                <span
                  style={{
                    flex: 'none',
                    fontSize: '12px',
                    fontWeight: 800,
                    borderRadius: '9999px',
                    padding: '3px 10px',
                    backgroundColor: h.bg || TAG_STYLES[h.tag]?.bg || 'var(--cp-sand)',
                    color: h.fg || TAG_STYLES[h.tag]?.fg || 'var(--cp-navy)',
                  }}
                >
                  {h.tag}
                </span>
                <span style={{ flex: '1 1 260px', minWidth: 0, fontSize: '14px', lineHeight: '20px' }}>
                  <b>{h.who}</b> · {h.what}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
