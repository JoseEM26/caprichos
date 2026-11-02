import { useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { pedidosApi } from './pedidosApi';
import { ErrorApi } from '../../comun/api';

export interface ModalRechazarCobroMozoProps {
  pedidoId: string | number;
  codigoPedido: string;
  alCerrar: () => void;
  alRechazar: () => void;
}

/** Caja rechaza el cobro que envió el mozo: motivo obligatorio y Sí/No. El pedido sigue por cobrar. */
export function ModalRechazarCobroMozo({ pedidoId, codigoPedido, alCerrar, alRechazar }: ModalRechazarCobroMozoProps) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const pedirConfirmacion = () => {
    if (motivo.trim().length < 5) {
      setError('El motivo es obligatorio y debe tener al menos 5 caracteres.');
      return;
    }
    setError('');
    setConfirmar(true);
  };

  const rechazar = async () => {
    try {
      setEnviando(true);
      await pedidosApi.rechazarCobroMozo(pedidoId, motivo.trim());
      setConfirmar(false);
      alRechazar();
    } catch (err: unknown) {
      setConfirmar(false);
      setError(err instanceof ErrorApi ? err.message : 'No se pudo rechazar el cobro. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <div role="dialog" aria-modal="true" aria-label="Rechazar cobro del mozo" className="salon-overlay">
        <div onClick={alCerrar} className="pc-fondo" />
        <div className="salon-panel" style={{ maxWidth: 440, margin: '10vh auto', padding: 20, background: 'var(--cp-cream)', borderRadius: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Rechazar cobro del mozo</div>
          <p style={{ fontSize: 13, margin: '0 0 12px', color: 'var(--cp-soft)' }}>
            Pedido {codigoPedido}. Se quita el aviso del mozo y se anula la nota de venta que se emitió. El pedido
            sigue por cobrar y el voucher no se borra.
          </p>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontWeight: 700, fontSize: 13 }}>
            Motivo
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              style={{ minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-line)', padding: 10, fontSize: 14, fontWeight: 400 }}
            />
          </label>
          {error && (
            <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust, #B2500F)', marginTop: 8 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            <Boton variante="secundario" onClick={alCerrar} disabled={enviando}>
              Cerrar
            </Boton>
            <Boton onClick={pedirConfirmacion} disabled={enviando}>
              Rechazar cobro
            </Boton>
          </div>
        </div>
      </div>
      <Confirmar
        abierto={confirmar}
        titulo="¿Rechazar el cobro del mozo?"
        mensaje={`Se anula la nota de venta del pedido ${codigoPedido}. El pedido vuelve a quedar por cobrar.`}
        textoConfirmar="Sí, rechazar"
        textoNo="No, cancelar"
        cargando={enviando}
        alConfirmar={rechazar}
        alCancelar={() => setConfirmar(false)}
      />
    </>
  );
}
