import { BadRequestException } from '@nestjs/common';
import {
  CLAVES_CONFIG_IMPRESION,
  MODALIDADES_PEDIDO,
  REGLAS_IMPRESION_DEFECTO,
  ReglasImpresion,
  TAMANOS_ETIQUETA_DEFECTO,
  CLAVES_TAMANO_ETIQUETA,
  TamanosEtiqueta,
  tamanosDesdeValores,
} from '@caprichos/compartido';
import { PrismaService } from '../../comun/prisma/prisma.service';

/** Claves de reglas (sin el plazo de vencimiento, que no es una regla del mapa). */
export const CLAVES_REGLAS = Object.values(CLAVES_CONFIG_IMPRESION).filter((c) => c !== CLAVES_CONFIG_IMPRESION.VENCE_MIN);
const CLAVES = CLAVES_REGLAS;

/** Convierte los valores guardados en `parametro` en reglas; lo que falte o sea inválido usa el defecto. */
export function reglasDesdeValores(valores: Record<string, unknown>): ReglasImpresion {
  const bool = (v: unknown, defecto: boolean) => (typeof v === 'boolean' ? v : defecto);
  const lista = (clave: string, defecto: string[]) => {
    const v = valores[clave];
    return Array.isArray(v)
      ? v.filter((m): m is string => typeof m === 'string' && (MODALIDADES_PEDIDO as readonly string[]).includes(m))
      : [...defecto];
  };
  return {
    generalModalidades: lista(CLAVES_CONFIG_IMPRESION.ETIQUETA_GENERAL_MODALIDADES, REGLAS_IMPRESION_DEFECTO.generalModalidades),
    areaModalidades: lista(CLAVES_CONFIG_IMPRESION.ETIQUETA_AREA_MODALIDADES, REGLAS_IMPRESION_DEFECTO.areaModalidades),
    bebidaModalidades: lista(CLAVES_CONFIG_IMPRESION.ETIQUETA_BEBIDA_MODALIDADES, REGLAS_IMPRESION_DEFECTO.bebidaModalidades),
    bebidaActivo: bool(valores[CLAVES_CONFIG_IMPRESION.ETIQUETA_BEBIDA_ACTIVO], REGLAS_IMPRESION_DEFECTO.bebidaActivo),
    areaActivo: bool(valores[CLAVES_CONFIG_IMPRESION.ETIQUETA_AREA_ACTIVO], REGLAS_IMPRESION_DEFECTO.areaActivo),
    comandaSalonActivo: bool(
      valores[CLAVES_CONFIG_IMPRESION.TICKET_COMANDA_SALON_ACTIVO],
      REGLAS_IMPRESION_DEFECTO.comandaSalonActivo,
    ),
    comandaAreaActivo: bool(
      valores[CLAVES_CONFIG_IMPRESION.TICKET_COMANDA_AREA_ACTIVO],
      REGLAS_IMPRESION_DEFECTO.comandaAreaActivo,
    ),
  };
}

/** Lee las reglas de la tabla parametro. Si la lectura falla, usa los defectos (no bloquea la aceptación). */
export async function leerReglasImpresion(prisma: PrismaService): Promise<ReglasImpresion> {
  try {
    const filas = await prisma.parametro.findMany({ where: { clave: { in: CLAVES } } });
    return reglasDesdeValores(Object.fromEntries(filas.map((f) => [f.clave, f.valor])));
  } catch {
    return {
      ...REGLAS_IMPRESION_DEFECTO,
      generalModalidades: [...REGLAS_IMPRESION_DEFECTO.generalModalidades],
      areaModalidades: [...REGLAS_IMPRESION_DEFECTO.areaModalidades],
      bebidaModalidades: [...REGLAS_IMPRESION_DEFECTO.bebidaModalidades],
    };
  }
}

