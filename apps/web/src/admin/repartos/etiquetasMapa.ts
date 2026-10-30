/**
 * Ubicación de las etiquetas de los pedidos en el mapa de reparto.
 *
 * Regla: cada pedido intenta mostrar «nombre + código»; si esa caja choca con un pin o con
 * otra etiqueta ya colocada, muestra solo el código; si tampoco cabe, no muestra etiqueta
 * (el pin sigue siendo tocable y la hoja inferior muestra el nombre completo).
 * Los pedidos se colocan por prioridad (elegido, orden de ruta, más espera).
 */

export type ModoEtiqueta = 'completa' | 'codigo' | 'oculta';

export interface PuntoEtiqueta {
  id: string;
  /** Punta del pin en píxeles del contenedor del mapa. */
  x: number;
  y: number;
  anchoCompleta: number;
  anchoCodigo: number;
  /** Mayor valor = se coloca antes. */
  prioridad: number;
}

export interface Caja {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const PIN_MEDIO_ANCHO = 13;
const PIN_ALTO = 26;
const SEPARACION_X = 12;
const ALTO_COMPLETA = 34;
const ALTO_CODIGO = 18;

/** Caja de la etiqueta de un pedido, a la derecha del pin y levemente arriba. */
export function cajaEtiqueta(p: PuntoEtiqueta, modo: Exclude<ModoEtiqueta, 'oculta'>): Caja {
  const ancho = modo === 'completa' ? p.anchoCompleta : p.anchoCodigo;
  const alto = modo === 'completa' ? ALTO_COMPLETA : ALTO_CODIGO;
  const yCentro = p.y - 14;
  return {
    x0: p.x + SEPARACION_X,
    x1: p.x + SEPARACION_X + ancho,
    y0: yCentro - alto / 2,
    y1: yCentro + alto / 2,
  };
}

function solapan(a: Caja, b: Caja): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/**
 * Devuelve el modo de etiqueta de cada pedido, sin que dos etiquetas ni una etiqueta y un pin se encimen.
 * `obstaculos` son cajas fijas que ninguna etiqueta puede tapar (p. ej. el marcador de la tienda).
 */
export function planificarEtiquetas(
  puntos: PuntoEtiqueta[],
  obstaculos: Caja[] = [],
): Map<string, ModoEtiqueta> {
  const ocupadas: Array<{ id: string; caja: Caja }> = [
    ...puntos.map((p) => ({
      id: p.id,
      caja: {
        x0: p.x - PIN_MEDIO_ANCHO,
        x1: p.x + PIN_MEDIO_ANCHO,
        y0: p.y - PIN_ALTO,
        y1: p.y,
      },
    })),
    ...obstaculos.map((caja) => ({ id: '__fijo__', caja })),
  ];

  const resultado = new Map<string, ModoEtiqueta>();
  const orden = [...puntos].sort((a, b) => b.prioridad - a.prioridad || a.id.localeCompare(b.id));

  for (const p of orden) {
    let modo: ModoEtiqueta = 'oculta';
    for (const candidato of ['completa', 'codigo'] as const) {
      const caja = cajaEtiqueta(p, candidato);
      const choca = ocupadas.some((o) => o.id !== p.id && solapan(o.caja, caja));
      if (!choca) {
        modo = candidato;
        ocupadas.push({ id: p.id, caja });
        break;
      }
    }
    resultado.set(p.id, modo);
  }

  return resultado;
}

/** Acorta el nombre visible en el mapa; el nombre completo queda en la hoja del pedido. */
export function nombreEtiqueta(nombre: string, maximo = 22): string {
  return nombre.length > maximo ? `${nombre.slice(0, maximo - 1)}…` : nombre;
}

/** Ancho aproximado en píxeles de un texto de la etiqueta (fuente de 12px en negrita). */
export function anchoTexto(texto: string, pxPorCaracter = 7): number {
  return Math.ceil(texto.length * pxPorCaracter) + 14;
}
