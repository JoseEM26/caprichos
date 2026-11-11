import { coincideTexto } from '../../comun/normalizar-busqueda';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { historialProducto, type ConsultaHistorial } from './historial-producto';
import { Prisma } from '@prisma/client';
import { obtenerFotoUrl } from '../../comun/foto-url';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { inicioDiaLimaIso, finDiaLimaIso } from '../../comun/fechas-lima';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { MovimientoAlmacenDto } from './dto/movimiento-almacen.dto';
import { MermaMultipleDto } from './dto/merma-multiple.dto';
import { ProduccionTandasDto } from './dto/produccion-tandas.dto';
import { CierreDiaDto } from './dto/cierre-dia.dto';
import { AlmacenQueryDto } from './dto/almacen-query.dto';
import { CrearPedidoInternoDto } from './dto/crear-pedido-interno.dto';
import { RegistrarAperturaDto } from './dto/registrar-apertura.dto';
import { MermaProductoDto } from './dto/merma-producto.dto';
import {
  controlaPorSabor,
  fechaLimaHoy,
  mermarProductoControlado,
  NOTA_OTRO_MINIMA,
  notaOtroValida,
  registrarAperturaArrastre,
  sincronizarAgotadoSabor,
  saldoSabor,
} from '../stock/producto-controlado';
import { StockService } from '../stock/stock.service';
import { ConsumoRecetaService } from './consumo-receta.service';

