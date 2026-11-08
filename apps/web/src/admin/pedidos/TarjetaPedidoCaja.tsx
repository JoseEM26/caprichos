import { memo } from 'react';
import type { Pedido } from './pedidosApi';
import { InsigniaModalidad, IconoCanal, claveCanal, textoMesa } from './InsigniaModalidad';
import { deliverySinUbicacion } from './ubicacionDelivery';
import { canalLabel, getBadge, ChipCobroMozo } from './PedidosAdminView';
import { InsigniaDireccionEditada } from './InsigniaDireccionEditada';
import { InsigniaCambioCobro } from './PanelCambioCobro';
import { EtiquetaCajaCerrada } from './BannerCajaCerrada';

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });

const COLOR_ESPERA: Record<string, string> = { verde: '#2F7A45', naranja: '#B2500F', rojo: '#B42318' };

/** Nombre grande; en mesa, «Mesa 4 · Ana» con la mesa destacada. */
export function NombreCliente({ pedido }: { pedido: Pick<Pedido, 'cliente_nombre' | 'modalidad' | 'mesa_nombre'> }) {
  const nombre = pedido.cliente_nombre?.trim() || 'Cliente';
  const mesa = String(pedido.modalidad).toUpperCase() === 'MESA' && pedido.mesa_nombre ? textoMesa(pedido.mesa_nombre) : null;
  const titulo = mesa ? `${mesa} · ${nombre}` : nombre;
  return (
    <h3 className="cj-pc-nombre" title={titulo}>
      {mesa && <span className="cj-pc-mesa">{mesa} · </span>}
      {nombre}
    </h3>
  );
}

function chipPago(o: Pedido): { texto: string; clase: string } {
  const pag = String(o.pago_estado || '').toUpperCase();
  if (pag === 'PAGADO') return { texto: 'Pagado', clase: 'ok' };
  if (pag === 'COORDINADO') return { texto: 'Pago coordinado', clase: 'info' };
  return { texto: 'Por cobrar', clase: 'pend' };
}

export interface TarjetaPedidoCajaProps {
  pedido: Pedido;
  seleccionado: boolean;
  resaltado: boolean;
  cajaCerradaEspera: boolean;
  cambioCobroPendiente: boolean;
  alSeleccionar: (id: Pedido['id']) => void;
  /** Para pruebas: instante actual en ms. */
  ahora?: number;
}

/** Tarjeta de la lista de Caja: nombre y modalidad primero; código, canal y espera; estado, pago y total. */
export const TarjetaPedidoCaja = memo(function TarjetaPedidoCaja({
  pedido: o, seleccionado, resaltado, cajaCerradaEspera, cambioCobroPendiente, alSeleccionar, ahora,
}: TarjetaPedidoCajaProps) {
  const badge = getBadge(o);
  const pago = chipPago(o);
  const canal = claveCanal(o.canal, o.codigo);
  const itemsTexto = (o.lineas || []).map((l) => `${l.cantidad}× ${l.nombre}`).join(', ');
  const esDelivery = String(o.modalidad).toUpperCase() === 'DELIVERY';
  const espera = o.creado_en ? Math.max(0, Math.floor(((ahora ?? Date.now()) - new Date(o.creado_en).getTime()) / 60000)) : null;
  const colorEspera = COLOR_ESPERA[String(o.colorEspera || o.color || '')] ?? 'var(--cp-soft, #2C4C5D)';
  const sinUbicacion = esDelivery && deliverySinUbicacion(o);
  const lugar = esDelivery ? (sinUbicacion ? 'Falta la ubicación' : o.zona?.nombre || o.entrega_direccion || null) : null;

  return (
    <button
      type="button"
      onClick={() => alSeleccionar(o.id)}
      className={`cj-pedido-card cj-pc ${resaltado ? 'cj-resaltado' : ''}`}
      aria-label={`Pedido ${o.codigo} de ${o.cliente_nombre?.trim() || 'Cliente'}`}
      style={{ border: `1.5px solid ${seleccionado ? 'var(--cp-orange, #E67929)' : 'var(--cp-line, #E3D6C6)'}` }}
    >
      <div className="cj-pc-top">
        <NombreCliente pedido={o} />
        <InsigniaModalidad modalidad={o.modalidad} mesaNombre={o.mesa_nombre} />
      </div>
      <div className="cj-pc-codigo">
        <span className="cj-pc-cod">{o.codigo}</span>
        <span className="cj-pc-canal" data-canal={canal}>
          <IconoCanal clave={canal} />
          {canalLabel(canal === 'WHATSAPP' ? 'WHATSAPP' : o.canal)}
        </span>
        {o.creado_en && (
          <span style={{ color: colorEspera, fontWeight: 700 }}>
            {hora(o.creado_en)} · {espera} min
          </span>
        )}
        {cajaCerradaEspera && <EtiquetaCajaCerrada />}
        {o.pedido_origen && <span className="cj-pc-chip" data-testid="insignia-extra" style={{ background: '#FFF4D6', color: 'var(--cp-navy)' }}>EXTRA de {o.pedido_origen.codigo}</span>}
      </div>
      {lugar && (
        <div className="cj-pc-lugar" style={sinUbicacion ? { color: 'var(--cp-rust, #B2500F)', fontWeight: 700 } : undefined}>
          {lugar}
        </div>
      )}
      <ChipCobroMozo cobro={o.cobroMozo} />
      {o.ubicacion_editada_en && <InsigniaDireccionEditada />}
      {cambioCobroPendiente && <InsigniaCambioCobro />}
      <div className="cj-pc-estado">
        <span className="cj-pc-chip" style={{ background: badge.bg, color: badge.fg }}>{badge.l}</span>
        <span className={`cj-pc-chip cj-pc-pago-${pago.clase}`}>{pago.texto}</span>
        <span className="cj-pc-total">S/ {Number(o.total || 0).toFixed(2)}</span>
        {o.total_con_extras != null && <span className="cj-pc-chip" data-testid="total-con-extras" style={{ background: '#FFF4D6', color: 'var(--cp-navy)' }}>Total con extras S/ {o.total_con_extras.toFixed(2)}</span>}
      </div>
      <div className="cj-pc-items" title={itemsTexto}>{itemsTexto || '1 producto'}</div>
    </button>
  );
});
