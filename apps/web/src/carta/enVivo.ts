import type { CategoriaCarta, EstadoLocalCarta } from './tipos';

/** Respuesta de GET /carta/disponibilidad (solo lo que cambia con el stock). */
export interface DisponibilidadCarta {
  productos: Array<{
    id: string;
    disponible: boolean;
    controlaStock: boolean;
    quedan: number | null;
    sabores?: Array<{ id: string; disponible: boolean; quedan: number | null }>;
  }>;
}

/** Pone al día disponible/quedan de productos y sabores; devuelve el mismo arreglo si nada cambió. */
export function aplicarDisponibilidad(categorias: CategoriaCarta[], d: DisponibilidadCarta | null | undefined): CategoriaCarta[] {
  if (!d || !Array.isArray(d.productos)) return categorias;
  const porId = new Map(d.productos.map((p) => [String(p.id), p]));
  let cambio = false;
  const nuevas = categorias.map((c) => ({
    ...c,
    productos: c.productos.map((p) => {
      const n = porId.get(String(p.id));
      if (!n) return p;
      const saboresIgual = (p.sabores ?? []).every((s) => {
        const ns = n.sabores?.find((x) => String(x.id) === String(s.id));
        return !ns || (ns.disponible === s.disponible && ns.quedan === (s.quedan ?? null));
      });
      if (n.disponible === p.disponible && n.quedan === (p.quedan ?? null) && saboresIgual) return p;
      cambio = true;
      return {
        ...p,
        disponible: n.disponible,
        quedan: n.quedan,
        sabores: (p.sabores ?? []).map((s) => {
          const ns = n.sabores?.find((x) => String(x.id) === String(s.id));
          return ns ? { ...s, disponible: ns.disponible, quedan: ns.quedan } : s;
        }),
        saboresConStock: n.sabores ? n.sabores.some((s) => s.disponible) : p.saboresConStock,
      };
    }),
  }));
  return cambio ? nuevas : categorias;
}

const MS_LIMA = -5 * 3600_000; // Lima: UTC-5 todo el año (sin horario de verano)
const aMinutos = (hhmm: string | null | undefined) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/**
 * Milisegundos hasta el próximo cambio de horario de hoy (cierra si está abierto; abre si aún no abrió).
 * Null si no hay un cambio pendiente hoy (pausa, feriado, ya cerró) — ahí manda el sondeo.
 */
export function msHastaProximoCambio(estado: EstadoLocalCarta | null, ahoraMs: number = Date.now()): number | null {
  if (!estado || estado.pausaAltaDemanda || estado.motivo === 'PAUSA') return null;
  const objetivo = aMinutos(estado.abierta ? estado.cierra : estado.abre);
  if (objetivo === null) return null;
  const lima = new Date(ahoraMs + MS_LIMA);
  const ahoraMin = lima.getUTCHours() * 60 + lima.getUTCMinutes() + lima.getUTCSeconds() / 60 + lima.getUTCMilliseconds() / 60000;
  const falta = (objetivo - ahoraMin) * 60000;
  return falta > 0 ? Math.ceil(falta) : null;
}
