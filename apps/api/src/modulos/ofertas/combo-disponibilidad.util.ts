import { estaDisponible } from '../catalogo/catalogo.service';

export { esGrupoBebidaDuplicado } from './combo-grupos.util';

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
  /** Nombre de la categoría y del área (para saber si es una bebida). */
  categoriaNombre?: string | null;
  areaNombre?: string | null;
  /** Foto del producto (para mostrar la opción en la carta). */
  fotoUrl?: string | null;
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
  /** Complemento a elegir: las partes con el mismo grupo se agrupan por paquete y basta con que UN paquete se pueda armar. */
  paqueteGrupo?: string | null;
  paqueteNombre?: string | null;
  /** Sabores permitidos en la parte (id de sabor); vacío o ausente = todos. */
  saboresIds?: string[];
  /** Productos que no entran aunque su categoría sí; vacío o ausente = ninguno. */
  productosExcluidos?: string[];
  /** Cupos que ocupa cada producto en una parte A_ELECCION; lo no listado vale 1. */
  cuposProducto?: Record<string, number>;
  /** Parte opcional: el cliente puede no llevarla, así que su falta de stock no agota el combo. */
  opcional?: boolean;
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
 * Disponible = no agotado (a mano o por cronómetro); `oculto` NO cuenta: un producto que solo vive dentro de un combo
 * puede estar desactivado en la carta. Si controla stock, además con saldo: un producto por sabor
 * necesita algún sabor con saldo, uno sin sabores necesita saldo > 0. Sin stock controlado, no cambia.
 */
export function productoDisponible(p: ProductoDisp | undefined): boolean {
  if (!p || !estaDisponible(p.agotadoHasta)) return false;
  if (!p.controlaStock) return true;
  if ((p.sabores ?? []).length > 0) return (p.sabores ?? []).some(saborDisponible);
  return (p.saldo ?? 0) > 0;
}

/**
 * Unidades que se pueden pedir de un producto ahora: Infinity si no controla stock (y no está agotado; oculto no cuenta),
 * 0 si no está disponible; con sabores, la suma del saldo de sus sabores disponibles.
 */
export function unidadesDisponibles(p: ProductoDisp | undefined): number {
  if (!p || !estaDisponible(p.agotadoHasta)) return 0;
  if (!p.controlaStock) return Infinity;
  if ((p.sabores ?? []).length > 0) {
    return (p.sabores ?? []).filter(saborDisponible).reduce((acc, s) => acc + Math.floor(s.saldo), 0);
  }
  return Math.max(0, Math.floor(p.saldo ?? 0));
}

/** Bebida por el nombre de su categoría o de su área (misma regla de la carta y de las etiquetas del vaso). */
export function esBebidaPorNombres(categoria?: string | null, area?: string | null): boolean {
  const cat = (categoria || '').toUpperCase();
  const are = (area || '').toUpperCase();
  return (
    cat.includes('FRAPPE') ||
    cat.includes('ICED') ||
    cat.includes('FROZEN') ||
    cat.includes('CALIENTE') ||
    cat.includes('BEBIDA') ||
    are.includes('BARRA') ||
    are.includes('BEBIDA')
  );
}

/**
 * Parte de BEBIDAS: A_ELECCION sin paquete cuyas opciones son todas bebidas. Las opciones vienen de la lista de productos
 * (si el dueño marcó productos, esos mandan) o, sin lista, de las categorías. El cliente elige `cantidad` bebidas
 * («Bebida 1..N») entre ellas.
 */
export function esParteBebidas(parte: ParteDisp, productos: ProductoDisp[]): boolean {
  if (parte.tipo !== 'A_ELECCION' || parte.paqueteGrupo) return false;
  const candidatas = productos.filter((p) =>
    parte.productos.length > 0 ? parte.productos.includes(p.id) : parte.categorias.includes(p.categoriaId),
  );
  if (parte.productos.length === 0 && parte.categorias.length === 0) return false;
  return candidatas.length > 0 && candidatas.every((p) => esBebidaPorNombres(p.categoriaNombre, p.areaNombre));
}

/**
 * ¿El producto es opción de la parte? FIJO: el principal; UNA_DE: su lista; A_ELECCION: sin los excluidos y, si hay productos
 * marcados, SOLO esos (la lista manda); sin productos marcados, los de sus categorías.
 */
