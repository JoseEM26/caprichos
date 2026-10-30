import { useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Icono } from '../../comun/Icono';

export interface ClaveInicialModalProps {
  clave?: string | null;
  claveInicial?: string | null;
  abierto?: boolean;
  nombreUsuario?: string;
  alCerrar: () => void;
}

export function ClaveInicialModal({
  clave,
  claveInicial,
  abierto = true,
  nombreUsuario,
  alCerrar,
}: ClaveInicialModalProps) {
  const [copiado, setCopiado] = useState(false);
  const valorClave = clave || claveInicial || null;

  if (!abierto || !valorClave) return null;

  async function copiarAlPortapapeles() {
    if (!valorClave) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(valorClave);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = valorClave;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    } catch {
      // Fallback
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-clave-titulo"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(11, 44, 62, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'var(--cp-white)',
          border: '2px solid var(--cp-orange)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 16px 40px rgba(11, 44, 62, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '20px',
              background: '#FFF8E6',
              color: 'var(--cp-rust)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icono nombre="alerta" tamano={22} />
          </div>
          <div>
            <h3
              id="modal-clave-titulo"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '18px',
                color: 'var(--cp-navy)',
                margin: 0,
              }}
            >
              Contraseña inicial asignada
            </h3>
            {nombreUsuario && (
              <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
                Para: <b>{nombreUsuario}</b>
              </div>
            )}
          </div>
        </div>

        {/* Cuadro de la contraseña */}
        <div
          style={{
            background: 'var(--cp-sand)',
            border: '1.5px solid var(--cp-line)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: 'var(--cp-soft)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '4px',
              }}
            >
              Contraseña temporal (12 caracteres)
            </div>
            <div
              data-testid="clave-inicial-valor"
              style={{
                fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
                fontSize: '20px',
                fontWeight: 800,
                color: 'var(--cp-navy)',
                letterSpacing: '1.5px',
                wordBreak: 'break-all',
                userSelect: 'all',
              }}
            >
              {valorClave}
            </div>
          </div>
          <Boton
            type="button"
            variante={copiado ? 'oscuro' : 'primario'}
            tamano="pequeno"
            onClick={copiarAlPortapapeles}
            aria-label="Copiar contraseña"
          >
            <Icono nombre={copiado ? 'check' : 'punto'} tamano={16} />
            {copiado ? 'Copiada' : 'Copiar'}
          </Boton>
        </div>

        {/* Advertencia obligatoria */}
        <div
          role="alert"
          style={{
            background: '#FBEDE9',
            border: '1.5px solid var(--cp-rust)',
            borderRadius: '12px',
            padding: '12px 14px',
            fontSize: '13px',
            lineHeight: '18px',
            color: 'var(--cp-rust)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icono nombre="alerta" tamano={16} />
            ADVERTENCIA IMPORTANTE
          </div>
          <div>
            Esta contraseña solo se muestra <b>UNA SOLA VEZ</b>. Cópiala y compártela de forma segura
            con el usuario. Al cerrar este cuadro la contraseña no se podrá volver a consultar. En el
            primer ingreso, el sistema le exigirá crear una nueva.
          </div>
        </div>

        {/* Botón de cierre */}
        <Boton
          type="button"
          variante="secundario"
          tamano="grande"
          onClick={alCerrar}
          style={{ width: '100%' }}
        >
          Entendido, cerrar
        </Boton>
      </div>
    </div>
  );
}
