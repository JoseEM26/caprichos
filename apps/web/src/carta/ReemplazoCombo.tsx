import { useState, type KeyboardEvent } from 'react';
import type { AlternativaParteItem, ComboParteItem, OfertaItem, OpcionDetalleCombo } from '../admin/ofertas/ofertasApi';
import { Reparto } from '../comun/saboresMezcla';

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
    .filter((p) => (p.tipo ?? p.tipoParte) === 'FIJO' && p.alternativasActivas !== true && !!p.principalNombre && p.opcional !== true)
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

/** Un complemento con alternativas («Complemento»): cada paquete es una combinación de piezas y el cliente elige UNO. */
export interface GrupoPaquetes {
  grupo: string;
  paquetes: { nombre: string; disponible: boolean }[];
}

/** Grupos de paquetes del combo en el orden en que se armaron; un paquete está disponible si todas sus piezas lo están. */
export function gruposPaquetes(oferta: OfertaItem | null): GrupoPaquetes[] {
  const grupos: GrupoPaquetes[] = [];
  for (const p of oferta?.combosParte ?? []) {
    if (!p.paqueteGrupo) continue;
    const nombre = p.paqueteNombre ?? '';
    let g = grupos.find((x) => x.grupo === p.paqueteGrupo);
    if (!g) {
      g = { grupo: p.paqueteGrupo, paquetes: [] };
      grupos.push(g);
    }
    const ya = g.paquetes.find((x) => x.nombre === nombre);
    if (ya) ya.disponible = ya.disponible && p.disponible !== false;
    else g.paquetes.push({ nombre, disponible: p.disponible !== false });
  }
  return grupos;
}

/** La oferta solo con las partes normales y las del paquete elegido de cada grupo: el resto del armado la usa tal cual. */
export function filtrarPaquetes(oferta: OfertaItem | null, elegidos: Record<string, string>): OfertaItem | null {
  if (!oferta || !(oferta.combosParte ?? []).some((p) => p.paqueteGrupo)) return oferta;
  return {
    ...oferta,
    combosParte: (oferta.combosParte ?? []).filter((p) => !p.paqueteGrupo || elegidos[p.paqueteGrupo] === p.paqueteNombre),
  };
}

/** Hay un grupo de paquetes sin paquete elegido. */
export const faltaElegirPaquete = (oferta: OfertaItem | null, elegidos: Record<string, string>): boolean =>
  gruposPaquetes(oferta).some((g) => !elegidos[g.grupo]);

interface PropsPaquetes {
  grupos: GrupoPaquetes[];
  elegidos: Record<string, string>;
  onElegir: (grupo: string, paquete: string) => void;
}

/** Nombre corto para el chip: sin aclaraciones entre paréntesis; el nombre completo va en title y en el resumen. */
export const nombreCortoPaquete = (nombre: string): string => nombre.replace(/\s*\([^)]*\)/g, '').trim() || nombre;

