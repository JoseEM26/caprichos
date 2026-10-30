import { useState, useRef, useEffect, useMemo } from 'react';
import { Icono } from './Icono';

export interface OpcionCombo {
  valor: string;
  etiqueta: string;
  subtitulo?: string;
}

export interface ComboProps {
  opciones: OpcionCombo[];
  valor: string;
  alCambiar: (valor: string) => void;
  etiqueta?: string;
  placeholder?: string;
  deshabilitado?: boolean;
  error?: string;
}

export function Combo({
  opciones,
  valor,
  alCambiar,
  etiqueta,
  placeholder = 'Selecciona una opción',
  deshabilitado = false,
  error,
}: ComboProps) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const contenedorRef = useRef<HTMLDivElement>(null);
  const inputBusquedaRef = useRef<HTMLInputElement>(null);

  const seleccionada = useMemo(
    () => opciones.find((op) => op.valor === valor),
    [opciones, valor],
  );

  const mostrarBuscador = opciones.length > 10;

  const opcionesFiltradas = useMemo(() => {
    if (!mostrarBuscador || !busqueda.trim()) {
      return opciones;
    }
    const q = busqueda.toLowerCase().trim();
    return opciones.filter(
      (op) =>
        op.etiqueta.toLowerCase().includes(q) ||
        (op.subtitulo && op.subtitulo.toLowerCase().includes(q)),
    );
  }, [opciones, busqueda, mostrarBuscador]);

  useEffect(() => {
    function handleClickFuera(e: MouseEvent) {
      if (
        contenedorRef.current &&
        !contenedorRef.current.contains(e.target as Node)
      ) {
        setAbierto(false);
      }
    }
    if (abierto) {
      document.addEventListener('mousedown', handleClickFuera);
      if (mostrarBuscador) {
        setTimeout(() => inputBusquedaRef.current?.focus(), 50);
      }
    }
    return () => {
      document.removeEventListener('mousedown', handleClickFuera);
    };
  }, [abierto, mostrarBuscador]);

  const seleccionar = (val: string) => {
    alCambiar(val);
    setAbierto(false);
    setBusqueda('');
  };

  return (
    <div
      ref={contenedorRef}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        width: '100%',
      }}
    >
      {etiqueta && (
        <label
          style={{
            fontWeight: 700,
            fontSize: '13px',
            color: 'var(--cp-navy)',
          }}
        >
          {etiqueta}
        </label>
      )}

      <button
        type="button"
        disabled={deshabilitado}
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          minHeight: '48px',
          borderRadius: '12px',
          border: `1.5px solid ${error ? 'var(--cp-rust)' : 'var(--cp-line)'}`,
          background: 'var(--cp-white)',
          color: seleccionada ? 'var(--cp-navy)' : 'var(--cp-soft)',
          padding: '0 14px',
          fontSize: '14px',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: deshabilitado ? 'not-allowed' : 'pointer',
          opacity: deshabilitado ? 0.6 : 1,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {seleccionada ? seleccionada.etiqueta : placeholder}
        </span>
        <span style={{ color: 'var(--cp-soft)', marginLeft: '8px', display: 'flex', alignItems: 'center' }}>
          <Icono nombre={abierto ? 'chevronAbajo' : 'chevronDerecha'} tamano={14} />
        </span>
      </button>

      {error && (
        <span
          role="alert"
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--cp-rust)',
          }}
        >
          {error}
        </span>
      )}

      {abierto && !deshabilitado && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 50,
            background: 'var(--cp-white)',
            border: '1.5px solid var(--cp-line)',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(11, 44, 62, 0.15)',
            maxHeight: '260px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {mostrarBuscador && (
            <div
              style={{
                position: 'sticky',
                top: 0,
                background: 'var(--cp-white)',
                padding: '8px',
                borderBottom: '1px solid var(--cp-line)',
                zIndex: 2,
              }}
            >
              <input
                ref={inputBusquedaRef}
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar opción..."
                aria-label="Buscar opción"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '36px',
                  borderRadius: '8px',
                  border: '1px solid var(--cp-line)',
                  padding: '0 10px',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>
          )}

          {opcionesFiltradas.length === 0 ? (
            <div
              style={{
                padding: '12px',
                fontSize: '13px',
                color: 'var(--cp-soft)',
                textAlign: 'center',
              }}
            >
              No se encontraron coincidencias
            </div>
          ) : (
            opcionesFiltradas.map((op) => {
              const esActiva = op.valor === valor;
              return (
                <button
                  key={op.valor}
                  type="button"
                  role="option"
                  aria-selected={esActiva}
                  onClick={() => seleccionar(op.valor)}
                  style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    background: esActiva ? 'var(--cp-sand)' : 'transparent',
                    color: 'var(--cp-navy)',
                    border: 0,
                    borderBottom: '1px solid var(--cp-line)',
                    minHeight: '44px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontWeight: esActiva ? 800 : 600, fontSize: '13px' }}>
                    {op.etiqueta}
                  </span>
                  {op.subtitulo && (
                    <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                      {op.subtitulo}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
