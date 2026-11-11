import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MATRIZ } from '../acceso/permisos';
import { rolesDelUsuario } from '../acceso/roles-usuario';
import { montoElegiblePuntos } from '../ofertas/puntos-elegibles.util';

/** Líneas que por su nombre ya son un paquete o promoción (regla vigente de registrarConsumo). */
const REGEX_EXCLUIDOS = /combo|promoci[oó]n|docena/i;

export const PCT_DESCUENTO_PERSONAL_DEFECTO = 25;

export interface LineaDescuentoPersonal {
  productoId?: bigint | string | number | null;
  nombre: string;
  subtotal: number;
  noSumaBeneficios?: boolean;
  /** Línea de combo/oferta: trae su propio precio */
  enPromocion?: boolean;
}

/**
 * Descuento del personal: porcentaje sobre lo elegible. Quedan fuera combos, promociones, «docena»,
 * productos que no suman beneficios y líneas que ya recibieron otro descuento o cupón del pedido.
 */
export function calcularDescuentoPersonal(
  lineas: LineaDescuentoPersonal[],
  detalles: Array<{ lineasAfectadas?: Array<{ productoId: string }> }> | null | undefined,
  pct: number,
): number {
  const base = montoElegiblePuntos(
    lineas.map((l, i) => ({
      productoId: l.productoId != null ? String(l.productoId) : `n${i}`,
      subtotal: l.subtotal,
      noSumaBeneficios: l.noSumaBeneficios,
      enPromocion: l.enPromocion || REGEX_EXCLUIDOS.test(l.nombre),
    })),
    detalles as any,
  );
  return Math.round(base * (pct / 100) * 100) / 100;
}

/** Porcentaje del trabajador: el de su ficha de empleado o, si no tiene, el parámetro del local (25 por defecto). */
export async function resolverPctPersonal(db: any, partyId: bigint): Promise<number> {
  const rol = await db.partyRole?.findFirst?.({
    where: { party_id: partyId, employee_detail: { isNot: null } },
    include: { employee_detail: true },
  });
  const propio = rol?.employee_detail?.descuento_pct;
  if (propio !== null && propio !== undefined && Number(propio) > 0) return Number(propio);
  try {
    const param = await db.parametro.findUnique({ where: { clave: 'descuento_personal_pct' } });
    if (param && typeof param.valor === 'number') return param.valor;
  } catch {
    // sin parámetro: valor por defecto
  }
  return PCT_DESCUENTO_PERSONAL_DEFECTO;
}

/**
 * Descuento de personal para quien escribe un celular en la carta pública: solo si ese celular es contacto de un
 * trabajador con usuario ACTIVO. Devuelve únicamente el porcentaje (nunca datos del trabajador). El celular NO está
 * verificado: por eso solo da descuento, jamás crédito. Fuente única del porcentaje: resolverPctPersonal.
 */
export async function descuentoPersonalPorCelular(db: any, celular: string | null | undefined): Promise<{ pct: number } | null> {
  const nacional = String(celular ?? '').replace(/\D/g, '').replace(/^51(?=9\d{8}$)/, '');
  if (!/^9\d{8}$/.test(nacional)) return null;
  const contacto = await db.contactMechanism?.findFirst?.({
    where: {
      tipo: { in: ['TELEFONO', 'WHATSAPP'] },
      valor: { in: [nacional, `51${nacional}`] },
      activo: true,
      party: { usuario: { is: { activo: true } } },
    },
    select: { party_id: true },
  });
  if (!contacto) return null;
  return { pct: await resolverPctPersonal(db, contacto.party_id) };
}

/**
 * Descuento de personal para la cuenta de cliente con sesión iniciada en la carta: el celular sale de la cuenta
 * autenticada (nunca de un campo escrito). Sin cuenta activa o sin celular de trabajador activo: null.
 */
export async function descuentoPersonalDeCuenta(db: any, partyId: bigint | string | number | null | undefined): Promise<{ pct: number } | null> {
  if (partyId === null || partyId === undefined || !/^\d+$/.test(String(partyId))) return null;
  const cuenta = await db.customerAccount?.findFirst?.({ where: { party_id: BigInt(partyId), activo: true }, select: { telefono: true } });
  return descuentoPersonalPorCelular(db, cuenta?.telefono);
}

