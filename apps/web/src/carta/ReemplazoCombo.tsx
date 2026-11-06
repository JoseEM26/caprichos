import type { AlternativaParteItem, ComboParteItem, OfertaItem, OpcionDetalleCombo } from '../admin/ofertas/ofertasApi';
import { Reparto, totalElegido } from '../comun/saboresMezcla';

/**
 * Parte del combo sin saldo para su original: el cliente elige una alternativa (producto y cantidad propios,
 * mismo precio del combo). Solo aparece cuando el servidor marca `alternativasActivas`.
 */
export interface ParteConAlternativas {
  parteId: string;
  /** Lo que falta: el principal (FIJO) o las opciones de la parte. */
  faltanteNombre: string;
  alternativas: AlternativaParteItem[];
}

/**
 * Resumen de las partes fijas del combo con su tamaño («Frappe Oreo · Regular 12 oz»). Solo las que salen con su
 * principal (sin alternativa activa): la alternativa la muestra el aviso de reemplazo.
 */
export function partesFijasResumen(oferta: OfertaItem | null): string[] {
  if (!oferta) return [];
  return (oferta.combosParte ?? [])
    .filter((p) => (p.tipo ?? p.tipoParte) === 'FIJO' && p.alternativasActivas !== true && !!p.principalNombre)
    .map((p) => (p.tamanoNombre ? `${p.principalNombre} · ${p.tamanoNombre}` : (p.principalNombre as string)));
}

/** Línea «Incluye: …» con las partes fijas y su tamaño; nada si el combo no tiene partes fijas. */
export function ResumenPartesFijas({ oferta }: { oferta: OfertaItem | null }) {
  const nombres = partesFijasResumen(oferta);
  if (nombres.length === 0) return null;
  return (
    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cp-navy)' }}>
      Incluye: {nombres.join(' + ')}
    </div>
  );
}

/** Combo activo vinculado a un producto de la carta (el producto «Combo Dúo...» abre su ventana de armado). */
export function comboDeProducto(ofertas: OfertaItem[] | undefined, productoId: string): OfertaItem | null {
  return (
    (ofertas ?? []).find(
      (o) => o.tipo === 'COMBO' && o.activo !== false && String(o.alcanceProductoId ?? '') === String(productoId),
    ) ?? null
  );
}

/** Partes cuyo original no alcanza: se ofrecen sus alternativas (todas, con las agotadas bloqueadas). */
export function partesConAlternativas(oferta: OfertaItem | null): ParteConAlternativas[] {
  if (!oferta) return [];
  return (oferta.combosParte ?? [])
    .filter((p) => p.alternativasActivas === true && (p.alternativas ?? []).length > 0)
    .map((p) => {
      const esFijo = (p.tipo ?? p.tipoParte) === 'FIJO';
      const nombres = (p.opcionesDetalle ?? []).map((o) => o.nombre).filter(Boolean);
      return {
        parteId: String(p.id),
        faltanteNombre: esFijo ? p.principalNombre || 'el producto principal' : nombres.length ? nombres.join(' / ') : 'la elección',
        alternativas: p.alternativas ?? [],
      };
    });
}

/** Reparto inicial al elegir una alternativa: sin sabores ya quedan completas sus unidades; con sabor, el cliente las elige. */
export function repartoAlternativa(alt: AlternativaParteItem): Reparto {
  return alt.sabores && alt.sabores.length > 0 ? {} : { [alt.id]: alt.cantidad };
}

export interface ComboEleccion {
  parteId: string;
  productoId: string;
  saborId?: string;
}

/** Partes con lista de productos (juguetes, donas) o la alternativa elegida: el cliente elige cuántas de cada una. */
export interface ParteEleccion {
  parteId: string;
  /** Opciones por combo: el servidor exige cantidad × unidades elegidas. */
  cantidad: number;
  opciones: OpcionDetalleCombo[];
}

/**
 * Clave del contador de una opción en el reparto de una parte. Producto normal: «productoId». Producto por sabor:
 * «productoId|saborId» (cada unidad lleva su sabor, como en la mezcla de sabores de la carta).
 */
export const claveSabor = (productoId: string, saborId: string): string => `${productoId}|${saborId}`;

/** Alternativa elegida para una parte, si la hay (solo cuando el original no alcanza). */
function alternativaElegida(p: ComboParteItem, elegidos: Record<string, string>): AlternativaParteItem | undefined {
  if (p.alternativasActivas !== true) return undefined;
  return (p.alternativas ?? []).find((a) => a.id === elegidos[String(p.id)]);
}

