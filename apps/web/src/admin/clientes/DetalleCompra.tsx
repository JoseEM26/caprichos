import { useEffect, useState } from 'react';
import { obtenerDetalleCompra } from './clientesApi';
import type { DetalleCompraCliente } from './tipos';

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

/** Lo que pidió el cliente en una compra: se carga al desplegarla. */
export function DetalleCompra({ clienteId, pedidoId }: { clienteId: string; pedidoId: string }) {
  const [d, setD] = useState<DetalleCompraCliente | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    obtenerDetalleCompra(clienteId, pedidoId).then(setD).catch((e: any) => setError(e?.message || 'No se pudo cargar el detalle.'));
  }, [clienteId, pedidoId]);

  if (error) return <div role="alert" style={{ fontSize: 12, color: 'var(--cp-rust)' }}>{error}</div>;
  if (!d) return <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>Cargando detalle...</div>;

  return (
    <div data-testid="detalle-compra" style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {d.lineas.map((l) => {
          const extra = [
            l.tamano,
            l.opciones.join(', '),
            l.sabores.map((s) => `${s.nombre} x${s.cantidad}`).join(', '),
            l.nombresPersona.length ? `Vasos: ${l.nombresPersona.join(', ')}` : '',
            l.nota ? `Nota: ${l.nota}` : '',
          ].filter(Boolean).join(' · ');
          return (
            <li key={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>
                <b>{l.cantidad}×</b> {l.nombre}{l.cortesia ? ' (cortesía)' : ''}
                {extra && <span style={{ display: 'block', color: 'var(--cp-soft)' }}>{extra}</span>}
              </span>
              <span>{soles(l.subtotal)}</span>
            </li>
          );
        })}
      </ul>
      <div style={{ borderTop: '1px dashed var(--cp-line)', paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Fila t="Subtotal" v={soles(d.subtotal)} />
        {d.descuentos.length > 0
          ? d.descuentos.map((x, i) => <Fila key={i} t={`Descuento · ${x.nombre}`} v={`- ${soles(x.monto)}`} />)
          : d.descuento > 0 && <Fila t="Descuento" v={`- ${soles(d.descuento)}`} />}
        {d.puntosCanjeados > 0 && <Fila t="Puntos canjeados" v={`${d.puntosCanjeados.toFixed(2)} pts`} />}
        {d.envio != null && d.envio > 0 && <Fila t="Envío" v={soles(d.envio)} />}
        {d.propina > 0 && <Fila t="Propina" v={soles(d.propina)} />}
        <Fila t={<b>Total</b>} v={<b>{soles(d.total)}</b>} />
        <Fila t="Pago" v={`${d.pagos && d.pagos.length > 0 ? d.pagos.map((x) => `${x.medio} ${soles(x.monto)}`).join(' · ') : (d.medioPago ?? 'Sin medio')} · ${d.pagoEstado === 'PAGADO' ? 'Cobrado' : 'Sin cobrar'}`} />
        <Fila t="Comprobante" v={d.comprobante === 'SIMPLE' || !d.comprobante ? 'Ticket' : d.comprobante} />
        <Fila t="Estado" v={d.estado} />
        {d.nota && <Fila t="Nota del pedido" v={d.nota} />}
      </div>
    </div>
  );
}

function Fila({ t, v }: { t: React.ReactNode; v: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: 'var(--cp-soft)' }}>{t}</span>
      <span>{v}</span>
    </div>
  );
}
