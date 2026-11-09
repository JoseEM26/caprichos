import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
  Optional,
} from '@nestjs/common';
import { jpegProductoWhatsApp } from './imagen-whatsapp';
import { anfitrionBloqueadoPorPaso, opcionesSinStock, pasoOpcionalOcultoPorStock } from '../stock/opcion-requiere';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { estaVigente, formatearFecha, obtenerAhoraLima, categoriasAlcance } from '../ofertas/ofertas.util';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import {
  CategoriaCarta,
  ProductoCarta,
  SaborCarta,
} from './catalogo.tipos';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { EditarProductoDto } from './dto/editar-producto.dto';
import { AgotarDto } from './dto/agotar.dto';
import { ActualizarCategoriaDto, CrearCategoriaDto } from './dto/categoria.dto';
import { FiltrarProductosDto } from './dto/filtrar-productos.dto';
import {
  ActualizarGrupoOpcionesDto,
  ActualizarOpcionDto,
  CrearGrupoOpcionesDto,
  CrearOpcionDto,
} from './dto/grupo-opciones.dto';
import {
  ActualizarListaDto,
  ActualizarValorDto,
  AgregarValorDto,
  CrearListaDto,
} from './dto/lista.dto';
import { invalidarOpcionesMenosPedida } from '../cocina/opcion-menos-pedida';
import { aperturaHoyProductos, estadoSaborCarta, estadoSaboresHoy, limpiarAgotadosAutomaticosDeProducto, quedanProductos } from '../stock/producto-controlado';

