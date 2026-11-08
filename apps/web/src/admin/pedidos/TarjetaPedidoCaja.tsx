import { memo } from 'react';
import type { Pedido } from './pedidosApi';
import { IconoModalidad, IconoCanal, claveCanal, claveModalidad, textoMesa } from './InsigniaModalidad';
import { deliverySinUbicacion } from './ubicacionDelivery';
import { canalLabel, ChipCobroMozo } from './PedidosAdminView';
import { InsigniaDireccionEditada } from './InsigniaDireccionEditada';
import { InsigniaCambioCobro } from './PanelCambioCobro';
import { EtiquetaCajaCerrada } from './BannerCajaCerrada';
import { ESTILO_ESPERA, esCerrado, estadoVisual, nivelEspera } from './estadosCaja';
import type { AccionCaja } from './accionesCaja';

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });
const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', timeZone: 'America/Lima' });

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

/** «En el local · Mesa 4», «A domicilio · Zona 2» o «Para llevar». */
function lineaModalidad(o: Pedido): string {
  const clave = claveModalidad(o.modalidad);
  if (clave === 'MESA') {
    const n = String(o.mesa_nombre || '').trim();
    const mesa = !n ? 'Mesa' : /^(mesa|en espera)/i.test(n) ? n : `Mesa ${n}`;
    return `En el local · ${mesa}`;
  }
  if (clave === 'DELIVERY') return o.zona?.nombre ? `A domicilio · ${o.zona.nombre}` : 'A domicilio';
  if (clave === 'LLEVAR') return 'Para llevar';
  if (clave === 'COMER_LOCAL') return 'Comer en el local';
  return 'En el local';
}

export interface TarjetaPedidoCajaProps {
  pedido: Pedido;
  seleccionado: boolean;
  resaltado: boolean;
  cajaCerradaEspera: boolean;
  cambioCobroPendiente: boolean;
  alSeleccionar: (id: Pedido['id']) => void;
  /** Botón grande del pie (confirmar pago, preparar, listo…); null en los cerrados */
  accion?: AccionCaja | null;
  alAccion?: (pedido: Pedido, accion: AccionCaja) => void;
  /** Para pruebas: instante actual en ms. */
  ahora?: number;
}

/**
 * Tarjeta de la lista de Caja: barra de color por estado, código y nombre, espera, modalidad, productos, estado/pago/total
 * y un botón grande con la acción siguiente. El botón de abrir el detalle y el de acción son hermanos (no se anidan).
 */
