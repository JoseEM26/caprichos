import { etiquetaMotivo } from './cortesia.tipos';

/** Una cortesía tal como sale de la base, ya con nombres (sin Prisma). */
export interface FilaCortesia {
  id: string;
  creadoEn: Date;
  productoId: string;
  producto: string;
  sabor: string | null;
  cantidad: number;
  valorLista: number;
  motivo: string;
  nota: string | null;
  pedido: string | null;
  pedidoReferencia: string | null;
  dadaPorId: string;
  dadaPor: string;
  autorizadaPor: string | null;
}

export interface Acumulado {
  registros: number;
  unidades: number;
  centavos: number;
}

/** Agrupa por una clave y suma registros, unidades y valor de lista (en centavos para no arrastrar decimales). */
function agrupar<T>(
  filas: FilaCortesia[],
  clave: (f: FilaCortesia) => string,
  base: (f: FilaCortesia) => T,
): Array<T & { registros: number; unidades: number; valorLista: number }> {
  const mapa = new Map<string, { base: T; acc: Acumulado }>();
  for (const f of filas) {
    const k = clave(f);
    let entrada = mapa.get(k);
    if (!entrada) {
      entrada = { base: base(f), acc: { registros: 0, unidades: 0, centavos: 0 } };
      mapa.set(k, entrada);
    }
    entrada.acc.registros += 1;
    entrada.acc.unidades += f.cantidad;
    entrada.acc.centavos += Math.round(f.valorLista * 100);
  }
  return [...mapa.values()]
    .map(({ base: b, acc }) => ({ ...b, registros: acc.registros, unidades: acc.unidades, valorLista: acc.centavos / 100 }))
    .sort((a, b) => b.valorLista - a.valorLista || b.unidades - a.unidades);
}

/** Resumen del informe «Cortesías»: total regalado a precio de lista y desgloses por motivo, producto y quién la dio. */
export function resumenCortesias(filas: FilaCortesia[]) {
  const centavos = filas.reduce((acc, f) => acc + Math.round(f.valorLista * 100), 0);
  return {
    resumen: {
      registros: filas.length,
      unidades: filas.reduce((acc, f) => acc + f.cantidad, 0),
      valorLista: centavos / 100,
    },
    porMotivo: agrupar(filas, (f) => f.motivo, (f) => ({ codigo: f.motivo, motivo: etiquetaMotivo(f.motivo) })),
    porProducto: agrupar(filas, (f) => f.productoId, (f) => ({ productoId: f.productoId, producto: f.producto })),
    porQuien: agrupar(filas, (f) => f.dadaPorId, (f) => ({ partyId: f.dadaPorId, nombre: f.dadaPor })),
  };
}
