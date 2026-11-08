import type { PagoDespacho } from './cocinaTipos';

const MEDIO: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  YAPE: 'Yape',
  PLIN: 'Plin',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
  CREDITO_PERSONAL: 'Crédito del personal',
};

/** Nombre legible del medio; un código desconocido se muestra sin guiones bajos y con mayúscula inicial. */
export function etiquetaMedio(medio: string): string {
  if (MEDIO[medio]) return MEDIO[medio];
  const t = String(medio || '').replace(/_/g, ' ').toLowerCase().trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Sin medio';
}

type Tono = { texto: string; fondo: string; color: string; caja: string; borde: string };
// Cada situación con su color propio, siempre con texto: pagado (verde), por cobrar (óxido), personal (dorado)
const TONO = {
  PAGADO: { texto: 'YA PAGADO', fondo: '#2F7A45', color: '#FFFFFF', caja: '#EAF6EC', borde: '#2F7A45' },
  COBRADO_MOZO: { texto: 'YA PAGADO · cobró el mozo', fondo: '#2F7A45', color: '#FFFFFF', caja: '#EAF6EC', borde: '#2F7A45' },
  POR_COBRAR: { texto: 'POR COBRAR', fondo: '#B2500F', color: '#FFFFFF', caja: '#FFF1DC', borde: '#B2500F' },
  PERSONAL: { texto: 'CONSUMO DEL PERSONAL · a su crédito', fondo: '#D99E39', color: '#0B2C3E', caja: '#FFF7E0', borde: '#D99E39' },
} as const satisfies Record<string, Tono>;

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

/** Pago del pedido en Despacho: si ya se pagó, con qué medio, si es del personal y si lleva vuelto, con colores claros. */
export function ResumenPagoDespacho({
  pedidoId,
  pago,
  telefono,
  esPersonal = false,
}: {
  pedidoId: string;
  pago: PagoDespacho;
  telefono?: string | null;
  esPersonal?: boolean;
}) {
  const personal = esPersonal || pago.medios.some((m) => m.medio === 'CREDITO_PERSONAL');
  const t: Tono = personal ? TONO.PERSONAL : (TONO[pago.estado] ?? TONO.POR_COBRAR);
  const vuelto = personal
    ? { texto: 'Sin cobro en caja', detalle: 'se carga al crédito del trabajador', fondo: '#F3E9DB' }
    : pago.llevaVuelto === true
      ? { texto: `SÍ lleva vuelto: ${soles(pago.vuelto ?? 0)}`, detalle: pago.recibido != null ? `Paga con ${soles(pago.recibido)}` : '', fondo: '#FFE08A' }
      : pago.llevaVuelto === false
        ? { texto: pago.efectivo > 0 ? 'NO lleva vuelto (paga exacto)' : 'NO lleva vuelto', detalle: '', fondo: '#F3E9DB' }
        : { texto: 'Vuelto: no indicó con cuánto paga', detalle: `Efectivo ${soles(pago.efectivo)}`, fondo: '#FFE08A' };
  const fila: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '15px', color: '#0B2C3E' };
  return (
    <section
      data-testid={`pago-despacho-${pedidoId}`}
      aria-label="Pago del pedido"
      style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 12px', borderRadius: '12px', border: `2px solid ${t.borde}`, background: t.caja, color: '#0B2C3E' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <span
          data-testid={`pago-estado-${pedidoId}`}
          style={{ fontWeight: 900, fontSize: '14px', letterSpacing: '.03em', padding: '4px 12px', borderRadius: '9999px', background: t.fondo, color: t.color }}
        >
          {t.texto}
        </span>
        <strong style={{ fontSize: '20px', fontFamily: 'Montserrat, sans-serif' }}>{soles(pago.total)}</strong>
      </div>
      {pago.cobrarAlEntregar != null && !personal && (
        <div data-testid={`cobrar-entregar-${pedidoId}`} style={{ padding: '6px 10px', borderRadius: '8px', background: '#0B2C3E', color: '#fff', fontWeight: 900, fontSize: '16px' }}>
          COBRAR AL ENTREGAR: {soles(pago.cobrarAlEntregar)} (efectivo)
        </div>
      )}
      {pago.medios.map((m) => (
        <div key={m.medio} style={fila}>
          <span>{etiquetaMedio(m.medio)}</span>
          <span style={{ fontWeight: 700 }}>{soles(m.monto)}</span>
        </div>
      ))}
      {pago.descuento > 0 && (
        <div style={fila}>
          <span>{personal ? 'Descuento de personal' : 'Descuento'}</span>
          <span style={{ fontWeight: 700, color: '#1F5C32' }}>− {soles(pago.descuento)}</span>
        </div>
      )}
      {pago.propina > 0 && (
        <div style={fila}>
          <span>Propina</span>
          <span style={{ fontWeight: 700 }}>{soles(pago.propina)}</span>
        </div>
      )}
      <div data-testid={`vuelto-${pedidoId}`} style={{ padding: '6px 10px', borderRadius: '8px', background: vuelto.fondo, color: '#0B2C3E', fontWeight: 800, fontSize: '16px' }}>
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
