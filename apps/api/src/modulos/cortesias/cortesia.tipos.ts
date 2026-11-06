import { MATRIZ } from '../acceso/permisos';
import { rolesDelUsuario } from '../acceso/roles-usuario';
import { BadRequestException } from '@nestjs/common';

/** Motivos fijos de la cortesía (Kevin Rosales). El último exige nota. */
export const MOTIVOS_CORTESIA = [
  { codigo: 'COMPENSACION_ERROR_DEMORA', etiqueta: 'Compensación por error o demora' },
  { codigo: 'CUMPLEANOS_CLIENTE_FRECUENTE', etiqueta: 'Cumpleaños o cliente frecuente' },
  { codigo: 'DEGUSTACION_PROMOCION', etiqueta: 'Degustación o promoción' },
  { codigo: 'RECLAMO_CLIENTE', etiqueta: 'Reclamo del cliente' },
  { codigo: 'OTRO', etiqueta: 'Otro' },
] as const;

export type MotivoCortesia = (typeof MOTIVOS_CORTESIA)[number]['codigo'];

export function etiquetaMotivo(codigo: string): string {
  return MOTIVOS_CORTESIA.find((m) => m.codigo === codigo)?.etiqueta ?? codigo;
}

/** Quién puede dar cortesías según la matriz de permisos (cortesias/dar): Caja, ADMIN y SUPERVISOR. */
export function puedeDarCortesia(usuario: { rol: string; roles?: string[] } | undefined): boolean {
  return rolesDelUsuario(usuario).some((r) => (MATRIZ[r] ?? []).includes('cortesias/dar'));
}

/** El SUPERVISOR (principal) da la cortesía con su código; ADMIN y CAJERO no. */
export function requiereCodigoCortesia(req: any): boolean {
  return req?.usuario?.rol === 'SUPERVISOR';
}

/** Valida motivo y nota. Lanza 400 si el motivo no está en la lista o si «Otro» no trae nota. */
export function validarMotivoCortesia(motivo: unknown, nota: unknown): { motivo: MotivoCortesia; nota: string | null } {
  const m = MOTIVOS_CORTESIA.find((x) => x.codigo === motivo);
  if (!m) {
    throw new BadRequestException({ codigo: 'MOTIVO_INVALIDO', mensaje: 'Elige el motivo de la cortesía' });
  }
  const notaLimpia = typeof nota === 'string' ? nota.trim() : '';
  if (m.codigo === 'OTRO' && notaLimpia.length === 0) {
    throw new BadRequestException({ codigo: 'NOTA_REQUERIDA', mensaje: 'Con el motivo «Otro» escribe una nota' });
  }
  return { motivo: m.codigo, nota: notaLimpia.length > 0 ? notaLimpia : null };
}
