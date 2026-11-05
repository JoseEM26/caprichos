import type { TicketComandaSalonDatos } from '../tipos/etiquetas.js';

/** Renglón de la comanda de salón ya maquetado al ancho del papel (58 mm = 32 columnas, 80 mm = 48). */
export interface LineaComanda {
  texto: string;
  centrado?: boolean;
  negrita?: boolean;
}

/** Parte un texto en renglones de `cols` columnas, cortando por palabras (y por bloque si no hay espacios). */
function partir(texto: string, cols: number): string[] {
  const out: string[] = [];
  let actual = '';
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    for (let trozo = palabra; trozo.length > 0; ) {
      const cabe = actual ? actual.length + 1 + trozo.length <= cols : trozo.length <= cols;
      if (cabe) {
        actual = actual ? `${actual} ${trozo}` : trozo;
        break;
      }
      if (actual) {
        out.push(actual);
        actual = '';
      } else {
        out.push(trozo.slice(0, cols));
        trozo = trozo.slice(cols);
      }
    }
  }
  if (actual) out.push(actual);
  return out;
}

/**
 * Comanda de salón: cabecera (código, mesa o cliente, hora) y, por cada línea, cantidad, nombre, tamaño,
 * opciones y notas. Es la hoja que la cocina y el mozo leen; la imprime la ticketera de Caja.
 */
export function lineasTicketComandaSalon(t: TicketComandaSalonDatos, columnas: number = 48): LineaComanda[] {
  const c = columnas;
  const o: LineaComanda[] = [];
  const p = (texto: string, extra: Partial<LineaComanda> = {}) => o.push({ texto, ...extra });
  const bloque = (texto: string, cols: number, extra: Partial<LineaComanda> = {}, sangria = '') =>
    partir(texto, cols - sangria.length).forEach((t2) => p(sangria + t2, extra));

  p(t.area ? `COMANDA · ${t.area}` : 'COMANDA', { centrado: true, negrita: true });
  p(`Pedido ${t.codigo}`, { centrado: true, negrita: true });
  p('-'.repeat(c));
  if (t.mesa) p(`Mesa: ${t.mesa}`, { negrita: true });
  if (t.cliente) bloque(`Cliente: ${t.cliente}`, c);
  p(`${t.canal} - ${t.fecha} ${t.hora}`);
  if (t.nota) bloque(`NOTA: ${t.nota}`, c, { negrita: true });
  p('-'.repeat(c));

  for (const l of t.lineas) {
    bloque(`${l.cantidad} x ${l.nombre}`, c, { negrita: true });
    if (l.tamano) bloque(`Tamaño: ${l.tamano}`, c, {}, '  ');
    for (const op of l.opciones) bloque(`- ${op}`, c, {}, '  ');
    if (l.nota) bloque(`NOTA: ${l.nota}`, c, { negrita: true }, '  ');
  }
  p('-'.repeat(c));
  return o;
}
