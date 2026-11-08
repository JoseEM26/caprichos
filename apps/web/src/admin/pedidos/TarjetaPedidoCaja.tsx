import { memo } from 'react';
import type { Pedido } from './pedidosApi';
import { InsigniaMesa } from './InsigniaMesa';
import { PastillaEspera } from './PastillaEspera';
import { IconoModalidad, IconoCanal, claveCanal, claveModalidad, textoMesa, type ClaveModalidad } from './InsigniaModalidad';
import { deliverySinUbicacion } from './ubicacionDelivery';
import { canalLabel, ChipCobroMozo } from './PedidosAdminView';
import { InsigniaDireccionEditada } from './InsigniaDireccionEditada';
import { InsigniaCambioCobro } from './PanelCambioCobro';
import { EtiquetaCajaCerrada } from './BannerCajaCerrada';
import { esCerrado, estadoVisual } from './estadosCaja';
import type { AccionCaja } from './accionesCaja';
import { AccionesComerLocal } from '../salon/componentes/AccionesComerLocal';

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });

/** Nombre del cliente (es lo único que se acorta); la mesa va en su propia insignia. */
export function NombreCliente({ pedido }: { pedido: Pick<Pedido, 'cliente_nombre'> }) {
  const nombre = pedido.cliente_nombre?.trim() || 'Cliente';
  return (
    <h3 className="cj-pc-nombre cj2-nombre" title={nombre}>
      {nombre}
    </h3>
  );
}

function chipPago(o: Pedido): { texto: string; clase: string } {
  const pag = String(o.pago_estado || '').toUpperCase();
  // Consumo del personal: se carga al crédito del trabajador, no se cobra en caja
  if (o.es_personal) return { texto: 'Crédito del personal', clase: 'info' };
  if (pag === 'PAGADO') return { texto: 'Pagado', clase: 'ok' };
  if (pag === 'COORDINADO') return { texto: 'Pago coordinado', clase: 'info' };
  return { texto: 'Por cobrar', clase: 'pend' };
}

const ROTULO: Record<ClaveModalidad, string> = {
  DELIVERY: 'DELIVERY', LLEVAR: 'PARA LLEVAR', MESA: 'MESA', COMER_LOCAL: 'COMER EN EL LOCAL', LOCAL: 'EN EL LOCAL',
};

/** Rótulo de la insignia («MESA 4», «DELIVERY») y detalle secundario (la zona del delivery). */
function textoInsignia(o: Pedido): { rotulo: string; detalle: string | null } {
  const clave = claveModalidad(o.modalidad);
  if (clave === 'MESA') return { rotulo: ROTULO.MESA, detalle: null };
  if (clave === 'DELIVERY') return { rotulo: ROTULO.DELIVERY, detalle: o.zona?.nombre || null };
  return { rotulo: ROTULO[clave], detalle: null };
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
  /** Refresca la lista tras asignar mesa o mandar a la lista de espera (pedidos «Comer en el local»). */
  alComerLocal?: () => void;
  /** Para pruebas: instante actual en ms. */
  ahora?: number;
}

/**
 * Tarjeta de la lista de Caja: barra de color por estado, código y nombre, espera, modalidad, productos, estado/pago/total
 * y un botón grande con la acción siguiente. El botón de abrir el detalle y el de acción son hermanos (no se anidan).
 */
export const TarjetaPedidoCaja = memo(function TarjetaPedidoCaja({
  pedido: o, seleccionado, resaltado, cajaCerradaEspera, cambioCobroPendiente, alSeleccionar, accion, alAccion, alComerLocal, ahora,
}: TarjetaPedidoCajaProps) {
  const visual = estadoVisual(o);
  const pago = chipPago(o);
  const canal = claveCanal(o.canal, o.codigo);
  const clave = claveModalidad(o.modalidad);
  const insignia = textoInsignia(o);
  const cerrado = esCerrado(o);
  const conMesa = !!o.mesa_nombre?.trim() && (clave === 'MESA' || /^en espera/i.test(o.mesa_nombre));
  const nombreCompleto = o.cliente_nombre?.trim() || 'Cliente';
  const lineas = o.lineas || [];
  const itemsTexto = lineas.map((l) => `${l.cantidad}× ${l.nombre}`);
  const esDelivery = clave === 'DELIVERY';
  const sinUbicacion = esDelivery && deliverySinUbicacion(o);
  const lugar = esDelivery ? (sinUbicacion ? 'Falta la ubicación' : o.entrega_direccion || null) : null;

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
        aria-label={conMesa ? `Pedido ${o.codigo}, ${textoMesa(o.mesa_nombre)}, de ${nombreCompleto}` : `Pedido ${o.codigo} de ${nombreCompleto}`}
      >
        <span className="cj2-top">
          <span className="cj2-ident">
            {conMesa && <InsigniaMesa mesaNombre={o.mesa_nombre} grande />}
            <NombreCliente pedido={o} />
          </span>
          <PastillaEspera creadoEn={o.creado_en} cerrado={cerrado} ahora={ahora} />
        </span>

        <span className="cj2-mod">
          <span className="cj2-mod-texto" data-modalidad={clave}>
            <span className="cj2-mod-ico"><IconoModalidad modalidad={clave} tamano={22} /></span>
            <span className="cj2-mod-txt">{insignia.rotulo}</span>
            {insignia.detalle && <span className="cj2-mod-det">· {insignia.detalle}</span>}
          </span>
          <span className="cj2-canal" data-canal={canal}>
            <span className="cj2-cod cj2-codigo">{o.codigo}</span> ·{' '}
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
      {String(o.modalidad).toUpperCase() === 'COMER_LOCAL' && <AccionesComerLocal pedido={o} alCambio={alComerLocal} compacto />}
    </div>
  );
});
