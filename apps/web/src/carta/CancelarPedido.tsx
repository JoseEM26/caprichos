import { useState } from 'react';
import { api, ErrorApi } from '../comun/api';

/**
 * «Cancelar pedido» del seguimiento: solo si el pedido aún no está pagado ni en preparación (lo dice la API).
 * Pide confirmación Sí/No; si no se puede, muestra el motivo corto.
 */
export function CancelarPedido({ codigo, token, cancelable, anulado, terminado, onCancelado }: {
  codigo: string;
  token?: string;
  cancelable?: { puede: boolean; mensaje?: string };
  anulado: boolean;
  terminado: boolean;
  onCancelado: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!cancelable || anulado || terminado) return null;
  if (!cancelable.puede) {
    return cancelable.mensaje ? <p className="sg-detalle" data-testid="no-cancelable">{cancelable.mensaje}</p> : null;
  }
  const cancelar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await api.post(`/carta/pedidos/${encodeURIComponent(codigo)}/cancelar?t=${encodeURIComponent(token ?? '')}`, {});
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos cancelar tu pedido. Intenta de nuevo.');
    } finally {
      setEnviando(false);
      setConfirmando(false);
      onCancelado();
    }
  };
  return (
    <section className="sg-tarjeta" aria-label="Cancelar pedido">
      {!confirmando ? (
        <button type="button" onClick={() => setConfirmando(true)}>Cancelar pedido</button>
      ) : (
        <div role="alertdialog" aria-label="Confirmar cancelación">
          <p className="sg-detalle">¿Seguro que quieres cancelar el pedido {codigo}?</p>
          <button type="button" onClick={cancelar} disabled={enviando}>Sí, cancelar</button>{' '}
          <button type="button" onClick={() => setConfirmando(false)} disabled={enviando}>No</button>
        </div>
      )}
      {error && <p className="sg-detalle" role="alert">{error}</p>}
    </section>
  );
}
