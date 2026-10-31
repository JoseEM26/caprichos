import { useEffect, useId, useRef, useState } from 'react';
import { Icono } from './Icono';

export interface OpcionFiltro {
  valor: string;
  etiqueta: string;
  /** Cantidad de resultados con esa opción (se muestra al lado). */
  cantidad?: number;
}

export interface FiltroComboProps {
  /** Nombre del filtro: «Estado», «Canal», «Rol»... */
  etiqueta: string;
  valor: string;
  opciones: OpcionFiltro[];
  alCambiar: (valor: string) => void;
  /** Valor que significa «sin filtrar» (por defecto, el de la primera opción). Si el valor es otro, el filtro se resalta. */
  valorPorDefecto?: string;
  deshabilitado?: boolean;
}

/**
 * Filtro desplegable compacto: reemplaza una fila de botones (un botón por opción) por un solo combo.
 * Muestra «Etiqueta: opción elegida» y, al abrir, la lista con la cantidad de resultados de cada una.
 */
export function FiltroCombo({ etiqueta, valor, opciones, alCambiar, valorPorDefecto, deshabilitado = false }: FiltroComboProps) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const idLista = useId();

  const porDefecto = valorPorDefecto ?? opciones[0]?.valor;
  const actual = opciones.find((o) => o.valor === valor);
  const filtrado = valor !== porDefecto;

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  const elegir = (v: string) => {
    alCambiar(v);
    setAbierto(false);
  };

  return (
    <div ref={raiz} style={{ position: 'relative', display: 'inline-block', minWidth: 170 }}>
      <button
        type="button"
        disabled={deshabilitado}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={idLista}
        aria-label={`${etiqueta}: ${actual?.etiqueta ?? valor}`}
        onClick={() => setAbierto((a) => !a)}
        style={{
          width: '100%',
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '0 12px',
          borderRadius: 12,
          border: `1.5px solid ${filtrado ? 'var(--cp-orange, #E67929)' : 'var(--cp-line, #E3D6C6)'}`,
          background: filtrado ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-white, #FFFFFF)',
          color: 'var(--cp-navy, #0B2C3E)',
          fontSize: 13,
          cursor: deshabilitado ? 'not-allowed' : 'pointer',
          opacity: deshabilitado ? 0.6 : 1,
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '15px', minWidth: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--cp-soft, #2C4C5D)', fontWeight: 700 }}>{etiqueta}</span>
          <span style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {actual?.etiqueta ?? valor}
            {actual?.cantidad != null && <span style={{ fontWeight: 600, color: 'var(--cp-soft, #2C4C5D)' }}> ({actual.cantidad})</span>}
          </span>
        </span>
        <Icono nombre={abierto ? 'chevronAbajo' : 'chevronDerecha'} tamano={14} />
      </button>

      {abierto && (
        <div
          id={idLista}
          role="listbox"
          aria-label={etiqueta}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: '100%',
            zIndex: 60,
            background: 'var(--cp-white, #FFFFFF)',
            border: '1.5px solid var(--cp-line, #E3D6C6)',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(11,44,62,0.15)',
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {opciones.map((o) => {
            const activa = o.valor === valor;
            return (
              <button
                key={o.valor}
                type="button"
                role="option"
                aria-selected={activa}
                onClick={() => elegir(o.valor)}
                style={{
                  width: '100%',
                  minHeight: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '0 14px',
                  border: 0,
                  borderBottom: '1px solid var(--cp-line, #E3D6C6)',
                  background: activa ? 'var(--cp-sand, #F1E6D6)' : 'transparent',
                  color: 'var(--cp-navy, #0B2C3E)',
                  fontSize: 13,
                  fontWeight: activa ? 800 : 600,
                  textAlign: 'left',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{o.etiqueta}</span>
                {o.cantidad != null && <span style={{ color: 'var(--cp-soft, #2C4C5D)', fontWeight: 700 }}>{o.cantidad}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
