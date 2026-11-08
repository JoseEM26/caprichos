import { useCallback, useEffect, useState } from 'react';
import { api, ErrorApi } from '../../comun/api';

const CLAVE = 'impresion_prioridad';

/**
 * «Imprimir primero los tickets de pago»: encendido (lo normal), el ticket de pago y las comandas salen antes que los
 * stickers que ya esperan; apagado, todo sale por orden de llegada. Se guarda al marcar.
 */
export function PrioridadTickets({ puedeEditar }: { puedeEditar: boolean }) {
  const [primero, setPrimero] = useState<boolean | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const lista = await api.get<Array<{ clave: string; valor: unknown }>>('/admin/configuracion');
      const fila = lista.find((p) => p.clave === CLAVE);
      // Sin fila o con cualquier valor distinto de ORDEN_LLEGADA, los tickets van primero (como en el servidor).
      setPrimero(String(fila?.valor ?? '').trim().toUpperCase() !== 'ORDEN_LLEGADA');
    } catch {
      setPrimero(null);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cambiar = async (nuevo: boolean) => {
    setGuardando(true);
    setError(null);
    try {
      await api.put(`/admin/configuracion/${CLAVE}`, { valor: nuevo ? 'TICKETS_PRIMERO' : 'ORDEN_LLEGADA' });
      setPrimero(nuevo);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar el cambio');
    } finally {
      setGuardando(false);
    }
  };

  if (primero === null) return null;
  return (
    <div data-testid="prioridad-tickets" style={{ margin: '0 0 12px', padding: '10px 14px', border: '1px solid var(--cp-line, #E3D6C6)', borderRadius: 12 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 }}>
        <input
          type="checkbox"
          checked={primero}
          disabled={!puedeEditar || guardando}
          onChange={(e) => void cambiar(e.target.checked)}
        />
        Imprimir primero los tickets de pago
      </label>
      <div style={{ fontSize: 12.5, color: 'var(--cp-soft, #7a6a5a)', marginTop: 4 }}>
        El ticket de pago y las comandas salen antes que los stickers que están esperando. Si lo quitas, todo sale por orden de llegada.
      </div>
      {error && <div role="alert" style={{ color: 'var(--cp-danger, #b3261e)', fontSize: 12.5, marginTop: 4 }}>{error}</div>}
    </div>
  );
}
