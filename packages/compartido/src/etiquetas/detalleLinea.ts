/**
 * Detalle de una línea de pedido para el ticket de pago, la precuenta y la vista previa.
 * UNA sola función arma el texto (sabores, opciones, nombre por vaso, nota, combo, cortesía) para que no diverjan.
 * Todos los campos son opcionales: un pedido o ticket antiguo sin ellos sale solo con nombre y subtotal.
 */
export interface LineaDetalleEntrada {
  cantidad: number;
  nombre: string;
  tamano?: string | null;
  precioUnit?: number | null;
  subtotal: number;
  /** Reparto por sabor (mezcla): «3 Fresa · 3 Oreo». */
  sabores?: { sabor: string; cantidad: number }[];
  /** Un solo sabor elegido (cuando no hay reparto). */
  sabor?: string | null;
  opciones?: { grupo?: string | null; nombre: string; extra?: number | null }[];
  /** Para quién es cada vaso. */
  nombresPersona?: string[];
  nota?: string | null;
  /** Línea regalada: valor de lista que se dejó de cobrar. */
  cortesia?: { valorLista?: number | null } | null;
  /** Piezas de un combo (con su propio tamaño, sabor y opciones). */
  partes?: LineaDetalleEntrada[];
}

export interface DetalleLinea {
  cantidad: number;
  /** Producto y tamaño: «Dona (Caja x6)». */
  titulo: string;
  precioUnit?: number;
  subtotal: number;
  cortesia?: { valorLista?: number };
  /** Renglones secundarios en orden: sabores, opciones, para quién, nota, cortesía. */
  detalles: string[];
  partes: DetalleLinea[];
}

export const solesTexto = (n: number | string | null | undefined) => `S/ ${Number(n || 0).toFixed(2)}`;

const limpio = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export function detalleLinea(l: LineaDetalleEntrada): DetalleLinea {
  const detalles: string[] = [];
  const sabores = (l.sabores ?? []).filter((s) => limpio(s.sabor));
  if (sabores.length > 0) detalles.push(`Sabores: ${sabores.map((s) => `${s.cantidad} ${limpio(s.sabor)}`).join(' · ')}`);
  else if (limpio(l.sabor)) detalles.push(`Sabor: ${limpio(l.sabor)}`);
  // Opciones agrupadas por su grupo (tipo de leche, endulzante...), cada una con su extra si lo tiene
  const porGrupo = new Map<string, string[]>();
  for (const o of l.opciones ?? []) {
    const nombre = limpio(o.nombre);
    if (!nombre) continue;
    const extra = Number(o.extra ?? 0) > 0 ? ` (+${solesTexto(o.extra)})` : '';
    const g = limpio(o.grupo);
    porGrupo.set(g, [...(porGrupo.get(g) ?? []), `${nombre}${extra}`]);
  }
  for (const [g, nombres] of porGrupo) detalles.push(g ? `${g}: ${nombres.join(', ')}` : nombres.join(', '));
  const para = (l.nombresPersona ?? []).map(limpio).filter(Boolean);
  if (para.length > 0) detalles.push(`Para: ${para.join(', ')}`);
  if (limpio(l.nota)) detalles.push(`Nota: ${limpio(l.nota)}`);
  const cortesia = l.cortesia
    ? { ...(l.cortesia.valorLista != null ? { valorLista: Number(l.cortesia.valorLista) } : {}) }
    : undefined;
  if (cortesia) {
    detalles.push(`CORTESÍA ${solesTexto(0)}${cortesia.valorLista != null ? ` (valor ${solesTexto(cortesia.valorLista)})` : ''}`);
  }
  return {
    cantidad: l.cantidad,
    titulo: `${l.nombre}${limpio(l.tamano) ? ` (${limpio(l.tamano)})` : ''}`,
    ...(l.precioUnit != null ? { precioUnit: Number(l.precioUnit) } : {}),
    subtotal: Number(l.subtotal),
    ...(cortesia ? { cortesia } : {}),
    detalles,
    partes: (l.partes ?? []).map(detalleLinea),
  };
}

/** Un descuento ya con nombre legible: «Promo Dúo», «Cupón VERANO», «Descuento del personal 25%», «Puntos canjeados». */
export interface DescuentoTicket {
  tipo?: string;
  nombre: string;
  monto: number;
}

