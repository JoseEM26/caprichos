import type { ProductoAdmin } from './catalogoApi';

/** Un tamaño del producto con su precio. `tamanoValorId` es el id del valor en la lista TAMANO. */
export interface TamanoEstado {
  tamanoValorId: string;
  nombre: string;
  precio: number;
  activo: boolean;
}

/** Un grupo de opciones que se le pregunta al cliente en este producto. */
export interface GrupoEstado {
  grupoId: string;
  nombre?: string;
  requerido?: boolean;
  minimo?: number;
  maximo?: number;
}

/** Estado que se emite en modo borrador y que el contenedor manda al crear el producto. */
export interface EstadoOpciones {
  tamanos: TamanoEstado[];
  grupos: GrupoEstado[];
  /** Cocina: resaltar la opción menos pedida de cada grupo. Sin valor = apagado. */
  resaltarMenosPedida?: boolean;
}

export const ESTADO_VACIO: EstadoOpciones = { tamanos: [], grupos: [] };

export function estadoDesdeProducto(p: ProductoAdmin): EstadoOpciones {
  return {
    resaltarMenosPedida: p.resaltarOpcionMenosPedida === true,
    tamanos: (p.tamanos || []).map((t) => ({
      tamanoValorId: t.tamanoValorId,
      nombre: t.nombre,
      precio: t.precio,
      activo: t.activo !== false,
    })),
    grupos: (p.grupos || []).map((g) => ({
      grupoId: g.id,
      nombre: g.nombre,
      requerido: g.obligatorio,
      minimo: g.minimo,
      maximo: g.maximo,
    })),
  };
}

/** Devuelve el primer error de los tamaños o null si todo está bien. */
export function validarTamanos(tamanos: TamanoEstado[]): string | null {
  const vistos = new Set<string>();
  for (const t of tamanos) {
    if (!Number.isFinite(t.precio) || t.precio < 0) {
      return `El precio de «${t.nombre}» debe ser 0 o más.`;
    }
    const clave = t.nombre.trim().toLowerCase();
    if (vistos.has(clave)) return `El tamaño «${t.nombre}» está repetido en este producto.`;
    vistos.add(clave);
  }
  if (tamanos.length > 0 && !tamanos.some((t) => t.activo)) {
    return 'Deja al menos un tamaño activo, o quita todos para vender a precio único.';
  }
  return null;
}
