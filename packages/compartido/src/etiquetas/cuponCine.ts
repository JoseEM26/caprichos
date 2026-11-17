import type { LineaTicket } from './ticketPago.js';

/**
 * Cupón «de colección» (ticket de cine antiguo) que sale al pie del ticket de pago. Es texto monocromo puro: lo imprime
 * la térmica igual que el resto del ticket y la vista previa del admin usa esta misma función (una sola plantilla).
 */
export interface DatosCuponCine {
  codigo: string;
  /** Valor ya escrito: «25 % DE DESCUENTO», «S/ 5.00 DE DESCUENTO», «ENVÍO GRATIS» */
  valor?: string | null;
  alcance?: string | null;
  /** Fecha de vencimiento ya formateada dd/mm/aaaa */
  vence?: string | null;
  /** Número de este cupón entre los dados (N.º 0002) y el tope (de 0200); sin número no sale el talón numerado */
  numero?: number | null;
  tope?: number | null;
}

/** Texto del valor del cupón para el ticket: «25 % DE DESCUENTO», «S/ 5.00 DE DESCUENTO» o «ENVÍO GRATIS». */
export function textoValorCupon(descuentoTipo: string, descuentoValor: number): string {
  if (descuentoTipo === 'ENVIO_GRATIS') return 'ENVÍO GRATIS';
  if (descuentoTipo === 'PORCENTAJE') return `${Number.isInteger(descuentoValor) ? descuentoValor : descuentoValor.toFixed(2)} % DE DESCUENTO`;
  return `S/ ${Number(descuentoValor).toFixed(2)} DE DESCUENTO`;
}

const centrar = (t: string, w: number) => {
  const pad = Math.max(0, Math.floor((w - t.length) / 2));
  return `${' '.repeat(pad)}${t}`;
};

/** Parte un texto en renglones de `w` columnas por palabras. */
function envolver(texto: string, w: number): string[] {
  const out: string[] = [];
  let actual = '';
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    if (!actual) actual = palabra;
    else if (actual.length + 1 + palabra.length <= w) actual = `${actual} ${palabra}`;
    else {
      out.push(actual);
      actual = palabra;
    }
  }
  if (actual) out.push(actual);
  return out;
}

/** Las líneas del cupón de colección: marco doble, valor grande, alcance, vigencia, corte con muescas, talón numerado y QR. */
export function lineasCuponCine(c: DatosCuponCine, columnas: number = 48): LineaTicket[] {
  const w = columnas;
  const o: LineaTicket[] = [];
  const marco = '='.repeat(w);
  const corte = `o${'-'.repeat(w - 2)}o`;
  const centro = (t: string, extra: Partial<LineaTicket> = {}) => {
    for (const r of envolver(t, w)) o.push({ texto: centrar(r, w), centrado: true, ...extra });
  };

  o.push({ texto: marco });
  centro('C A P R I C H O S', { negrita: true });
  centro('~ CUPÓN DE COLECCIÓN ~');
  o.push({ texto: marco });
  o.push({ texto: '' });
  if (c.valor) centro(c.valor.toUpperCase(), { negrita: true });
  centro(`Alcance: ${c.alcance?.trim() || 'Toda la carta'}`);
  if (c.vence) centro(`Válido hasta ${c.vence}`);
  o.push({ texto: '' });
  o.push({ texto: corte });
  if (c.numero != null) {
    const n = String(c.numero).padStart(4, '0');
    const tope = c.tope != null ? ` de ${String(c.tope).padStart(4, '0')}` : '';
    centro(`N.º ${n}${tope}`);
  }
  centro('Código');
  centro(c.codigo, { negrita: true });
  o.push({ texto: '', centrado: true, qr: c.codigo });
  centro('Presenta este ticket en tu próxima visita');
  o.push({ texto: marco });
  return o;
}
