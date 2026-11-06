import type { ComboParteItem, OfertaItem } from '../admin/ofertas/ofertasApi';
import { Reparto, totalElegido } from '../comun/saboresMezcla';

export interface ParteConReemplazo {
  parteId: string;
  principalNombre: string;
  opciones: { id: string; nombre: string }[];
}

/** Combo activo vinculado a un producto de la carta (el producto «Combo Dúo...» abre su ventana de armado). */
export function comboDeProducto(ofertas: OfertaItem[] | undefined, productoId: string): OfertaItem | null {
  return (
    (ofertas ?? []).find(
      (o) => o.tipo === 'COMBO' && o.activo !== false && String(o.alcanceProductoId ?? '') === String(productoId),
    ) ?? null
  );
}

/** Partes FIJO cuyo principal no está disponible: el cliente debe elegir uno de los reemplazos disponibles. */
export function partesConReemplazo(oferta: OfertaItem | null): ParteConReemplazo[] {
  if (!oferta) return [];
  return (oferta.combosParte ?? [])
    .filter((p) => (p.tipo ?? p.tipoParte) === 'FIJO' && p.opcionesDisponibles && p.opcionesDisponibles.length > 0)
    .filter((p) => !p.opcionesDisponibles!.includes(String(p.productos?.[0])))
    .map((p) => ({
      parteId: String(p.id),
      principalNombre: p.principalNombre || 'El producto principal',
      opciones: (p.reemplazosDetalle ?? []).filter((r) => p.opcionesDisponibles!.includes(r.id)),
    }));
}

/** Elección inicial: si solo queda un reemplazo, ya viene elegido. */
export function eleccionInicial(partes: ParteConReemplazo[]): Record<string, string> {
  const e: Record<string, string> = {};
  for (const p of partes) if (p.opciones.length === 1) e[p.parteId] = p.opciones[0].id;
  return e;
}

/** Texto para la nota del pedido: «Empanada en lugar de Club Sandwich». */
export function notaReemplazos(partes: ParteConReemplazo[], elegidos: Record<string, string>): string {
  return partes
    .map((p) => {
      const o = p.opciones.find((x) => x.id === elegidos[p.parteId]);
      return o ? `${o.nombre} (en lugar de ${p.principalNombre})` : '';
    })
    .filter(Boolean)
    .join(' · ');
}

export interface ComboEleccion {
  parteId: string;
  productoId: string;
  saborId?: string;
}

/** Partes A_ELECCION con lista de productos (p. ej. juguetes): el cliente elige cuántas de cada una. */
export interface ParteEleccion {
  parteId: string;
  /** Opciones por combo: el servidor exige cantidad × unidades elegidas. */
  cantidad: number;
  opciones: NonNullable<ComboParteItem['opcionesDetalle']>;
}

/**
 * Clave del contador de una opción en el reparto de una parte. Producto normal: «productoId». Producto por sabor:
 * «productoId|saborId» (cada unidad lleva su sabor, como en la mezcla de sabores de la carta).
 */
export const claveSabor = (productoId: string, saborId: string): string => `${productoId}|${saborId}`;

export function partesEleccion(oferta: OfertaItem | null): ParteEleccion[] {
  if (!oferta) return [];
  return (oferta.combosParte ?? [])
    .filter((p) => (p.tipo ?? p.tipoParte) === 'A_ELECCION' && (p.opcionesDetalle ?? []).length > 0)
    .map((p) => ({ parteId: String(p.id), cantidad: p.cantidad, opciones: p.opcionesDetalle ?? [] }));
}

/** Elecciones por parte del combo: FIJO (principal o reemplazo) y A_ELECCION (cada unidad elegida, repetida por producto). */
export function eleccionesCombo(
  oferta: OfertaItem | null,
  elegidos: Record<string, string>,
  juguetes: Record<string, Reparto> = {},
): ComboEleccion[] {
  if (!oferta) return [];
  const fijas = (oferta.combosParte ?? [])
    .filter((p) => (p.tipo ?? p.tipoParte) === 'FIJO' && p.productos?.[0] !== undefined)
    .map((p) => ({ parteId: String(p.id), productoId: elegidos[String(p.id)] ?? String(p.productos![0]) }));
  const eleccion = partesEleccion(oferta).flatMap((parte) =>
    Object.entries(juguetes[parte.parteId] ?? {}).flatMap(([clave, n]) => {
      const [productoId, saborId] = clave.split('|');
      return Array.from({ length: n }, () => ({ parteId: parte.parteId, productoId, ...(saborId ? { saborId } : {}) }));
    }),
  );
  return [...fijas, ...eleccion];
}

/**
 * Unidades ya comprometidas por sabor (id del sabor → unidades): lo que eligen las partes del combo que se está
 * armando, más lo que ya hay en el carrito (líneas con sabores y elecciones de otros combos). Sirve para que el +
 * de un sabor nunca supere su saldo.
 */
export function usosDeSabor(
  lineas: { sabores?: { saborId: string; cantidad: number }[]; comboElecciones?: { saborId?: string }[] }[],
  juguetes: Record<string, Reparto>,
): Record<string, number> {
  const usos: Record<string, number> = {};
  const sumar = (saborId: string | undefined, n: number) => {
    if (saborId) usos[saborId] = (usos[saborId] ?? 0) + n;
  };
  for (const l of lineas) {
    for (const s of l.sabores ?? []) sumar(String(s.saborId), s.cantidad);
    for (const e of l.comboElecciones ?? []) sumar(e.saborId, 1);
  }
  for (const reparto of Object.values(juguetes)) {
    for (const [clave, n] of Object.entries(reparto)) sumar(clave.split('|')[1], n);
  }
  return usos;
}

/** Falta (o sobra) elegir en alguna parte A_ELECCION: hay que elegir cantidad × unidades exactas. */
export function faltaElegirJuguetes(partes: ParteEleccion[], juguetes: Record<string, Reparto>, unidades: number): boolean {
  return partes.some((p) => totalElegido(juguetes[p.parteId] ?? {}) !== p.cantidad * unidades);
}

export const faltaElegirReemplazo = (partes: ParteConReemplazo[], elegidos: Record<string, string>): boolean =>
  partes.some((p) => !elegidos[p.parteId]);

interface Props {
  partes: ParteConReemplazo[];
  elegidos: Record<string, string>;
  onElegir: (parteId: string, productoId: string) => void;
}

export function AvisoReemplazoCombo({ partes, elegidos, onElegir }: Props) {
  if (partes.length === 0) return null;
  return (
    <div data-testid="aviso-reemplazo-combo" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {partes.map((p) => (
        <div
          key={p.parteId}
          role="group"
          aria-label={`Reemplazo de ${p.principalNombre}`}
          style={{ border: '1.5px solid var(--cp-orange)', borderRadius: 14, padding: 12, background: 'var(--cp-white)' }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
            {p.principalNombre} no está disponible ahora; elige uno de estos:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {p.opciones.map((o) => {
              const on = elegidos[p.parteId] === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onElegir(p.parteId, o.id)}
                  style={{
                    minHeight: 44,
                    padding: '0 14px',
                    borderRadius: 12,
                    border: `2px solid ${on ? 'var(--cp-orange)' : 'var(--cp-line)'}`,
                    background: on ? 'var(--cp-orange)' : 'var(--cp-white)',
                    color: on ? '#FFFFFF' : 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  {o.nombre}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
