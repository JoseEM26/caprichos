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
  alConfirmar,
  alCancelar,
  children,
}: ConfirmarProps) {
  if (!abierto) return null;

  const textoBotonSi = textoConfirmar || textoSi;

  return (
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
      }}
      onClick={cargando ? undefined : alCancelar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        aria-labelledby="confirmar-titulo"
        style={{
          width: '100%',
          maxWidth: '420px',
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
            variante={peligro ? 'peligro' : 'primario'}
            cargando={cargando}
            onClick={alConfirmar}
          >
            {textoBotonSi}
          </Boton>
        </div>
      </div>
    </div>
  );
}
