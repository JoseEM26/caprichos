import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { diaCalendarioLima, sumarDiasIso } from '../../comun/fechas-lima';

/** Roles que pueden programar pedidos (Caja y mozo; Supervisor y Admin con sus permisos de Caja). */
export const ROLES_PROGRAMAR = ['CAJERO', 'MOZO', 'ADMIN', 'SUPERVISOR'] as const;

export const PARAM_PROGRAMADO_DIAS_MAX = 'programado_dias_max';
export const PARAM_PROGRAMADO_AVISO_MIN = 'programado_aviso_min';
export const DIAS_MAX_DEFECTO = 7;
export const AVISO_MIN_DEFECTO = 30;

export interface ConfigProgramados {
  /** Tope de días hacia adelante (día calendario de Lima). */
  diasMax: number;
  /** Minutos antes de la hora pactada en que el pedido pasa a cocina o a la cola de reparto. */
  avisoMin: number;
}

function entero(valor: unknown, defecto: number, min: number, max: number): number {
  const n = Number(valor);
  return Number.isInteger(n) && n >= min && n <= max ? n : defecto;
}

/** Lee los dos parámetros (con sus valores por defecto si faltan o son inválidos). */
export async function leerConfigProgramados(db: { parametro: { findMany: (args: any) => Promise<Array<{ clave: string; valor: unknown }>> } }): Promise<ConfigProgramados> {
  const filas = await db.parametro.findMany({ where: { clave: { in: [PARAM_PROGRAMADO_DIAS_MAX, PARAM_PROGRAMADO_AVISO_MIN] } } });
  const mapa = new Map(filas.map((f) => [f.clave, f.valor]));
  return {
    diasMax: entero(mapa.get(PARAM_PROGRAMADO_DIAS_MAX), DIAS_MAX_DEFECTO, 1, 60),
    avisoMin: entero(mapa.get(PARAM_PROGRAMADO_AVISO_MIN), AVISO_MIN_DEFECTO, 0, 480),
  };
}

/** Solo Caja y mozo (y Supervisor/Admin): el servidor lo exige aunque la pantalla no muestre la opción. */
export function exigirPuedeProgramar(roles: string[]): void {
  if (!roles.some((r) => (ROLES_PROGRAMAR as readonly string[]).includes(r))) {
    throw new ForbiddenException({ codigo: 'PROGRAMAR_SIN_PERMISO', mensaje: 'Solo Caja y mozo pueden programar pedidos para otro día' });
  }
}

/** Valida la fecha pactada: instante futuro y dentro del tope de días (día calendario de Lima). */
export function validarProgramadoPara(valor: unknown, ahora: Date, diasMax: number): Date {
  const fecha = valor instanceof Date ? valor : new Date(String(valor ?? ''));
  if (Number.isNaN(fecha.getTime())) {
    throw new BadRequestException({ codigo: 'PROGRAMADO_FECHA_INVALIDA', mensaje: 'La fecha y hora del pedido programado no es válida' });
  }
  if (fecha.getTime() <= ahora.getTime()) {
    throw new BadRequestException({ codigo: 'PROGRAMADO_EN_EL_PASADO', mensaje: 'La hora del pedido programado debe ser posterior a ahora' });
  }
  const tope = sumarDiasIso(diaCalendarioLima(ahora), diasMax);
  if (diaCalendarioLima(fecha) > tope) {
    throw new BadRequestException({ codigo: 'PROGRAMADO_MUY_LEJOS', mensaje: `Solo se puede programar hasta ${diasMax} días adelante` });
  }
  return fecha;
}

/** ¿Ya toca pasar el pedido a cocina o a la cola? (hora pactada menos el aviso). */
export function debePasarACola(programadoPara: Date, ahora: Date, avisoMin: number): boolean {
  return programadoPara.getTime() - avisoMin * 60_000 <= ahora.getTime();
}
