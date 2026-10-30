import {
  EstadoImpresora,
  EstadoMaquinaImpresion,
  ImpresoraReportada,
  RolImpresora,
} from '@caprichos/compartido';
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

const MOTIVO_ESTADO: Record<string, string> = {
  desconectada: 'Impresora no encontrada',
  sin_papel: 'Sin papel',
  error: 'Error en la impresora',
};

/**
 * El latido guarda las máquinas en latido_detalle como JSON ({ detalle, impresoras }) para no tocar el
 * esquema; un latido viejo trae texto plano o nada.
 */
export function empaquetarDetalleLatido(detalle?: string | null, impresoras?: ImpresoraReportada[]): string | null {
  const d = detalle?.trim() || null;
  if (!impresoras?.length) return d;
  return JSON.stringify({ detalle: d, impresoras });
}

export function leerImpresorasLatido(detalle?: string | null): ImpresoraReportada[] | null {
  if (!detalle || !detalle.startsWith('{')) return null;
  try {
    const j = JSON.parse(detalle);
    return Array.isArray(j.impresoras) ? j.impresoras : null;
  } catch {
    return null;
  }
}

/**
 * Estado de cada máquina. Sin latido vigente: ambas «el programa del local no está corriendo».
 * Un agente viejo (sin lista por rol) solo habla de la etiquetera; la ticketera queda sin configurar.
 */
export function estadoPorRol(
  agente: { ultimo_latido?: Date | string | null; latido_impresora?: string | null; latido_detalle?: string | null } | null | undefined,
  ahora = Date.now(),
): Record<RolImpresora, EstadoMaquinaImpresion> {
  if (!agenteConectado(agente?.ultimo_latido, ahora)) {
    const caida: EstadoMaquinaImpresion = {
      conectada: false,
      estado: 'sin_programa',
      motivo: 'El programa del local no está corriendo',
    };
    return { ETIQUETERA: { ...caida }, TICKETERA: { ...caida } };
  }
  const lista = leerImpresorasLatido(agente?.latido_detalle) ??
    (agente?.latido_impresora
      ? [{ rol: 'ETIQUETERA' as const, estado: agente.latido_impresora as EstadoImpresora, detalle: agente.latido_detalle ?? undefined }]
      : []);
  const una = (rol: RolImpresora): EstadoMaquinaImpresion => {
    const r = lista.find((x) => x.rol === rol);
    if (!r) {
      return { conectada: false, estado: 'no_configurada', motivo: 'No está configurada en el programa del local' };
    }
    if (r.estado === 'lista') return { conectada: true, estado: 'lista', motivo: null };
    const base = MOTIVO_ESTADO[r.estado] || 'Impresora con problema';
    return { conectada: false, estado: r.estado, motivo: r.detalle && r.estado === 'error' ? `${base}: ${r.detalle}` : base };
  };
  return { ETIQUETERA: una('ETIQUETERA'), TICKETERA: una('TICKETERA') };
}
