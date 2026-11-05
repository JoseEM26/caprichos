import type { OfertaItem } from '../admin/ofertas/ofertasApi';

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
}

/** Qué se eligió en cada parte FIJO del combo (el principal si está, si no el reemplazo elegido): lo valida el servidor. */
export function eleccionesCombo(oferta: OfertaItem | null, elegidos: Record<string, string>): ComboEleccion[] {
  if (!oferta) return [];
  return (oferta.combosParte ?? [])
    .filter((p) => (p.tipo ?? p.tipoParte) === 'FIJO' && p.productos?.[0] !== undefined)
    .map((p) => ({ parteId: String(p.id), productoId: elegidos[String(p.id)] ?? String(p.productos![0]) }));
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
