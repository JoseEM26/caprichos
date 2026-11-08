import { inicioDiaLimaDeFecha } from '../../cocina/cocina.util';

/** Qué tan procesado está un chat de WhatsApp en el punto de venta. */
export type PosEstado = 'REGISTRADO' | 'SIN_COBRAR' | 'SIN_PEDIDO';

export interface PosChat {
  estado: PosEstado;
  codigo: string | null;
  pedidoId: string | null;
}

export interface PedidoParaPos {
  id: bigint;
  codigo: string;
  estado: string;
  pago_estado: string | null;
  cliente_telefono: string | null;
  creado_en: Date;
}

/** Los últimos 9 dígitos: el chat guarda 51XXXXXXXXX y el pedido puede traer solo el celular. */
export const ultimos9 = (tel?: string | null): string => {
  const d = String(tel ?? '').replace(/\D/g, '');
  return d.length >= 9 ? d.slice(-9) : '';
};

/** Inicio (00:00 de Lima) del día de `ahora`. */
export function inicioHoyLima(ahora = new Date()): Date {
  return inicioDiaLimaDeFecha(new Date(ahora.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10));
}

/** Id del pedido ligado al chat porque su voucher llegó por ahí (flujo.pago.pedidoId). */
export const pedidoLigadoDelFlujo = (flujo: unknown): bigint | null => {
  const id = (flujo as any)?.pago?.pedidoId;
  return id && /^\d+$/.test(String(id)) ? BigInt(String(id)) : null;
};

/**
 * Cruza chats con pedidos en memoria (el servicio trae los pedidos en UNA consulta):
 * el pedido ligado por el flujo del chat, o el más reciente de hoy con el mismo celular. Los anulados no cuentan.
 */
export function resolverPos(
  chats: { id: bigint; telefono: string; flujo?: unknown }[],
  pedidos: PedidoParaPos[],
): Map<bigint, PosChat> {
  const vivos = pedidos
    .filter((p) => p.estado !== 'ANULADO')
    .sort((a, b) => b.creado_en.getTime() - a.creado_en.getTime());
  const porId = new Map(vivos.map((p) => [p.id.toString(), p]));
  const porTel = new Map<string, PedidoParaPos>();
  for (const p of vivos) {
    const k = ultimos9(p.cliente_telefono);
    if (k && !porTel.has(k)) porTel.set(k, p);
  }
  const mapa = new Map<bigint, PosChat>();
  for (const c of chats) {
    const ligado = pedidoLigadoDelFlujo(c.flujo);
    const p = (ligado && porId.get(ligado.toString())) || porTel.get(ultimos9(c.telefono));
    mapa.set(
      c.id,
      p
        ? { estado: p.pago_estado === 'PAGADO' ? 'REGISTRADO' : 'SIN_COBRAR', codigo: p.codigo, pedidoId: p.id.toString() }
        : { estado: 'SIN_PEDIDO', codigo: null, pedidoId: null },
    );
  }
  return mapa;
}

/** Un chat «falta procesar» si el cliente escribió hoy y no tiene pedido en el punto de venta. */
export const faltaProcesar = (pos: PosChat, clienteEscribioHoy: boolean): boolean =>
  pos.estado === 'SIN_PEDIDO' && clienteEscribioHoy;

/** Un chat archivado se «reabre» solo cuando el CLIENTE escribe de nuevo (ni el bot ni el equipo lo reabren). */
export const reabiertoTrasAtendido = (
  atendidoEn: Date | null | undefined,
  mensajes: { autor: string; en: Date }[],
): boolean => !!atendidoEn && mensajes.some((m) => m.autor === 'CLIENTE' && m.en > atendidoEn);