/** El crédito es solo para el personal (cuenta activa o rol de empleado), nunca para clientes. */
export async function validarColaborador(db: any, partyId: bigint) {
  const party = await db.party.findUnique({
    where: { id: partyId },
    include: { persona: true, usuario: true, roles: { include: { employee_detail: true } } },
  });
  if (!party) {
    throw new NotFoundException({ codigo: 'COLABORADOR_NO_ENCONTRADO', mensaje: 'El colaborador no existe en el sistema' });
  }
  if (!(party.usuario?.activo ?? true)) {
    throw new BadRequestException({ codigo: 'COLABORADOR_DESACTIVADO', mensaje: 'El colaborador se encuentra desactivado' });
  }
  const esPersonal = Boolean(party.usuario) || Boolean(party.roles?.some((r: any) => r.employee_detail));
  if (!esPersonal) {
    throw new BadRequestException({
      codigo: 'NO_ES_PERSONAL',
      mensaje: 'El crédito del personal solo se da a trabajadores del local',
    });
  }
  return party;
}

/**
 * Qué descuento y qué monto le toca al trabajador por un pedido ya creado (lo comparten registrarConsumo y la
 * regularización). El pedido trae sus líneas y su descuento_detalle; si ya lleva el descuento del personal, no se repite.
 */
export async function planDescuentoPersonalDePedido(db: any, pedido: any, partyId: bigint) {
  const detallesPrevios: any[] = Array.isArray(pedido.descuento_detalle) ? pedido.descuento_detalle : [];
  const previo = detallesPrevios.find((d) => d?.tipo === 'PERSONAL');
  if (previo) {
    return {
      yaTraeDescuento: true,
      pct: Number(previo.descuentoValor ?? 0),
      descuento: Number(previo.montoDescontado ?? 0),
      montoNeto: Math.max(0, Number(pedido.total)),
      nuevosDetalles: null as any[] | null,
    };
  }
  const pct = await resolverPctPersonal(db, partyId);
  const lineasDb: any[] = pedido.lineas ?? [];
  const ids = lineasDb.map((l) => l.producto_id).filter((x) => x != null);
  const prods: any[] = ids.length
    ? ((await db.producto?.findMany?.({ where: { id: { in: ids } }, select: { id: true, no_suma_beneficios: true } })) ?? [])
    : [];
  const noSuma = new Set(prods.filter((p) => p.no_suma_beneficios).map((p) => String(p.id)));
  const descuento =
    lineasDb.length === 0
      ? Math.round(Number(pedido.total) * (pct / 100) * 100) / 100
      : calcularDescuentoPersonal(
          lineasDb.map((l) => ({
            productoId: l.producto_id,
            nombre: l.nombre,
            subtotal: Number(l.subtotal ?? Number(l.precio_unit) * l.cantidad),
            noSumaBeneficios: l.producto_id != null && noSuma.has(String(l.producto_id)),
            enPromocion: l.oferta_id != null || l.linea_combo_id != null,
          })),
          detallesPrevios,
          pct,
        );
  return {
    yaTraeDescuento: false,
    pct,
    descuento,
    montoNeto: Math.max(0, Math.round((Number(pedido.total) - descuento) * 100) / 100),
    nuevosDetalles:
      descuento > 0
        ? [
            ...detallesPrevios,
            { tipo: 'PERSONAL', nombre: `Descuento del personal ${pct}%`, descuentoTipo: 'PORCENTAJE', descuentoValor: pct, montoDescontado: descuento },
          ]
        : null,
  };
}

const ZONA = 'America/Lima';

/** Fecha de calendario de Lima (año, mes 0-11, día) de un instante. */
export function fechaLima(d: Date = new Date()): { y: number; m: number; d: number } {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const v = (t: string) => Number(partes.find((x) => x.type === t)?.value);
  return { y: v('year'), m: v('month') - 1, d: v('day') };
}


/** Día de hoy en Lima como valor para una columna DATE (medianoche UTC del día de calendario). */
export function fechaDiaLima(ahora: Date = new Date()): Date {
  const h = fechaLima(ahora);
  return new Date(Date.UTC(h.y, h.m, h.d));
}

/** Quién puede cobrarle al trabajador en el momento (creditos/cobrar_ahora): ADMIN, CAJERO y MOZO. */
export function puedeCobrarAhoraPersonal(usuario: { rol: string; roles?: string[] } | undefined): boolean {
  return rolesDelUsuario(usuario).some((r) => (MATRIZ[r] ?? []).includes('creditos/cobrar_ahora'));
}