/** Valores a guardar para un cambio parcial de reglas. Valida modalidades y tipos; lanza 400 si no cuadra. */
export function valoresDesdeCambio(cambio: Partial<{
  generalModalidades: string[];
  areaModalidades: string[];
  bebidaModalidades: string[];
  bebidaActivo: boolean;
  areaActivo: boolean;
  comandaSalonActivo: boolean;
  comandaAreaActivo: boolean;
}>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const listas: Array<['generalModalidades' | 'areaModalidades' | 'bebidaModalidades', string]> = [
    ['generalModalidades', CLAVES_CONFIG_IMPRESION.ETIQUETA_GENERAL_MODALIDADES],
    ['areaModalidades', CLAVES_CONFIG_IMPRESION.ETIQUETA_AREA_MODALIDADES],
    ['bebidaModalidades', CLAVES_CONFIG_IMPRESION.ETIQUETA_BEBIDA_MODALIDADES],
  ];
  for (const [campo, clave] of listas) {
    const lista = cambio[campo];
    if (lista === undefined) continue;
    const valida = Array.isArray(lista) && lista.every((m) => (MODALIDADES_PEDIDO as readonly string[]).includes(m));
    if (!valida) {
      throw new BadRequestException({
        codigo: 'MODALIDAD_INVALIDA',
        mensaje: `Modalidades válidas: ${MODALIDADES_PEDIDO.join(', ')}`,
      });
    }
    out[clave] = [...new Set(lista)];
  }
  const booleanos: Array<[keyof typeof cambio, string]> = [
    ['bebidaActivo', CLAVES_CONFIG_IMPRESION.ETIQUETA_BEBIDA_ACTIVO],
    ['areaActivo', CLAVES_CONFIG_IMPRESION.ETIQUETA_AREA_ACTIVO],
    ['comandaSalonActivo', CLAVES_CONFIG_IMPRESION.TICKET_COMANDA_SALON_ACTIVO],
    ['comandaAreaActivo', CLAVES_CONFIG_IMPRESION.TICKET_COMANDA_AREA_ACTIVO],
  ];
  for (const [campo, clave] of booleanos) {
    if (cambio[campo] === undefined) continue;
    if (typeof cambio[campo] !== 'boolean') {
      throw new BadRequestException({ codigo: 'VALOR_INVALIDO', mensaje: `${String(campo)} debe ser verdadero o falso` });
    }
    out[clave] = cambio[campo];
  }
  return out;
}

/** Orden de salida de la cola (parametro `impresion_prioridad`): tickets de pago y comandas antes que los stickers, o solo por llegada. */
export const PRIORIDADES_IMPRESION = ['TICKETS_PRIMERO', 'ORDEN_LLEGADA'] as const;
export type PrioridadImpresion = (typeof PRIORIDADES_IMPRESION)[number];

/** Sin configurar, o con cualquier valor inválido o un fallo al leer, se imprimen primero los tickets. */
export async function leerTicketsPrimero(prisma: PrismaService): Promise<boolean> {
  try {
    const fila = await prisma.parametro.findUnique({ where: { clave: 'impresion_prioridad' } });
    return String(fila?.valor ?? '').toUpperCase() !== 'ORDEN_LLEGADA';
  } catch {
    return true;
  }
}

/** Tickets (TICKET_*) primero si se pide; dentro de cada grupo, el más antiguo (id menor) primero. */
export function ordenarPorPrioridad<T extends { id: bigint; tipo: string }>(trabajos: T[], ticketsPrimero: boolean): T[] {
  const grupo = (t: T) => (ticketsPrimero && t.tipo.startsWith('TICKET_') ? 0 : 1);
  return [...trabajos].sort((a, b) => grupo(a) - grupo(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Tamaño de los stickers de bebida y general (mm) desde `parametro`; sin configurar o inválido, el de fábrica. */
export async function leerTamanosEtiqueta(prisma: PrismaService): Promise<TamanosEtiqueta> {
  try {
    const filas = await prisma.parametro.findMany({ where: { clave: { in: Object.values(CLAVES_TAMANO_ETIQUETA) } } });
    return tamanosDesdeValores(Object.fromEntries(filas.map((f) => [f.clave, f.valor])));
  } catch {
    return TAMANOS_ETIQUETA_DEFECTO;
  }
}
