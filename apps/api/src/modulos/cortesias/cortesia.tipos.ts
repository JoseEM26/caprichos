import { MATRIZ } from '../acceso/permisos';
import { rolesDelUsuario } from '../acceso/roles-usuario';
import { BadRequestException } from '@nestjs/common';

/** Motivos de la cortesía (lista corta para auditar). El último exige nota. */
export const MOTIVOS_CORTESIA = [
  { codigo: 'CUMPLEANOS', etiqueta: 'Cumpleaños' },
  { codigo: 'CLIENTE_FRECUENTE', etiqueta: 'Cliente frecuente' },
  { codigo: 'ERROR_COCINA', etiqueta: 'Error de cocina' },
  { codigo: 'PRUEBA', etiqueta: 'Prueba' },
  { codigo: 'OTRO', etiqueta: 'Otro' },
] as const;

/** Motivos de la lista anterior: ya no se eligen, pero las cortesías viejas los conservan y se siguen mostrando y filtrando. */
export const MOTIVOS_CORTESIA_ANTERIORES = [
  { codigo: 'COMPENSACION_ERROR_DEMORA', etiqueta: 'Compensación por error o demora' },
  { codigo: 'CUMPLEANOS_CLIENTE_FRECUENTE', etiqueta: 'Cumpleaños o cliente frecuente' },
  { codigo: 'DEGUSTACION_PROMOCION', etiqueta: 'Degustación o promoción' },
  { codigo: 'RECLAMO_CLIENTE', etiqueta: 'Reclamo del cliente' },
] as const;

export type MotivoCortesia = (typeof MOTIVOS_CORTESIA)[number]['codigo'];

export function etiquetaMotivo(codigo: string): string {
  return [...MOTIVOS_CORTESIA, ...MOTIVOS_CORTESIA_ANTERIORES].find((m) => m.codigo === codigo)?.etiqueta ?? codigo;
}

/** Quién puede dar cortesías según la matriz de permisos (cortesias/dar): ADMIN, SUPERVISOR, Caja y Mozo; es libre, queda auditada. */
export function puedeDarCortesia(usuario: { rol: string; roles?: string[] } | undefined): boolean {
  return rolesDelUsuario(usuario).some((r) => (MATRIZ[r] ?? []).includes('cortesias/dar'));
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
