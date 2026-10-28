import { EstadoImpresora } from '@caprichos/compartido';
import { PrismaService } from '../../comun/prisma/prisma.service';

/** Un agente cuenta como conectado si su último latido tiene 60 s o menos. */
export const LATIDO_VIGENTE_MS = 60 * 1000;

export function agenteConectado(
  ultimoLatido: Date | string | null | undefined,
  ahora = Date.now(),
): boolean {
  if (!ultimoLatido) return false;
  return ahora - new Date(ultimoLatido).getTime() <= LATIDO_VIGENTE_MS;
}

export interface EstadoAgenteImpresion {
  conectado: boolean;
  impresora: EstadoImpresora | 'desconectada';
  ultimoLatido: Date | null;
  /** Agente conectado y con la impresora lista: no hay nadie que avisar. */
  sinProblema: boolean;
}

/** Estado del agente de impresión a partir de su último latido (misma regla que el admin). */
export async function consultarEstadoAgente(
  prisma: PrismaService,
  ahora = Date.now(),
): Promise<EstadoAgenteImpresion> {
  const agente = await prisma.deviceKey.findFirst({
    where: { tipo: 'AGENTE', activo: true },
    orderBy: { ultimo_latido: { sort: 'desc', nulls: 'last' } },
  });
  const conectado = agenteConectado(agente?.ultimo_latido, ahora);
  const impresora = (agente?.latido_impresora as EstadoImpresora) || 'desconectada';
  return {
    conectado,
    impresora,
    ultimoLatido: agente?.ultimo_latido ?? null,
    sinProblema: conectado && impresora === 'lista',
  };
}

/** Lee un parámetro numérico de la tabla parametro; si falta o no es válido, usa el defecto. */
export async function leerParametroNumerico(
  prisma: PrismaService,
  clave: string,
  defecto: number,
): Promise<number> {
  try {
    const p = await prisma.parametro.findUnique({ where: { clave } });
    const n = Number(p?.valor);
    return Number.isFinite(n) && n > 0 ? n : defecto;
  } catch {
    return defecto;
  }
}
