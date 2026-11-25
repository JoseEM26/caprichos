import type { GrupoOpcionesCarta, OpcionCarta, ProductoCarta, TamanoCarta } from '../carta/tipos';

type Prod = Pick<ProductoCarta, 'fotoUrl' | 'sabores' | 'mostrarImagenesSabores' | 'mostrarImagenesTamanos'>;

/** Sabores con su miniatura (la propia o, si no tiene, la del producto) solo si el interruptor está encendido; si no, tal cual. */
export function saboresConFoto<T extends { id: string }>(sabores: T[], p: Prod): (T & { fotoUrl?: string | null })[] {
  if (!p.mostrarImagenesSabores) return sabores;
  return sabores.map((s) => ({ ...s, fotoUrl: p.sabores.find((x) => x.id === s.id)?.fotoUrl ?? p.fotoUrl }));
}

/** Foto principal: la del tamaño elegido si el interruptor está encendido y tiene; si no, la del producto. */
export function fotoPrincipal(p: Prod, tamano: Pick<TamanoCarta, 'fotoUrl'> | null | undefined): string | null {
  return (p.mostrarImagenesTamanos && tamano?.fotoUrl) || p.fotoUrl;
}

/** Miniatura de un botón de tamaño (null = no mostrar). */
export function fotoBotonTamano(p: Prod, t: TamanoCarta): string | null {
  return p.mostrarImagenesTamanos ? t.fotoUrl || p.fotoUrl : null;
}

/** Miniatura de una opción de grupo (null = no mostrar). */
export function fotoOpcion(p: Pick<ProductoCarta, 'fotoUrl'>, g: Pick<GrupoOpcionesCarta, 'mostrarImagenes'>, o: Pick<OpcionCarta, 'fotoUrl'>): string | null {
  return g.mostrarImagenes ? o.fotoUrl || p.fotoUrl : null;
}
