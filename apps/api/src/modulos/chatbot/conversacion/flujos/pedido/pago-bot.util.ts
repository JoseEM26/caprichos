import { VistaPreviaPedidoBot } from '../../tipos-conversacion';
import { EstadoCarritoPedido, MedioPagoBot } from './tipos-pedido';
import { BotonAccion, FilaLista } from '../../../puerto/whatsapp-mensajeria.puerto';

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Única función de totales del bot: resumen previo, final, efectivo y DTO. Con la vista previa del servidor
 * (descuento de promoción con casilla BOT y envío, ver vista-previa-pedido.util.ts) el total es el que cobra el servidor.
 */
export function calcularTotales(pedido: EstadoCarritoPedido, vista?: VistaPreviaPedidoBot | null) {
  // total = venta (sin propina). aCobrar = total + propina: lo que el cliente paga (montos, plan, efectivo).
  const propina = r2(pedido.propina ?? 0);
  if (vista) {
    const total = Math.max(0, r2(vista.subtotal - vista.descuento + (vista.envio ?? 0)));
    return {
      subtotal: vista.subtotal, descuento: vista.descuento, descuentoNombre: vista.descuentoNombre, envio: vista.envio,
      envioPromoNombre: vista.envioPromoNombre ?? null, envioGratisFalta: vista.envioGratisFalta ?? null,
      total, propina, aCobrar: r2(total + propina),
    };
  }
  const subtotal = r2(pedido.items.reduce((s, i) => s + i.subtotal, 0));
  const envio = pedido.modalidad === 'DELIVERY' ? (pedido.entrega?.tarifaEnvio ?? null) : 0;
  const total = Math.max(0, r2(subtotal + (envio || 0)));
  return { subtotal, descuento: 0, descuentoNombre: null, envio, envioPromoNombre: null, envioGratisFalta: null, total, propina, aCobrar: r2(total + propina) };
}

export const NOMBRE_MEDIO: Record<MedioPagoBot, string> = {
  EFECTIVO: 'Efectivo',
  YAPE: 'Yape',
  PLIN: 'Plin',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
};

const CLAVES: Array<[MedioPagoBot, string]> = [
  ['EFECTIVO', 'efectivo'],
  ['YAPE', 'yape'],
  ['PLIN', 'plin'],
  ['TARJETA', 'tarjeta'],
  ['TRANSFERENCIA', 'transferencia'],
];

/**
 * Medios activos del local. La configuración real (`mediosPago` de LocalService) solo trae los ACTIVOS;
 * sin configuración (o vacía) se ofrecen todos, como siempre.
 */
export function mediosActivos(datosLocalPublicos: any): MedioPagoBot[] {
  const cfg = datosLocalPublicos?.mediosPago ?? datosLocalPublicos?.mediosPagoVisibles ?? {};
  if (Object.keys(cfg).length === 0) return CLAVES.map(([m]) => m);
  return CLAVES.filter(([m, k]) => {
    const c = cfg[k] ?? (m === 'TARJETA' ? cfg.pos : undefined);
    return Boolean(c) && c.activo !== false;
  }).map(([m]) => m);
}

/** Medios que llevan voucher (los mismos que el servidor). */
export const MEDIOS_DIGITALES: MedioPagoBot[] = ['YAPE', 'PLIN', 'TRANSFERENCIA'];

/** Monto escrito por el cliente: «50», «s/50», «S/ 50.00», «50,5». null si no es un número positivo. */
/** «exacto», «justo», «sin vuelto», «lo exacto»… (sin número): paga el monto exacto. */
export function esPagoExacto(texto: string): boolean {
  const t = String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  return /^(lo |el |pago |pagare |pago el )?(exacto|justo|monto exacto|sin vuelto|sin cambio|cancelo exacto)\b/.test(t);
}

export function parsearMonto(texto: string): number | null {
  const limpio = String(texto || '').replace(/s\s*\/\.?/gi, '').replace(',', '.').replace(/[^\d.]/g, '');
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) && n > 0 ? r2(n) : null;
}

/**
 * Opciones de «con cuánto pagas»: monto exacto y hasta 2 billetes MAYORES al total
 * (total 62.50 → 70 y 100). Nunca un billete menor al total.
 */
export function opcionesBilletes(total: number): number[] {
  const t = r2(total);
  const redondeo = Math.ceil(t / 10) * 10;
  const sube: number[] = [];
  if (redondeo > t) sube.push(redondeo);
  const base = sube[0] ?? t;
  const billete = [20, 50, 100, 200].find((b) => b > base);
  if (billete) sube.push(billete);
  return sube.slice(0, 2);
}

export function botonesEfectivo(total: number): BotonAccion[] {
  return [
    { id: 'ped_paga_exacto', titulo: `Exacto (S/ ${total.toFixed(2)})` },
    ...opcionesBilletes(total).map((b) => ({ id: `ped_paga_${b}`, titulo: `S/ ${b}` })),
  ];
}

/** Medio principal, igual que el servidor: el digital de mayor monto, o el de mayor monto. */
export function medioPrincipal(plan: Array<{ medio: MedioPagoBot; monto: number }>): MedioPagoBot {
  const dig = plan.filter((f) => MEDIOS_DIGITALES.includes(f.medio));
  return [...(dig.length ? dig : plan)].sort((a, b) => b.monto - a.monto)[0].medio;
}

/** «Yape S/ 30.00 + Efectivo S/ 32.50, pagas con S/ 50.00, vuelto S/ 17.50» */
export function textoPago(pago: EstadoCarritoPedido['pago']): string {
  if (!pago?.metodo) return 'Efectivo';
  if (pago.plan?.length) {
    const partes = pago.plan.map((f) => `${NOMBRE_MEDIO[f.medio]} S/ ${f.monto.toFixed(2)}`).join(' + ');
    const ef = pago.plan.find((f) => f.medio === 'EFECTIVO');
    if (ef && pago.pagaCon) {
      return `${partes}, pagas con S/ ${pago.pagaCon.toFixed(2)}, vuelto S/ ${r2(pago.pagaCon - ef.monto).toFixed(2)}`;
    }
    return partes;
  }
  if (pago.metodo === 'EFECTIVO' && pago.pagaCon) return `Efectivo (Pagas con S/ ${pago.pagaCon.toFixed(2)})`;
  return NOMBRE_MEDIO[pago.metodo] ?? pago.metodo;
}

/** Filas/botones de medios: hasta 3 botones; si hay más, lista (WhatsApp permite 3 botones). */
export function opcionesMedios(medios: Array<{ id: string; titulo: string }>) {
  return medios.length <= 3
    ? { botones: medios as BotonAccion[] }
    : { filas: medios.map((m): FilaLista => ({ id: m.id, titulo: m.titulo })) };
}
