import { BadRequestException } from '@nestjs/common';
import {
  CLAVES_CONFIG_IMPRESION,
  MODALIDADES_PEDIDO,
  REGLAS_IMPRESION_DEFECTO,
  ReglasImpresion,
} from '@caprichos/compartido';
import { PrismaService } from '../../comun/prisma/prisma.service';

const CLAVES = Object.values(CLAVES_CONFIG_IMPRESION).filter((c) => c !== CLAVES_CONFIG_IMPRESION.VENCE_MIN);

/** Convierte los valores guardados en `parametro` en reglas; lo que falte o sea inválido usa el defecto. */
export function reglasDesdeValores(valores: Record<string, unknown>): ReglasImpresion {
  const bool = (v: unknown, defecto: boolean) => (typeof v === 'boolean' ? v : defecto);
  const general = valores[CLAVES_CONFIG_IMPRESION.ETIQUETA_GENERAL_MODALIDADES];
  return {
    generalModalidades: Array.isArray(general)
      ? general.filter((m): m is string => typeof m === 'string' && (MODALIDADES_PEDIDO as readonly string[]).includes(m))
      : [...REGLAS_IMPRESION_DEFECTO.generalModalidades],
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
    return { ...REGLAS_IMPRESION_DEFECTO, generalModalidades: [...REGLAS_IMPRESION_DEFECTO.generalModalidades] };
  }
}

/** Valores a guardar para un cambio parcial de reglas. Valida modalidades y tipos; lanza 400 si no cuadra. */
export function valoresDesdeCambio(cambio: Partial<{
  generalModalidades: string[];
  bebidaActivo: boolean;
  areaActivo: boolean;
  comandaSalonActivo: boolean;
  comandaAreaActivo: boolean;
}>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (cambio.generalModalidades !== undefined) {
    const lista = cambio.generalModalidades;
    const valida = Array.isArray(lista) && lista.every((m) => (MODALIDADES_PEDIDO as readonly string[]).includes(m));
    if (!valida) {
      throw new BadRequestException({
        codigo: 'MODALIDAD_INVALIDA',
        mensaje: `Modalidades válidas: ${MODALIDADES_PEDIDO.join(', ')}`,
      });
    }
    out[CLAVES_CONFIG_IMPRESION.ETIQUETA_GENERAL_MODALIDADES] = [...new Set(lista)];
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