/** «Elige tu complemento»: una fila de chips (radiogroup, flechas); los que no se pueden armar por stock quedan bloqueados. */
export function SelectorPaqueteCombo({ grupos, elegidos, onElegir }: PropsPaquetes) {
  const [cambio, setCambio] = useState<string | null>(null);
  if (grupos.length === 0) return null;
  return (
    <div data-testid="paquetes-combo" style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      {grupos.map((g) => {
        const etiqueta = `Elige tu ${g.grupo.toLowerCase()}`;
        const elegido = elegidos[g.grupo];
        const habilitados = g.paquetes.filter((x) => x.disponible);
        const foco = habilitados.find((x) => x.nombre === elegido) ?? habilitados[0];
        const mover = (e: KeyboardEvent<HTMLDivElement>) => {
          const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
          if (!d || habilitados.length === 0) return;
          e.preventDefault();
          const i = habilitados.findIndex((x) => x.nombre === foco?.nombre);
          const sig = habilitados[(i + d + habilitados.length) % habilitados.length];
          elegir(g.grupo, sig.nombre);
          const radios = e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not(:disabled)');
          radios[(i + d + habilitados.length) % habilitados.length]?.focus();
        };
        const elegir = (grupo: string, nombre: string) => {
          if (elegidos[grupo] === nombre) return;
          setCambio(elegidos[grupo] ? grupo : null);
          onElegir(grupo, nombre);
        };
        return (
          <div key={g.grupo} style={{ minWidth: 0 }}>
            <div id={`paq-${g.grupo}`} style={{ fontWeight: 800, fontSize: 14, marginBottom: 6, color: 'var(--cp-navy)' }}>
              {etiqueta}
              {g.paquetes.length > 6 && <span style={{ fontWeight: 500, fontSize: 12 }}> · desliza para ver más →</span>}
            </div>
            <div
              role="radiogroup"
              aria-labelledby={`paq-${g.grupo}`}
              onKeyDown={mover}
              style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollSnapType: 'x proximity', paddingBottom: 4, minWidth: 0 }}
            >
              {g.paquetes.map((pq) => {
                const on = elegido === pq.nombre;
                return (
                  <button
                    key={pq.nombre}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={pq.disponible ? pq.nombre : `${pq.nombre}, agotado`}
                    title={pq.nombre}
                    disabled={!pq.disponible}
                    tabIndex={foco?.nombre === pq.nombre ? 0 : -1}
                    onClick={() => elegir(g.grupo, pq.nombre)}
                    style={{
                      flex: g.paquetes.length <= 2 ? '1 1 0' : '0 0 auto',
                      scrollSnapAlign: 'start',
                      minHeight: 44,
                      maxWidth: 230,
                      padding: '0 12px',
                      borderRadius: 12,
                      border: `2px solid ${on ? 'var(--cp-orange)' : 'var(--cp-line)'}`,
                      background: on ? 'var(--cp-orange)' : 'var(--cp-white)',
                      color: 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: 13,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      opacity: pq.disponible ? 1 : 0.5,
                      cursor: pq.disponible ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {on && <span aria-hidden="true">✓ </span>}
                    {nombreCortoPaquete(pq.nombre)}
                    {!pq.disponible && <span style={{ fontSize: 11 }}> · Agotado</span>}
                  </button>
                );
              })}
            </div>
            {elegido && (
              <div role="status" style={{ fontSize: 12, marginTop: 4, color: 'var(--cp-navy)' }}>
                Elegiste: <strong>{elegido}</strong>
                {cambio === g.grupo && <span style={{ opacity: 0.7 }}> · Cambiaste tu {g.grupo.toLowerCase()}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export interface ComboEleccion {
  parteId: string;
  productoId: string;
  /** Solo partes opcionales: unidades que lleva (0 = sin ella). */
  cantidad?: number;
  saborId?: string;
}

/** Partes con lista de productos (juguetes, donas) o la alternativa elegida: el cliente elige cuántas de cada una. */
export interface ParteEleccion {
  parteId: string;
  /** Opciones por combo: el servidor exige cantidad × unidades elegidas. */
  cantidad: number;
  opciones: OpcionDetalleCombo[];
  /** Bebidas por categorías: se eligen en pasos «Bebida 1..N» (una por paso), no con contadores. */
  bebidas?: boolean;
}

/**
 * Clave del contador de una opción en el reparto de una parte. Producto normal: «productoId». Producto por sabor:
 * «productoId|saborId» (cada unidad lleva su sabor, como en la mezcla de sabores de la carta).
 */
export const claveSabor = (productoId: string, saborId: string): string => `${productoId}|${saborId}`;

/** Reparto (clave → unidades) de una lista ordenada de claves; los huecos («») no cuentan. */
export const repartoDeLista = (lista: string[]): Reparto => {
  const r: Reparto = {};
  for (const c of lista) if (c) r[c] = (r[c] ?? 0) + 1;
  return r;
};

/**
 * Lo elegido en todas las partes: contadores (juguetes, donas) y, en las partes de bebidas, la lista de pasos «Bebida N»
 * convertida a reparto (recortada al total vigente).
 */
export function unirElecciones(
  partes: ParteEleccion[],
  juguetes: Record<string, Reparto>,
  bebidas: Record<string, string[]>,
  unidades: number,
): Record<string, Reparto> {
  const unido = { ...juguetes };
  for (const p of partes) if (p.bebidas) unido[p.parteId] = repartoDeLista((bebidas[p.parteId] ?? []).slice(0, p.cantidad * unidades));
  return unido;
}

/** Nombre de cada bebida elegida en el orden en que viaja al servidor (agrupadas por producto): para el nombre del envase. */
export function bebidasElegidas(partes: ParteEleccion[], elegido: Record<string, Reparto>): string[] {
  return partes
    .filter((p) => p.bebidas)
    .flatMap((p) =>
      Object.entries(elegido[p.parteId] ?? {}).flatMap(([clave, n]) => {
        const nombre = p.opciones.find((o) => o.id === clave.split('|')[0])?.nombre ?? 'Bebida';
        return Array.from({ length: n }, () => nombre);
      }),
    );
}

/** Los grupos de opciones del anfitrión que repiten la bebida («Bebida 1 · Sabor») se ocultan si el combo tiene bebidas por categorías. */
export const esGrupoBebidaDuplicado = (nombre: string): boolean => {
  const n = nombre.trim();
  if (!/^bebida/i.test(n)) return false;
  const corto = n.includes(' · ') ? n.split(' · ').slice(1).join(' · ').trim() : '';
  return corto === '' || /^(sabor|bebida)/i.test(corto);
};

/** El combo ofrece sus bebidas por categorías (pasos «Bebida 1..N»). */
export const comboConBebidas = (oferta: OfertaItem | null | undefined): boolean =>
  (oferta?.combosParte ?? []).some((p) => p.bebidas === true && (p.opcionesDetalle ?? []).length > 0);

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
      return [{ parteId, cantidad: p.cantidad, opciones: p.opcionesDetalle ?? [], ...(p.bebidas ? { bebidas: true } : {}) }];
    }
    return [];
  });
}

/** Elecciones por parte del combo: FIJO (principal si no falta stock) y lo elegido en cada parte (cada unidad, repetida por producto). */
export function eleccionesCombo(
  oferta: OfertaItem | null,
  elegidos: Record<string, string>,
  juguetes: Record<string, Reparto> = {},
  opcionales: Record<string, number> = {},
): ComboEleccion[] {
  if (!oferta) return [];
  const deOpcional = new Map(partesOpcionales(oferta).map((o) => [o.parteId, o]));
  const fijas = (oferta.combosParte ?? [])
    .filter((p) => (p.tipo ?? p.tipoParte) === 'FIJO' && p.productos?.[0] !== undefined && p.alternativasActivas !== true)
    .map((p) => {
      const op = deOpcional.get(String(p.id));
      return { parteId: String(p.id), productoId: String(p.productos![0]), ...(op ? { cantidad: llevadasOpcional(op, opcionales) } : {}) };
    });
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

/** Lugares que ocupa una opción (clave «productoId» o «productoId|saborId») en la parte: 1 si no dice otra cosa. */
export const cuposDeClave = (parte: ParteEleccion, clave: string): number => parte.opciones.find((o) => o.id === clave.split('|')[0])?.cupos ?? 1;

/** Lugares ocupados por lo elegido en la parte (cada unidad cuenta los cupos de su producto). */
export const lugaresElegidos = (parte: ParteEleccion, reparto: Reparto): number =>
  Object.entries(reparto).reduce((a, [clave, n]) => a + (Number.isFinite(n) && n > 0 ? n * cuposDeClave(parte, clave) : 0), 0);

/** Falta (o sobra) elegir en alguna parte: los lugares ocupados deben ser cantidad × unidades exactas. */
export function faltaElegirJuguetes(partes: ParteEleccion[], juguetes: Record<string, Reparto>, unidades: number): boolean {
  return partes.some((p) => lugaresElegidos(p, juguetes[p.parteId] ?? {}) !== p.cantidad * unidades);
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

/** Partes opcionales del combo (papas: incluida 1, se puede quitar, extra S/ 6.00): el cliente decide cuántas lleva. */
export interface ParteOpcionalCombo {
  parteId: string;
  nombre: string;
  incluidas: number;
  min: number;
  max: number;
  precioExtra: number;
  porDefecto: number;
}

export function partesOpcionales(oferta: OfertaItem | null): ParteOpcionalCombo[] {
  if (!oferta) return [];
  return (oferta.combosParte ?? [])
    .filter((p) => (p.tipo ?? p.tipoParte) === 'FIJO' && p.opcional === true && p.alternativasActivas !== true && p.productos?.[0] !== undefined)
    .map((p) => {
      const incluidas = p.cantidad || 1;
      return {
        parteId: String(p.id),
        nombre: p.principalNombre ?? '',
        incluidas,
        min: p.cantidadMin ?? 0,
        max: p.cantidadMax ?? incluidas,
        precioExtra: Number(p.precioExtra) > 0 ? Number(p.precioExtra) : 0,
        porDefecto: p.incluidaPorDefecto === false ? 0 : incluidas,
      };
    });
}

/** Cuántas unidades lleva el cliente de la parte opcional (lo que eligió o, si no tocó nada, lo marcado por defecto). */
export const llevadasOpcional = (p: ParteOpcionalCombo, elegidas: Record<string, number>): number => elegidas[p.parteId] ?? p.porDefecto;

/** Cobro por combo de los extras (unidades sobre las incluidas × precio del extra); el servidor lo recalcula. */
export function recargoOpcionales(oferta: OfertaItem | null, elegidas: Record<string, number>): number {
  const total = partesOpcionales(oferta).reduce((a, p) => a + Math.max(0, llevadasOpcional(p, elegidas) - p.incluidas) * p.precioExtra, 0);
  return Math.round(total * 100) / 100;
}

/** Tarjeta compacta de una parte opcional: «Papas nativas · ✓ Incluida» con − n +; avisa «Sin papas» y el cobro de cada extra. */
export function ParteOpcionalTarjeta({ parte, valor, onCambio, deshabilitar = false }: { parte: ParteOpcionalCombo; valor: number; onCambio: (n: number) => void; deshabilitar?: boolean }) {
  const extras = Math.max(0, valor - parte.incluidas);
  const estado = valor === 0 ? '' : extras > 0 ? `✓ Incluida + ${extras} extra` : '✓ Incluida';
  const boton = (texto: string, etiqueta: string, desactivado: boolean, n: number) => (
    <button
      type="button"
      aria-label={`${etiqueta}: ${parte.nombre}`}
      disabled={deshabilitar || desactivado}
      onClick={() => onCambio(n)}
      style={{ width: 36, height: 36, borderRadius: 999, border: '1.5px solid var(--cp-line)', background: 'var(--cp-white)', fontWeight: 800, fontSize: 18, color: 'var(--cp-navy)' }}
    >
      {texto}
    </button>
  );
  return (
    <div data-testid={`parte-opcional-${parte.parteId}`} role="group" aria-label={`${parte.nombre}, opcional`} style={{ border: '1.5px solid var(--cp-line)', borderRadius: 14, padding: '10px 12px', background: 'var(--cp-white)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {parte.nombre}
          {estado && <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--cp-orange)', marginLeft: 8 }}>{estado}</span>}
        </div>
        {valor === 0 && <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>Sin {parte.nombre.toLowerCase()}</div>}
        {parte.precioExtra > 0 && parte.max > parte.incluidas && (
          <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>+ S/ {parte.precioExtra.toFixed(2)} por cada extra{extras > 0 ? ` (extra S/ ${(extras * parte.precioExtra).toFixed(2)})` : ''}</div>
        )}
        {parte.precioExtra > 0 && parte.max > parte.incluidas && valor > 0 && extras === 0 && (
          <div data-testid={`ayuda-extra-${parte.parteId}`} style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-rust)' }}>
            Ya incluye {parte.incluidas}. Toca + si quieres más: cada una suma S/ {parte.precioExtra.toFixed(2)}.
          </div>
        )}
        {extras > 0 && (
          <div data-testid={`suma-extra-${parte.parteId}`} style={{ fontSize: 12, fontWeight: 800, color: 'var(--cp-rust)' }}>
            Suma S/ {(extras * parte.precioExtra).toFixed(2)} al combo
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {boton('−', 'Quitar uno', valor <= parte.min, valor - 1)}
        <output aria-label={`Cantidad de ${parte.nombre}`} style={{ minWidth: 18, textAlign: 'center', fontWeight: 800 }}>{valor}</output>
        {boton('+', 'Agregar uno', valor >= parte.max, valor + 1)}
      </div>
    </div>
  );
}
