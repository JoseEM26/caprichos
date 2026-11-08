import type { PagoDespacho } from './cocinaTipos';

const MEDIO: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  YAPE: 'Yape',
  PLIN: 'Plin',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
};
const ESTADO = {
  PAGADO: { texto: 'Pagado', fondo: '#2F7A45', color: '#fff' },
  COBRADO_MOZO: { texto: 'Cobrado por mozo', fondo: '#2F7A45', color: '#fff' },
  POR_COBRAR: { texto: 'Por cobrar', fondo: 'var(--cp-orange, #E67929)', color: 'var(--cp-navy)' },
} as const;

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

/** Pago del pedido en Despacho: medios, estado del cobro y si lleva vuelto, en un bloque corto y ordenado. */
export function ResumenPagoDespacho({ pedidoId, pago, telefono }: { pedidoId: string; pago: PagoDespacho; telefono?: string | null }) {
  const e = ESTADO[pago.estado] ?? ESTADO.POR_COBRAR;
  const vuelto =
    pago.llevaVuelto === true
      ? { texto: `SÍ lleva vuelto: ${soles(pago.vuelto ?? 0)}`, detalle: pago.recibido != null ? `Paga con ${soles(pago.recibido)}` : '', fondo: '#FFF3C4' }
      : pago.llevaVuelto === false
        ? { texto: pago.efectivo > 0 ? 'NO lleva vuelto (paga exacto)' : 'NO lleva vuelto', detalle: '', fondo: 'var(--cp-sand, #EDE1D1)' }
        : { texto: 'Vuelto: no indicó con cuánto paga', detalle: `Efectivo ${soles(pago.efectivo)}`, fondo: '#FFF3C4' };
  const fila: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '15px' };
  return (
    <section
      data-testid={`pago-despacho-${pedidoId}`}
      aria-label="Pago del pedido"
      style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid var(--cp-line, #E3D6C6)', background: 'var(--cp-cream, #FBF6EE)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Pago</strong>
        <span data-testid={`pago-estado-${pedidoId}`} style={{ fontWeight: 800, fontSize: '13px', padding: '2px 10px', borderRadius: '9999px', background: e.fondo, color: e.color }}>
          {e.texto}
        </span>
        <strong style={{ marginLeft: 'auto', fontSize: '18px' }}>{soles(pago.total)}</strong>
      </div>
      {pago.medios.map((m) => (
        <div key={m.medio} style={fila}>
          <span>{MEDIO[m.medio] ?? m.medio}</span>
          <span style={{ fontWeight: 700 }}>{soles(m.monto)}</span>
        </div>
      ))}
      {pago.descuento > 0 && (
        <div style={fila}>
          <span>Descuento</span>
          <span style={{ fontWeight: 700 }}>− {soles(pago.descuento)}</span>
        </div>
      )}
      {pago.propina > 0 && (
        <div style={fila}>
          <span>Propina</span>
          <span style={{ fontWeight: 700 }}>{soles(pago.propina)}</span>
        </div>
      )}
      <div data-testid={`vuelto-${pedidoId}`} style={{ padding: '6px 10px', borderRadius: '8px', background: vuelto.fondo, fontWeight: 800, fontSize: '16px' }}>
        {vuelto.texto}
        {vuelto.detalle && <span style={{ fontWeight: 600, fontSize: '14px' }}> · {vuelto.detalle}</span>}
      </div>
      {telefono && (
        <div style={fila}>
          <span>Celular</span>
          <span style={{ fontWeight: 700 }}>{telefono}</span>
        </div>
      )}
    </section>
  );
}
