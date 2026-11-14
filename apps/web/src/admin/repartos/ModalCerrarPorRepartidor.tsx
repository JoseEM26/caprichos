import { useState } from 'react';
import { repartosApi, PedidoSeguimiento, RepartidorPanel } from './repartosApi';
import { Boton } from '../../comun/Boton';

/**
 * ADMIN y SUPERVISOR cierran el reparto por el repartidor: eligen quién entregó (por defecto, el asignado),
 * escriben el motivo y el pedido sale y se entrega a nombre de ese repartidor. Queda «cerrado por <tu nombre>» en la auditoría.
 */
export function ModalCerrarPorRepartidor({
  pedido,
  repartidores,
  alCerrar,
  alTerminar,
}: {
  pedido: PedidoSeguimiento;
  repartidores: RepartidorPanel[];
  alCerrar: () => void;
  alTerminar: () => void;
}) {
  const candidatos = repartidores.filter((r) => !r.es_admin);
  const [repartidor, setRepartidor] = useState(pedido.repartidor_party_id ?? '');
  const [motivo, setMotivo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmar = async () => {
    setCargando(true);
    setError(null);
    try {
      await repartosApi.cerrarPorRepartidor(pedido.id, repartidor, motivo.trim());
      alTerminar();
    } catch (e: any) {
      setError(e?.message || 'No se pudo cerrar el reparto');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-cerrar-por"
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(11,44,62,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && alCerrar()}
    >
      <div style={{ background: 'var(--cp-white, #FFFFFF)', borderRadius: 16, padding: 20, maxWidth: 420, width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 id="titulo-cerrar-por" style={{ margin: 0, fontSize: 17, color: 'var(--cp-navy, #0B2C3E)' }}>
          Cerrar {pedido.codigo} por el repartidor
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--cp-soft, #5A6E78)' }}>
          El pedido se marca entregado a nombre del repartidor (su reparto y su pago cuentan). Quedará registrado como cerrado por ti.
        </p>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 700 }}>
          Repartidor que entregó
          <select value={repartidor} onChange={(e) => setRepartidor(e.target.value)} style={{ minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-line, #E3D6C6)', padding: '0 8px', fontSize: 14 }}>
            <option value="">Elige el repartidor…</option>
            {candidatos.map((r) => (
              <option key={r.party_id} value={r.party_id}>{r.nombre}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 700 }}>
          Motivo (obligatorio)
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            style={{ borderRadius: 10, border: '1.5px solid var(--cp-line, #E3D6C6)', padding: 8, fontSize: 14, fontFamily: 'inherit' }}
          />
        </label>
        {error && <p role="alert" style={{ margin: 0, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Boton variante="secundario" onClick={alCerrar} disabled={cargando}>No</Boton>
          <Boton cargando={cargando} disabled={cargando || !repartidor || motivo.trim().length < 5} onClick={confirmar}>Sí, cerrar por él</Boton>
        </div>
      </div>
    </div>
  );
}
