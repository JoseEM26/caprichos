import { useState } from 'react';
import { Boton } from '../../../comun/Boton';
import { Confirmar } from '../../../comun/Confirmar';
import { MesaSalon } from '../tipos';

export interface ModalForzarLiberarMesaProps {
  mesa: MesaSalon | null;
  alCerrar: () => void;
  alForzar: (mesaId: string) => Promise<void>;
}

export function ModalForzarLiberarMesa({ mesa, alCerrar, alForzar }: ModalForzarLiberarMesaProps) {
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!mesa) return null;

  const nombreMesa = mesa.nombre || `Mesa ${mesa.numero}`;

  const ejecutar = async () => {
    setCargando(true);
    setError(null);
    try {
      await alForzar(mesa.id);
      setConfirmarAbierto(false);
    } catch (err: any) {
      setConfirmarAbierto(false);
      setError(err?.message || 'No se pudo liberar la mesa.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      <div
        className="salon-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 85,
          background: 'rgba(11, 44, 62, 0.65)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
        onClick={cargando ? undefined : alCerrar}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Liberar ${nombreMesa}`}
          className="salon-panel"
          style={{
            width: '100%',
            maxWidth: '460px',
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '20px',
            boxShadow: '0 20px 48px rgba(11, 44, 62, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--cp-line)',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '18px',
                color: 'var(--cp-navy)',
              }}
            >
              Liberar mesa
            </h2>
            <div style={{ fontSize: '13px', color: 'var(--cp-soft)', marginTop: '2px' }}>
              {nombreMesa}
            </div>
          </div>

          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {mesa.pedido ? (
              <div
                style={{
                  fontSize: '13px',
                  color: 'var(--cp-navy)',
                  background: 'var(--cp-cream)',
                  border: '1px solid var(--cp-line)',
                  borderRadius: '12px',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <strong>Pedido {mesa.pedido.codigo}</strong>
                {mesa.pedido.estado && <span>Estado: {mesa.pedido.estado}</span>}
                {typeof mesa.pedido.total === 'number' && (
                  <span>Total: S/ {mesa.pedido.total.toFixed(2)}</span>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
                La mesa figura ocupada sin un pedido activo.
              </div>
            )}

            <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)' }}>
              Libera solo la mesa; el pedido no se anula ni se cobra.
            </p>

            {error && (
              <div
                role="alert"
                style={{
                  padding: '12px 14px',
                  background: '#FBEDE9',
                  border: '1.5px solid var(--cp-rust)',
                  borderRadius: '12px',
                  color: 'var(--cp-rust)',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                {error}
              </div>
            )}
          </div>

          <div
            className="salon-pie-fijo"
            style={{
              padding: '14px 24px',
              borderTop: '1px solid var(--cp-line)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              background: 'var(--cp-cream)',
            }}
          >
            <Boton type="button" variante="secundario" onClick={alCerrar} disabled={cargando}>
              Cancelar
            </Boton>
            <Boton
              type="button"
              variante="peligro"
              disabled={cargando}
              onClick={() => setConfirmarAbierto(true)}
            >
              Liberar mesa
            </Boton>
          </div>
        </div>
      </div>

      <Confirmar
        abierto={confirmarAbierto}
        titulo="¿Liberar la mesa?"
        mensaje={`Se liberará ${nombreMesa} aunque el pedido siga activo. El pedido no se anula ni se cobra. Queda registrado en la auditoría con tu usuario.`}
        textoSi="Sí, liberar mesa"
        textoNo="No, volver"
        peligro
        cargando={cargando}
        alConfirmar={ejecutar}
        alCancelar={() => setConfirmarAbierto(false)}
      />
    </>
  );
}
