import type { GrupoOpcionItem, OpcionItem, ProductoAdmin, SaborItem, TamanoItem } from './catalogoApi';
import type { GrupoOpcionesCarta, ProductoCarta } from '../../carta/tipos';

/** Borrador flexible: un ProductoAdmin guardado o lo que haya en un formulario sin guardar. */
export interface BorradorProducto {
  id?: string;
  nombre?: string;
  descripcion?: string | null;
  precio?: number | string | null;
  fotoUrl?: string | null;
  /** Imagen elegida y aún no subida: la ventana crea una URL local y la libera al cerrar. */
  fotoArchivo?: File | null;
  categoria?: { nombre: string } | null;
  categoriaNombre?: string;
  oculto?: boolean;
  disponible?: boolean;
  agotadoHasta?: string | null;
  noSumaBeneficios?: boolean;
  tamanos?: Array<Partial<TamanoItem>>;
  grupos?: Array<Partial<GrupoOpcionItem>>;
  sabores?: SaborItem[];
}

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const aOpcion = (o: Partial<OpcionItem>, i: number) => ({
  id: o.id || `op-${i}`,
  nombre: o.nombre ?? '',
  precioExtra: num(o.precioExtra),
  disponible: o.disponible !== false,
});

/** Convierte un borrador de producto (admin) al ProductoCarta que pinta la carta pública. */
export function aProductoCarta(
  draft: BorradorProducto | ProductoAdmin,
  gruposGenerales: GrupoOpcionItem[] = [],
): ProductoCarta {
  const d = draft as BorradorProducto;
  const tamanos = (d.tamanos ?? [])
    .filter((t) => t.activo !== false && (t.nombre ?? '').trim())
    .map((t, i) => ({ id: t.id || `tam-${i}`, nombre: t.nombre as string, precio: num(t.precio) }));

  const grupos: GrupoOpcionesCarta[] = (d.grupos ?? [])
    .filter((g) => g.activo !== false)
    .map((g, i) => {
      // un grupo sin opciones propias toma las del grupo general (misma lista)
      const general = gruposGenerales.find((x) => x.id === g.id || (g.listaId && x.listaId === g.listaId));
      const ops = (g.opciones?.length ? g.opciones : (general?.opciones ?? []))
        .filter((o) => o.activo !== false)
        .map(aOpcion);
      const minimo = g.minimo ?? (g.obligatorio ? 1 : 0);
      const maximo = Math.max(g.maximo ?? 1, minimo, 1);
      return { id: g.id || `gr-${i}`, nombre: g.nombre ?? '', obligatorio: minimo >= 1, minimo, maximo, opciones: ops };
    })
    .filter((g) => g.opciones.length > 0);

  return {
    id: d.id || 'borrador',
    nombre: (d.nombre ?? '').trim() || 'Producto sin nombre',
    descripcion: d.descripcion?.trim() || null,
    fotoUrl: d.fotoUrl || null,
    precio: num(d.precio),
    tamanos,
    grupos,
    sabores: (d.sabores ?? [])
      .filter((s) => s.activo !== false)
      .map((s, i) => ({ id: s.id || `sab-${i}`, nombre: s.nombre, disponible: s.disponible !== false })),
    noSumaBeneficios: Boolean(d.noSumaBeneficios),
    disponible: d.disponible !== false,
    agotadoHasta: d.agotadoHasta ?? null,
  };
}

/** Avisos útiles para el dueño sobre lo que falta en el producto. */
export function avisosProducto(draft: BorradorProducto | ProductoAdmin): string[] {
  const d = draft as BorradorProducto;
  const p = aProductoCarta(d);
  const a: string[] = [];
  if (d.oculto) a.push('Este producto no aparece en la carta: está oculto.');
  else if (d.disponible === false) a.push('Este producto está agotado: en la carta se ve como no disponible.');
  if (!p.fotoUrl && !d.fotoArchivo) a.push('Falta la foto: la carta mostrará solo las iniciales.');
  if (!p.descripcion) a.push('Falta la descripción.');
  if (p.tamanos.length === 0) a.push('No tiene tamaños: se vende al precio base.');
  return a;
}