@Injectable()
export class AlmacenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly eventosGateway?: EventosGateway,
    @Optional() private readonly stockService?: StockService,
    @Optional() private readonly consumo?: ConsumoRecetaService,
  ) {}

  private parsearId(id: bigint | string | number, entidad = 'entidad'): bigint {
    try {
      return BigInt(id);
    } catch {
      throw new BadRequestException({
        codigo: 'ID_INVALIDO',
        mensaje: `El identificador de ${entidad} no es válido`,
      });
    }
  }

  private async obtenerLugarPorNombre(nombre: string) {
    let lugar = await this.prisma.lugarStock.findUnique({
      where: { nombre },
    });
    if (!lugar) {
      lugar = await this.prisma.lugarStock.create({
        data: {
          nombre,
          tipo: nombre === 'Almacén central' ? 'ALMACEN' : 'AREA',
        },
      });
    }
    return lugar;
  }

  // ==========================================
  // CONTEO DE APERTURA (productos que controlan stock)
  // ==========================================
  async obtenerApertura() {
    const fecha = fechaLimaHoy();
    // Un producto oculto no se cuenta ni aparece en la apertura (aunque tenga la casilla de control).
    // El anfitrión de un combo (Dúo, paquetes) tampoco: no lleva saldo propio, sus piezas descuentan su producto.
    const productos = await this.prisma.producto.findMany({
      where: { controla_stock: true, oculto: false, ofertasAlcance: { none: { tipo: 'COMBO' } } },
      select: {
        id: true,
        nombre: true,
        controla_stock: true,
        foto_archivo: { select: { ruta: true } },
        categoria: { select: { area: { select: { nombre: true } } } },
        sabores: { where: { activo: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true, activo: true } },
      },
      orderBy: { nombre: 'asc' },
    });
    const ids = productos.map((p) => p.id);
    const idsSabores = productos.flatMap((p) => p.sabores.map((sb) => sb.id));
    const [aperturas, filas, aperturasSabor, filasSabor] = await Promise.all([
      this.prisma.conteoApertura.findMany({
        where: { fecha: new Date(`${fecha}T00:00:00.000Z`), producto_id: { in: ids }, sabor_id: null },
      }),
      this.prisma.stock.findMany({ where: { producto_id: { in: ids } }, select: { producto_id: true, cantidad: true } }),
      this.prisma.conteoApertura.findMany({
        where: { fecha: new Date(`${fecha}T00:00:00.000Z`), sabor_id: { in: idsSabores } },
      }),
      this.prisma.stockSabor.findMany({ where: { sabor_id: { in: idsSabores } }, select: { sabor_id: true, cantidad: true } }),
    ]);
    const apertura = new Map(aperturas.map((a) => [a.producto_id.toString(), Number(a.cantidad)]));
    const saldo = new Map<string, number>();
    for (const f of filas) {
      const k = f.producto_id!.toString();
      saldo.set(k, (saldo.get(k) ?? 0) + Number(f.cantidad));
    }
    const aperturaSabor = new Map(aperturasSabor.map((a) => [a.sabor_id!.toString(), Number(a.cantidad)]));
    const saldoSabor = new Map(filasSabor.map((f) => [f.sabor_id.toString(), Number(f.cantidad)]));
    // Arrastre: lo producido hoy (ya sumado) se separa del saldo para sugerir «Quedaron de ayer»
    const producidoHoyPorSabor = await this.producidoHoyMapa(ids, idsSabores, fecha);
    const quedaron = (saldoActual: number, producido: number) => Math.max(0, saldoActual - producido);
    return {
      fecha,
      productos: productos.map((p) => {
        const k = p.id.toString();
        const ap = apertura.get(k);
        if (controlaPorSabor(p)) {
          // Producto por sabor: el saldo y la apertura se llevan por sabor
          const sabores = p.sabores.map((sb) => {
            const sk = sb.id.toString();
            const apSab = aperturaSabor.get(sk);
            const saldoSab = saldoSabor.get(sk) ?? 0;
            const producido = producidoHoyPorSabor.sabor.get(sk) ?? 0;
            return {
              saborId: sk,
              nombre: sb.nombre,
              saldo: saldoSab,
              aperturaHoy: apSab !== undefined,
              aperturaCantidad: apSab ?? null,
              producidoHoy: producido,
              quedaronAyer: quedaron(saldoSab, producido),
            };
          });
          return {
            productoId: k,
            nombre: p.nombre,
            areaNombre: p.categoria?.area?.nombre ?? null,
            fotoUrl: obtenerFotoUrl(p.foto_archivo),
            saldo: sabores.reduce((acc, sb) => acc + sb.saldo, 0),
            aperturaHoy: sabores.some((sb) => sb.aperturaHoy),
            aperturaCantidad: null,
            producidoHoy: sabores.reduce((acc, sb) => acc + sb.producidoHoy, 0),
            quedaronAyer: sabores.reduce((acc, sb) => acc + sb.quedaronAyer, 0),
            sabores,
          };
        }
        const saldoProd = saldo.get(k) ?? 0;
        const producido = producidoHoyPorSabor.producto.get(k) ?? 0;
        return {
          productoId: k,
          nombre: p.nombre,
          areaNombre: p.categoria?.area?.nombre ?? null,
          fotoUrl: obtenerFotoUrl(p.foto_archivo),
          saldo: saldoProd,
          aperturaHoy: ap !== undefined,
          aperturaCantidad: ap ?? null,
          producidoHoy: producido,
          quedaronAyer: quedaron(saldoProd, producido),
          sabores: [],
        };
      }),
    };
  }

  /** Lo producido hoy por producto (sin sabor) y por sabor, para la apertura con arrastre. */
  private async producidoHoyMapa(ids: bigint[], idsSabores: bigint[], fecha: string) {
    const producto = new Map<string, number>();
    const sabor = new Map<string, number>();
    if (ids.length === 0 && idsSabores.length === 0) return { producto, sabor };
    const movs = await this.prisma.movimientoStock.findMany({
      where: {
        tipo: 'ENTRADA',
        nota: 'Produje hoy',
        en: { gte: new Date(`${fecha}T05:00:00.000Z`) },
        OR: [{ producto_id: { in: ids } }, { sabor_id: { in: idsSabores } }],
      },
      select: { producto_id: true, sabor_id: true, cantidad: true },
    });
    for (const m of movs) {
      const c = Number(m.cantidad);
      if (m.sabor_id) sabor.set(m.sabor_id.toString(), (sabor.get(m.sabor_id.toString()) ?? 0) + c);
      else if (m.producto_id) producto.set(m.producto_id.toString(), (producto.get(m.producto_id.toString()) ?? 0) + c);
    }
    return { producto, sabor };
  }

  async registrarApertura(dto: RegistrarAperturaDto, usuario: UsuarioAutenticado, ip?: string) {
    const fecha = fechaLimaHoy();
    const ids = dto.items.map((i) => this.parsearId(i.productoId, 'producto'));
    const productos = await this.prisma.producto.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        nombre: true,
        controla_stock: true,
        categoria: { select: { area_id: true } },
        sabores: { where: { activo: true }, select: { id: true, nombre: true, activo: true } },
      },
    });
    for (const item of dto.items) {
      const prod = productos.find((p) => p.id === this.parsearId(item.productoId, 'producto'));
      if (!prod) {
        throw new NotFoundException({ codigo: 'PRODUCTO_NO_ENCONTRADO', mensaje: `Producto ${item.productoId} no encontrado` });
      }
      if (!prod.controla_stock) {
        throw new BadRequestException({
          codigo: 'PRODUCTO_SIN_CONTROL',
          mensaje: 'Ese producto no controla stock: no lleva conteo de apertura',
        });
      }
      const porSabor = controlaPorSabor(prod);
      if (porSabor && !item.saborId) {
        throw new BadRequestException({
          codigo: 'SABOR_REQUERIDO',
          mensaje: `${prod.nombre} lleva conteo por sabor: indica el sabor de cada cantidad`,
        });
      }
      if (!porSabor && item.saborId) {
        throw new BadRequestException({
          codigo: 'PRODUCTO_SIN_SABORES',
          mensaje: 'Ese producto no lleva conteo por sabor',
        });
      }
      if (item.saborId && !prod.sabores.some((sb) => sb.id === this.parsearId(item.saborId!, 'sabor'))) {
        throw new BadRequestException({
          codigo: 'SABORES_INVALIDOS',
          mensaje: `El sabor ${item.saborId} no pertenece a ese producto o no está activo`,
        });
      }
    }

    const mermas: Array<{ productoId: string; saborId: string | null; cantidad: number; motivo: string; movimientoId: string }> = [];
    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        const prod = productos.find((p) => p.id === this.parsearId(item.productoId, 'producto'))!;
        const sabor = item.saborId ? prod.sabores.find((sb) => sb.id === this.parsearId(item.saborId!, 'sabor')) : undefined;
        const r = await registrarAperturaArrastre(tx, {
          productoId: prod.id,
          saborId: item.saborId ? this.parsearId(item.saborId, 'sabor') : null,
          quedaron: item.cantidad,
          produccion: item.produccion ?? 0,
          areaId: prod.categoria?.area_id ?? null,
          por: usuario.partyId,
          ahora: new Date(),
          fecha,
          merma: {
            motivo: item.motivo,
            nota: item.nota,
            saldoEsperado: item.saldoEsperado,
            nombre: prod.nombre,
            saborNombre: sabor?.nombre ?? null,
          },
        });
        if (r.merma) {
          mermas.push({
            productoId: item.productoId,
            saborId: item.saborId ?? null,
            cantidad: r.merma.cantidad,
            motivo: r.merma.motivo,
            movimientoId: r.merma.movimientoId.toString(),
          });
        }
      }
      await this.auditoria.registrar(
        {
          categoria: 'CAMBIO',
          modulo: 'almacen',
          accion: 'REGISTRAR_APERTURA',
          entidad: 'conteo_apertura',
          partyId: usuario.partyId,
          despues: { fecha, productos: dto.items.length, mermas },
          ip,
        },
        tx,
      );
    });

    this.eventosGateway?.emitirAdmin('stock:cambio', {});
    if (typeof this.stockService?.verificarYReactivarAgotados === 'function') {
      await this.stockService.verificarYReactivarAgotados([], ids);
    }
    return { ok: true, registrados: dto.items.length, mermas: mermas.length };
  }

  // ==========================================
  // MERMA DE PRODUCTO TERMINADO (sabor o producto)
  // ==========================================
  /** Sin mirar «Control de almacén»: la audita movimiento_stock (por y en) y auditoria. */
  async registrarMermaProducto(dto: MermaProductoDto, usuario: UsuarioAutenticado, ip?: string) {
    const productoId = this.parsearId(dto.productoId, 'producto');
    const prod = await this.prisma.producto.findUnique({
      where: { id: productoId },
      select: {
        id: true,
        nombre: true,
        controla_stock: true,
        categoria: { select: { area_id: true } },
        sabores: { where: { activo: true }, select: { id: true, nombre: true, activo: true } },
      },
    });
    if (!prod) {
      throw new NotFoundException({ codigo: 'PRODUCTO_NO_ENCONTRADO', mensaje: `Producto ${dto.productoId} no encontrado` });
    }
    if (!prod.controla_stock) {
      throw new BadRequestException({ codigo: 'PRODUCTO_SIN_CONTROL', mensaje: 'Ese producto no controla stock' });
    }
    const porSabor = controlaPorSabor(prod);
    if (porSabor && !dto.saborId) {
      throw new BadRequestException({ codigo: 'SABOR_REQUERIDO', mensaje: `${prod.nombre} lleva stock por sabor: indica el sabor` });
    }
    if (!porSabor && dto.saborId) {
      throw new BadRequestException({ codigo: 'PRODUCTO_SIN_SABORES', mensaje: `${prod.nombre} no lleva stock por sabor` });
    }
    const sabor = dto.saborId ? prod.sabores.find((sb) => sb.id === this.parsearId(dto.saborId!, 'sabor')) : undefined;
    if (dto.saborId && !sabor) {
      throw new BadRequestException({ codigo: 'SABORES_INVALIDOS', mensaje: `El sabor no pertenece a ${prod.nombre} o no está activo` });
    }
    if (dto.motivo === 'OTRO' && !notaOtroValida(dto.nota)) {
      throw new BadRequestException({ codigo: 'NOTA_OBLIGATORIA', mensaje: `Si el motivo es Otro, escribe una nota de al menos ${NOTA_OTRO_MINIMA} letras` });
    }

    const fecha = fechaLimaHoy();
    const resultado = await this.prisma.$transaction(async (tx) => {
      const r = await mermarProductoControlado(tx, {
        productoId: prod.id,
        nombre: prod.nombre,
        saborId: sabor?.id ?? null,
        saborNombre: sabor?.nombre ?? null,
        cantidad: dto.cantidad,
        motivo: dto.motivo,
        nota: dto.nota,
        areaId: prod.categoria?.area_id ?? null,
        por: usuario.partyId,
        ahora: new Date(),
        fecha,
      });
      await this.auditoria.registrar(
        {
          categoria: 'CAMBIO',
          modulo: 'almacen',
          accion: 'MERMA_PRODUCTO',
          entidad: 'movimiento_stock',
          entidadId: r.movimientoId,
          partyId: usuario.partyId,
          despues: {
            productoId: prod.id.toString(),
            saborId: sabor?.id.toString() ?? null,
            cantidad: dto.cantidad,
            motivo: dto.motivo,
            saldo: r.saldo,
          },
          ip,
        },
        tx,
      );
      return r;
    });

    this.eventosGateway?.emitirAdmin('stock:cambio', {});
    return { ok: true, id: resultado.movimientoId.toString(), saldo: resultado.saldo };
  }

  private mermaProductoEnApertura(nombre: string) {
    return new ConflictException({
      codigo: 'MERMA_PRODUCTO_EN_APERTURA',
      mensaje: `La merma de productos (${nombre}) se registra en Apertura del día`,
      enlace: '/admin/apertura',
    });
  }

  historialProducto(id: string, q: ConsultaHistorial) {
    return historialProducto(this.prisma, id, q);
  }

  /** Mermas de productos terminados de hoy (todas las que salieron de Apertura), con motivo, quién y si ya se anularon. */
  async listarMermasProductoHoy() {
    const desde = new Date(`${fechaLimaHoy()}T05:00:00.000Z`); // medianoche de Lima
    const movs = await this.prisma.movimientoStock.findMany({
      where: { tipo: 'MERMA', producto_id: { not: null }, en: { gte: desde } },
      include: { producto: { select: { nombre: true } }, sabor: { select: { nombre: true } } },
      orderBy: { en: 'desc' },
    });
    const anuladas = movs.length
      ? await this.prisma.movimientoStock.findMany({
          where: { movimiento_anulado_id: { in: movs.map((m) => m.id) } },
          select: { movimiento_anulado_id: true },
        })
      : [];
    const idsAnulados = new Set(anuladas.map((a) => a.movimiento_anulado_id!.toString()));
    const personas = await this.prisma.person.findMany({
      where: { party_id: { in: [...new Set(movs.map((m) => m.por))] } },
      select: { party_id: true, nombres: true, apellidos: true },
    });
    const quien = new Map(personas.map((p) => [p.party_id.toString(), `${p.nombres} ${p.apellidos ?? ''}`.trim()]));
    return {
      fecha: fechaLimaHoy(),
      mermas: movs
        .filter((m) => Number(m.cantidad) < 0)
        .map((m) => {
          const [, motivo, ...nota] = (m.nota ?? '').split(' · ');
          return {
            id: m.id.toString(),
            producto: m.producto?.nombre ?? '',
            sabor: m.sabor?.nombre ?? null,
            cantidad: Math.abs(Number(m.cantidad)),
            motivo: motivo ?? m.nota ?? '',
            nota: nota.join(' · ') || null,
            en: m.en.toISOString(),
            por: quien.get(m.por.toString()) ?? null,
            anulada: idsAnulados.has(m.id.toString()),
          };
        }),
    };
  }

  // ==========================================
  // HISTORIAL Y LISTA DE MOVIMIENTOS
  // ==========================================
  async listarMovimientos(query: AlmacenQueryDto) {
    const where: Prisma.MovimientoStockWhereInput = {};

    if (query.insumoId) {
      where.insumo_id = this.parsearId(query.insumoId, 'insumo');
    }

    if (query.tipo && query.tipo !== 'Todos') {
      const tipoMapeado = query.tipo.toUpperCase();
      if (tipoMapeado === 'ENTRADAS' || tipoMapeado === 'ENTRADA') {
        where.tipo = { in: ['ENTRADA', 'PRODUCCION_ALTA', 'TRASLADO_ENTRADA'] };
      } else if (tipoMapeado === 'SALIDAS' || tipoMapeado === 'SALIDA') {
        where.tipo = { in: ['SALIDA', 'PRODUCCION_CONSUMO', 'TRASLADO_SALIDA', 'CONSUMO_RECETA'] };
      } else if (tipoMapeado === 'MERMAS' || tipoMapeado === 'MERMA') {
        where.tipo = { in: ['MERMA', 'DIFERENCIA_CONTEO'] };
      } else if (tipoMapeado === 'DEVOLUCIONES' || tipoMapeado === 'DEVOLUCION') {
        where.tipo = 'DEVOLUCION';
      } else {
        where.tipo = query.tipo;
      }
    }

    if (query.fechaDesde || query.fechaHasta) {
      where.en = {};
      if (query.fechaDesde) {
        where.en.gte = inicioDiaLimaIso(query.fechaDesde);
      }
      if (query.fechaHasta) {
        where.en.lte = finDiaLimaIso(query.fechaHasta);
      }
    }

    const qBusqueda = query.q?.trim() ?? '';
    const pagina = Math.max(1, Number(query.pagina) || 1);
    const limite = Math.min(200, Math.max(1, Number(query.limite) || 100));
    // ponytail: con búsqueda de texto se trae hasta 5000 movimientos del rango (sin el filtro de tipo) y se filtra
    // en memoria sin tildes; sin búsqueda se pagina en la BD. Si el historial crece, pasar a una columna normalizada.
    const conBusqueda = qBusqueda !== '';
    const whereLectura: Prisma.MovimientoStockWhereInput = conBusqueda ? { ...where, tipo: undefined } : where;
    const movimientos = await this.prisma.movimientoStock.findMany({
      where: whereLectura,
      include: {
        insumo: true,
        producto: true,
        lugar: true,
      },
      orderBy: { en: 'desc' },
      skip: conBusqueda ? 0 : (pagina - 1) * limite,
      take: conBusqueda ? 5000 : limite,
    });
    const totalTipo = conBusqueda ? 0 : await this.prisma.movimientoStock.count({ where });

    const baseWhereDate: Prisma.MovimientoStockWhereInput = {};
    if (query.fechaDesde || query.fechaHasta) {
      baseWhereDate.en = {};
      if (query.fechaDesde) baseWhereDate.en.gte = inicioDiaLimaIso(query.fechaDesde);
      if (query.fechaHasta) baseWhereDate.en.lte = finDiaLimaIso(query.fechaHasta);
    }

    const todosMovs = await this.prisma.movimientoStock.findMany({
      where: baseWhereDate,
      select: { tipo: true },
    });

    const grupoDe = (tipo: string) =>
      ['ENTRADA', 'PRODUCCION_ALTA', 'TRASLADO_ENTRADA'].includes(tipo)
        ? 'entradas'
        : ['SALIDA', 'PRODUCCION_CONSUMO', 'TRASLADO_SALIDA'].includes(tipo)
          ? 'salidas'
          : ['MERMA', 'DIFERENCIA_CONTEO'].includes(tipo)
            ? 'mermas'
            : tipo === 'DEVOLUCION'
              ? 'devoluciones'
              : null;
    const contar = (tipos: string[]) => {
      const c = { todos: tipos.length, entradas: 0, salidas: 0, mermas: 0, devoluciones: 0 };
      for (const t of tipos) {
        const g = grupoDe(t);
        if (g) c[g]++;
      }
      return c;
    };
    // Sin búsqueda, los conteos son los reales del rango; con búsqueda se calculan sobre lo que coincide (abajo).
    const conteosRango = contar(todosMovs.map((m) => m.tipo));

    const formateados = movimientos.map((m) => {
      const fechaObj = new Date(m.en);
      const dia = String(fechaObj.getDate()).padStart(2, '0');
      const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
      const horas = String(fechaObj.getHours()).padStart(2, '0');
      const mins = String(fechaObj.getMinutes()).padStart(2, '0');
      const fechaStr = `${dia}/${mes}`;
      const horaStr = `${horas}:${mins}`;

      let tipoNombre = 'Entrada';
      let chipBg = 'var(--cp-line)';
      let chipFg = 'var(--cp-navy)';

      if (['ENTRADA', 'PRODUCCION_ALTA', 'TRASLADO_ENTRADA'].includes(m.tipo)) {
        tipoNombre = 'Entrada';
        chipBg = 'var(--cp-line)';
        chipFg = 'var(--cp-navy)';
      } else if (['SALIDA', 'PRODUCCION_CONSUMO', 'TRASLADO_SALIDA'].includes(m.tipo)) {
        tipoNombre = 'Salida';
        chipBg = 'var(--cp-line)';
        chipFg = 'var(--cp-navy)';
      } else if (['MERMA', 'DIFERENCIA_CONTEO'].includes(m.tipo)) {
        tipoNombre = 'Merma';
        chipBg = 'rgb(253, 236, 232)';
        chipFg = 'var(--cp-rust)';
      } else if (m.tipo === 'DEVOLUCION') {
        tipoNombre = 'Devolución';
        chipBg = 'var(--cp-greenbg)';
        chipFg = 'var(--cp-navy)';
      } else if (m.tipo === 'VENTA') {
        tipoNombre = 'Venta';
        chipBg = 'var(--cp-sand)';
        chipFg = 'var(--cp-navy)';
      } else if (m.tipo === 'CORTESIA') {
        tipoNombre = 'Cortesía';
        chipBg = 'var(--cp-sand)';
        chipFg = 'var(--cp-navy)';
      } else if (m.tipo === 'ANULACION') {
        tipoNombre = 'Anulación';
        chipBg = 'var(--cp-line)';
        chipFg = 'var(--cp-rust)';
      }

      const itemNombre = m.insumo?.nombre || m.producto?.nombre || 'Insumo';
      const unidad = m.insumo?.unidad_almacen || 'unidades';
      const cantAbs = Math.abs(Number(m.cantidad));

      let documento = m.nota || '';
      if (m.produccion_id) documento = `PRD-${m.produccion_id.toString()}`;
      else if (m.compra_id) documento = `OC-${m.compra_id.toString()}`;
      else if (m.traslado_id) documento = `TR-${m.traslado_id.toString()}`;

      return {
        id: m.id.toString(),
        fecha: fechaStr,
        hora: horaStr,
        tipo: tipoNombre,
        tipoRaw: m.tipo,
        chipBg,
        chipFg,
        insumo: itemNombre,
        insumoId: m.insumo_id?.toString() || m.producto_id?.toString() || '',
        cantidadNum: cantAbs,
        cantidad: `${cantAbs} ${unidad.toLowerCase()}`,
        origen: m.lugar.nombre,
        destino: m.nota?.includes('Destino:') ? m.nota.split('Destino:')[1].trim() : m.lugar.nombre,
        documento: documento || '-',
        nota: m.nota || '',
        anulado: m.tipo === 'ANULACION' || m.tipo === 'VENTA' || !!m.movimiento_anulado_id,
      };
    });

    if (!conBusqueda) {
      return {
        conteos: conteosRango,
        movimientos: formateados,
        total: totalTipo,
        pagina,
        limite,
      };
    }

    const coinciden = formateados.filter((m) =>
      coincideTexto(qBusqueda, m.insumo, m.documento, m.nota, m.origen, m.destino),
    );
    const tipoPedido = query.tipo && query.tipo !== 'Todos' ? query.tipo.toUpperCase() : null;
    const grupoPedido = tipoPedido
      ? ({ ENTRADA: 'entradas', ENTRADAS: 'entradas', SALIDA: 'salidas', SALIDAS: 'salidas', MERMA: 'mermas', MERMAS: 'mermas', DEVOLUCION: 'devoluciones', DEVOLUCIONES: 'devoluciones' } as Record<string, string>)[tipoPedido]
      : undefined;
    const delTipo = !tipoPedido
      ? coinciden
      : coinciden.filter((m) => (grupoPedido ? grupoDe(m.tipoRaw) === grupoPedido : m.tipoRaw === tipoPedido));
    return {
      conteos: contar(coinciden.map((m) => m.tipoRaw)),
      movimientos: delTipo.slice((pagina - 1) * limite, pagina * limite),
      total: delTipo.length,
      pagina,
      limite,
    };
  }

  // ==========================================
  // REGISTRAR MOVIMIENTO MANUAL
  // ==========================================
  async registrarMovimiento(
    dto: MovimientoAlmacenDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    if (dto.tipo === 'ENTRADA') {
      throw new ConflictException({
        codigo: 'INGRESO_SOLO_COMPRAS',
        mensaje: 'Los ingresos se registran en Compras',
      });
    }

    const insumoId = this.parsearId(dto.insumoId, 'insumo');
    const insumo = await this.prisma.insumo.findUnique({
      where: { id: insumoId },
    });

    if (!insumo) {
      throw new NotFoundException({
        codigo: 'INSUMO_NO_ENCONTRADO',
        mensaje: 'El insumo no existe',
      });
    }

    const origenLugar = await this.obtenerLugarPorNombre(dto.origen);
    const destinoLugar = dto.destino
      ? await this.obtenerLugarPorNombre(dto.destino)
      : null;

    const cantidadDecimal = new Prisma.Decimal(dto.cantidad);
    const cantidadNum = Number(dto.cantidad);

    const esMermaReparto =
      dto.tipo === 'MERMA' &&
      (Boolean(dto.origen?.toLowerCase().includes('reparto')) ||
       Boolean(dto.motivo?.toLowerCase().includes('reparto')) ||
       Boolean(dto.nota?.toLowerCase().includes('reparto')));

    if (['SALIDA', 'MERMA', 'DEVOLUCION'].includes(dto.tipo) && !esMermaReparto) {
      const stockExistente = await this.prisma.stock.findFirst({
        where: { insumo_id: insumoId, lugar_id: origenLugar.id },
      });
      const stockDisponible = stockExistente ? Number(stockExistente.cantidad) : 0;

      if (cantidadNum > stockDisponible) {
        throw new BadRequestException({
          codigo: 'STOCK_INSUFICIENTE',
          mensaje: `Solo hay ${stockDisponible} ${insumo.unidad_almacen} de ${insumo.nombre} en ${origenLugar.nombre}.`,
        });
      }
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      if (esMermaReparto) {
        // FT-DEL-03 / RN-CAP-126 / RQ-ALM-03-11:
        // Merma en reparto es PURAMENTE INFORMATIVA, NO descuenta stock (ya se descontó al salir/cocinarse)
        const notaFinal = `Merma informativa en reparto (${dto.motivo || 'Reparto'})${dto.nota ? ` · ${dto.nota}` : ''}`;
        const mov = await tx.movimientoStock.create({
          data: {
            tipo: 'MERMA',
            insumo_id: insumoId,
            lugar_id: origenLugar.id,
            cantidad: new Prisma.Decimal(0),
            nota: notaFinal,
            por: usuario ? usuario.partyId : BigInt(1),
          },
        });
        return { mov };
      }
      if (
        dto.tipo === 'SALIDA' &&
        destinoLugar &&
        destinoLugar.id !== origenLugar.id
      ) {
        await tx.stock.updateMany({
          where: { insumo_id: insumoId, lugar_id: origenLugar.id },
          data: { cantidad: { decrement: cantidadDecimal } },
        });

        const traslado = await tx.traslado.create({
          data: {
            insumo_id: insumoId,
            destino_lugar_id: destinoLugar.id,
            enviado: cantidadDecimal,
            estado: 'POR_RECIBIR',
            enviado_por: usuario ? usuario.partyId : BigInt(1),
            nota: dto.nota || null,
          },
        });

        const movSalida = await tx.movimientoStock.create({
          data: {
            tipo: 'TRASLADO_SALIDA',
            insumo_id: insumoId,
            lugar_id: origenLugar.id,
            cantidad: cantidadDecimal.negated(),
            traslado_id: traslado.id,
            nota: `Traslado a ${destinoLugar.nombre} · TR-${traslado.id.toString()}`,
            por: usuario ? usuario.partyId : BigInt(1),
          },
        });

        return { mov: movSalida, trasladoId: traslado.id.toString() };
      }

      let delta = cantidadDecimal;
      if (dto.tipo === 'SALIDA' || dto.tipo === 'MERMA') {
        delta = cantidadDecimal.negated();
      }

      const stockActual = await tx.stock.findFirst({
        where: { insumo_id: insumoId, lugar_id: origenLugar.id },
      });

      if (stockActual) {
        await tx.stock.update({
          where: { id: stockActual.id },
          data: { cantidad: { increment: delta } },
        });
      } else {
        await tx.stock.create({
          data: {
            insumo_id: insumoId,
            lugar_id: origenLugar.id,
            cantidad: delta,
          },
        });
      }

      let notaFinal = dto.nota || '';
      if (dto.tipo === 'MERMA' && dto.motivo) {
        notaFinal = `Merma (${dto.motivo})${dto.nota ? ` · ${dto.nota}` : ''}`;
      } else if (dto.destino) {
        notaFinal = `Destino: ${dto.destino}${dto.nota ? ` · ${dto.nota}` : ''}`;
      }

      const mov = await tx.movimientoStock.create({
        data: {
          tipo: dto.tipo,
          insumo_id: insumoId,
          lugar_id: origenLugar.id,
          cantidad: delta,
          nota: notaFinal || null,
          por: usuario ? usuario.partyId : BigInt(1),
        },
      });

      return { mov };
    });

    if (usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'almacen',
        accion: 'REGISTRAR_MOVIMIENTO_ALMACEN',
        entidad: 'movimiento_stock',
        entidadId: resultado.mov.id,
        partyId: usuario.partyId,
        despues: { tipo: dto.tipo, insumo: insumo.nombre, cantidad: dto.cantidad },
        ip,
      });
    }

    this.eventosGateway?.emitirAdmin('stock:cambio', {
      insumoId: insumoId.toString(),
      lugarId: origenLugar.id.toString(),
    });

    if ((dto.tipo as string) === 'ENTRADA' && typeof this.stockService?.verificarYReactivarAgotados === 'function') {
      await this.stockService.verificarYReactivarAgotados([insumoId]);
    }

    return {
      ok: true,
      id: resultado.mov.id.toString(),
      tipo: dto.tipo,
      trasladoId: resultado.trasladoId || undefined,
    };
  }

  // ==========================================
  // MERMA MÚLTIPLE DE PRODUCTOS/INSUMOS
  // ==========================================
  async mermaMultiple(
    dto: MermaMultipleDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const idsCreados: bigint[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const linea of dto.lineas) {
        const entityId = this.parsearId(linea.insumoId, 'insumo o producto');
        const origenLugar = await this.obtenerLugarPorNombre(linea.origen);
        const cantDecimal = new Prisma.Decimal(linea.cantidad);
        const cantNum = Number(linea.cantidad);

        // Buscar primero como Insumo, luego como Producto
        const insumo = await tx.insumo.findUnique({ where: { id: entityId } });
        let producto = null;
        if (!insumo) {
          producto = await tx.producto.findUnique({ where: { id: entityId } });
        }

        if (!insumo && !producto) {
          throw new NotFoundException({
            codigo: 'ITEM_NO_ENCONTRADO',
            mensaje: `El insumo o producto con ID ${entityId.toString()} no existe`,
          });
        }

        const nombre = insumo ? insumo.nombre : producto!.nombre;
        const unidad = insumo ? insumo.unidad_almacen : 'unidades';

        // Producto por sabor: la merma sale del saldo de ese sabor
        let saborMerma: { id: bigint; nombre: string } | null = null;
        if (producto) {
          const saboresActivos = await tx.sabor.findMany({
            where: { producto_id: producto.id, activo: true },
            select: { id: true, nombre: true, activo: true },
          });
          const porSabor = controlaPorSabor({ controla_stock: producto.controla_stock, sabores: saboresActivos });
          if (porSabor) {
            if (linea.saborId === undefined || linea.saborId === null || linea.saborId === '') {
              throw new BadRequestException({
                codigo: 'SABOR_REQUERIDO',
                mensaje: `${nombre} lleva stock por sabor: indica el sabor de la merma`,
              });
            }
            const saborId = this.parsearId(linea.saborId, 'sabor');
            saborMerma = saboresActivos.find((sb) => sb.id === saborId) ?? null;
            if (!saborMerma) {
              throw new BadRequestException({
                codigo: 'SABORES_INVALIDOS',
                mensaje: `El sabor no pertenece a ${nombre} o no está activo`,
              });
            }
          } else if (linea.saborId !== undefined && linea.saborId !== null && linea.saborId !== '') {
            throw new BadRequestException({
              codigo: 'PRODUCTO_SIN_SABORES',
              mensaje: `${nombre} no lleva stock por sabor`,
            });
          }
        }

        const esMermaReparto =
          Boolean(linea.origen?.toLowerCase().includes('reparto')) ||
          Boolean(linea.destino?.toLowerCase().includes('reparto'));

        // La merma de un producto (no insumo) solo se registra en Apertura del día (la de reparto es informativa y sigue igual)
        if (producto && !esMermaReparto) throw this.mermaProductoEnApertura(nombre);

        if (saborMerma && !esMermaReparto) {
          const saldo = await saldoSabor(tx, saborMerma.id);
          if (cantNum > saldo) {
            throw new BadRequestException({
              codigo: 'STOCK_INSUFICIENTE',
              mensaje: `Solo hay ${saldo} de ${saborMerma.nombre} (${nombre}).`,
            });
          }
          await tx.stockSabor.update({
            where: { sabor_id: saborMerma.id },
            data: { cantidad: { decrement: cantDecimal } },
          });
        } else if (!esMermaReparto) {
          // Buscar stock actual en el origen
          const stock = insumo
            ? await tx.stock.findFirst({
                where: { insumo_id: entityId, lugar_id: origenLugar.id },
              })
            : await tx.stock.findFirst({
                where: { producto_id: entityId, lugar_id: origenLugar.id },
              });

          const stockDisponible = stock ? Number(stock.cantidad) : 0;
          if (cantNum > stockDisponible) {
            throw new BadRequestException({
              codigo: 'STOCK_INSUFICIENTE',
              mensaje: `Solo hay ${stockDisponible} ${unidad} de ${nombre} en ${origenLugar.nombre}.`,
            });
          }

          if (stock) {
            // Descontar atómicamente del stock
            await tx.stock.update({
              where: { id: stock.id },
              data: { cantidad: { decrement: cantDecimal } },
            });
          }
        }

        const mov = await tx.movimientoStock.create({
          data: {
            tipo: 'MERMA',
            insumo_id: insumo ? entityId : null,
            producto_id: producto ? entityId : null,
            sabor_id: saborMerma?.id ?? null,
            lugar_id: origenLugar.id,
            cantidad: esMermaReparto ? new Prisma.Decimal(0) : cantDecimal.negated(),
            nota: esMermaReparto
              ? `Merma informativa en reparto (${linea.destino || 'Reparto'})`
              : `Merma múltiple (${linea.destino || 'Desecho'})`,
            por: usuario ? usuario.partyId : BigInt(1),
          },
        });

        idsCreados.push(mov.id);
      }
    });

    if (usuario && idsCreados.length > 0) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'almacen',
        accion: 'REGISTRAR_MERMA_MULTIPLE',
        entidad: 'movimiento_stock',
        entidadId: idsCreados[0],
        partyId: usuario.partyId,
        despues: { cantidadLineas: dto.lineas.length },
        ip,
      });
    }

    this.eventosGateway?.emitirAdmin('stock:cambio', {});

    return { ok: true, lineasMermadas: idsCreados.length };
  }

  // ==========================================
  // ANULAR MOVIMIENTO
  // ==========================================
  async anularMovimiento(
    id: string | number | bigint,
    motivo: string,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const movId = this.parsearId(id, 'movimiento_stock');
    const movOriginal = await this.prisma.movimientoStock.findUnique({
      where: { id: movId },
    });

    if (!movOriginal) {
      throw new NotFoundException({
        codigo: 'MOVIMIENTO_NO_ENCONTRADO',
        mensaje: 'El movimiento no existe',
      });
    }

    if (movOriginal.tipo === 'ANULACION' || movOriginal.tipo === 'VENTA' || movOriginal.tipo === 'CORTESIA') {
      throw new BadRequestException({
        codigo: 'MOVIMIENTO_AUTOMATICO_NO_ANULABLE',
        mensaje: 'Los movimientos generados automáticamente por cobro o anulación no se pueden anular manualmente',
      });
    }

    const movYaAnulado = await this.prisma.movimientoStock.findFirst({
      where: { movimiento_anulado_id: movId },
    });
    if (movYaAnulado) {
      throw new BadRequestException({
        codigo: 'MOVIMIENTO_YA_ANULADO',
        mensaje: 'Este movimiento ya fue anulado anteriormente',
      });
    }

    const deltaInverso = new Prisma.Decimal(movOriginal.cantidad).negated();

    const resultado = await this.prisma.$transaction(async (tx) => {
      // Dos anulaciones a la vez del mismo movimiento se turnan: la segunda ya ve la anulación de la primera
      if (typeof tx.$queryRaw === 'function') await tx.$queryRaw`SELECT id FROM movimiento_stock WHERE id = ${movId} FOR UPDATE`;
      if (await tx.movimientoStock.findFirst({ where: { movimiento_anulado_id: movId }, select: { id: true } })) {
        throw new BadRequestException({
          codigo: 'MOVIMIENTO_YA_ANULADO',
          mensaje: 'Este movimiento ya fue anulado anteriormente',
        });
      }
      if (movOriginal.insumo_id) {
        await tx.stock.updateMany({
          where: {
            insumo_id: movOriginal.insumo_id,
            lugar_id: movOriginal.lugar_id,
          },
          data: { cantidad: { increment: deltaInverso } },
        });
      } else if (movOriginal.sabor_id) {
        // Merma o producción de un sabor: el saldo vive en el sabor, no en la fila de stock del producto
        await tx.stockSabor.upsert({
          where: { sabor_id: movOriginal.sabor_id },
          update: { cantidad: { increment: deltaInverso } },
          create: { sabor_id: movOriginal.sabor_id, cantidad: deltaInverso },
        });
      } else if (movOriginal.producto_id) {
        await tx.stock.updateMany({
          where: {
            producto_id: movOriginal.producto_id,
            lugar_id: movOriginal.lugar_id,
          },
          data: { cantidad: { increment: deltaInverso } },
        });
      }

      const movAnulacion = await tx.movimientoStock.create({
        data: {
          tipo: 'ANULACION',
          insumo_id: movOriginal.insumo_id,
          producto_id: movOriginal.producto_id,
          sabor_id: movOriginal.sabor_id,
          lugar_id: movOriginal.lugar_id,
          cantidad: deltaInverso,
          movimiento_anulado_id: movId,
          nota: `Anulación: ${motivo}`,
          por: usuario ? usuario.partyId : BigInt(1),
        },
      });

      return movAnulacion;
    });

    if (usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'almacen',
        accion: 'ANULAR_MOVIMIENTO_ALMACEN',
        entidad: 'movimiento_stock',
        entidadId: resultado.id,
        partyId: usuario.partyId,
        despues: { motivo, movimientoAnuladoId: movId.toString() },
        ip,
      });
    }

    this.eventosGateway?.emitirAdmin('stock:cambio', {
      insumoId: movOriginal.insumo_id?.toString(),
      productoId: movOriginal.producto_id?.toString(),
      lugarId: movOriginal.lugar_id.toString(),
    });

    if (movOriginal.sabor_id && deltaInverso.greaterThan(0)) {
      const saldo = await saldoSabor(this.prisma, movOriginal.sabor_id);
      if (saldo > 0) await sincronizarAgotadoSabor(this.prisma, movOriginal.sabor_id, saldo, new Date(), usuario ? usuario.partyId : BigInt(1));
    }

    if (deltaInverso.greaterThan(0) && typeof this.stockService?.verificarYReactivarAgotados === 'function') {
      await this.stockService.verificarYReactivarAgotados(
        movOriginal.insumo_id ? [movOriginal.insumo_id] : [],
        movOriginal.producto_id ? [movOriginal.producto_id] : [],
      );
    }

    return { ok: true, id: resultado.id.toString() };
  }

  // ==========================================
  // PRODUCCIÓN DEL DÍA POR TANDA
  // ==========================================
  async listarRecetasProduccion() {
    const recetas = await this.prisma.receta.findMany({
      where: { es_produccion: true, sabor_id: null },
      include: {
        producto: true,
        lineas: {
          include: { insumo: true },
        },
      },
    });

    const cocinaLugar = await this.obtenerLugarPorNombre('Salados');
    const almacenLugar = await this.obtenerLugarPorNombre('Almacén central');

    const resultado: any[] = [];

    for (const rec of recetas) {
      const insumosDetalle: any[] = [];
      let tandasMax = 99999;

      for (const lin of rec.lineas) {
        const ins = lin.insumo;
        const stockCocina = await this.prisma.stock.findFirst({
          where: { insumo_id: ins.id, lugar_id: cocinaLugar.id },
        });
        const stockAlm = await this.prisma.stock.findFirst({
          where: { insumo_id: ins.id, lugar_id: almacenLugar.id },
        });

        const cantCocina = stockCocina ? Number(stockCocina.cantidad) : 0;
        const cantAlm = stockAlm ? Number(stockAlm.cantidad) : 0;
        const cantTotal = cantCocina + cantAlm;

        const necPorTanda = Number(lin.cantidad);
        const tandasParaInsumo = necPorTanda > 0 ? cantTotal / necPorTanda : 999;
        if (tandasParaInsumo < tandasMax) {
          tandasMax = tandasParaInsumo;
        }

        insumosDetalle.push({
          insumoId: ins.id.toString(),
          nombre: ins.nombre,
          unidad: ins.unidad_almacen,
          porTanda: necPorTanda,
          cantidadPorTanda: necPorTanda,
          stockCocina: cantCocina,
          stockAlmacen: cantAlm,
          stockTotal: cantTotal,
        });
      }

      const yieldUnidades = Number(rec.rinde || 24);

      resultado.push({
        id: rec.id.toString(),
        nombre: rec.producto.nombre,
        productoNombre: rec.producto.nombre,
        productoId: rec.producto_id.toString(),
        tandaBase: yieldUnidades,
        rindePorTanda: yieldUnidades,
        tandasMaximas: Math.floor(tandasMax * 10) / 10,
        insumos: insumosDetalle,
      });
    }

    return resultado;
  }

  async registrarProduccion(
    dto: ProduccionTandasDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const recetaId = this.parsearId(dto.recetaId, 'receta');
    const receta = await this.prisma.receta.findUnique({
      where: { id: recetaId },
      include: {
        producto: { include: { sabores: { where: { activo: true } } } },
        lineas: { include: { insumo: true } },
      },
    });

    if (!receta) {
      throw new NotFoundException({
        codigo: 'RECETA_NO_ENCONTRADA',
        mensaje: 'La receta no existe',
      });
    }

    // Producto por sabor: la producción va al saldo de ese sabor (obligatorio indicarlo)
    const porSabor = controlaPorSabor(receta.producto);
    let saborProduccion: { id: bigint; nombre: string } | null = null;
    if (porSabor) {
      if (dto.saborId === undefined || dto.saborId === null || dto.saborId === '') {
        throw new BadRequestException({
          codigo: 'SABOR_REQUERIDO',
          mensaje: `${receta.producto.nombre} lleva stock por sabor: indica el sabor que se produce`,
        });
      }
      const saborId = this.parsearId(dto.saborId, 'sabor');
      saborProduccion = receta.producto.sabores.find((sb) => sb.id === saborId) ?? null;
      if (!saborProduccion) {
        throw new BadRequestException({
          codigo: 'SABORES_INVALIDOS',
          mensaje: `El sabor no pertenece a ${receta.producto.nombre} o no está activo`,
        });
      }
    } else if (dto.saborId !== undefined && dto.saborId !== null && dto.saborId !== '') {
      throw new BadRequestException({
        codigo: 'PRODUCTO_SIN_SABORES',
        mensaje: `${receta.producto.nombre} no lleva stock por sabor`,
      });
    }

    // Control de almacén encendido: se descuenta de Cocina con conversión de unidades y merma del insumo; si el sabor tiene su
    // propia receta se usa esa (si no, la general); si Cocina no alcanza la tanda sigue (stock negativo + pendiente de emitir)
    // salvo que «permitir cocina negativa» esté en «no». Apagado: flujo de siempre, sin tocar nada nuevo.
    const modoAlmacen = this.consumo ? await this.consumo.modoTanda() : null;
    const recetaEf = modoAlmacen ? await this.consumo!.recetaDeTanda(receta, saborProduccion?.id ?? null) : receta;

    const rinde = Number(recetaEf.rinde) > 0 ? Number(recetaEf.rinde) : 1;
    let yieldTotal: number;
    let tandasCalculadas: number;

    if (dto.unidadesObtenidas !== undefined && dto.unidadesObtenidas !== null) {
      yieldTotal = Number(dto.unidadesObtenidas);
      tandasCalculadas = dto.tandas !== undefined && dto.tandas !== null
        ? Number(dto.tandas)
        : yieldTotal / rinde;
    } else if (dto.tandas !== undefined && dto.tandas !== null) {
      tandasCalculadas = Number(dto.tandas);
      yieldTotal = dto.unidadesReales !== undefined
        ? Number(dto.unidadesReales)
        : Math.round(rinde * tandasCalculadas);
    } else {
      yieldTotal = rinde;
      tandasCalculadas = 1;
    }

    const cocinaLugar = await this.obtenerLugarPorNombre('Salados');

    if (modoAlmacen) {
      if (!modoAlmacen.permitirNegativa) {
        const f = await this.consumo!.faltantesTanda(recetaEf, yieldTotal);
        if (f.length > 0) {
          throw new BadRequestException({
            codigo: 'STOCK_MATERIA_PRIMA_INSUFICIENTE',
            mensaje: `No alcanza el stock en Cocina: faltan ${f.map((x) => `${x.insumo} (requiere ${x.requiere.toFixed(2)} ${x.unidad}, en Cocina hay ${x.hay.toFixed(2)})`).join(', ')}. Pide insumos al almacén primero.`,
          });
        }
      }
    } else {
    const faltantes: string[] = [];

    // Se descuenta exclusivamente de Cocina
    for (const lin of receta.lineas) {
      const ins = lin.insumo;
      const necPorTanda = Number(lin.cantidad);
      const necTotal = (yieldTotal / rinde) * necPorTanda;

      const stockCocina = await this.prisma.stock.findFirst({
        where: { insumo_id: ins.id, lugar_id: cocinaLugar.id },
      });

      const cantCocina = stockCocina ? Number(stockCocina.cantidad) : 0;

      if (cantCocina < necTotal) {
        faltantes.push(`${ins.nombre} (requiere ${necTotal.toFixed(2)} ${ins.unidad_almacen}, en Cocina hay ${cantCocina.toFixed(2)})`);
      }
    }

    if (faltantes.length > 0) {
      throw new BadRequestException({
        codigo: 'STOCK_MATERIA_PRIMA_INSUFICIENTE',
        mensaje: `No alcanza el stock en Cocina: faltan ${faltantes.join(', ')}. Pide insumos al almacén primero.`,
      });
    }

    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      for (const lin of modoAlmacen ? [] : receta.lineas) {
        const ins = lin.insumo;
        const necPorTanda = Number(lin.cantidad);
        const necTotal = (yieldTotal / rinde) * necPorTanda;
        const necTotalDecimal = new Prisma.Decimal(necTotal);

        await tx.stock.updateMany({
          where: { insumo_id: ins.id, lugar_id: cocinaLugar.id },
          data: { cantidad: { decrement: necTotalDecimal } },
        });

        await tx.movimientoStock.create({
          data: {
            tipo: 'PRODUCCION_CONSUMO',
            insumo_id: ins.id,
            lugar_id: cocinaLugar.id,
            cantidad: necTotalDecimal.negated(),
            nota: `Producción de ${receta.producto.nombre} (${yieldTotal} unidades)`,
            por: usuario ? usuario.partyId : BigInt(1),
          },
        });
      }

      const prod = await tx.produccion.create({
        data: {
          receta_id: recetaId,
          tandas: new Prisma.Decimal(tandasCalculadas),
          unidades: new Prisma.Decimal(yieldTotal),
          por: usuario ? usuario.partyId : BigInt(1),
        },
      });

      if (modoAlmacen) await this.consumo!.consumirTanda(tx, recetaEf, yieldTotal, prod.id, usuario ? usuario.partyId : BigInt(1));

      if (saborProduccion) {
        await tx.stockSabor.upsert({
          where: { sabor_id: saborProduccion.id },
          update: { cantidad: { increment: new Prisma.Decimal(yieldTotal) } },
          create: { sabor_id: saborProduccion.id, cantidad: new Prisma.Decimal(yieldTotal) },
        });
        await tx.movimientoStock.create({
          data: {
            tipo: 'PRODUCCION_ALTA',
            producto_id: receta.producto_id,
            sabor_id: saborProduccion.id,
            lugar_id: cocinaLugar.id,
            cantidad: new Prisma.Decimal(yieldTotal),
            produccion_id: prod.id,
            nota: `Producción del día · PRD-${prod.id.toString()} · ${saborProduccion.nombre} (${yieldTotal} unidades)`,
            por: usuario ? usuario.partyId : BigInt(1),
          },
        });
        await sincronizarAgotadoSabor(tx, saborProduccion.id, await saldoSabor(tx, saborProduccion.id), new Date(), usuario ? usuario.partyId : BigInt(1));
        return prod;
      }

      const stockProd = await tx.stock.findFirst({
        where: { producto_id: receta.producto_id, lugar_id: cocinaLugar.id },
      });

      if (stockProd) {
        await tx.stock.update({
          where: { id: stockProd.id },
          data: { cantidad: { increment: new Prisma.Decimal(yieldTotal) } },
        });
      } else {
        await tx.stock.create({
          data: {
            producto_id: receta.producto_id,
            lugar_id: cocinaLugar.id,
            cantidad: new Prisma.Decimal(yieldTotal),
          },
        });
      }

      await tx.movimientoStock.create({
        data: {
          tipo: 'PRODUCCION_ALTA',
          producto_id: receta.producto_id,
          lugar_id: cocinaLugar.id,
          cantidad: new Prisma.Decimal(yieldTotal),
          produccion_id: prod.id,
          nota: `Producción del día · PRD-${prod.id.toString()} (${yieldTotal} unidades)`,
          por: usuario ? usuario.partyId : BigInt(1),
        },
      });

      return prod;
    });

    if (usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'almacen',
        accion: 'REGISTRAR_PRODUCCION',
        entidad: 'produccion',
        entidadId: resultado.id,
        partyId: usuario.partyId,
        despues: { tandas: dto.tandas, unidades: yieldTotal },
        ip,
      });
    }

    this.eventosGateway?.emitirAdmin('stock:cambio', {});

    if (typeof this.stockService?.verificarYReactivarAgotados === 'function') {
      await this.stockService.verificarYReactivarAgotados([], [receta.producto_id]);
    }

    return {
      id: resultado.id.toString(),
      tandas: dto.tandas,
      unidades: yieldTotal,
      documento: `PRD-${resultado.id.toString()}`,
    };
  }

  async anularProduccion(
    id: string | number | bigint,
    motivo: string,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const prodId = this.parsearId(id, 'produccion');
    const prod = await this.prisma.produccion.findUnique({
      where: { id: prodId },
      include: {
        receta: {
          include: {
            producto: true,
            lineas: { include: { insumo: true } },
          },
        },
      },
    });

    if (!prod) {
      throw new NotFoundException({
        codigo: 'PRODUCCION_NO_ENCONTRADA',
        mensaje: 'La producción no existe',
      });
    }

    if (prod.anulado_en) {
      throw new BadRequestException({
        codigo: 'PRODUCCION_YA_ANULADA',
        mensaje: 'Esta producción ya fue anulada',
      });
    }

    const cocinaLugar = await this.obtenerLugarPorNombre('Salados');

    await this.prisma.$transaction(async (tx) => {
      // Marca atómica: dos anulaciones a la vez no devuelven los insumos dos veces
      const marcada = await tx.produccion.updateMany({
        where: { id: prodId, anulado_en: null },
        data: { anulado_en: new Date(), motivo_anulacion: motivo },
      });
      if (marcada.count === 0) {
        throw new BadRequestException({ codigo: 'PRODUCCION_YA_ANULADA', mensaje: 'Esta producción ya fue anulada' });
      }

      // Si la producción fue de un sabor, se quita de ese sabor (lo que dejó la alta en el movimiento)
      const altaSabor = await tx.movimientoStock.findFirst({
        where: { produccion_id: prodId, tipo: 'PRODUCCION_ALTA', sabor_id: { not: null } },
        select: { sabor_id: true },
      });
      if (altaSabor?.sabor_id) {
        await tx.stockSabor.updateMany({
          where: { sabor_id: altaSabor.sabor_id },
          data: { cantidad: { decrement: prod.unidades } },
        });
      } else {
        await tx.stock.updateMany({
          where: { producto_id: prod.receta.producto_id, lugar_id: cocinaLugar.id },
          data: { cantidad: { decrement: prod.unidades } },
        });
      }

      await tx.movimientoStock.create({
        data: {
          tipo: 'ANULACION',
          producto_id: prod.receta.producto_id,
          sabor_id: altaSabor?.sabor_id ?? null,
          lugar_id: cocinaLugar.id,
          cantidad: new Prisma.Decimal(-Number(prod.unidades)),
          produccion_id: prodId,
          nota: `Anulación producción: ${motivo}`,
          por: usuario ? usuario.partyId : BigInt(1),
        },
      });

      // Tanda registrada con el control de almacén: se devuelve exactamente lo que descontó (y baja sus pendientes)
      const yaRevertida = this.consumo && (await this.consumo.activo()) ? await this.consumo.revertirTanda(tx, prodId, usuario ? usuario.partyId : BigInt(1)) : false;

      for (const lin of yaRevertida ? [] : prod.receta.lineas) {
        const necPorTanda = Number(lin.cantidad);
        const rinde = Number(prod.receta.rinde) > 0 ? Number(prod.receta.rinde) : 1;
        // Lo mismo que consumió registrarProduccion: (unidades / rinde) × cantidad por tanda. Con «tandas» distintas de
        // unidades/rinde (rendimiento real) devolver tandas × cantidad inflaba el stock de insumos.
        const cantDevolver = (Number(prod.unidades) / rinde) * necPorTanda;

        await tx.stock.updateMany({
          where: { insumo_id: lin.insumo_id, lugar_id: cocinaLugar.id },
          data: { cantidad: { increment: new Prisma.Decimal(cantDevolver) } },
        });

        await tx.movimientoStock.create({
          data: {
            tipo: 'ANULACION',
            insumo_id: lin.insumo_id,
            lugar_id: cocinaLugar.id,
            cantidad: new Prisma.Decimal(cantDevolver),
            nota: `Devolución insumo por anulación PRD-${prodId.toString()}`,
            por: usuario ? usuario.partyId : BigInt(1),
          },
        });
      }
    });

    if (usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'almacen',
        accion: 'ANULAR_PRODUCCION',
        entidad: 'produccion',
        entidadId: prodId,
        partyId: usuario.partyId,
        despues: { motivo },
        ip,
      });
    }

    this.eventosGateway?.emitirAdmin('stock:cambio', {});

    if (typeof this.stockService?.verificarYReactivarAgotados === 'function') {
      const insumosADevolver = prod.receta.lineas.map((l: any) => l.insumo_id);
      await this.stockService.verificarYReactivarAgotados(insumosADevolver, []);
    }

    return { ok: true, id: prodId.toString() };
  }

  // ==========================================
  // CIERRE DEL DÍA CON CONTEO Y MERMA
  // ==========================================
  async obtenerProductosDelDia() {
    // Productos por sabor: su saldo vive en stock_sabor. Se listan con el desglose por sabor (su merma va por registrarMermaProducto).
    const porSabor = await this.prisma.producto.findMany({
      where: { controla_stock: true, oculto: false, sabores: { some: { activo: true } } },
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        sabores: {
          where: { activo: true },
          orderBy: { nombre: 'asc' },
          select: { id: true, nombre: true, stockSabor: { select: { cantidad: true } } },
        },
      },
    });
    const idsPorSabor = new Set(porSabor.map((p) => p.id.toString()));

    const recetas = await this.prisma.receta.findMany({
      where: { es_produccion: true, sabor_id: null },
      include: {
        producto: {
          include: {
            stocks: { include: { lugar: true } },
          },
        },
      },
    });

    const insumosFrescos = await this.prisma.insumo.findMany({
      where: {
        activo: true,
        nombre: { in: ['Donas (producción del día)', 'Donas artesanales', 'Donas del día', 'Pan de molde', 'Galletas'] },
      },
      include: {
        stocks: { include: { lugar: true } },
      },
    });

    const resultado: any[] = [];

    for (const p of porSabor) {
      const sabores = p.sabores.map((sb) => ({
        saborId: sb.id.toString(),
        nombre: sb.nombre,
        sistema: Number(sb.stockSabor?.cantidad ?? 0),
      }));
      resultado.push({
        productoId: p.id.toString(),
        nombre: p.nombre,
        sistema: sabores.reduce((acc, sb) => acc + sb.sistema, 0),
        unidad: 'unidades',
        sabores,
      });
    }

    for (const r of recetas) {
      if (r.producto && !r.producto.oculto && !idsPorSabor.has(r.producto.id.toString())) {
        const stockTotal = r.producto.stocks.reduce(
          (acc, s) => acc + Number(s.cantidad),
          0,
        );
        resultado.push({
          productoId: r.producto.id.toString(),
          nombre: r.producto.nombre,
          sistema: stockTotal,
          unidad: 'unidades',
        });
      }
    }

    for (const ins of insumosFrescos) {
      if (!resultado.some((x) => x.nombre.toLowerCase() === ins.nombre.toLowerCase())) {
        const stockTotal = ins.stocks.reduce(
          (acc, s) => acc + Number(s.cantidad),
          0,
        );
        resultado.push({
          insumoId: ins.id.toString(),
          nombre: ins.nombre,
          sistema: stockTotal,
          unidad: ins.unidad_almacen,
        });
      }
    }

    return resultado;
  }

  async registrarCierreDia(
    dto: CierreDiaDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const hoy = dto.fecha ? new Date(dto.fecha) : new Date();
    const cocinaLugar = await this.obtenerLugarPorNombre('Salados');

    const resultado = await this.prisma.$transaction(async (tx) => {
      for (const fila of dto.filas) {
        // Producto por sabor: no se cierra por fila (su saldo está por sabor); se botan sabores con registrarMermaProducto
        if (fila.productoId && (await tx.sabor.count({ where: { producto_id: this.parsearId(fila.productoId, 'producto'), activo: true } })) > 0) {
          continue;
        }
        const cont = Number(fila.contado);
        const bot = Number(fila.botar);
        const sis = Number(fila.sistema);
        const dif = Math.max(0, sis - cont);

        if (bot > 0) {
          if (fila.insumoId) {
            const insId = this.parsearId(fila.insumoId, 'insumo');
            await tx.stock.updateMany({
              where: { insumo_id: insId, lugar_id: cocinaLugar.id },
              data: { cantidad: { decrement: new Prisma.Decimal(bot) } },
            });
            await tx.movimientoStock.create({
              data: {
                tipo: 'MERMA',
                insumo_id: insId,
                lugar_id: cocinaLugar.id,
                cantidad: new Prisma.Decimal(-bot),
                nota: `Cierre del día · Merma (${fila.destino})`,
                por: usuario ? usuario.partyId : BigInt(1),
              },
            });
          } else if (fila.productoId) {
            const prodId = this.parsearId(fila.productoId, 'producto');
            const pc = await tx.producto.findUnique({ where: { id: prodId }, select: { nombre: true, controla_stock: true } });
            if (pc?.controla_stock) throw this.mermaProductoEnApertura(pc.nombre);
            await tx.stock.updateMany({
              where: { producto_id: prodId, lugar_id: cocinaLugar.id },
              data: { cantidad: { decrement: new Prisma.Decimal(bot) } },
            });
            await tx.movimientoStock.create({
              data: {
                tipo: 'MERMA',
                producto_id: prodId,
                lugar_id: cocinaLugar.id,
                cantidad: new Prisma.Decimal(-bot),
                nota: `Cierre del día · Merma (${fila.destino})`,
                por: usuario ? usuario.partyId : BigInt(1),
              },
            });
          }
        }

        if (dif > 0) {
          if (fila.insumoId) {
            const insId = this.parsearId(fila.insumoId, 'insumo');
            await tx.stock.updateMany({
              where: { insumo_id: insId, lugar_id: cocinaLugar.id },
              data: { cantidad: { decrement: new Prisma.Decimal(dif) } },
            });
            await tx.movimientoStock.create({
              data: {
                tipo: 'DIFERENCIA_CONTEO',
                insumo_id: insId,
                lugar_id: cocinaLugar.id,
                cantidad: new Prisma.Decimal(-dif),
                nota: `Cierre del día · Diferencia de conteo`,
                por: usuario ? usuario.partyId : BigInt(1),
              },
            });
          } else if (fila.productoId) {
            const prodId = this.parsearId(fila.productoId, 'producto');
            await tx.stock.updateMany({
              where: { producto_id: prodId, lugar_id: cocinaLugar.id },
              data: { cantidad: { decrement: new Prisma.Decimal(dif) } },
            });
            await tx.movimientoStock.create({
              data: {
                tipo: 'DIFERENCIA_CONTEO',
                producto_id: prodId,
                lugar_id: cocinaLugar.id,
                cantidad: new Prisma.Decimal(-dif),
                nota: `Cierre del día · Diferencia de conteo`,
                por: usuario ? usuario.partyId : BigInt(1),
              },
            });
          }
        }
      }

      const cierre = await tx.cierreDia.upsert({
        where: {
          fecha_lugar_id: {
            fecha: hoy,
            lugar_id: cocinaLugar.id,
          },
        },
        update: {
          detalle: dto.filas as any,
          por: usuario ? usuario.partyId : BigInt(1),
          en: new Date(),
        },
        create: {
          fecha: hoy,
          lugar_id: cocinaLugar.id,
          detalle: dto.filas as any,
          por: usuario ? usuario.partyId : BigInt(1),
        },
      });

      return cierre;
    });

    if (usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'almacen',
        accion: 'REGISTRAR_CIERRE_DIA',
        entidad: 'cierre_dia',
        entidadId: resultado.id,
        partyId: usuario.partyId,
        despues: { filas: dto.filas.length },
        ip,
      });
    }

    this.eventosGateway?.emitirAdmin('stock:cambio', {});

    return { ok: true, id: resultado.id.toString() };
  }

  // ==========================================
  // PEDIDOS INTERNOS Y TRASLADOS
  // ==========================================
  async listarPedidosInternos() {
    const pedidos = await this.prisma.pedidoInterno.findMany({
      include: {
        area: true,
      },
      orderBy: { en: 'desc' },
    });

    return pedidos.map((p) => ({
      id: p.id.toString(),
      area: p.area?.nombre || 'Salados',
      detalle: p.detalle,
      estado: p.estado,
      en: p.en,
    }));
  }

  async crearPedidoInterno(
    dto: CrearPedidoInternoDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    let areaId: bigint | null = null;

    if (dto.areaId) {
      areaId = this.parsearId(dto.areaId, 'area');
    } else if (dto.area && dto.area.trim().length > 0) {
      const area = await this.prisma.areaCocina.findFirst({
        where: { nombre: { equals: dto.area.trim(), mode: 'insensitive' } },
      });
      if (area) {
        areaId = area.id;
      }
    }

    if (!areaId) {
      const defaultArea = await this.prisma.areaCocina.findFirst({
        where: { activo: true },
        orderBy: { id: 'asc' },
      });
      areaId = defaultArea?.id ?? BigInt(1);
    }

    const areaRecord = await this.prisma.areaCocina.findUnique({
      where: { id: areaId },
    });
    const areaNombre = areaRecord?.nombre || 'Salados';

    const pedido = await this.prisma.pedidoInterno.create({
      data: {
        area_id: areaId,
        detalle: {
          items: dto.items as any,
          nota: dto.nota || null,
        } as unknown as Prisma.InputJsonValue,
        estado: 'PENDIENTE',
        por: usuario ? usuario.partyId : BigInt(1),
        en: new Date(),
      },
    });

    if (usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'almacen',
        accion: 'CREAR_PEDIDO_INTERNO',
        resultado: 'OK',
        entidad: 'pedido_interno',
        entidadId: pedido.id,
        partyId: usuario.partyId,
        despues: {
          areaId: areaId.toString(),
          itemsCount: dto.items.length,
          nota: dto.nota,
        },
        ip,
      });
    }

    this.eventosGateway?.emitirAdmin('almacen:pedido_interno', {
      id: pedido.id.toString(),
      area: areaNombre,
      estado: 'PENDIENTE',
    });

    return {
      ok: true,
      id: pedido.id.toString(),
      estado: pedido.estado,
      area: areaNombre,
    };
  }

  async entregarPedidoInterno(
    id: string | number | bigint,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const pedId = this.parsearId(id, 'pedido_interno');
    const ped = await this.prisma.pedidoInterno.findUnique({
      where: { id: pedId },
      include: { area: true },
    });

    if (!ped) {
      throw new NotFoundException({
        codigo: 'PEDIDO_INTERNO_NO_ENCONTRADO',
        mensaje: 'El pedido interno no existe',
      });
    }

    if (ped.estado === 'ENTREGADO') {
      throw new ConflictException({
        codigo: 'PEDIDO_INTERNO_YA_ENTREGADO',
        mensaje: 'El pedido interno ya fue entregado',
      });
    }

    const almacenLugar = await this.obtenerLugarPorNombre('Almacén central');
    const destinoLugar = await this.obtenerLugarPorNombre(ped.area?.nombre || 'Salados');
    const ahora = new Date();

    const detalleObj: any = ped.detalle;
    const items: any[] = Array.isArray(detalleObj)
      ? detalleObj
      : Array.isArray(detalleObj?.items)
      ? detalleObj.items
      : [];

    const trasladosCreados: bigint[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const cantNum = Number(item.cantidad);
        if (isNaN(cantNum) || cantNum <= 0) continue;
        const cantDecimal = new Prisma.Decimal(cantNum);

        let insumo = null;
        if (item.insumoId) {
          try {
            insumo = await tx.insumo.findUnique({
              where: { id: BigInt(item.insumoId) },
            });
          } catch { /* busqueda de insumo opcional; si falla se sigue sin el dato */ }
        }
        if (!insumo && item.insumo) {
          insumo = await tx.insumo.findFirst({
            where: {
              nombre: { equals: item.insumo.trim(), mode: 'insensitive' },
            },
          });
        }

        if (insumo) {
          // Descontar stock central
          const stockCentral = await tx.stock.findFirst({
            where: { insumo_id: insumo.id, lugar_id: almacenLugar.id },
          });

          if (stockCentral) {
            await tx.stock.update({
              where: { id: stockCentral.id },
              data: { cantidad: { decrement: cantDecimal } },
            });
          } else {
            await tx.stock.create({
              data: {
                insumo_id: insumo.id,
                lugar_id: almacenLugar.id,
                cantidad: cantDecimal.negated(),
              },
            });
          }

          // Movimiento de salida de almacén central
          await tx.movimientoStock.create({
            data: {
              tipo: 'TRASLADO_SALIDA',
              insumo_id: insumo.id,
              lugar_id: almacenLugar.id,
              cantidad: cantDecimal.negated(),
              nota: `Entrega de pedido interno #${pedId.toString()} para ${destinoLugar.nombre}`,
              por: usuario ? usuario.partyId : BigInt(1),
            },
          });

          // Crear traslado por recibir hacia el área
          const traslado = await tx.traslado.create({
            data: {
              insumo_id: insumo.id,
              destino_lugar_id: destinoLugar.id,
              enviado: cantDecimal,
              estado: 'POR_RECIBIR',
              pedido_interno_id: pedId,
              enviado_por: usuario ? usuario.partyId : BigInt(1),
              enviado_en: ahora,
              nota: `Pedido interno #${pedId.toString()}`,
            },
          });

          trasladosCreados.push(traslado.id);
        }
      }

      await tx.pedidoInterno.update({
        where: { id: pedId },
        data: {
          estado: 'ENTREGADO',
          entregado_por: usuario ? usuario.partyId : BigInt(1),
          entregado_en: ahora,
        },
      });
    });

    if (usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'almacen',
        accion: 'ENTREGAR_PEDIDO_INTERNO',
        resultado: 'OK',
        entidad: 'pedido_interno',
        entidadId: pedId,
        partyId: usuario.partyId,
        despues: { estado: 'ENTREGADO', trasladosCount: trasladosCreados.length },
        ip,
      });
    }

    this.eventosGateway?.emitirAdmin('almacen:pedido_interno', {
      id: pedId.toString(),
      estado: 'ENTREGADO',
    });
    this.eventosGateway?.emitirAdmin('stock:cambio', {});

    return { ok: true, id: pedId.toString(), estado: 'ENTREGADO', traslados: trasladosCreados.length };
  }

  async listarTraslados() {
    const traslados = await this.prisma.traslado.findMany({
      include: {
        insumo: true,
        destinoLugar: true,
      },
      orderBy: { enviado_en: 'desc' },
    });

    return traslados.map((t) => ({
      id: t.id.toString(),
      insumoId: t.insumo_id.toString(),
      insumoNombre: t.insumo.nombre,
      destino: t.destinoLugar.nombre,
      enviado: Number(t.enviado),
      recibido: t.recibido !== null ? Number(t.recibido) : null,
      diferencia: t.diferencia !== null ? Number(t.diferencia) : null,
      estado: t.estado,
      enviadoEn: t.enviado_en,
      recibidoEn: t.recibido_en,
    }));
  }

  async confirmarRecepcionTraslado(
    id: string | number | bigint,
    cantidadRecibida: number,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const trasladoId = this.parsearId(id, 'traslado');
    const traslado = await this.prisma.traslado.findUnique({
      where: { id: trasladoId },
      include: { destinoLugar: true },
    });

    if (!traslado) {
      throw new NotFoundException({
        codigo: 'TRASLADO_NO_ENCONTRADO',
        mensaje: 'El traslado no existe',
      });
    }

    if (traslado.estado === 'RECIBIDO') {
      throw new BadRequestException({
        codigo: 'TRASLADO_YA_RECIBIDO',
        mensaje: 'El traslado ya fue recibido anteriormente',
      });
    }

    const enviadoNum = Number(traslado.enviado);
    const recibidoNum = cantidadRecibida;
    const diferenciaNum = enviadoNum - recibidoNum;

    await this.prisma.$transaction(async (tx) => {
      const stockDestino = await tx.stock.findFirst({
        where: {
          insumo_id: traslado.insumo_id,
          lugar_id: traslado.destino_lugar_id,
        },
      });

      if (stockDestino) {
        await tx.stock.update({
          where: { id: stockDestino.id },
          data: { cantidad: { increment: new Prisma.Decimal(recibidoNum) } },
        });
      } else {
        await tx.stock.create({
          data: {
            insumo_id: traslado.insumo_id,
            lugar_id: traslado.destino_lugar_id,
            cantidad: new Prisma.Decimal(recibidoNum),
          },
        });
      }

      await tx.movimientoStock.create({
        data: {
          tipo: 'TRASLADO_ENTRADA',
          insumo_id: traslado.insumo_id,
          lugar_id: traslado.destino_lugar_id,
          cantidad: new Prisma.Decimal(recibidoNum),
          traslado_id: trasladoId,
          nota: `Recepción traslado TR-${trasladoId.toString()}${diferenciaNum !== 0 ? ` (dif: ${diferenciaNum})` : ''}`,
          por: usuario ? usuario.partyId : BigInt(1),
        },
      });

      await tx.traslado.update({
        where: { id: trasladoId },
        data: {
          estado: 'RECIBIDO',
          recibido: new Prisma.Decimal(recibidoNum),
          diferencia: new Prisma.Decimal(diferenciaNum),
          recibido_por: usuario ? usuario.partyId : BigInt(1),
          recibido_en: new Date(),
        },
      });
    });

    if (usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'almacen',
        accion: 'CONFIRMAR_RECEPCION_TRASLADO',
        entidad: 'traslado',
        entidadId: trasladoId,
        partyId: usuario.partyId,
        despues: { recibido: recibidoNum, diferencia: diferenciaNum },
        ip,
      });
    }

    this.eventosGateway?.emitirAdmin('stock:cambio', {
      insumoId: traslado.insumo_id.toString(),
      lugarId: traslado.destino_lugar_id.toString(),
    });

    if (typeof this.stockService?.verificarYReactivarAgotados === 'function') {
      await this.stockService.verificarYReactivarAgotados([traslado.insumo_id]);
    }

    return { ok: true, id: trasladoId.toString(), estado: 'RECIBIDO' };
  }
}