/**
 * Qué elige el cliente con cantidad: la alternativa elegida (si el original no alcanza) o, si no, la lista de
 * productos de la parte A_ELECCION (juguetes, donas). Con alternativas activas sin elegir, la lista original no se muestra.
 */
export function partesEleccion(oferta: OfertaItem | null, elegidos: Record<string, string> = {}): ParteEleccion[] {
  if (!oferta) return [];
  return (oferta.combosParte ?? []).flatMap((p): ParteEleccion[] => {
    const parteId = String(p.id);
    if (p.alternativasActivas === true) {
      const alt = alternativaElegida(p, elegidos);
      return alt ? [{ parteId, cantidad: alt.cantidad, opciones: [alt] }] : [];
    }
    if ((p.tipo ?? p.tipoParte) === 'A_ELECCION' && (p.opcionesDetalle ?? []).length > 0) {
      return [{ parteId, cantidad: p.cantidad, opciones: p.opcionesDetalle ?? [] }];
    }
    return [];
  });
}

/** Elecciones por parte del combo: FIJO (principal si no falta stock) y lo elegido en cada parte (cada unidad, repetida por producto). */
export function eleccionesCombo(
  oferta: OfertaItem | null,
  elegidos: Record<string, string>,
  juguetes: Record<string, Reparto> = {},
): ComboEleccion[] {
  if (!oferta) return [];
  const fijas = (oferta.combosParte ?? [])
    .filter((p) => (p.tipo ?? p.tipoParte) === 'FIJO' && p.productos?.[0] !== undefined && p.alternativasActivas !== true)
    .map((p) => ({ parteId: String(p.id), productoId: String(p.productos![0]) }));
  const eleccion = partesEleccion(oferta, elegidos).flatMap((parte) =>
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

/** Falta (o sobra) elegir en alguna parte: hay que elegir cantidad × unidades exactas. */
export function faltaElegirJuguetes(partes: ParteEleccion[], juguetes: Record<string, Reparto>, unidades: number): boolean {
  return partes.some((p) => totalElegido(juguetes[p.parteId] ?? {}) !== p.cantidad * unidades);
}

/** Hay una parte sin original disponible y sin alternativa elegida. */
export const faltaElegirReemplazo = (partes: ParteConAlternativas[], elegidos: Record<string, string>): boolean =>
  partes.some((p) => !elegidos[p.parteId]);

/** Texto para la nota del pedido: «Gala (en lugar de Club Sandwich)». */
export function notaReemplazos(partes: ParteConAlternativas[], elegidos: Record<string, string>): string {
  return partes
    .map((p) => {
      const a = p.alternativas.find((x) => x.id === elegidos[p.parteId]);
      return a ? `${a.nombre} (en lugar de ${p.faltanteNombre})` : '';
    })
    .filter(Boolean)
    .join(' · ');
}

interface Props {
  partes: ParteConAlternativas[];
  elegidos: Record<string, string>;
  onElegir: (parteId: string, alternativa: AlternativaParteItem) => void;
}

/** «Sin stock de X: elige una alternativa (mismo precio)»: todas las alternativas; las agotadas quedan bloqueadas. */
export function AvisoAlternativasCombo({ partes, elegidos, onElegir }: Props) {
  if (partes.length === 0) return null;
  return (
    <div data-testid="aviso-reemplazo-combo" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {partes.map((p) => (
        <div
          key={p.parteId}
          role="group"
          aria-label={`Alternativas de ${p.faltanteNombre}`}
          style={{ border: '1.5px solid var(--cp-orange)', borderRadius: 14, padding: 12, background: 'var(--cp-white)' }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
            Sin stock de {p.faltanteNombre}: elige una alternativa (mismo precio)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {p.alternativas.map((a) => {
              const on = elegidos[p.parteId] === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={on}
                  disabled={!a.disponible}
                  onClick={() => onElegir(p.parteId, a)}
                  style={{
                    minHeight: 44,
                    padding: '0 14px',
                    borderRadius: 12,
                    border: `2px solid ${on ? 'var(--cp-orange)' : 'var(--cp-line)'}`,
                    background: on ? 'var(--cp-orange)' : 'var(--cp-white)',
                    color: on ? '#FFFFFF' : 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: 13,
                    opacity: a.disponible ? 1 : 0.5,
                    cursor: a.disponible ? 'pointer' : 'not-allowed',
                  }}
                >
                  {a.nombre}
                  {a.cantidad > 1 ? ` × ${a.cantidad}` : ''}
                  {!a.disponible ? ' · No hay stock' : ''}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
