import { useState } from 'react';
import { repartosApi, PedidoReparto, RepartidorPanel } from './repartosApi';
import { Boton } from '../../comun/Boton';

/**
 * Excepción de Caja/Admin cuando un repartidor se cae: soltar el pedido (vuelve a «Esperando repartidor»)
 * o pasarlo a otro repartidor real. El motivo es obligatorio y queda auditado en el servidor.
 */
export function ModalSoltarPedido({
  pedido,
  repartidores,
  alCerrar,
  alTerminar,
}: {
  pedido: PedidoReparto;
  repartidores: RepartidorPanel[];
  alCerrar: () => void;
  alTerminar: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [destino, setDestino] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Solo repartidores reales (el admin que reparte no es destino válido del servidor)
  const candidatos = repartidores.filter((r) => !r.es_admin && r.party_id !== pedido.repartidor_party_id);

  const confirmar = async () => {
    if (!motivo.trim()) {
      setError('Escribe el motivo');
      return;
    }
    setCargando(true);
    setError(null);
    try {
      if (destino) await repartosApi.reasignarPedido(pedido.id, destino, motivo.trim());
      else await repartosApi.liberarPedido(pedido.id, motivo.trim());
      alTerminar();
    } catch (e: any) {
      setError(e?.message || 'No se pudo completar la acción');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-soltar"
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(11,44,62,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && alCerrar()}
    >
      <div style={{ background: 'var(--cp-white, #FFFFFF)', borderRadius: 16, padding: 20, maxWidth: 420, width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 id="titulo-soltar" style={{ margin: 0, fontSize: 17, color: 'var(--cp-navy, #0B2C3E)' }}>
          Soltar / reasignar {pedido.codigo}
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--cp-soft, #5A6E78)' }}>
          Solo por excepción (por ejemplo, el repartidor se cayó). Quedará registrado con tu nombre.
        </p>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 700 }}>
          Motivo (obligatorio)
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            style={{ borderRadius: 10, border: '1.5px solid var(--cp-line, #E3D6C6)', padding: 8, fontSize: 14, fontFamily: 'inherit' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 700 }}>
          Pasar a
          <select
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            style={{ minHeight: 40, borderRadius: 10, border: '1.5px solid var(--cp-line, #E3D6C6)', padding: '0 8px', fontSize: 14 }}
          >
            <option value="">Dejarlo sin repartidor (vuelve a esperando)</option>
            {candidatos.map((r) => (
              <option key={r.party_id} value={r.party_id}>
                {r.nombre}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
            {error}
          </p>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <Boton variante="secundario" onClick={alCerrar} style={{ flex: 1 }}>
            Cancelar
          </Boton>
          <Boton variante="primario" onClick={confirmar} cargando={cargando} style={{ flex: 1 }}>
            {destino ? 'Reasignar' : 'Soltar pedido'}
          </Boton>
        </div>
      </div>
    </div>
  );
}
