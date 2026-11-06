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

/** Alternativa de una parte: producto y cantidad que sustituyen a la parte cuando su original no alcanza. */
export interface AlternativaDisp {
  id: string;
  cantidad: number;
}

export interface ParteDisp {
  id?: string;
  tipo: 'A_ELECCION' | 'UNA_DE' | 'FIJO';
  cantidad: number;
  categorias: string[];
  productos: string[];
  /** Alternativas en orden («si no hay stock, elige»). Cualquier tipo de parte. */
  alternativas: AlternativaDisp[];
}

export interface AlternativaDisponibilidad {
  id: string;
  cantidad: number;
  disponible: boolean;
}

export interface ParteDisponibilidad {
  disponible: boolean;
  /** FIJO: el principal si está disponible; si no, las alternativas disponibles en orden. Otros tipos: vacío. */
  opcionesDisponibles: string[];
  principalDisponible: boolean | null;
  /** El original alcanza con el saldo de lo pedido (no hace falta alternativa). */
  armable: boolean;
  /** Todas las alternativas, en orden, con su disponibilidad ahora. */
  alternativas: AlternativaDisponibilidad[];
  /** Hay que ofrecer alternativas: el original no alcanza y alguna alternativa tiene stock. */
  alternativasActivas: boolean;
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
 * Unidades que se pueden pedir de un producto ahora: Infinity si no controla stock (y está visible y no agotado),
 * 0 si no está disponible; con sabores, la suma del saldo de sus sabores disponibles.
 */
export function unidadesDisponibles(p: ProductoDisp | undefined): number {
  if (!p || p.oculto || !estaDisponible(p.agotadoHasta)) return 0;
  if (!p.controlaStock) return Infinity;
  if ((p.sabores ?? []).length > 0) {
    return (p.sabores ?? []).filter(saborDisponible).reduce((acc, s) => acc + Math.floor(s.saldo), 0);
  }
  return Math.max(0, Math.floor(p.saldo ?? 0));
}

/** Productos que pueden cubrir la parte original: FIJO el principal; UNA_DE sus productos; A_ELECCION los de sus categorías o lista. */
export function productosDeParte(parte: ParteDisp, productos: ProductoDisp[]): ProductoDisp[] {
  if (parte.tipo === 'FIJO') return productos.filter((p) => p.id === parte.productos[0]);
  if (parte.tipo === 'UNA_DE') return productos.filter((p) => parte.productos.includes(p.id));
  return productos.filter((p) => parte.categorias.includes(p.categoriaId) || parte.productos.includes(p.id));
}

/** El original alcanza: entre sus productos hay unidades para la cantidad de la parte (por unidad de combo). */
export function parteArmable(parte: ParteDisp, productos: ProductoDisp[], unidades = 1): boolean {
  const total = productosDeParte(parte, productos).reduce((acc, p) => acc + unidadesDisponibles(p), 0);
  return total >= parte.cantidad * unidades;
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
    const alternativas = parte.alternativas.map((a) => ({
      id: a.id,
      cantidad: a.cantidad,
      disponible: unidadesDisponibles(porId.get(a.id)) >= a.cantidad,
    }));
    const armable = parteArmable(parte, productos);
    const altDisponible = alternativas.some((a) => a.disponible);
    // Alternativas solo cuando falta saldo para el original; la parte queda disponible con el original o con una alternativa
    const alternativasActivas = !armable && altDisponible;
    const originalOk = productosDeParte(parte, productos).some((p) => productoDisponible(p));
    const disponible = originalOk || altDisponible;
    const altIds = alternativas.filter((a) => a.disponible).map((a) => a.id);

    if (parte.tipo === 'FIJO') {
      const principal = parte.productos[0];
      const principalOk = !!principal && productoDisponible(porId.get(principal));
      const opciones = principalOk ? [principal] : altIds;
      if (!disponible) motivos.push(nombre(principal ?? ''));
      return {
        disponible,
        opcionesDisponibles: opciones,
        principalDisponible: principalOk,
        armable,
        alternativas,
        alternativasActivas,
      };
    }
    if (!disponible) {
      motivos.push(parte.tipo === 'UNA_DE' ? 'una de las opciones' : 'las bebidas a elegir');
    }
    return { disponible, opcionesDisponibles: [], principalDisponible: null, armable, alternativas, alternativasActivas };
  });

  return {
    disponible: resultado.every((r) => r.disponible),
    motivoAgotado: motivos.length ? `Falta ${motivos.join(' y ')}` : null,
    partes: resultado,
  };
}