/** Renglones de totales que comparten ticket y precuenta, antes del TOTAL: subtotal, descuentos desglosados y envío. */
export function resumenAntesDelTotal(d: {
  subtotal?: number | null;
  descuentos?: DescuentoTicket[] | null;
  envio?: number | null;
}): { etiqueta: string; monto: number; resta?: boolean }[] {
  const o: { etiqueta: string; monto: number; resta?: boolean }[] = [];
  const descuentos = (d.descuentos ?? []).filter((x) => Number(x.monto) > 0);
  const envio = Number(d.envio ?? 0);
  // Subtotal solo si hay algo que explicar (descuentos o envío)
  if (d.subtotal != null && (descuentos.length > 0 || envio > 0)) o.push({ etiqueta: 'Subtotal', monto: Number(d.subtotal) });
  for (const x of descuentos) o.push({ etiqueta: x.nombre, monto: Number(x.monto), resta: true });
  if (envio > 0) o.push({ etiqueta: 'Envío', monto: envio });
  return o;
}

const redondeo = (v: unknown): number => Math.round(Number(v ?? 0) * 100) / 100;

/**
 * Línea cruda de un pedido (fila de la base o JSON de la API) → entrada del detalle. Acepta los dos nombres de campo
 * (`sabor_nombre`/`nombre`, `opcion_nombre`/`nombre`, `grupo_nombre`/`grupo`) y cuelga las piezas del combo (líneas hijas).
 */
export function entradaDeLineaPedido(l: any, todas: any[] = []): LineaDetalleEntrada {
  const hijas = l.id == null ? [] : todas.filter((h) => h.linea_combo_id != null && String(h.linea_combo_id) === String(l.id));
  const sabores = (l.sabores || []).map((s: any) => ({ sabor: s.sabor_nombre ?? s.nombre, cantidad: s.cantidad }));
  return {
    cantidad: l.cantidad,
    nombre: l.nombre,
    tamano: l.tamano ?? null,
    precioUnit: l.precio_unit == null ? null : redondeo(l.precio_unit),
    subtotal: redondeo(l.subtotal ?? Number(l.precio_unit) * l.cantidad),
    ...(sabores.length > 0 ? { sabores } : {}),
    ...(l.sabor ? { sabor: l.sabor } : {}),
    opciones: (l.opcionesElegidas || l.opciones || []).map((o: any) => ({
      grupo: o.grupo_nombre ?? o.grupo ?? null,
      nombre: o.opcion_nombre || o.nombre || '',
      extra: o.precio_extra == null ? null : redondeo(o.precio_extra),
    })),
    nombresPersona: l.nombres_persona || [],
    nota: l.nota ?? null,
    ...(l.es_cortesia ? { cortesia: { valorLista: l.cortesia?.valor_lista == null ? null : redondeo(l.cortesia.valor_lista) } } : {}),
    partes: hijas.map((h) => entradaDeLineaPedido(h, todas)),
  };
}

/** Descuentos del pedido con nombre legible: oferta/promo por nombre, cupón por código, personal y puntos canjeados. */
export function descuentosDePedido(pedido: { descuento_detalle?: unknown; descuento?: unknown; puntos_canjeados?: unknown }): DescuentoTicket[] {
  const crudo = pedido.descuento_detalle as any;
  const lista: any[] = Array.isArray(crudo) ? crudo : crudo && typeof crudo === 'object' ? [crudo] : [];
  const out: DescuentoTicket[] = lista
    .map((d) => {
      const nombre = d.tipo === 'CUPON' ? `Cupón ${d.codigo || d.nombre || ''}`.trim() : String(d.nombre || d.codigo || 'Descuento');
      return { tipo: String(d.tipo ?? ''), nombre, monto: redondeo(d.montoDescontado ?? d.monto) };
    })
    .filter((d) => d.monto > 0);
  if (out.length === 0 && redondeo(pedido.descuento) > 0) out.push({ tipo: 'DESCUENTO', nombre: 'Descuento', monto: redondeo(pedido.descuento) });
  const puntos = redondeo(pedido.puntos_canjeados);
  if (puntos > 0) out.push({ tipo: 'PUNTOS', nombre: `Puntos canjeados (${puntos})`, monto: puntos });
  return out;
}