export function normalizarTexto(texto: string): string {
  if (!texto) return '';
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Regreso de un agotado «hasta que lo reactive una persona». */
export const AGOTADO_INDEFINIDO = new Date('9999-12-31T23:59:59Z');

/** Único criterio de disponibilidad (carta, bot, Caja, mozo, combos, pedidos): sin fecha, o fecha ya vencida. */
export function estaDisponible(agotadoHasta: Date | string | null | undefined, ahoraMs: number = Date.now()): boolean {
  if (!agotadoHasta) return true;
  if (typeof agotadoHasta === 'string' && agotadoHasta.toLowerCase() === 'infinity') {
    return false;
  }
  const fecha = new Date(agotadoHasta);
  if (isNaN(fecha.getTime())) return false;
  return fecha.getTime() <= ahoraMs;
}

/** Hora de regreso (ISO) de un agotado temporal; null si es indefinido o no hay agotado. */
export function regresoAgotado(agotadoHasta: Date | string | null | undefined): string | null {
  if (!agotadoHasta) return null;
  const f = new Date(agotadoHasta);
  if (isNaN(f.getTime()) || f.getFullYear() >= 9999) return null;
  return f.toISOString();
}

export function obtenerFotoUrl(archivo?: { ruta: string } | null): string | null {
  if (!archivo?.ruta) return null;
  if (archivo.ruta.startsWith('http://') || archivo.ruta.startsWith('https://')) {
    return archivo.ruta;
  }
  const limpia = archivo.ruta.replace(/^\/+/, '');
  return `/archivos/${limpia}`;
}

/**
 * Producto que controla stock y ya no tiene saldo: por sabor, ningún sabor activo con saldo; sin sabores, saldo 0.
 * Igual que la carta (el admin no debe mostrar «Disponible» lo que el cliente ve agotado).
 */
function sinSaldoAdmin(
  p: { id: bigint; controla_stock: boolean; sabores?: Array<{ id: bigint; activo: boolean }> },
  estadoSabores: Map<string, { saldo: number }>,
  quedan: Map<string, number>,
): boolean {
  if (!p.controla_stock) return false;
  const activos = (p.sabores ?? []).filter((s) => s.activo);
  if (activos.length > 0) return !activos.some((s) => (estadoSabores.get(s.id.toString())?.saldo ?? 0) >= 1);
  return (quedan.get(p.id.toString()) ?? 0) <= 0;
}

/**
 * Por qué se ve «Agotado» en el admin: MANUAL (agotado_hasta puesto a mano, no vuelve solo), AUTOMATICO (saldo 0 por
 * stock controlado, vuelve al reponer) o null si está disponible. Un agotado sin origen guardado se lee como MANUAL.
 */
export function origenAgotadoAdmin(
  p: { agotado_hasta: Date | null; agotado_origen?: string | null },
  sinSaldo: boolean,
): 'MANUAL' | 'AUTOMATICO' | null {
  if (!estaDisponible(p.agotado_hasta)) return p.agotado_origen === 'AUTOMATICO' ? 'AUTOMATICO' : 'MANUAL';
  return sinSaldo ? 'AUTOMATICO' : null;
}

@Injectable()
export class CatalogoService implements OnApplicationBootstrap {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly eventosGateway?: EventosGateway,
  ) {}

  /** Al arrancar deja listas las imágenes JPEG de WhatsApp: Meta espera la imagen al enviar el carrusel. */
  onApplicationBootstrap() {
    setTimeout(() => void this.calentarImagenesWhatsApp(), 5_000).unref?.();
  }

  /**
   * Pre-genera (caché en memoria) el JPEG de WhatsApp de los productos dados (o de todos los visibles).
   * Nunca lanza: si falla, el endpoint lo genera al pedirlo.
   */
  async calentarImagenesWhatsApp(ids?: string[], uploadsDir = process.env.UPLOADS_DIR || './data/uploads'): Promise<void> {
    try {
      const idsBig = ids?.filter((i) => /^\d+$/.test(i)).map((i) => BigInt(i));
      if (ids && !idsBig?.length) return;
      const ps = await this.prisma.producto.findMany({
        where: { oculto: false, categoria: { oculta: false }, ...(idsBig ? { id: { in: idsBig } } : {}) },
        select: { id: true, nombre: true, foto_archivo: { select: { ruta: true } } },
      });
      for (const p of ps) {
        await jpegProductoWhatsApp(String(p.id), p.nombre, p.foto_archivo?.ruta ?? null, uploadsDir).catch(() => undefined);
      }
    } catch {
      /* ponytail: sin calentar, el primer pedido de Meta paga la conversión */
    }
  }

  private parsearId(id: bigint | string | number): bigint {
    try {
      return BigInt(id);
    } catch {
      throw new BadRequestException({
        codigo: 'ID_INVALIDO',
        mensaje: 'El identificador no es válido',
      });
    }
  }

  // =========================================================================
  // 1. CARTA PÚBLICA (GET /carta)
  // =========================================================================

  private ventasCache: { en: number; datos: Record<string, number> } | null = null;

  /**
   * Unidades vendidas por producto en los últimos 90 días (pedidos no rechazados ni anulados), con caché de 15 min.
   * Sirve para ordenar el carrusel del bot; los productos sin ventas no aparecen (cuentan 0).
   */
  async ventasPorProducto(ahora = Date.now()): Promise<Record<string, number>> {
    if (this.ventasCache && ahora - this.ventasCache.en < 15 * 60_000) return this.ventasCache.datos;
    const filas = await this.prisma.pedidoLinea.groupBy({
      by: ['producto_id'],
      where: {
        producto_id: { not: null },
        es_cortesia: false,
        pedido: { estado: { notIn: ['RECHAZADO', 'ANULADO'] }, creado_en: { gte: new Date(ahora - 90 * 86_400_000) } },
      },
      _sum: { cantidad: true },
    });
    const datos: Record<string, number> = {};
    for (const f of filas) datos[String(f.producto_id)] = f._sum.cantidad ?? 0;
    this.ventasCache = { en: ahora, datos };
    return datos;
  }

  /** Nombre de un producto visible en la carta (ni él ni su categoría ocultos), o null. */
  async nombreProductoVisible(id: string): Promise<string | null> {
    const p = await this.prisma.producto.findFirst({
      where: { id: BigInt(id), oculto: false, categoria: { oculta: false } },
      select: { nombre: true },
    });
    return p?.nombre ?? null;
  }

  /** Nombre y ruta de la foto de un producto visible (null si no existe u oculto). */
  async fotoProductoVisible(id: string): Promise<{ nombre: string; ruta: string | null } | null> {
    const p = await this.prisma.producto.findFirst({
      where: { id: BigInt(id), oculto: false, categoria: { oculta: false } },
      select: { nombre: true, foto_archivo: { select: { ruta: true } } },
    });
    return p ? { nombre: p.nombre, ruta: p.foto_archivo?.ruta ?? null } : null;
  }

  async obtenerCarta(q?: string): Promise<CategoriaCarta[]> {
    const categorias = await this.prisma.categoria.findMany({
      where: { oculta: false },
      orderBy: { orden: 'asc' },
      include: {
        productos: {
          where: { oculto: false },
          orderBy: { orden: 'asc' },
          include: {
            foto_archivo: true,
            tamanos: {
              where: { activo: true },
              include: { tamano_valor: true },
              orderBy: { tamano_valor: { orden: 'asc' } },
            },
            grupos: {
              orderBy: { orden: 'asc' },
              include: {
                grupo: {
                  include: {
                    opciones: {
                      where: { activo: true },
                      include: { valor: true },
                      orderBy: { valor: { orden: 'asc' } },
                    },
                  },
                },
              },
            },
            sabores: {
              where: { activo: true },
              orderBy: { nombre: 'asc' },
            },
            // Anfitrión de una oferta COMBO (Dúo): sus pasos son los grupos del combo, no una mezcla propia.
            // Con alternativas configuradas (combo_parte_reemplazo) el combo no sale «No disponible» por un paso.
            ofertasAlcance: {
              where: { tipo: 'COMBO' },
              select: { id: true, combosParte: { where: { reemplazos: { some: {} } }, select: { id: true }, take: 1 } },
              take: 1,
            },
          },
        },
      },
    });

    const quedanPorProducto = await quedanProductos(
      this.prisma,
      categorias.flatMap((c) => c.productos.map((p) => p.id)),
    );
    // Opciones de grupo ligadas a stock (opcion_requiere): cuáles no alcanzan con el saldo ahora
    const sinStockOpcion = await opcionesSinStock(
      this.prisma,
      categorias.flatMap((c) => c.productos.flatMap((p) => p.grupos.flatMap((pg) => pg.grupo.opciones.filter((o) => o.activo).map((o) => o.id)))),
    );
    const estadoSabores = await estadoSaboresHoy(
      this.prisma,
      categorias.flatMap((c) => c.productos.flatMap((p) => p.sabores.map((s) => s.id))),
    );

    const terminosBusqueda = q && q.trim() ? normalizarTexto(q).split(/\s+/).filter(Boolean) : [];

    const resultado: CategoriaCarta[] = [];

    for (const cat of categorias) {
      const productosCarta: ProductoCarta[] = [];

      for (const p of cat.productos) {
        // Filtro de búsqueda ?q= sin tildes ni mayúsculas por nombre o descripción (RQ-CAR-01-03)
        if (terminosBusqueda.length > 0) {
          const textoCompleto = normalizarTexto(`${p.nombre} ${p.descripcion || ''}`);
          const coincide = terminosBusqueda.every((termino) => textoCompleto.includes(termino));
          if (!coincide) {
            continue;
          }
        }

        // Anfitrión de combo: nunca se vende por mezcla de sabores propia (sus sabores no viajan a la carta)
        const esAnfitrionCombo = (p.ofertasAlcance ?? []).length > 0;
        const sabores: SaborCarta[] = (esAnfitrionCombo ? [] : p.sabores || [])
          .filter((s) => s.activo)
          .map((s) => estadoSaborCarta(s, estadoSabores.get(s.id.toString()), p.controla_stock));
        const saboresConStock = sabores.some((s) => s.disponible);
        // Producto por sabor: su stock y su disponibilidad salen de los sabores (quedan = suma de los disponibles)
        const porSabor = p.controla_stock && sabores.length > 0;
        const quedanProducto = quedanPorProducto.get(p.id.toString()) ?? null;
        const disponibles = sabores.filter((s) => s.disponible);
        const quedan = porSabor
          ? disponibles.length === 0
            ? 0
            : disponibles.every((s) => s.quedan !== null)
              ? disponibles.reduce((acc, s) => acc + (s.quedan ?? 0), 0)
              : null
          : quedanProducto;
        const tamanos = (p.tamanos || []).map((t) => ({
          id: t.id.toString(),
          tamanoValorId: (t.tamano_valor_id ?? t.tamano_valor?.id)?.toString() ?? null,
          nombre: t.tamano_valor?.nombre || '',
          precio: Number(Number(t.precio).toFixed(2)),
          unidades: t.unidades,
        }));

        const gruposTodos = (p.grupos || [])
          .filter((pg) => pg.grupo && pg.grupo.activo)
          .map((pg) => {
            const opcionesActivas = (pg.grupo.opciones || []).filter((o) => o.activo);
            const opciones = opcionesActivas.map((o) => ({
              id: o.id.toString(),
              nombre: o.valor?.nombre || '',
              precioExtra: Number(Number(o.precio_extra).toFixed(2)),
              disponible: estaDisponible(o.agotado_hasta) && !sinStockOpcion.has(o.id.toString()),
            }));
            const bloqueadas = opcionesActivas.filter((o) => sinStockOpcion.has(o.id.toString())).map((o) => o.valor?.nombre || '');
            const libres = opciones.filter((o) => o.disponible).map((o) => o.nombre);
            // Plan B visible: hay opciones agotadas por stock y otras que se pueden elegir
            const aviso = bloqueadas.length > 0 && libres.length > 0
              ? `Se acabaron: ${bloqueadas.join(', ')}. Elige entre: ${libres.join(', ')}`
              : null;
            return {
              id: pg.grupo.id.toString(),
              nombre: pg.grupo.nombre,
              obligatorio: pg.grupo.obligatorio,
              minimo: pg.grupo.minimo,
              maximo: pg.grupo.maximo,
              opciones,
              aviso,
              // Todas sus opciones bloqueadas por stock (sin plan B en el paso)
              sinStock: bloqueadas.length > 0 && libres.length === 0,
            };
          })
          // Grupo sin opciones activas (p. ej. «Galleta 1 · Sabor» tras quitar sus sabores): no se muestra ni bloquea
          .filter((g) => g.opciones.length > 0);
        // Paso de sabor que solo tiene sentido con donas en saldo: si es opcional y se queda sin opciones por stock, no se muestra
        const pasosStock = gruposTodos.map((g) => ({
          g,
          paso: {
            obligatorio: g.obligatorio,
            minimo: g.minimo,
            opciones: g.opciones.map((o) => ({ disponible: o.disponible, bloqueadaPorStock: sinStockOpcion.has(o.id) })),
          },
        }));
        const grupos = pasosStock.filter(({ paso }) => !pasoOpcionalOcultoPorStock(paso)).map(({ g }) => g);

        // Producto que controla stock: sin saldo no se vende (aunque no esté marcado como agotado).
        // Anfitrión de combo: un paso OBLIGATORIO sin ninguna opción por stock (y sin alternativas en el combo) lo deja «No disponible».
        const esAnfitrionConAlternativas = (p.ofertasAlcance?.[0]?.combosParte ?? []).length > 0;
        const disponible = (porSabor
          ? estaDisponible(p.agotado_hasta) && saboresConStock
          : estaDisponible(p.agotado_hasta) && !(quedan !== null && quedan <= 0))
          && !(esAnfitrionCombo && anfitrionBloqueadoPorPaso(pasosStock.map((x) => x.paso), esAnfitrionConAlternativas));
        const agotadoHasta =
          p.agotado_hasta && !disponible
            ? p.agotado_hasta.toISOString()
            : null;

        productosCarta.push({
          id: p.id.toString(),
          nombre: p.nombre,
          descripcion: p.descripcion,
          fotoUrl: obtenerFotoUrl(p.foto_archivo),
          precio: Number(Number(p.precio).toFixed(2)),
          tamanos,
          grupos,
          sabores,
          noSumaBeneficios: p.no_suma_beneficios,
          disponible,
          agotadoHasta,
          controlaStock: p.controla_stock,
          saboresConStock,
          quedan,
        });
      }

      // Si hay búsqueda activa y la categoría no tiene productos coincidentes, se omite
      if (terminosBusqueda.length > 0 && productosCarta.length === 0) {
        continue;
      }

      resultado.push({
        id: cat.id.toString(),
        nombre: cat.nombre,
        orden: cat.orden,
        productos: productosCarta,
      });
    }

    return resultado;
  }

  // =========================================================================
  // 2. PRODUCTOS (ADMIN)
  // =========================================================================

  /** Saldo de hoy y si ya se contó la apertura, de los productos que controlan stock (solo lectura para el admin). */
  private async stockAdminDe(productos: Array<{ id: bigint; controla_stock: boolean }>) {
    const ids = productos.filter((p) => p.controla_stock).map((p) => p.id);
    if (ids.length === 0) return { quedan: new Map<string, number>(), apertura: new Set<string>() };
    const [quedan, apertura] = await Promise.all([quedanProductos(this.prisma, ids), aperturaHoyProductos(this.prisma, ids)]);
    return { quedan, apertura };
  }

  async listarProductosAdmin(filtros: FiltrarProductosDto) {
    const where: any = {};

    if (filtros.incluyeOcultos === false) {
      where.oculto = false;
    }

    if (filtros.categoria) {
      try {
        const catId = BigInt(filtros.categoria);
        where.categoria_id = catId;
      } catch {
        where.categoria = { nombre: { contains: filtros.categoria, mode: 'insensitive' } };
      }
    }

    const busqueda = filtros.busqueda || filtros.q;
    if (busqueda && busqueda.trim()) {
      where.OR = [
        { nombre: { contains: busqueda.trim(), mode: 'insensitive' } },
        { descripcion: { contains: busqueda.trim(), mode: 'insensitive' } },
      ];
    }

    const productos = await this.prisma.producto.findMany({
      where,
      orderBy: [{ categoria: { orden: 'asc' } }, { orden: 'asc' }],
      include: {
        categoria: true,
        foto_archivo: true,
        tamanos: {
          include: { tamano_valor: true },
          orderBy: { tamano_valor: { orden: 'asc' } },
        },
        grupos: {
          orderBy: { orden: 'asc' },
          include: {
            grupo: {
              include: {
                opciones: {
                  include: { valor: true },
                  orderBy: { valor: { orden: 'asc' } },
                },
              },
            },
          },
        },
        sabores: {
          orderBy: { nombre: 'asc' },
        },
        // Anfitrión de una oferta COMBO (el Dúo, la Cajita): solo lectura, sin migración.
        ofertasAlcance: { where: { tipo: 'COMBO' }, select: { id: true }, take: 1 },
      },
    });

    // Promociones activas sobre el precio (DESCUENTO / LLEVA_PAGA): una sola consulta para todo el listado.
    // Se excluyen COMBO (el producto suelto sí suma) y cupones (otra tabla). Una promoción sin alcance
    // (toda la carta) va aparte en `promocionesGenerales` para no esconder el botón en todos los productos.
    const ofertas = productos.length
      ? await this.prisma.oferta.findMany({
          where: { activo: true, tipo: { in: ['DESCUENTO', 'LLEVA_PAGA'] } },
          select: {
            id: true, nombre: true, tipo: true, activo: true, alcance_producto_id: true,
            alcance_categoria_id: true, alcance_categoria_ids: true, dias: true, hora_desde: true, hora_hasta: true,
            fecha_desde: true, fecha_hasta: true, canales: true, limite_usos: true, usos_actuales: true,
          },
        })
      : [];
    const estadoSabores = await estadoSaboresHoy(
      this.prisma,
      productos.flatMap((p) => p.sabores.map((s) => s.id)),
    );
    const stockAdmin = await this.stockAdminDe(productos);
    const hoy = obtenerAhoraLima().fechaIso;
    const aItem = (o: any) => {
      const desde = formatearFecha(o.fecha_desde);
      const hasta = formatearFecha(o.fecha_hasta);
      return {
        id: o.id.toString(),
        nombre: o.nombre,
        tipo: o.tipo as string,
        vigenteAhora: estaVigente(o),
        estado: (desde && hoy < desde ? 'PROGRAMADA' : hasta && hoy > hasta ? 'VENCIDA' : 'EN_CURSO') as
          | 'PROGRAMADA'
          | 'VENCIDA'
          | 'EN_CURSO',
      };
    };
    const generales = ofertas.filter((o) => !o.alcance_producto_id && !categoriasAlcance(o).length).map(aItem);

    return productos.map((p) => ({
      id: p.id.toString(),
      categoriaId: p.categoria_id.toString(),
      categoria: {
        id: p.categoria.id.toString(),
        nombre: p.categoria.nombre,
      },
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: Number(Number(p.precio).toFixed(2)),
      orden: p.orden,
      oculto: p.oculto,
      disponible: estaDisponible(p.agotado_hasta) && !sinSaldoAdmin(p, estadoSabores, stockAdmin.quedan),
      agotadoHasta: p.agotado_hasta ? p.agotado_hasta.toISOString() : null,
      agotadoOrigen: origenAgotadoAdmin(p, sinSaldoAdmin(p, estadoSabores, stockAdmin.quedan)),
      agotadoMotivo: estaDisponible(p.agotado_hasta) ? null : p.agotado_motivo ?? null,
      noSumaBeneficios: p.no_suma_beneficios,
      resaltarOpcionMenosPedida: p.resaltar_opcion_menos_pedida,
      controlaStock: p.controla_stock,
      esAnfitrionCombo: (p.ofertasAlcance ?? []).length > 0,
      quedan: p.controla_stock ? stockAdmin.quedan.get(p.id.toString()) ?? 0 : null,
      aperturaHoy: p.controla_stock ? stockAdmin.apertura.has(p.id.toString()) : null,
      promociones: ofertas
        .filter((o) => o.alcance_producto_id === p.id || (!o.alcance_producto_id && categoriasAlcance(o).includes(p.categoria_id)))
        .map(aItem),
      promocionesGenerales: generales,
      fotoUrl: obtenerFotoUrl(p.foto_archivo),
      tamanos: (p.tamanos || []).map((t) => ({
        id: t.id.toString(),
        tamanoValorId: t.tamano_valor_id.toString(),
        nombre: t.tamano_valor?.nombre || '',
        precio: Number(Number(t.precio).toFixed(2)),
        activo: t.activo,
        unidades: t.unidades,
      })),
      grupos: (p.grupos || []).map((pg) => ({
        id: pg.grupo.id.toString(),
        nombre: pg.grupo.nombre,
        obligatorio: pg.grupo.obligatorio,
        minimo: pg.grupo.minimo,
        maximo: pg.grupo.maximo,
        orden: pg.orden,
        activo: pg.grupo.activo,
        opciones: (pg.grupo.opciones || []).map((o) => ({
          id: o.id.toString(),
          nombre: o.valor?.nombre || '',
          precioExtra: Number(Number(o.precio_extra).toFixed(2)),
          resaltarSiempre: o.resaltar_siempre,
          activo: o.activo,
          disponible: estaDisponible(o.agotado_hasta),
        })),
      })),
      sabores: (p.sabores || []).map((s) => ({
        ...estadoSaborCarta(s, estadoSabores.get(s.id.toString()), p.controla_stock),
        aperturaHoy: estadoSabores.get(s.id.toString())?.aperturaHoy ?? false,
      })),
    }));
  }

  async obtenerProductoPorId(id: bigint | string | number) {
    const pId = this.parsearId(id);
    const p = await this.prisma.producto.findUnique({
      where: { id: pId },
      include: {
        categoria: true,
        foto_archivo: true,
        tamanos: {
          include: { tamano_valor: true },
        },
        grupos: {
          include: {
            grupo: {
              include: {
                opciones: {
                  include: { valor: true },
                },
              },
            },
          },
        },
        sabores: true,
        ofertasAlcance: { where: { tipo: 'COMBO' }, select: { id: true }, take: 1 },
      },
    });

    if (!p) {
      throw new NotFoundException({
        codigo: 'PRODUCTO_NO_ENCONTRADO',
        mensaje: 'El producto no existe',
      });
    }
    const estadoSabores = await estadoSaboresHoy(this.prisma, (p.sabores || []).map((s) => s.id));
    const stockAdmin = await this.stockAdminDe([p]);

    return {
      id: p.id.toString(),
      categoriaId: p.categoria_id.toString(),
      categoria: {
        id: p.categoria.id.toString(),
        nombre: p.categoria.nombre,
      },
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: Number(Number(p.precio).toFixed(2)),
      orden: p.orden,
      oculto: p.oculto,
      disponible: estaDisponible(p.agotado_hasta) && !sinSaldoAdmin(p, estadoSabores, stockAdmin.quedan),
      agotadoHasta: p.agotado_hasta ? p.agotado_hasta.toISOString() : null,
      agotadoOrigen: origenAgotadoAdmin(p, sinSaldoAdmin(p, estadoSabores, stockAdmin.quedan)),
      agotadoMotivo: estaDisponible(p.agotado_hasta) ? null : p.agotado_motivo ?? null,
      noSumaBeneficios: p.no_suma_beneficios,
      resaltarOpcionMenosPedida: p.resaltar_opcion_menos_pedida,
      controlaStock: p.controla_stock,
      esAnfitrionCombo: (p.ofertasAlcance ?? []).length > 0,
      quedan: p.controla_stock ? stockAdmin.quedan.get(p.id.toString()) ?? 0 : null,
      aperturaHoy: p.controla_stock ? stockAdmin.apertura.has(p.id.toString()) : null,
      fotoUrl: obtenerFotoUrl(p.foto_archivo),
      tamanos: (p.tamanos || []).map((t) => ({
        id: t.id.toString(),
        tamanoValorId: t.tamano_valor_id.toString(),
        nombre: t.tamano_valor?.nombre || '',
        precio: Number(Number(t.precio).toFixed(2)),
        activo: t.activo,
        unidades: t.unidades,
      })),
      grupos: (p.grupos || []).map((pg) => ({
        id: pg.grupo.id.toString(),
        nombre: pg.grupo.nombre,
        obligatorio: pg.grupo.obligatorio,
        minimo: pg.grupo.minimo,
        maximo: pg.grupo.maximo,
        orden: pg.orden,
        opciones: (pg.grupo.opciones || []).map((o) => ({
          id: o.id.toString(),
          nombre: o.valor?.nombre || '',
          precioExtra: Number(Number(o.precio_extra).toFixed(2)),
          resaltarSiempre: o.resaltar_siempre,
          activo: o.activo,
          disponible: estaDisponible(o.agotado_hasta),
        })),
      })),
      sabores: (p.sabores || []).map((s) => ({
        ...estadoSaborCarta(s, estadoSabores.get(s.id.toString()), p.controla_stock),
        aperturaHoy: estadoSabores.get(s.id.toString())?.aperturaHoy ?? false,
      })),
    };
  }

  // --- Enlace de cada opción con el stock (opcion_requiere) ---

  /** Requisitos de stock de una opción y los productos (con sus sabores) que se pueden enlazar. */
  async listarRequisitosOpcion(opcionId: string) {
    const id = this.parsearId(opcionId);
    const opcion = await this.prisma.opcion.findUnique({ where: { id }, select: { id: true, valor: { select: { nombre: true } } } });
    if (!opcion) throw new NotFoundException({ codigo: 'OPCION_NO_ENCONTRADA', mensaje: 'La opción no existe' });
    const [filas, productos] = await Promise.all([
      this.prisma.opcionRequiere.findMany({
        where: { opcion_id: id },
        orderBy: { id: 'asc' },
        select: { producto_id: true, sabor_id: true, cantidad: true, producto: { select: { nombre: true } }, sabor: { select: { nombre: true } } },
      }),
      this.prisma.producto.findMany({
        where: { controla_stock: true },
        orderBy: { nombre: 'asc' },
        select: { id: true, nombre: true, sabores: { where: { activo: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } } },
      }),
    ]);
    return {
      opcionId: id.toString(),
      nombre: opcion.valor?.nombre ?? '',
      requisitos: filas.map((f) => ({
        productoId: f.producto_id.toString(),
        productoNombre: f.producto.nombre,
        saborId: f.sabor_id ? f.sabor_id.toString() : null,
        saborNombre: f.sabor?.nombre ?? null,
        cantidad: f.cantidad,
      })),
      productos: productos.map((p) => ({
        id: p.id.toString(),
        nombre: p.nombre,
        sabores: p.sabores.map((s) => ({ id: s.id.toString(), nombre: s.nombre })),
      })),
    };
  }

  /**
   * Reemplaza los requisitos de una opción. Sin requisitos, la opción vuelve a depender solo de agotado_hasta.
   * 400 si la cantidad no es 1..99, si se repite un producto/sabor o si el sabor no es de ese producto.
   */
  async guardarRequisitosOpcion(
    opcionId: string,
    requisitos: Array<{ productoId: string | number; saborId?: string | number | null; cantidad: number }>,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const id = this.parsearId(opcionId);
    const opcion = await this.prisma.opcion.findUnique({ where: { id }, select: { id: true, valor: { select: { nombre: true } } } });
    if (!opcion) throw new NotFoundException({ codigo: 'OPCION_NO_ENCONTRADA', mensaje: 'La opción no existe' });
    const antes = await this.prisma.opcionRequiere.findMany({ where: { opcion_id: id }, select: { producto_id: true, sabor_id: true, cantidad: true } });

    const vistos = new Set<string>();
    const filas: Array<{ opcion_id: bigint; producto_id: bigint; sabor_id: bigint | null; cantidad: number }> = [];
    for (const r of requisitos ?? []) {
      const productoId = this.parsearId(r.productoId);
      const saborId = r.saborId ? this.parsearId(r.saborId) : null;
      const cantidad = Math.floor(Number(r.cantidad));
      if (!Number.isFinite(cantidad) || cantidad < 1 || cantidad > 99) {
        throw new BadRequestException({ codigo: 'CANTIDAD_INVALIDA', mensaje: 'La cantidad debe ser un número entre 1 y 99' });
      }
      const clave = `${productoId}|${saborId ?? ''}`;
      if (vistos.has(clave)) {
        throw new BadRequestException({ codigo: 'REQUISITO_REPETIDO', mensaje: 'Un producto (o sabor) aparece dos veces en la misma opción' });
      }
      vistos.add(clave);
      const prod = await this.prisma.producto.findUnique({ where: { id: productoId }, select: { id: true, nombre: true } });
      if (!prod) throw new NotFoundException({ codigo: 'PRODUCTO_NO_ENCONTRADO', mensaje: 'El producto no existe' });
      if (saborId) {
        const sabor = await this.prisma.sabor.findFirst({ where: { id: saborId, producto_id: productoId }, select: { id: true } });
        if (!sabor) throw new BadRequestException({ codigo: 'SABOR_INVALIDO', mensaje: `El sabor no pertenece a ${prod.nombre}` });
      }
      filas.push({ opcion_id: id, producto_id: productoId, sabor_id: saborId, cantidad });
    }

    await this.prisma.$transaction([
      this.prisma.opcionRequiere.deleteMany({ where: { opcion_id: id } }),
      this.prisma.opcionRequiere.createMany({ data: filas }),
    ]);

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'CAMBIAR_STOCK_OPCION',
      resultado: 'OK',
      entidad: 'opcion',
      entidadId: id,
      antes: antes.map((a) => ({ productoId: a.producto_id.toString(), saborId: a.sabor_id?.toString() ?? null, cantidad: a.cantidad })),
      despues: filas.map((f) => ({ productoId: f.producto_id.toString(), saborId: f.sabor_id?.toString() ?? null, cantidad: f.cantidad })),
      usuario,
      ip,
    } as any);

    return this.listarRequisitosOpcion(opcionId);
  }

  async crearProducto(dto: CrearProductoDto, usuario?: UsuarioAutenticado, ip?: string) {
    if (dto.precio < 0) {
      throw new BadRequestException({
        codigo: 'PRECIO_INVALIDO',
        mensaje: 'El precio del producto debe ser mayor o igual a 0',
      });
    }

    if (dto.tamanos) {
      for (const t of dto.tamanos) {
        if (t.precio < 0) {
          throw new BadRequestException({
            codigo: 'PRECIO_INVALIDO',
            mensaje: 'El precio de cada tamaño debe ser mayor o igual a 0',
          });
        }
      }
    }

    const nombreExistente = await this.prisma.producto.findUnique({
      where: { nombre: dto.nombre.trim() },
    });

    if (nombreExistente) {
      throw new ConflictException({
        codigo: 'NOMBRE_DUPLICADO',
        mensaje: 'Ya existe un producto con ese nombre',
      });
    }

    const categoriaId = this.parsearId(dto.categoriaId);
    const categoria = await this.prisma.categoria.findUnique({
      where: { id: categoriaId },
    });

    if (!categoria) {
      throw new NotFoundException({
        codigo: 'CATEGORIA_NO_ENCONTRADA',
        mensaje: 'La categoría especificada no existe',
      });
    }

    const fotoArchivoId = dto.fotoArchivoId ? this.parsearId(dto.fotoArchivoId) : null;

    const nuevoProducto = await this.prisma.$transaction(async (tx) => {
      const prod = await tx.producto.create({
        data: {
          nombre: dto.nombre.trim(),
          categoria_id: categoriaId,
          descripcion: dto.descripcion?.trim() || null,
          precio: dto.precio,
          foto_archivo_id: fotoArchivoId,
          orden: dto.orden ?? 0,
          no_suma_beneficios: dto.noSumaBeneficios ?? false,
          resaltar_opcion_menos_pedida: dto.resaltarOpcionMenosPedida ?? false,
          controla_stock: dto.controlaStock ?? false,
          oculto: false,
        },
      });

      if (dto.tamanos && dto.tamanos.length > 0) {
        for (const t of dto.tamanos) {
          await tx.productoTamano.create({
            data: {
              producto_id: prod.id,
              tamano_valor_id: this.parsearId(t.tamanoValorId),
              precio: t.precio,
              activo: t.activo ?? true,
              unidades: t.unidades ?? 1,
            },
          });
        }
      }

      if (dto.grupos && dto.grupos.length > 0) {
        for (let idx = 0; idx < dto.grupos.length; idx++) {
          const g = dto.grupos[idx];
          await tx.productoGrupo.create({
            data: {
              producto_id: prod.id,
              grupo_id: this.parsearId(g.grupoId),
              orden: g.orden ?? idx,
            },
          });
        }
      }

      if (dto.sabores && dto.sabores.length > 0) {
        for (const nombreSabor of dto.sabores) {
          if (nombreSabor && nombreSabor.trim()) {
            await tx.sabor.create({
              data: {
                producto_id: prod.id,
                nombre: nombreSabor.trim(),
                activo: true,
              },
            });
          }
        }
      }

      return prod;
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'CREAR_PRODUCTO',
      resultado: 'OK',
      entidad: 'producto',
      entidadId: nuevoProducto.id,
      despues: {
        id: nuevoProducto.id.toString(),
        nombre: nuevoProducto.nombre,
        categoriaId: categoriaId.toString(),
        precio: dto.precio,
      },
      partyId: usuario?.partyId,
      ip,
    });

    return this.obtenerProductoPorId(nuevoProducto.id);
  }

  async editarProducto(
    id: bigint | string | number,
    dto: EditarProductoDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const pId = this.parsearId(id);
    const actual = await this.prisma.producto.findUnique({
      where: { id: pId },
      include: {
        tamanos: true,
        grupos: true,
        sabores: true,
      },
    });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'PRODUCTO_NO_ENCONTRADO',
        mensaje: 'El producto no existe',
      });
    }

    if (dto.precio !== undefined && dto.precio < 0) {
      throw new BadRequestException({
        codigo: 'PRECIO_INVALIDO',
        mensaje: 'El precio del producto debe ser mayor o igual a 0',
      });
    }

    if (dto.nombre && dto.nombre.trim() !== actual.nombre) {
      const duplicado = await this.prisma.producto.findUnique({
        where: { nombre: dto.nombre.trim() },
      });
      if (duplicado && duplicado.id !== pId) {
        throw new ConflictException({
          codigo: 'NOMBRE_DUPLICADO',
          mensaje: 'Ya existe otro producto con ese nombre',
        });
      }
    }

    let categoriaId = actual.categoria_id;
    if (dto.categoriaId !== undefined) {
      categoriaId = this.parsearId(dto.categoriaId);
      const catExiste = await this.prisma.categoria.findUnique({
        where: { id: categoriaId },
      });
      if (!catExiste) {
        throw new NotFoundException({
          codigo: 'CATEGORIA_NO_ENCONTRADA',
          mensaje: 'La categoría no existe',
        });
      }
    }

    // Foto: solo se toca si el cliente manda la clave. Clave ausente = conservar
    // la foto actual; `null` explícito = quitarla. El front omite la clave si el
    // admin no cambió la foto (no mandar null por defecto: borraría la imagen).
    const fotoArchivoId =
      dto.fotoArchivoId !== undefined
        ? dto.fotoArchivoId
          ? this.parsearId(dto.fotoArchivoId)
          : null
        : actual.foto_archivo_id;

    await this.prisma.$transaction(async (tx) => {
      // Apagar «Controlar stock»: el agotado automático (saldo 0) ya no aplica y se limpia; el MANUAL se respeta.
      if (dto.controlaStock === false && actual.controla_stock) {
        await limpiarAgotadosAutomaticosDeProducto(tx, pId);
      }
      await tx.producto.update({
        where: { id: pId },
        data: {
          nombre: dto.nombre ? dto.nombre.trim() : undefined,
          categoria_id: categoriaId,
          descripcion: dto.descripcion !== undefined ? dto.descripcion?.trim() || null : undefined,
          precio: dto.precio !== undefined ? dto.precio : undefined,
          orden: dto.orden !== undefined ? dto.orden : undefined,
          oculto: dto.oculto !== undefined ? dto.oculto : undefined,
          no_suma_beneficios:
            dto.noSumaBeneficios !== undefined ? dto.noSumaBeneficios : undefined,
          resaltar_opcion_menos_pedida:
            dto.resaltarOpcionMenosPedida !== undefined ? dto.resaltarOpcionMenosPedida : undefined,
          controla_stock: dto.controlaStock !== undefined ? dto.controlaStock : undefined,
          foto_archivo_id: fotoArchivoId,
        },
      });

      if (dto.tamanos) {
        for (const t of dto.tamanos) {
          if (t.precio < 0) {
            throw new BadRequestException({
              codigo: 'PRECIO_INVALIDO',
              mensaje: 'El precio de cada tamaño debe ser mayor o igual a 0',
            });
          }
          const tamanoValorId = this.parsearId(t.tamanoValorId);
          await tx.productoTamano.upsert({
            where: {
              producto_id_tamano_valor_id: {
                producto_id: pId,
                tamano_valor_id: tamanoValorId,
              },
            },
            update: {
              precio: t.precio,
              activo: t.activo ?? true,
              ...(t.unidades !== undefined ? { unidades: t.unidades } : {}),
            },
            create: {
              producto_id: pId,
              tamano_valor_id: tamanoValorId,
              precio: t.precio,
              activo: t.activo ?? true,
              unidades: t.unidades ?? 1,
            },
          });
        }
      }

      if (dto.grupos) {
        for (let idx = 0; idx < dto.grupos.length; idx++) {
          const g = dto.grupos[idx];
          const grupoId = this.parsearId(g.grupoId);
          await tx.productoGrupo.upsert({
            where: {
              producto_id_grupo_id: {
                producto_id: pId,
                grupo_id: grupoId,
              },
            },
            update: {
              orden: g.orden ?? idx,
            },
            create: {
              producto_id: pId,
              grupo_id: grupoId,
              orden: g.orden ?? idx,
            },
          });
        }
      }

      if (dto.sincronizarGrupos && dto.grupos) {
        await tx.productoGrupo.deleteMany({
          where: {
            producto_id: pId,
            grupo_id: { notIn: dto.grupos.map((g) => this.parsearId(g.grupoId)) },
          },
        });
      }

      if (dto.sabores) {
        for (const s of dto.sabores) {
          if (s.id) {
            // Solo sabores de ESTE producto: un id ajeno no se toca.
            await tx.sabor.updateMany({
              where: { id: this.parsearId(s.id), producto_id: pId },
              data: {
                nombre: s.nombre.trim(),
                activo: s.activo ?? true,
              },
            });
          } else {
            await tx.sabor.upsert({
              where: {
                producto_id_nombre: {
                  producto_id: pId,
                  nombre: s.nombre.trim(),
                },
              },
              update: {
                activo: s.activo ?? true,
              },
              create: {
                producto_id: pId,
                nombre: s.nombre.trim(),
                activo: s.activo ?? true,
              },
            });
          }
        }
      }
    });

    // El resaltado de cocina se cuenta con las opciones y grupos del producto: al cambiarlos, se vuelve a contar
    if (dto.resaltarOpcionMenosPedida !== undefined || dto.grupos !== undefined) {
      invalidarOpcionesMenosPedida(pId);
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'EDITAR_PRODUCTO',
      resultado: 'OK',
      entidad: 'producto',
      entidadId: pId,
      antes: {
        nombre: actual.nombre,
        precio: Number(actual.precio),
        oculto: actual.oculto,
      },
      despues: {
        nombre: dto.nombre ?? actual.nombre,
        precio: dto.precio ?? Number(actual.precio),
        oculto: dto.oculto ?? actual.oculto,
      },
      partyId: usuario?.partyId,
      ip,
    });

    return this.obtenerProductoPorId(pId);
  }

  async agotarProducto(
    id: bigint | string | number,
    dto: AgotarDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const pId = this.parsearId(id);
    const actual = await this.prisma.producto.findUnique({ where: { id: pId } });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'PRODUCTO_NO_ENCONTRADO',
        mensaje: 'El producto no existe',
      });
    }

    let fechaAgotado: Date = AGOTADO_INDEFINIDO;
    if (dto?.agotadoHasta && dto.agotadoHasta !== 'infinity') {
      fechaAgotado = new Date(dto.agotadoHasta);
      if (isNaN(fechaAgotado.getTime()) || fechaAgotado.getTime() <= Date.now()) {
        throw new BadRequestException({
          codigo: 'TIEMPO_AGOTADO_INVALIDO',
          mensaje: 'La hora de regreso debe ser una fecha futura',
        });
      }
    }
    const motivo = dto?.motivo?.trim() ? dto.motivo.trim().slice(0, 120) : null;

    // Agotar desde el admin es MANUAL: no vuelve solo al reponer ni al abrir el día (sí a la hora de regreso, si la hay).
    await this.prisma.producto.update({
      where: { id: pId },
      data: { agotado_hasta: fechaAgotado, agotado_origen: 'MANUAL', agotado_motivo: motivo },
    });
    await this.prisma.agotado.updateMany({
      where: { producto_id: pId, reactivado_en: null },
      data: { origen: 'MANUAL' },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'AGOTAR_PRODUCTO',
      resultado: 'OK',
      entidad: 'producto',
      entidadId: pId,
      antes: { agotado_hasta: actual.agotado_hasta },
      despues: { agotado_hasta: fechaAgotado.toISOString(), motivo },
      partyId: usuario?.partyId,
      ip,
    });
    await this.emitirDisponibilidad();

    return {
      ok: true,
      id: pId.toString(),
      disponible: false,
      agotadoHasta: fechaAgotado.toISOString(),
    };
  }

  /** Avisa a Caja, Productos y Cocina (tiempo real) quién está agotado ahora. Nunca lanza. */
  async emitirDisponibilidad(): Promise<void> {
    try {
      const ahora = new Date();
      const [ps, ss, os] = await Promise.all([
        this.prisma.producto.findMany({ where: { agotado_hasta: { gt: ahora } }, select: { id: true } }),
        this.prisma.sabor.findMany({ where: { agotado_hasta: { gt: ahora } }, select: { id: true } }),
        this.prisma.opcion.findMany({ where: { agotado_hasta: { gt: ahora } }, select: { id: true } }),
      ]);
      const productos = ps.map((x) => x.id.toString());
      const sabores = ss.map((x) => x.id.toString());
      const opciones = os.map((x) => x.id.toString());
      this.eventosGateway?.emitirAdmin('carta:disponibilidad', {
        productos, sabores, opciones, productoIds: productos, saborIds: sabores, opcionIds: opciones,
      });
    } catch {
      /* ponytail: sin aviso en vivo, las pantallas se ponen al día en su próxima carga */
    }
  }

  /**
   * Quita el agotado de los productos cuya hora de regreso ya pasó (agotado_hasta ≤ ahora). La disponibilidad no
   * depende de esto (se calcula al leer); solo deja limpios los datos, audita y avisa en vivo. Idempotente.
   */
  async reactivarVencidos(ahora: Date = new Date()): Promise<number> {
    const vencidos = await this.prisma.producto.findMany({
      where: { agotado_hasta: { not: null, lte: ahora } },
      select: { id: true, agotado_hasta: true, agotado_motivo: true },
    });
    let n = 0;
    for (const v of vencidos) {
      // updateMany con la misma condición: si otra persona ya lo reactivó o lo volvió a agotar, no se pisa.
      const r = await this.prisma.producto.updateMany({
        where: { id: v.id, agotado_hasta: v.agotado_hasta },
        data: { agotado_hasta: null, agotado_origen: null, agotado_motivo: null },
      });
      if (!r.count) continue;
      n++;
      await this.prisma.agotado.updateMany({ where: { producto_id: v.id, reactivado_en: null }, data: { reactivado_en: ahora } });
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'catalogo',
        accion: 'REACTIVADO_AUTOMATICO',
        resultado: 'OK',
        entidad: 'producto',
        entidadId: v.id,
        antes: { agotado_hasta: v.agotado_hasta, motivo: v.agotado_motivo },
        despues: { agotado_hasta: null },
      });
    }
    if (n > 0) await this.emitirDisponibilidad();
    return n;
  }

  async disponibilizarProducto(
    id: bigint | string | number,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const pId = this.parsearId(id);
    const actual = await this.prisma.producto.findUnique({ where: { id: pId } });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'PRODUCTO_NO_ENCONTRADO',
        mensaje: 'El producto no existe',
      });
    }

    await this.prisma.producto.update({
      where: { id: pId },
      data: { agotado_hasta: null, agotado_origen: null, agotado_motivo: null },
    });
    await this.prisma.agotado.updateMany({
      where: { producto_id: pId, reactivado_en: null },
      data: { reactivado_en: new Date() },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'DISPONIBILIZAR_PRODUCTO',
      resultado: 'OK',
      entidad: 'producto',
      entidadId: pId,
      antes: { agotado_hasta: actual.agotado_hasta, motivo: actual.agotado_motivo },
      despues: { agotado_hasta: null },
      partyId: usuario?.partyId,
      ip,
    });
    await this.emitirDisponibilidad();

    return {
      ok: true,
      id: pId.toString(),
      disponible: true,
      agotadoHasta: null,
    };
  }

  async ocultarProducto(id: bigint | string | number, usuario?: UsuarioAutenticado, ip?: string) {
    const pId = this.parsearId(id);
    const actual = await this.prisma.producto.findUnique({ where: { id: pId } });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'PRODUCTO_NO_ENCONTRADO',
        mensaje: 'El producto no existe',
      });
    }

    await this.prisma.producto.update({
      where: { id: pId },
      data: { oculto: true },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'OCULTAR_PRODUCTO',
      resultado: 'OK',
      entidad: 'producto',
      entidadId: pId,
      antes: { oculto: actual.oculto },
      despues: { oculto: true },
      partyId: usuario?.partyId,
      ip,
    });

    return { ok: true, id: pId.toString(), oculto: true };
  }

  async mostrarProducto(id: bigint | string | number, usuario?: UsuarioAutenticado, ip?: string) {
    const pId = this.parsearId(id);
    const actual = await this.prisma.producto.findUnique({ where: { id: pId } });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'PRODUCTO_NO_ENCONTRADO',
        mensaje: 'El producto no existe',
      });
    }

    await this.prisma.producto.update({
      where: { id: pId },
      data: { oculto: false },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'MOSTRAR_PRODUCTO',
      resultado: 'OK',
      entidad: 'producto',
      entidadId: pId,
      antes: { oculto: actual.oculto },
      despues: { oculto: false },
      partyId: usuario?.partyId,
      ip,
    });

    return { ok: true, id: pId.toString(), oculto: false };
  }

  async asociarFotoProducto(
    id: bigint | string | number,
    fotoArchivoId: string | number | null,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const pId = this.parsearId(id);
    const actual = await this.prisma.producto.findUnique({ where: { id: pId } });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'PRODUCTO_NO_ENCONTRADO',
        mensaje: 'El producto no existe',
      });
    }

    const archivoId = fotoArchivoId ? this.parsearId(fotoArchivoId) : null;
    if (archivoId) {
      const archivoExiste = await this.prisma.archivo.findUnique({ where: { id: archivoId } });
      if (!archivoExiste) {
        throw new NotFoundException({
          codigo: 'ARCHIVO_NO_ENCONTRADO',
          mensaje: 'El archivo especificado no existe',
        });
      }
    }

    await this.prisma.producto.update({
      where: { id: pId },
      data: { foto_archivo_id: archivoId },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'ASOCIAR_FOTO_PRODUCTO',
      resultado: 'OK',
      entidad: 'producto',
      entidadId: pId,
      antes: { foto_archivo_id: actual.foto_archivo_id?.toString() },
      despues: { foto_archivo_id: archivoId?.toString() },
      partyId: usuario?.partyId,
      ip,
    });

    return { ok: true, id: pId.toString(), fotoArchivoId: archivoId?.toString() || null };
  }

  // =========================================================================
  // 3. OPCIONES (ADMIN)
  // =========================================================================

  async agotarOpcion(
    id: bigint | string | number,
    dto: AgotarDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const oId = this.parsearId(id);
    const actual = await this.prisma.opcion.findUnique({ where: { id: oId } });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'OPCION_NO_ENCONTRADA',
        mensaje: 'La opción no existe',
      });
    }

    let fechaAgotado: Date;
    if (dto && dto.agotadoHasta) {
      if (dto.agotadoHasta === 'infinity') {
        fechaAgotado = new Date('9999-12-31T23:59:59Z');
      } else {
        fechaAgotado = new Date(dto.agotadoHasta);
        if (isNaN(fechaAgotado.getTime())) {
          fechaAgotado = new Date('9999-12-31T23:59:59Z');
        }
      }
    } else {
      fechaAgotado = new Date('9999-12-31T23:59:59Z');
    }

    await this.prisma.opcion.update({
      where: { id: oId },
      data: { agotado_hasta: fechaAgotado },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'AGOTAR_OPCION',
      resultado: 'OK',
      entidad: 'opcion',
      entidadId: oId,
      antes: { agotado_hasta: actual.agotado_hasta },
      despues: { agotado_hasta: fechaAgotado.toISOString() },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      ok: true,
      id: oId.toString(),
      disponible: false,
      agotadoHasta: fechaAgotado.toISOString(),
    };
  }

  async disponibilizarOpcion(
    id: bigint | string | number,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const oId = this.parsearId(id);
    const actual = await this.prisma.opcion.findUnique({ where: { id: oId } });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'OPCION_NO_ENCONTRADA',
        mensaje: 'La opción no existe',
      });
    }

    await this.prisma.opcion.update({
      where: { id: oId },
      data: { agotado_hasta: null },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'DISPONIBILIZAR_OPCION',
      resultado: 'OK',
      entidad: 'opcion',
      entidadId: oId,
      antes: { agotado_hasta: actual.agotado_hasta },
      despues: { agotado_hasta: null },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      ok: true,
      id: oId.toString(),
      disponible: true,
      agotadoHasta: null,
    };
  }

  async ocultarOpcion(id: bigint | string | number, usuario?: UsuarioAutenticado, ip?: string) {
    const oId = this.parsearId(id);
    const actual = await this.prisma.opcion.findUnique({ where: { id: oId } });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'OPCION_NO_ENCONTRADA',
        mensaje: 'La opción no existe',
      });
    }

    await this.prisma.opcion.update({
      where: { id: oId },
      data: { activo: false },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'OCULTAR_OPCION',
      resultado: 'OK',
      entidad: 'opcion',
      entidadId: oId,
      antes: { activo: actual.activo },
      despues: { activo: false },
      partyId: usuario?.partyId,
      ip,
    });

    return { ok: true, id: oId.toString(), activo: false };
  }

  async mostrarOpcion(id: bigint | string | number, usuario?: UsuarioAutenticado, ip?: string) {
    const oId = this.parsearId(id);
    const actual = await this.prisma.opcion.findUnique({ where: { id: oId } });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'OPCION_NO_ENCONTRADA',
        mensaje: 'La opción no existe',
      });
    }

    await this.prisma.opcion.update({
      where: { id: oId },
      data: { activo: true },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'MOSTRAR_OPCION',
      resultado: 'OK',
      entidad: 'opcion',
      entidadId: oId,
      antes: { activo: actual.activo },
      despues: { activo: true },
      partyId: usuario?.partyId,
      ip,
    });

    return { ok: true, id: oId.toString(), activo: true };
  }

  // =========================================================================
  // 4. CATEGORÍAS (ADMIN)
  // =========================================================================

  async listarCategoriasAdmin() {
    const categorias = await this.prisma.categoria.findMany({
      orderBy: { orden: 'asc' },
      include: { area: true },
    });

    return categorias.map((c) => ({
      id: c.id.toString(),
      nombre: c.nombre,
      areaId: c.area_id.toString(),
      areaNombre: c.area?.nombre,
      orden: c.orden,
      oculta: c.oculta,
      llevaOpciones: c.lleva_opciones,
    }));
  }

  async actualizarCategoria(
    id: bigint | string | number,
    dto: ActualizarCategoriaDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const cId = this.parsearId(id);
    const actual = await this.prisma.categoria.findUnique({ where: { id: cId } });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'CATEGORIA_NO_ENCONTRADA',
        mensaje: 'La categoría no existe',
      });
    }

    if (dto.nombre && dto.nombre.trim() !== actual.nombre) {
      const duplicado = await this.prisma.categoria.findUnique({
        where: { nombre: dto.nombre.trim() },
      });
      if (duplicado && duplicado.id !== cId) {
        throw new ConflictException({
          codigo: 'NOMBRE_DUPLICADO',
          mensaje: 'Ya existe otra categoría con ese nombre',
        });
      }
    }

    let areaId = actual.area_id;
    if (dto.areaId !== undefined) {
      areaId = this.parsearId(dto.areaId);
      const areaExiste = await this.prisma.areaCocina.findUnique({ where: { id: areaId } });
      if (!areaExiste) {
        throw new NotFoundException({
          codigo: 'AREA_NO_ENCONTRADA',
          mensaje: 'El área de cocina no existe',
        });
      }
    }

    const updated = await this.prisma.categoria.update({
      where: { id: cId },
      data: {
        nombre: dto.nombre ? dto.nombre.trim() : undefined,
        area_id: areaId,
        orden: dto.orden !== undefined ? dto.orden : undefined,
        oculta: dto.oculta !== undefined ? dto.oculta : undefined,
        lleva_opciones: dto.llevaOpciones !== undefined ? dto.llevaOpciones : undefined,
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'EDITAR_CATEGORIA',
      resultado: 'OK',
      entidad: 'categoria',
      entidadId: cId,
      antes: {
        nombre: actual.nombre,
        orden: actual.orden,
        oculta: actual.oculta,
      },
      despues: {
        nombre: updated.nombre,
        orden: updated.orden,
        oculta: updated.oculta,
      },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      id: updated.id.toString(),
      nombre: updated.nombre,
      areaId: updated.area_id.toString(),
      orden: updated.orden,
      oculta: updated.oculta,
      llevaOpciones: updated.lleva_opciones,
    };
  }

  async ocultarCategoria(id: bigint | string | number, usuario?: UsuarioAutenticado, ip?: string) {
    const cId = this.parsearId(id);
    const actual = await this.prisma.categoria.findUnique({ where: { id: cId } });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'CATEGORIA_NO_ENCONTRADA',
        mensaje: 'La categoría no existe',
      });
    }

    await this.prisma.categoria.update({
      where: { id: cId },
      data: { oculta: true },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'OCULTAR_CATEGORIA',
      resultado: 'OK',
      entidad: 'categoria',
      entidadId: cId,
      antes: { oculta: actual.oculta },
      despues: { oculta: true },
      partyId: usuario?.partyId,
      ip,
    });

    return { ok: true, id: cId.toString(), oculta: true };
  }

  async mostrarCategoria(id: bigint | string | number, usuario?: UsuarioAutenticado, ip?: string) {
    const cId = this.parsearId(id);
    const actual = await this.prisma.categoria.findUnique({ where: { id: cId } });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'CATEGORIA_NO_ENCONTRADA',
        mensaje: 'La categoría no existe',
      });
    }

    await this.prisma.categoria.update({
      where: { id: cId },
      data: { oculta: false },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'MOSTRAR_CATEGORIA',
      resultado: 'OK',
      entidad: 'categoria',
      entidadId: cId,
      antes: { oculta: actual.oculta },
      despues: { oculta: false },
      partyId: usuario?.partyId,
      ip,
    });

    return { ok: true, id: cId.toString(), oculta: false };
  }

  async crearCategoria(
    dto: CrearCategoriaDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const nombre = dto.nombre.trim();
    const duplicado = await this.prisma.categoria.findFirst({
      where: { nombre: { equals: nombre, mode: 'insensitive' } },
    });
    if (duplicado) {
      throw new ConflictException({
        codigo: 'NOMBRE_DUPLICADO',
        mensaje: 'Ya existe una categoría con ese nombre',
      });
    }

    let areaId: bigint;
    if (dto.areaId) {
      areaId = this.parsearId(dto.areaId);
    } else {
      const primeraArea = await this.prisma.areaCocina.findFirst({
        where: { activo: true },
        orderBy: { id: 'asc' },
      });
      areaId = primeraArea?.id || BigInt(1);
    }

    let orden = dto.orden;
    if (orden === undefined) {
      const maxOrden = await this.prisma.categoria.aggregate({ _max: { orden: true } });
      orden = (maxOrden._max.orden || 0) + 1;
    }

    const nueva = await this.prisma.categoria.create({
      data: {
        nombre,
        area_id: areaId,
        orden,
        lleva_opciones: dto.llevaOpciones ?? true,
        oculta: dto.oculta ?? false,
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'CREAR_CATEGORIA',
      resultado: 'OK',
      entidad: 'categoria',
      entidadId: nueva.id,
      despues: {
        nombre: nueva.nombre,
        orden: nueva.orden,
        llevaOpciones: nueva.lleva_opciones,
      },
      partyId: usuario?.partyId,
      ip,
    });

    this.eventosGateway?.emitirAdmin('catalogo:categoria_creada', {
      id: nueva.id.toString(),
      nombre: nueva.nombre,
    });

    return {
      id: nueva.id.toString(),
      nombre: nueva.nombre,
      areaId: nueva.area_id.toString(),
      orden: nueva.orden,
      oculta: nueva.oculta,
      llevaOpciones: nueva.lleva_opciones,
    };
  }

  // =========================================================================
  // 5. LISTAS Y VALORES (ADMIN)
  // =========================================================================

  async listarListasAdmin() {
    const listas = await this.prisma.lista.findMany({
      orderBy: { id: 'asc' },
      include: {
        valores: {
          orderBy: { orden: 'asc' },
          include: {
            _count: {
              select: {
                productoTamanos: true,
                opciones: true,
              },
            },
          },
        },
        grupos: {
          select: { id: true, nombre: true },
        },
      },
    });

    return listas.map((l) => ({
      id: l.id.toString(),
      codigo: l.codigo,
      nombre: l.nombre,
      grupos: l.grupos.map((g) => ({ id: g.id.toString(), nombre: g.nombre })),
      valores: l.valores.map((v) => ({
        id: v.id.toString(),
        nombre: v.nombre,
        orden: v.orden,
        activo: v.activo,
        usos: (v._count?.productoTamanos || 0) + (v._count?.opciones || 0),
      })),
    }));
  }

  async crearLista(
    dto: CrearListaDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const nombre = dto.nombre.trim();
    if (nombre.length < 2) {
      throw new BadRequestException({
        codigo: 'NOMBRE_CORTO',
        mensaje: 'El nombre debe tener al menos 2 letras',
      });
    }

    const codigo = dto.codigo || `GRP_${nombre.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, '_').slice(0, 35)}_${Date.now().toString(36).slice(-4).toUpperCase()}`;

    const nueva = await this.prisma.lista.create({
      data: {
        nombre,
        codigo,
      },
    });

    await this.prisma.grupoOpciones.upsert({
      where: { nombre },
      update: { lista_id: nueva.id, activo: true },
      create: {
        nombre,
        lista_id: nueva.id,
        minimo: 0,
        maximo: 1,
        obligatorio: false,
        activo: true,
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'CREAR_LISTA',
      resultado: 'OK',
      entidad: 'lista',
      entidadId: nueva.id,
      despues: { nombre: nueva.nombre, codigo: nueva.codigo },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      id: nueva.id.toString(),
      codigo: nueva.codigo,
      nombre: nueva.nombre,
      valores: [],
    };
  }

  async actualizarLista(
    id: bigint | string | number,
    dto: ActualizarListaDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const lId = this.parsearId(id);
    const actual = await this.prisma.lista.findUnique({ where: { id: lId } });
    if (!actual) {
      throw new NotFoundException({
        codigo: 'LISTA_NO_ENCONTRADA',
        mensaje: 'La lista no existe',
      });
    }

    const nuevoNombre = dto.nombre?.trim();
    if (nuevoNombre && nuevoNombre.length < 2) {
      throw new BadRequestException({
        codigo: 'NOMBRE_CORTO',
        mensaje: 'El nombre debe tener al menos 2 letras',
      });
    }

    const updated = await this.prisma.lista.update({
      where: { id: lId },
      data: {
        nombre: nuevoNombre || undefined,
        codigo: dto.codigo || undefined,
      },
    });

    if (nuevoNombre) {
      await this.prisma.grupoOpciones.updateMany({
        where: { lista_id: lId },
        data: { nombre: nuevoNombre },
      });
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'EDITAR_LISTA',
      resultado: 'OK',
      entidad: 'lista',
      entidadId: lId,
      antes: { nombre: actual.nombre },
      despues: { nombre: updated.nombre },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      id: updated.id.toString(),
      codigo: updated.codigo,
      nombre: updated.nombre,
    };
  }

  async agregarValorLista(
    listaId: bigint | string | number,
    dto: AgregarValorDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const lId = this.parsearId(listaId);
    const lista = await this.prisma.lista.findUnique({ where: { id: lId } });
    if (!lista) {
      throw new NotFoundException({
        codigo: 'LISTA_NO_ENCONTRADA',
        mensaje: 'La lista no existe',
      });
    }

    const nombre = dto.nombre.trim();
    if (nombre.length < 1) {
      throw new BadRequestException({
        codigo: 'NOMBRE_VACIO',
        mensaje: 'Escribe el nombre del elemento',
      });
    }

    const existente = await this.prisma.listaValor.findFirst({
      where: {
        lista_id: lId,
        nombre: { equals: nombre, mode: 'insensitive' },
      },
    });

    let valor: any;
    if (existente) {
      if (existente.activo) {
        throw new ConflictException({
          codigo: 'VALOR_DUPLICADO',
          mensaje: `«${nombre}» ya está en esta lista`,
        });
      }
      valor = await this.prisma.listaValor.update({
        where: { id: existente.id },
        data: { activo: true, nombre },
      });
    } else {
      let orden = dto.orden;
      if (orden === undefined) {
        const maxOrden = await this.prisma.listaValor.aggregate({
          where: { lista_id: lId },
          _max: { orden: true },
        });
        orden = (maxOrden._max.orden || 0) + 1;
      }
      valor = await this.prisma.listaValor.create({
        data: {
          lista_id: lId,
          nombre,
          orden,
          activo: dto.activo ?? true,
        },
      });
    }

    const grupo = await this.prisma.grupoOpciones.findFirst({
      where: { lista_id: lId },
    });
    if (grupo) {
      await this.prisma.opcion.upsert({
        where: {
          grupo_id_valor_id: {
            grupo_id: grupo.id,
            valor_id: valor.id,
          },
        },
        update: { activo: true },
        create: {
          grupo_id: grupo.id,
          valor_id: valor.id,
          precio_extra: 0,
          activo: true,
        },
      });
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'AGREGAR_VALOR_LISTA',
      resultado: 'OK',
      entidad: 'lista_valor',
      entidadId: valor.id,
      despues: { listaId: lId.toString(), nombre: valor.nombre },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      id: valor.id.toString(),
      listaId: valor.lista_id.toString(),
      nombre: valor.nombre,
      orden: valor.orden,
      activo: valor.activo,
    };
  }

  async actualizarValorLista(
    id: bigint | string | number,
    dto: ActualizarValorDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const vId = this.parsearId(id);
    const actual = await this.prisma.listaValor.findUnique({ where: { id: vId } });
    if (!actual) {
      throw new NotFoundException({
        codigo: 'VALOR_NO_ENCONTRADO',
        mensaje: 'El elemento de la lista no existe',
      });
    }

    const nuevoNombre = dto.nombre?.trim();
    if (nuevoNombre && nuevoNombre !== actual.nombre) {
      const dup = await this.prisma.listaValor.findFirst({
        where: {
          lista_id: actual.lista_id,
          id: { not: vId },
          nombre: { equals: nuevoNombre, mode: 'insensitive' },
        },
      });
      if (dup) {
        throw new ConflictException({
          codigo: 'VALOR_DUPLICADO',
          mensaje: `«${nuevoNombre}» ya existe en esta lista`,
        });
      }
    }

    const updated = await this.prisma.listaValor.update({
      where: { id: vId },
      data: {
        nombre: nuevoNombre || undefined,
        orden: dto.orden !== undefined ? dto.orden : undefined,
        activo: dto.activo !== undefined ? dto.activo : undefined,
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'EDITAR_VALOR_LISTA',
      resultado: 'OK',
      entidad: 'lista_valor',
      entidadId: vId,
      antes: { nombre: actual.nombre, activo: actual.activo },
      despues: { nombre: updated.nombre, activo: updated.activo },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      id: updated.id.toString(),
      listaId: updated.lista_id.toString(),
      nombre: updated.nombre,
      orden: updated.orden,
      activo: updated.activo,
    };
  }

  async alternarValorLista(
    id: bigint | string | number,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const vId = this.parsearId(id);
    const actual = await this.prisma.listaValor.findUnique({ where: { id: vId } });
    if (!actual) {
      throw new NotFoundException({
        codigo: 'VALOR_NO_ENCONTRADO',
        mensaje: 'El elemento no existe',
      });
    }

    const nuevoActivo = !actual.activo;
    const updated = await this.prisma.listaValor.update({
      where: { id: vId },
      data: { activo: nuevoActivo },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: nuevoActivo ? 'ACTIVAR_VALOR_LISTA' : 'DESACTIVAR_VALOR_LISTA',
      resultado: 'OK',
      entidad: 'lista_valor',
      entidadId: vId,
      antes: { activo: actual.activo },
      despues: { activo: nuevoActivo },
      partyId: usuario?.partyId,
      ip,
    });

    return { ok: true, id: vId.toString(), activo: nuevoActivo };
  }

  // =========================================================================
  // 6. GRUPOS DE OPCIONES (ADMIN)
  // =========================================================================

  async listarGruposAdmin() {
    const grupos = await this.prisma.grupoOpciones.findMany({
      orderBy: { id: 'asc' },
      include: {
        lista: true,
        opciones: {
          include: { valor: true },
          orderBy: { valor: { orden: 'asc' } },
        },
        productos: {
          include: {
            producto: {
              select: { id: true, nombre: true, categoria_id: true },
            },
          },
        },
      },
    });

    return grupos.map((g) => {
      const prodCats = Array.from(new Set(g.productos.map((p) => p.producto.categoria_id.toString())));
      return {
        id: g.id.toString(),
        nombre: g.nombre,
        listaId: g.lista_id ? g.lista_id.toString() : null,
        listaNombre: g.lista?.nombre || null,
        obligatorio: g.obligatorio,
        minimo: g.minimo,
        maximo: g.maximo,
        activo: g.activo,
        categoriaIds: prodCats,
        productosCount: g.productos.length,
        opciones: g.opciones.map((o) => ({
          id: o.id.toString(),
          valorId: o.valor_id.toString(),
          nombre: o.valor?.nombre || '',
          precioExtra: Number(Number(o.precio_extra).toFixed(2)),
          resaltarSiempre: o.resaltar_siempre,
          activo: o.activo,
          disponible: estaDisponible(o.agotado_hasta),
        })),
      };
    });
  }

  async crearGrupo(
    dto: CrearGrupoOpcionesDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const nombre = dto.nombre.trim();
    const dup = await this.prisma.grupoOpciones.findFirst({
      where: { nombre: { equals: nombre, mode: 'insensitive' } },
    });
    if (dup) {
      throw new ConflictException({
        codigo: 'GRUPO_DUPLICADO',
        mensaje: `Ya existe un grupo de opciones llamado «${nombre}»`,
      });
    }

    let listaId: bigint | null = null;
    if (dto.listaId) {
      listaId = this.parsearId(dto.listaId);
    } else {
      const nuevaLista = await this.prisma.lista.create({
        data: {
          nombre,
          codigo: `GRP_${nombre.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, '_').slice(0, 35)}_${Date.now().toString(36).slice(-4).toUpperCase()}`,
        },
      });
      listaId = nuevaLista.id;
    }

    const nuevo = await this.prisma.grupoOpciones.create({
      data: {
        nombre,
        lista_id: listaId,
        obligatorio: dto.obligatorio ?? false,
        minimo: dto.minimo ?? 0,
        maximo: dto.maximo ?? 1,
        activo: dto.activo ?? true,
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'CREAR_GRUPO_OPCIONES',
      resultado: 'OK',
      entidad: 'grupo_opciones',
      entidadId: nuevo.id,
      despues: { nombre: nuevo.nombre, listaId: listaId?.toString() },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      id: nuevo.id.toString(),
      nombre: nuevo.nombre,
      listaId: listaId ? listaId.toString() : null,
      obligatorio: nuevo.obligatorio,
      minimo: nuevo.minimo,
      maximo: nuevo.maximo,
      activo: nuevo.activo,
      opciones: [],
      categoriaIds: [],
    };
  }

  /** Crea una opción nueva (o reactiva una existente) dentro de un grupo, con su precio extra. */
  async crearOpcionGrupo(
    grupoId: bigint | string | number,
    dto: CrearOpcionDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const gId = this.parsearId(grupoId);
    const grupo = await this.prisma.grupoOpciones.findUnique({ where: { id: gId } });
    if (!grupo) {
      throw new NotFoundException({
        codigo: 'GRUPO_NO_ENCONTRADO',
        mensaje: 'El grupo de opciones no existe',
      });
    }
    const nombre = (dto.nombre ?? '').trim();
    if (!nombre) {
      throw new BadRequestException({
        codigo: 'NOMBRE_VACIO',
        mensaje: 'Escribe el nombre de la opción',
      });
    }
    const precioExtra = dto.precioExtra ?? 0;
    if (precioExtra < 0) {
      throw new BadRequestException({
        codigo: 'PRECIO_INVALIDO',
        mensaje: 'El precio extra debe ser mayor o igual a 0',
      });
    }

    let listaId = grupo.lista_id;
    if (!listaId) {
      const lista = await this.prisma.lista.create({
        data: { nombre: grupo.nombre, codigo: `GRP_${grupo.id.toString()}_${Date.now().toString(36).toUpperCase()}` },
      });
      listaId = lista.id;
      await this.prisma.grupoOpciones.update({ where: { id: gId }, data: { lista_id: listaId } });
    }

    const existente = await this.prisma.listaValor.findFirst({
      where: { lista_id: listaId, nombre: { equals: nombre, mode: 'insensitive' } },
    });
    let valor: any = existente;
    if (!valor) {
      const maxOrden = await this.prisma.listaValor.aggregate({
        where: { lista_id: listaId },
        _max: { orden: true },
      });
      valor = await this.prisma.listaValor.create({
        data: { lista_id: listaId, nombre, orden: (maxOrden._max.orden || 0) + 1, activo: true },
      });
    } else if (!valor.activo) {
      valor = await this.prisma.listaValor.update({ where: { id: valor.id }, data: { activo: true } });
    }

    const yaEnGrupo = await this.prisma.opcion.findUnique({
      where: { grupo_id_valor_id: { grupo_id: gId, valor_id: valor.id } },
    });
    if (yaEnGrupo && yaEnGrupo.activo) {
      throw new ConflictException({
        codigo: 'OPCION_DUPLICADA',
        mensaje: `«${valor.nombre}» ya es una opción de este grupo`,
      });
    }
    const opcion = await this.prisma.opcion.upsert({
      where: { grupo_id_valor_id: { grupo_id: gId, valor_id: valor.id } },
      update: { activo: true, precio_extra: precioExtra, ...(dto.resaltarSiempre !== undefined ? { resaltar_siempre: dto.resaltarSiempre } : {}) },
      create: { grupo_id: gId, valor_id: valor.id, precio_extra: precioExtra, activo: true, resaltar_siempre: dto.resaltarSiempre ?? false },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'CREAR_OPCION',
      resultado: 'OK',
      entidad: 'opcion',
      entidadId: opcion.id,
      despues: { grupoId: gId.toString(), nombre: valor.nombre, precioExtra, resaltarSiempre: opcion.resaltar_siempre },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      id: opcion.id.toString(),
      valorId: valor.id.toString(),
      nombre: valor.nombre,
      precioExtra: Number(Number(opcion.precio_extra).toFixed(2)),
      resaltarSiempre: opcion.resaltar_siempre,
      activo: opcion.activo,
      disponible: estaDisponible(opcion.agotado_hasta),
    };
  }

  /** Edita nombre, precio extra y/o estado (activo/oculto) de una opción. Nada se elimina. */
  async editarOpcion(
    id: bigint | string | number,
    dto: ActualizarOpcionDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const oId = this.parsearId(id);
    const actual = await this.prisma.opcion.findUnique({ where: { id: oId }, include: { valor: true } });
    if (!actual) {
      throw new NotFoundException({
        codigo: 'OPCION_NO_ENCONTRADA',
        mensaje: 'La opción no existe',
      });
    }
    if (dto.precioExtra !== undefined && dto.precioExtra < 0) {
      throw new BadRequestException({
        codigo: 'PRECIO_INVALIDO',
        mensaje: 'El precio extra debe ser mayor o igual a 0',
      });
    }
    const nuevoNombre = dto.nombre?.trim();
    if (dto.nombre !== undefined && !nuevoNombre) {
      throw new BadRequestException({
        codigo: 'NOMBRE_VACIO',
        mensaje: 'Escribe el nombre de la opción',
      });
    }
    if (nuevoNombre && actual.valor && nuevoNombre !== actual.valor.nombre) {
      const dup = await this.prisma.listaValor.findFirst({
        where: {
          lista_id: actual.valor.lista_id,
          id: { not: actual.valor_id },
          nombre: { equals: nuevoNombre, mode: 'insensitive' },
        },
      });
      if (dup) {
        throw new ConflictException({
          codigo: 'VALOR_DUPLICADO',
          mensaje: `«${nuevoNombre}» ya existe en esta lista`,
        });
      }
      await this.prisma.listaValor.update({ where: { id: actual.valor_id }, data: { nombre: nuevoNombre } });
    }
    const updated = await this.prisma.opcion.update({
      where: { id: oId },
      data: {
        precio_extra: dto.precioExtra !== undefined ? dto.precioExtra : undefined,
        activo: dto.activo !== undefined ? dto.activo : undefined,
        resaltar_siempre: dto.resaltarSiempre !== undefined ? dto.resaltarSiempre : undefined,
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'EDITAR_OPCION',
      resultado: 'OK',
      entidad: 'opcion',
      entidadId: oId,
      antes: { nombre: actual.valor?.nombre, precioExtra: Number(actual.precio_extra), activo: actual.activo, resaltarSiempre: actual.resaltar_siempre },
      despues: {
        nombre: nuevoNombre || actual.valor?.nombre,
        precioExtra: Number(updated.precio_extra),
        activo: updated.activo,
        resaltarSiempre: updated.resaltar_siempre,
      },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      id: updated.id.toString(),
      valorId: updated.valor_id.toString(),
      nombre: nuevoNombre || actual.valor?.nombre || '',
      precioExtra: Number(Number(updated.precio_extra).toFixed(2)),
      resaltarSiempre: updated.resaltar_siempre,
      activo: updated.activo,
      disponible: estaDisponible(updated.agotado_hasta),
    };
  }

  async actualizarGrupo(
    id: bigint | string | number,
    dto: ActualizarGrupoOpcionesDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const gId = this.parsearId(id);
    const actual = await this.prisma.grupoOpciones.findUnique({ where: { id: gId } });
    if (!actual) {
      throw new NotFoundException({
        codigo: 'GRUPO_NO_ENCONTRADO',
        mensaje: 'El grupo de opciones no existe',
      });
    }

    const nuevoNombre = dto.nombre?.trim();
    if (nuevoNombre && nuevoNombre !== actual.nombre) {
      const dup = await this.prisma.grupoOpciones.findFirst({
        where: {
          id: { not: gId },
          nombre: { equals: nuevoNombre, mode: 'insensitive' },
        },
      });
      if (dup) {
        throw new ConflictException({
          codigo: 'GRUPO_DUPLICADO',
          mensaje: `Ya existe otro grupo de opciones llamado «${nuevoNombre}»`,
        });
      }
    }

    const updated = await this.prisma.grupoOpciones.update({
      where: { id: gId },
      include: { _count: { select: { productos: true } } },
      data: {
        nombre: nuevoNombre || undefined,
        lista_id: dto.listaId ? this.parsearId(dto.listaId) : undefined,
        obligatorio: dto.obligatorio !== undefined ? dto.obligatorio : undefined,
        minimo: dto.minimo !== undefined ? dto.minimo : undefined,
        maximo: dto.maximo !== undefined ? dto.maximo : undefined,
        activo: dto.activo !== undefined ? dto.activo : undefined,
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'EDITAR_GRUPO_OPCIONES',
      resultado: 'OK',
      entidad: 'grupo_opciones',
      entidadId: gId,
      antes: { nombre: actual.nombre, obligatorio: actual.obligatorio },
      despues: { nombre: updated.nombre, obligatorio: updated.obligatorio },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      id: updated.id.toString(),
      nombre: updated.nombre,
      listaId: updated.lista_id ? updated.lista_id.toString() : null,
      obligatorio: updated.obligatorio,
      minimo: updated.minimo,
      maximo: updated.maximo,
      activo: updated.activo,
      productosCount: updated._count.productos,
    };
  }

  async asignarGrupoCategorias(
    grupoId: bigint | string | number,
    categoriaIds: (string | number)[],
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const gId = this.parsearId(grupoId);
    const grupo = await this.prisma.grupoOpciones.findUnique({ where: { id: gId } });
    if (!grupo) {
      throw new NotFoundException({
        codigo: 'GRUPO_NO_ENCONTRADO',
        mensaje: 'El grupo de opciones no existe',
      });
    }

    const cIds = categoriaIds.map((c) => this.parsearId(c));

    const productosEnCats = await this.prisma.producto.findMany({
      where: { categoria_id: { in: cIds } },
      select: { id: true, categoria_id: true },
    });

    const actuales = await this.prisma.productoGrupo.findMany({
      where: { grupo_id: gId },
      include: { producto: { select: { id: true, categoria_id: true } } },
    });

    for (const pg of actuales) {
      if (cIds.length === 0 || !cIds.some((cid) => cid === pg.producto.categoria_id)) {
        await this.prisma.productoGrupo.delete({ where: { id: pg.id } });
      }
    }

    for (const p of productosEnCats) {
      await this.prisma.productoGrupo.upsert({
        where: {
          producto_id_grupo_id: {
            producto_id: p.id,
            grupo_id: gId,
          },
        },
        update: {},
        create: {
          producto_id: p.id,
          grupo_id: gId,
        },
      });
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'ASIGNAR_GRUPO_CATEGORIAS',
      resultado: 'OK',
      entidad: 'grupo_opciones',
      entidadId: gId,
      despues: { categoriaIds: categoriaIds.map(String) },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      ok: true,
      grupoId: gId.toString(),
      categoriaIds: categoriaIds.map(String),
    };
  }
}
