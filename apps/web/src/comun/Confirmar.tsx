import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Boton } from './Boton';

export interface ConfirmarProps {
  abierto: boolean;
  titulo?: string;
  mensaje?: string;
  textoSi?: string;
  textoConfirmar?: string;
  textoNo?: string;
  peligro?: boolean;
  cargando?: boolean;
  /** Deshabilita solo el botón de confirmar (p. ej. falta elegir mesa). */
  deshabilitarConfirmar?: boolean;
  alConfirmar: () => void | Promise<void>;
  alCancelar: () => void;
  children?: React.ReactNode;
}

export function Confirmar({
  abierto,
  titulo = 'Confirmar acción',
  mensaje,
  textoSi = 'Sí, continuar',
  textoConfirmar,
  textoNo = 'No, cancelar',
  peligro = false,
  cargando = false,
  deshabilitarConfirmar = false,
  alConfirmar,
  alCancelar,
  children,
}: ConfirmarProps) {
  const dialogoRef = useRef<HTMLDivElement>(null);
  const alCancelarRef = useRef(alCancelar);
  alCancelarRef.current = alCancelar;

  // Foco inicial en el botón principal y cierre con Esc (no mientras carga).
  // ponytail: sin trampa de foco (Tab puede salir); basta para confirmaciones cortas.
  useEffect(() => {
    if (!abierto) return;
    dialogoRef.current?.querySelector<HTMLButtonElement>('[data-confirmar-principal]')?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !cargando) alCancelarRef.current();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [abierto, cargando]);

  if (!abierto || typeof document === 'undefined') return null;

  const textoBotonSi = textoConfirmar || textoSi;

  // Portal a document.body: sale centrada en la ventana visible aunque se
  // abra desde un modal con scroll o con transform/filter en un ancestro.
  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 5000,
        background: 'rgba(11, 44, 62, 0.65)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
      onClick={cargando ? undefined : alCancelar}
    >
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        aria-labelledby="confirmar-titulo"
        style={{
          width: '100%',
          maxWidth: '420px',
          maxHeight: 'calc(100dvh - 32px)',
          overflowY: 'auto',
          boxSizing: 'border-box',
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 12px 36px rgba(11, 44, 62, 0.22)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <h2
            id="confirmar-titulo"
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '18px',
              color: 'var(--cp-navy)',
            }}
          >
            {titulo}
          </h2>
          {mensaje && (
            <p
              style={{
                margin: 0,
                fontSize: '14px',
                lineHeight: '20px',
                color: 'var(--cp-soft)',
              }}
            >
              {mensaje}
            </p>
          )}
          {children}
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            justifyContent: 'flex-end',
            marginTop: '8px',
          }}
        >
          <Boton
            type="button"
            variante="secundario"
            disabled={cargando}
            onClick={alCancelar}
          >
            {textoNo}
          </Boton>
          <Boton
            type="button"
            data-confirmar-principal=""
            variante={peligro ? 'peligro' : 'primario'}
            cargando={cargando}
            disabled={deshabilitarConfirmar}
            onClick={alConfirmar}
          >
            {textoBotonSi}
          </Boton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
