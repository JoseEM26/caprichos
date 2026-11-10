import type { EstadoSeguimiento, PagoMedioSeguimiento } from './seguimiento';

export const NOMBRE_MEDIO: Record<string, string> = {
  YAPE: 'Yape',
  PLIN: 'Plin',
  TRANSFERENCIA: 'Transferencia',
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
};

export const NOMBRE_MODALIDAD: Record<string, string> = {
  DELIVERY: 'Delivery',
  RECOGER: 'Recojo en local',
  MESA: 'Comer en el local',
  COMER_LOCAL: 'Comer en el local',
};

export type TonoEtapa = 'normal' | 'listo' | 'fin' | 'anulado';

export interface EtapaCliente {
  /** Paso actual de la línea de tiempo (minúsculas): recibido, cocina, listo, camino, llego, entregado, anulado. */
  clave: string;
  titulo: string;
  detalle: string;
  tono: TonoEtapa;
}

/**
 * Mensaje principal para el cliente según el paso actual que calcula la API (modalidad + hitos + áreas de cocina).
 * Nunca decide el estado por su cuenta: solo lo redacta.
 */
export function etapaCliente(estado: EstadoSeguimiento | null, nombre = ''): EtapaCliente {
  if (!estado) return { clave: 'cargando', titulo: 'Consultando el estado de tu pedido...', detalle: '', tono: 'normal' };
  if (estado.anulado) {
    return { clave: 'anulado', titulo: 'Tu pedido fue anulado', detalle: 'Si fue un error, escríbenos por WhatsApp.', tono: 'anulado' };
  }
  const clave = (estado.pasos.find((p) => p.actual)?.clave ?? 'recibido').toLowerCase();
  const local = estado.modalidad === 'COMER_LOCAL';
  const delivery = estado.modalidad === 'DELIVERY';
  const progreso = estado.progreso?.etiqueta ?? '';

  switch (clave) {
    case 'cocina': {
      const p = estado.progreso;
      if (p && p.totalAreas > 0 && p.listasDe === p.totalAreas) {
        return { clave, titulo: 'Casi listo: armando tu pedido', detalle: 'Todo está preparado; lo estamos empacando para entregarlo.', tono: 'normal' };
      }
      const parcial = estado.progreso?.etapa === 'PARCIAL' ? progreso : '';
      return { clave, titulo: 'Estamos preparando tu pedido', detalle: parcial || 'Está en cocina, te avisamos cuando esté listo.', tono: 'normal' };
    }
    case 'listo':
      if (delivery) {
        const conRepartidor = /esperando salida/i.test(progreso);
        return {
          clave,
          titulo: 'Tu pedido está listo',
          detalle: conRepartidor ? 'Ya tiene repartidor: saldrá en cualquier momento.' : 'Esperamos al repartidor para que salga a tu dirección.',
          tono: 'listo',
        };
      }
      if (local) {
        return {
          clave,
          titulo: 'Tu pedido está listo',
          detalle: estado.ubicacion === 'ASIGNADA' && estado.mesa ? `Te lo llevamos a la ${estado.mesa}.` : `Te llamaremos por tu nombre${nombre ? `, ${nombre}` : ''}.`,
          tono: 'listo',
        };
      }
      return { clave, titulo: 'Tu pedido está listo para recoger', detalle: `Pasa por el local y muestra tu código #${estado.codigo}.`, tono: 'listo' };
    case 'camino':
      return { clave, titulo: 'Tu pedido va en camino', detalle: progreso || 'El repartidor ya salió.', tono: 'normal' };
    case 'llego':
      return { clave, titulo: 'Tu repartidor llegó', detalle: 'Sal a recibir tu pedido.', tono: 'listo' };
    case 'entregado':
      return {
        clave,
        titulo: delivery ? 'Pedido entregado' : local ? 'Pedido servido en tu mesa' : 'Pedido recogido',
        detalle: '¡Buen provecho! Gracias por elegir Caprichos.',
        tono: 'fin',
      };
    default:
      return { clave: 'recibido', titulo: 'Recibimos tu pedido', detalle: 'En unos minutos lo pasamos a cocina.', tono: 'normal' };
  }
}

/** Texto del estado de un medio de pago, igual de claro para el cliente que para el equipo. */
export function textoPagoMedio(p: PagoMedioSeguimiento, hora?: string | null): string {
  switch (p.estado) {
    case 'SIN_VOUCHER':
      return 'Aún no enviaste tu captura';
    case 'EN_REVISION':
      return 'Recibimos tu voucher y lo estamos revisando';
    case 'VERIFICADO':
      return hora ? `Pago confirmado ✓ · ${hora}` : 'Pago confirmado ✓';
    case 'RECHAZADO':
      return p.motivo ? `No pudimos validar tu voucher (${p.motivo}): vuelve a enviarlo` : 'No pudimos validar tu voucher: vuelve a enviarlo';
    case 'COBRADO_MOZO':
      return 'Cobrado por tu mozo';
    case 'PAGADO':
      return 'Pago confirmado ✓';
    default:
      return 'Lo pagas al recibir tu pedido';
  }
}

/** Una firma por pestaña: si cambia mientras el cliente mira otra pestaña, se marca con un punto. */
export function firmasPestanas(e: EstadoSeguimiento | null): Record<'estado' | 'pedido' | 'pago', string> {
  if (!e) return { estado: '', pedido: '', pago: '' };
  return {
    estado: `${e.anulado}|${e.pasos.map((p) => `${p.clave}${p.hecho ? 1 : 0}${p.actual ? 1 : 0}`).join(',')}`,
    pedido: JSON.stringify((e.progreso?.areas ?? []).map((a) => [a.nombre, a.estado, a.productos?.map((p) => p.listas)])),
    pago: JSON.stringify((e.resumenPago?.pagos ?? []).map((p) => [p.medio, p.estado])) + (e.voucher?.estado ?? ''),
  };
}

export interface FaltaArea {
  area: string;
  listos: number;
  total: number;
  /** Productos de esa área con unidades pendientes: «1 de 3 Waffle» */
  faltan: string[];
}

/** Avance por unidades y por área (misma fuente que el admin: progreso.areas de la API). */
export function avancePedido(estado: EstadoSeguimiento | null): { listos: number; total: number; areas: FaltaArea[] } {
  const areas: FaltaArea[] = (estado?.progreso?.areas ?? []).map((a) => {
    const prods = a.productos ?? [];
    const listos = prods.reduce((s, p) => s + Math.min(p.listas ?? 0, p.cantidad), 0);
    return {
      area: a.nombre,
      listos,
      total: prods.reduce((s, p) => s + p.cantidad, 0),
      faltan: prods.filter((p) => (p.listas ?? 0) < p.cantidad).map((p) => `${p.cantidad - (p.listas ?? 0)} ${p.nombre}`),
    };
  });
  return { listos: areas.reduce((s, a) => s + a.listos, 0), total: areas.reduce((s, a) => s + a.total, 0), areas };
}
