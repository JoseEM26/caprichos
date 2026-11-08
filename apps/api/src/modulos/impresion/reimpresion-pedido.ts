import {
  areasDeLineas,
  claveDeTrabajo,
  claveEtiquetaArea,
  claveEtiquetaBebida,
  CLAVE_GENERAL,
  CLAVE_TICKET,
  construirEtiquetaGeneral,
  construirEtiquetasArea,
  construirEtiquetasBebida,
  construirTicketComandaArea,
  construirTicketComandaSalon,
} from './constructor-etiquetas';
import { aplicaSegunReglas } from './ruteo-impresion';

export type TipoReimpresion = 'todo' | 'stickers' | 'ticket_cocina' | 'ticket_pago';
export type SubSticker = 'todos' | 'general' | 'area' | 'bebida';

export interface ItemReimpresion {
  tipo: string;
  /** Clave estable dentro del pedido (para no duplicar lo que ya está en cola). */
  clave: string;
  etiqueta: string;
  payload: any;
  areaId: bigint | null;
}
export interface OmitidoReimpresion {
  tipo: string;
  etiqueta: string;
  motivo: string;
}

export const ESTADOS_NO_VIGENTES = ['ANULADO', 'RECHAZADO'];
export const MARCA_PRECUENTA = 'PRE-CUENTA - SIN PAGAR';

const claveComanda = (tipo: string, area?: string | null) => (tipo === 'TICKET_COMANDA_AREA' ? `COMANDA_AREA:${area ?? ''}` : 'COMANDA_SALON');
/** Clave de un trabajo ya encolado (etiquetas, ticket de pago y comandas). */
export const claveDeJob = (j: { tipo: string; payload: any }): string | null =>
  claveDeTrabajo(j) ?? (j.tipo.startsWith('TICKET_COMANDA') ? claveComanda(j.tipo, j.payload?.area) : null);

/** Qué papeles pide la reimpresión, con los mismos constructores de una venta real. Las reglas de modalidad se respetan. */
export function planReimpresion(
  pedido: any,
  tipo: TipoReimpresion,
  sub: SubSticker,
  reglas: any,
  ticketPago: any,
  marca: string | null,
): { items: ItemReimpresion[]; omitidos: OmitidoReimpresion[] } {
  const items: ItemReimpresion[] = [];
  const omitidos: OmitidoReimpresion[] = [];
  const poner = (it: ItemReimpresion) => {
    if (aplicaSegunReglas(it.tipo, pedido.modalidad, reglas)) items.push(it);
    else omitidos.push({ tipo: it.tipo, etiqueta: it.etiqueta, motivo: `El Mapa de impresión no imprime esto para la modalidad ${pedido.modalidad}` });
  };
  const conMarca = <T extends object>(p: T): T => (marca ? { ...p, marca } : p);

  // Tickets primero: es el orden de creación y de la cola
  if (tipo === 'todo' || tipo === 'ticket_pago') {
    items.push({ tipo: 'TICKET_PAGO', clave: CLAVE_TICKET, etiqueta: 'Ticket de pago', payload: ticketPago, areaId: null });
  }
  if (tipo === 'todo' || tipo === 'ticket_cocina') {
    poner({ tipo: 'TICKET_COMANDA_SALON', clave: claveComanda('TICKET_COMANDA_SALON'), etiqueta: 'Ticket de cocina', payload: conMarca(construirTicketComandaSalon(pedido)), areaId: null });
    for (const areaId of areasDeLineas(pedido)) {
      const p = construirTicketComandaArea(pedido, areaId);
      poner({ tipo: 'TICKET_COMANDA_AREA', clave: claveComanda('TICKET_COMANDA_AREA', p.area), etiqueta: `Ticket de cocina ${p.area ?? ''}`.trim(), payload: conMarca(p), areaId });
    }
  }
  if (tipo === 'todo' || tipo === 'stickers') {
    const s = tipo === 'todo' ? 'todos' : sub;
    if (s === 'todos' || s === 'general') {
      poner({ tipo: 'ETIQUETA_GENERAL', clave: CLAVE_GENERAL, etiqueta: 'Sticker general', payload: construirEtiquetaGeneral(pedido), areaId: null });
    }
    if (s === 'todos' || s === 'area') {
      for (const a of construirEtiquetasArea(pedido)) {
        const areaId = pedido.lineas.find((l: any) => (l.area?.nombre || '').toUpperCase() === a.areaNombre)?.area_id ?? null;
        poner({ tipo: 'ETIQUETA_AREA', clave: claveEtiquetaArea(a.areaNombre), etiqueta: `Sticker ${a.areaNombre}`, payload: a, areaId });
      }
    }
    if (s === 'todos' || s === 'bebida') {
      for (const b of construirEtiquetasBebida(pedido)) {
        poner({ tipo: 'ETIQUETA_BEBIDA', clave: claveEtiquetaBebida(b.bebidaIndex), etiqueta: `Sticker de bebida ${b.bebidaIndex}`, payload: b, areaId: null });
      }
    }
  }
  return { items, omitidos };
}