export const TarjetaPedidoCaja = memo(function TarjetaPedidoCaja({
  pedido: o, seleccionado, resaltado, cajaCerradaEspera, cambioCobroPendiente, alSeleccionar, accion, alAccion, ahora,
}: TarjetaPedidoCajaProps) {
  const visual = estadoVisual(o);
  const pago = chipPago(o);
  const canal = claveCanal(o.canal, o.codigo);
  const clave = claveModalidad(o.modalidad);
  const cerrado = esCerrado(o);
  const lineas = o.lineas || [];
  const itemsTexto = lineas.map((l) => `${l.cantidad}× ${l.nombre}`);
  const esDelivery = clave === 'DELIVERY';
  const espera = o.creado_en ? Math.max(0, Math.floor(((ahora ?? Date.now()) - new Date(o.creado_en).getTime()) / 60000)) : null;
  const colorEspera = ESTILO_ESPERA[nivelEspera(espera, cerrado)];
  const sinUbicacion = esDelivery && deliverySinUbicacion(o);
  const lugar = esDelivery ? (sinUbicacion ? 'Falta la ubicación' : o.entrega_direccion || null) : null;
  // Cerrados y pedidos de días anteriores: la hora (con la fecha si no es de hoy); los demás, los minutos de espera
  const textoEspera = !o.creado_en ? null : cerrado || (espera ?? 0) >= 600 ? `${(espera ?? 0) >= 600 ? `${fechaCorta(o.creado_en)} ` : ''}${hora(o.creado_en)}` : `${espera} min`;

  return (
    <div
      className={`cj2-card ${resaltado ? 'cj-resaltado' : ''} ${seleccionado ? 'cj2-card--sel' : ''}`}
      data-estado={visual.clave}
    >
      <div className="cj2-barra" data-testid="barra-estado" aria-hidden="true" style={{ background: visual.barra }} />
      <button
        type="button"
        onClick={() => alSeleccionar(o.id)}
        className="cj2-abrir"
        aria-label={`Pedido ${o.codigo} de ${o.cliente_nombre?.trim() || 'Cliente'}`}
      >
        <span className="cj2-top">
          <span className="cj2-ident">
            <span className="cj2-cod">{o.codigo}</span>
            <NombreCliente pedido={o} />
          </span>
          {textoEspera && (
            <span className="cj2-espera" data-nivel={nivelEspera(espera, cerrado)} style={{ background: colorEspera.bg, color: colorEspera.fg }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              {textoEspera}
            </span>
          )}
        </span>

        <span className="cj2-mod">
          <span className="cj2-mod-texto" data-modalidad={clave}>
            <IconoModalidad modalidad={clave} tamano={16} />
            {lineaModalidad(o)}
          </span>
          <span className="cj2-canal" data-canal={canal}>
            <IconoCanal clave={canal} />
            {canalLabel(canal === 'WHATSAPP' ? 'WHATSAPP' : o.canal)}
            {o.creado_en && ` · ${hora(o.creado_en)}`}
          </span>
        </span>

        {lugar && (
          <span className="cj2-lugar" style={sinUbicacion ? { color: 'var(--cp-rust, #B2500F)', fontWeight: 800 } : undefined}>
            {lugar}
          </span>
        )}

        <span className="cj2-prods" title={itemsTexto.join(', ')}>
          {itemsTexto.length === 0 && <span>1 producto</span>}
          {itemsTexto.slice(0, 3).map((t, i) => (
            <span key={i}>{t}</span>
          ))}
          {itemsTexto.length > 3 && <span className="cj2-mas">+{itemsTexto.length - 3} más</span>}
        </span>

        {(cajaCerradaEspera || o.pedido_origen || o.cobroMozo || o.ubicacion_editada_en || cambioCobroPendiente) && (
          <span className="cj2-avisos">
            {cajaCerradaEspera && <EtiquetaCajaCerrada />}
            {o.pedido_origen && <span className="cj-pc-chip" data-testid="insignia-extra" style={{ background: '#FFF4D6', color: 'var(--cp-navy)' }}>EXTRA de {o.pedido_origen.codigo}</span>}
            <ChipCobroMozo cobro={o.cobroMozo} />
            {o.ubicacion_editada_en && <InsigniaDireccionEditada />}
            {cambioCobroPendiente && <InsigniaCambioCobro />}
          </span>
        )}

        <span className="cj2-pie-info">
          <span className="cj2-chips">
            <span className="cj-pc-chip" data-testid="chip-estado" style={{ background: visual.bg, color: visual.fg, border: visual.clave === 'anulado' ? '1.5px solid var(--cp-rust, #B2500F)' : undefined }}>{visual.l}</span>
            <span className={`cj-pc-chip cj-pc-pago-${pago.clase}`}>{pago.texto}</span>
            {o.total_con_extras != null && <span className="cj-pc-chip" data-testid="total-con-extras" style={{ background: '#FFF4D6', color: 'var(--cp-navy)' }}>Total con extras S/ {o.total_con_extras.toFixed(2)}</span>}
          </span>
          <span className="cj2-total">S/ {Number(o.total || 0).toFixed(2)}</span>
        </span>
      </button>
      {accion ? (
        <div className="cj2-accion-caja">
          <button
            type="button"
            className="cj2-accion"
            data-accion={accion.tipo}
            aria-label={`${accion.texto} ${o.codigo}`}
            style={{ background: accion.bg, color: accion.fg }}
            onClick={() => alAccion?.(o, accion)}
          >
            {accion.texto}
          </button>
        </div>
      ) : (
        <div aria-hidden="true" style={{ height: 6 }} />
      )}
    </div>
  );
});