export function admiteProducto(parte: ParteDisp, p: Pick<ProductoDisp, 'id' | 'categoriaId'> & { oculto?: boolean }): boolean {
  if (parte.tipo === 'FIJO') return p.id === parte.productos[0];
  if (parte.tipo === 'UNA_DE') return parte.productos.includes(p.id);
  if ((parte.productosExcluidos ?? []).includes(p.id)) return false;
  if (parte.productos.length > 0) return parte.productos.includes(p.id);
  // Elección por categoría: un producto oculto no se ofrece (solo vale oculto en piezas fijas o en la lista explícita)
  return !p.oculto && parte.categorias.includes(p.categoriaId);
}

/** Lugares que ocupa un producto en la parte (1 si no está en el mapa). */
export function cuposDeProducto(parte: Pick<ParteDisp, 'cuposProducto'>, productoId: string): number {
  const n = parte.cuposProducto?.[productoId];
  return Number.isInteger(n) && (n as number) > 1 ? (n as number) : 1;
}

/** Por qué una pieza bloquea el combo (para el panel del dueño), o null si está disponible. */
export function motivoProductoBloqueado(p: ProductoDisp): string | null {
  if (!estaDisponible(p.agotadoHasta)) {
    const h = new Date(p.agotadoHasta as Date | string);
    const hora = isNaN(+h) ? '' : ` hasta ${h.toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false })}`;
    return `Agotado${hora}`;
  }
  if (!productoDisponible(p)) return (p.sabores ?? []).length > 0 ? 'Sin sabores con saldo' : 'Stock 0';
  return null;
}

/** El producto tal como lo ve la parte: con sabores acotados, solo esos (vacío = todos). Sin sabores no cambia. */
export function conSaboresDeParte<T extends ProductoDisp>(parte: Pick<ParteDisp, 'saboresIds'>, p: T): T {
  const permitidos = parte.saboresIds ?? [];
  if (permitidos.length === 0 || !(p.sabores ?? []).length) return p;
  return { ...p, sabores: p.sabores!.filter((s) => permitidos.includes(s.id)) };
}

/** Productos que pueden cubrir la parte original (ver admiteProducto), con los sabores que la parte permite. */
export function productosDeParte(parte: ParteDisp, productos: ProductoDisp[]): ProductoDisp[] {
  return productos.flatMap((p) => {
    if (!admiteProducto(parte, p)) return [];
    const v = conSaboresDeParte(parte, p);
    // Con sabores acotados, un producto sin ninguno de los sabores permitidos no es opción
    return (p.sabores ?? []).length > 0 && (v.sabores ?? []).length === 0 ? [] : [v];
  });
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
    // Pieza de un paquete: debe alcanzar para su cantidad completa (un paquete de «2 donas» no se arma con 1)
    const enPaquete = !!parte.paqueteGrupo;
    const disponible = parte.opcional ? true : enPaquete ? armable || altDisponible : originalOk || altDisponible;
    const altIds = alternativas.filter((a) => a.disponible).map((a) => a.id);

    if (parte.tipo === 'FIJO') {
      const principal = parte.productos[0];
      const principalOk = !!principal && productoDisponible(porId.get(principal));
      const opciones = principalOk ? [principal] : altIds;
      if (!disponible && !enPaquete) motivos.push(nombre(principal ?? ''));
      return {
        disponible,
        opcionesDisponibles: opciones,
        principalDisponible: principalOk,
        armable,
        alternativas,
        alternativasActivas,
      };
    }
    if (!disponible && !enPaquete) {
      motivos.push(parte.tipo === 'UNA_DE' ? 'una de las opciones' : 'las bebidas a elegir');
    }
    return { disponible, opcionesDisponibles: [], principalDisponible: null, armable, alternativas, alternativasActivas };
  });

  // Cada grupo de paquetes necesita al menos un paquete con todas sus piezas disponibles
  const grupos = new Map<string, Map<string, boolean>>();
  partes.forEach((parte, i) => {
    if (!parte.paqueteGrupo) return;
    const paquetes = grupos.get(parte.paqueteGrupo) ?? new Map<string, boolean>();
    const nombrePaquete = parte.paqueteNombre ?? '';
    paquetes.set(nombrePaquete, (paquetes.get(nombrePaquete) ?? true) && resultado[i].disponible);
    grupos.set(parte.paqueteGrupo, paquetes);
  });
  let gruposOk = true;
  for (const [grupo, paquetes] of grupos) {
    if (![...paquetes.values()].some(Boolean)) {
      gruposOk = false;
      motivos.push(`el complemento «${grupo}»`);
    }
  }

  return {
    disponible: gruposOk && resultado.every((r, i) => r.disponible || !!partes[i].paqueteGrupo),
    motivoAgotado: motivos.length ? `Falta ${motivos.join(' y ')}` : null,
    partes: resultado,
  };
}
