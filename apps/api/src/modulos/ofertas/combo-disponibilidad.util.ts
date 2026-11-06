import { estaDisponible } from '../catalogo/catalogo.service';

/** Sabor de un producto por sabor, con su saldo (stock_sabor). */
export interface SaborDisp {
  id: string;
  nombre: string;
  activo: boolean;
  agotadoHasta: Date | string | null;
  saldo: number;
}

/** Producto mínimo que necesita el cálculo (todo como texto para no depender de bigint). */
export interface ProductoDisp {
  id: string;
  nombre: string;
  categoriaId: string;
  oculto: boolean;
  agotadoHasta: Date | string | null;
  /** Controla stock (producto terminado): con saldo 0 la elección queda bloqueada. */
  controlaStock?: boolean;
  /** Saldo del producto sin sabores. */
  saldo?: number;
  /** Sabores activos del producto: con sabores, el saldo vive en cada sabor. */
  sabores?: SaborDisp[];
}

export interface ParteDisp {
  id?: string;
  tipo: 'A_ELECCION' | 'UNA_DE' | 'FIJO';
  cantidad: number;
  categorias: string[];
  productos: string[];
  /** Plan B, plan C...: ids en orden (solo FIJO). */
  reemplazos: string[];
}

export interface ParteDisponibilidad {
  disponible: boolean;
  /** FIJO: el principal si está disponible; si no, los reemplazos disponibles en orden. Otros tipos: vacío. */
  opcionesDisponibles: string[];
  principalDisponible: boolean | null;
}

export interface ComboDisponibilidad {
  disponible: boolean;
  motivoAgotado: string | null;
  partes: ParteDisponibilidad[];
}

/** Sabor disponible = activo, no agotado y con saldo. */
export function saborDisponible(s: SaborDisp): boolean {
  return s.activo && estaDisponible(s.agotadoHasta) && s.saldo > 0;
}

/**
 * Disponible = ni oculto (desactivado) ni agotado; si controla stock, además con saldo: un producto por sabor
 * necesita algún sabor con saldo, uno sin sabores necesita saldo > 0. Sin stock controlado, no cambia.
 */
export function productoDisponible(p: ProductoDisp | undefined): boolean {
  if (!p || p.oculto || !estaDisponible(p.agotadoHasta)) return false;
  if (!p.controlaStock) return true;
  if ((p.sabores ?? []).length > 0) return (p.sabores ?? []).some(saborDisponible);
  return (p.saldo ?? 0) > 0;
}

/**
 * Un combo se puede armar si cada parte tiene con qué cumplirse:
 * FIJO: principal o algún reemplazo; UNA_DE: algún producto; A_ELECCION: algún producto
 * de sus categorías/productos (las bebidas se pueden repetir, basta 1).
 * Función pura: el estado se calcula en tiempo real, no se guarda.
 */
export function calcularDisponibilidadCombo(partes: ParteDisp[], productos: ProductoDisp[]): ComboDisponibilidad {
  const porId = new Map(productos.map((p) => [p.id, p]));
  const nombre = (id: string) => porId.get(id)?.nombre ?? 'un producto';
  const motivos: string[] = [];

  const resultado = partes.map((parte): ParteDisponibilidad => {
    if (parte.tipo === 'FIJO') {
      const principal = parte.productos[0];
      const principalOk = !!principal && productoDisponible(porId.get(principal));
      const reemplazosOk = parte.reemplazos.filter((id) => productoDisponible(porId.get(id)));
      const opciones = principalOk ? [principal] : reemplazosOk;
      if (opciones.length === 0) motivos.push(nombre(principal ?? ''));
      return { disponible: opciones.length > 0, opcionesDisponibles: opciones, principalDisponible: principalOk };
    }
    const candidatos =
      parte.tipo === 'UNA_DE'
        ? parte.productos
        : productos
            .filter((p) => parte.categorias.includes(p.categoriaId) || parte.productos.includes(p.id))
            .map((p) => p.id);
    const ok = candidatos.some((id) => productoDisponible(porId.get(id)));
    if (!ok) motivos.push(parte.tipo === 'UNA_DE' ? 'una de las opciones' : 'las bebidas a elegir');
    return { disponible: ok, opcionesDisponibles: [], principalDisponible: null };
  });

  return {
    disponible: resultado.every((r) => r.disponible),
    motivoAgotado: motivos.length ? `Falta ${motivos.join(' y ')}` : null,
    partes: resultado,
  };
}
