import { useCallback, useEffect, useState } from 'react';
import { api, ErrorApi } from '../../comun/api';

const CLAVE = 'impresion_cupon_en_ticket';

/**
 * «Imprimir cupón en el ticket»: apagado por defecto. Encendido, el ticket de pago lleva el cupón REAL y vigente que el
 * pedido haya generado (si no hay ninguno, no sale nada: ni título ni separador). Se guarda al marcar.
 */
export function CuponEnTicket({ puedeEditar }: { puedeEditar: boolean }) {
  const [activo, setActivo] = useState<boolean | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const lista = await api.get<Array<{ clave: string; valor: unknown }>>('/admin/configuracion');
      const fila = lista.find((p) => p.clave === CLAVE);
      setActivo(['si', 'sí', 'true', '1'].includes(String(fila?.valor ?? '').trim().toLowerCase()));
    } catch {
      setActivo(null);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cambiar = async (nuevo: boolean) => {
    setGuardando(true);
    setError(null);
    try {
      await api.put(`/admin/configuracion/${CLAVE}`, { valor: nuevo ? 'SI' : 'NO' });
      setActivo(nuevo);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar el cambio');
    } finally {
      setGuardando(false);
    }
  };

  if (activo === null) return null;
  return (
    <div data-testid="cupon-en-ticket" data-cfg-id="impresion-cupon-en-ticket" style={{ margin: '0 0 12px', padding: '10px 14px', border: '1px solid var(--cp-line, #E3D6C6)', borderRadius: 12 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 }}>
        <input type="checkbox" checked={activo} disabled={!puedeEditar || guardando} onChange={(e) => void cambiar(e.target.checked)} />
        Imprimir cupón en el ticket
      </label>
      <div style={{ fontSize: 12.5, color: 'var(--cp-soft, #7a6a5a)', marginTop: 4 }}>
        Apagado: el ticket nunca lleva cupones. Encendido: solo sale un cupón si el pedido generó uno real y vigente; si no hay, el ticket sale igual que siempre.
      </div>
      {error && <div role="alert" style={{ color: 'var(--cp-danger, #b3261e)', fontSize: 12.5, marginTop: 4 }}>{error}</div>}
    </div>
  );
}
