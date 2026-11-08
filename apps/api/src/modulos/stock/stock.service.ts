import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { MovimientoManualDto } from './dto/movimiento-manual.dto';
import { MovimientosQueryDto } from './dto/movimientos-query.dto';
import { convertirAUnidadAlmacen, insumosDeLinea } from './receta.util';
import { FECHA_HASTA_REACTIVAR } from '../cocina/cocina.util';
import { AvisosInternosService } from '../chatbot/avisos-internos/avisos-internos.service';
import { controlAlmacenActivo } from './control-almacen';
import { ORIGEN_AUTOMATICO, esAgotadoAutomatico, saldoSabor, sincronizarAgotadoSabor } from './producto-controlado';

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly eventosGateway?: EventosGateway,
    @Optional()
    @Inject(forwardRef(() => AvisosInternosService))
    private readonly avisosInternosService?: AvisosInternosService,
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

  /**
   * Registra un movimiento manual (entrada, salida, ajuste, merma, devolución o traslado).
   * Motivo es obligatorio para ajustes y mermas (RNF-CAP-020).
   * Traslado entre lugares es estrictamente atómico (las dos patas en una sola transacción).
   */
  async registrarMovimientoManual(
    dto: MovimientoManualDto,
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    if (dto.tipo === 'ENTRADA') {
      throw new ConflictException({
        codigo: 'INGRESO_SOLO_COMPRAS',
        mensaje: 'Los ingresos se registran en Compras',
      });
    }

    // 1. Validar motivo obligatorio en ajustes y mermas
    if (dto.tipo === 'AJUSTE' || dto.tipo === 'MERMA') {
      if (!dto.motivo || !dto.motivo.trim()) {
        throw new BadRequestException({
          codigo: 'MOTIVO_REQUERIDO',
          mensaje: 'El motivo es obligatorio para ajustes y mermas',
        });
      }
    }

    const insumoId = this.parsearId(dto.insumoId, 'insumo');
    const lugarId = this.parsearId(dto.lugarId, 'lugar_stock');

    const insumo = await this.prisma.insumo.findUnique({
      where: { id: insumoId },
    });
    if (!insumo) {
      throw new NotFoundException({
        codigo: 'INSUMO_NO_ENCONTRADO',
        mensaje: 'El insumo no existe',
      });
    }

    const lugar = await this.prisma.lugarStock.findUnique({
      where: { id: lugarId },
    });
    if (!lugar) {
      throw new NotFoundException({
        codigo: 'LUGAR_NO_ENCONTRADO',
        mensaje: 'El lugar de stock no existe',
      });
    }

    // Convertir cantidad a unidad de almacén
    const cantidadAlmacen = convertirAUnidadAlmacen(
      dto.cantidad,
      dto.unidad || 'almacen',
      insumo.factor_compra,
      insumo.factor_receta,
    );
    const cantDecimal = new Prisma.Decimal(cantidadAlmacen);

    // 2. Caso especial: TRASLADO (dos patas atómicas)
    if (dto.tipo === 'TRASLADO') {
      if (!dto.lugarDestinoId) {
        throw new BadRequestException({
          codigo: 'DESTINO_REQUERIDO',
          mensaje: 'El lugar de destino es obligatorio para un traslado',
        });
      }
      const lugarDestinoId = this.parsearId(dto.lugarDestinoId, 'lugar_destino');
      if (lugarId === lugarDestinoId) {
        throw new BadRequestException({
          codigo: 'TRASLADO_MISMO_LUGAR',
          mensaje: 'El lugar de origen y de destino no pueden ser el mismo',
        });
      }

      const destino = await this.prisma.lugarStock.findUnique({
        where: { id: lugarDestinoId },
      });
      if (!destino) {
        throw new NotFoundException({
          codigo: 'LUGAR_DESTINO_NO_ENCONTRADO',
          mensaje: 'El lugar de destino no existe',
        });
      }

      const resultado = await this.prisma.$transaction(async (tx) => {
        // Pata 1: salida de origen
        let stockOrigen = await tx.stock.findFirst({
          where: { insumo_id: insumoId, lugar_id: lugarId },
        });
        if (!stockOrigen) {
          stockOrigen = await tx.stock.create({
            data: {
              insumo_id: insumoId,
              lugar_id: lugarId,
              cantidad: new Prisma.Decimal(0).minus(cantDecimal),
            },
          });
        } else {
          stockOrigen = await tx.stock.update({
            where: { id: stockOrigen.id },
            data: {
              cantidad: { decrement: cantDecimal },
            },
          });
        }

        const movSalida = await tx.movimientoStock.create({
          data: {
            tipo: 'TRASLADO_SALIDA',
            insumo_id: insumoId,
            lugar_id: lugarId,
            cantidad: cantDecimal,
            nota: dto.motivo?.trim() || `Traslado hacia ${destino.nombre}`,
            por: usuario.partyId,
          },
        });

        // Pata 2: entrada a destino
        let stockDestino = await tx.stock.findFirst({
          where: { insumo_id: insumoId, lugar_id: lugarDestinoId },
        });
        if (!stockDestino) {
          stockDestino = await tx.stock.create({
            data: {
              insumo_id: insumoId,
              lugar_id: lugarDestinoId,
              cantidad: cantDecimal,
            },
          });
        } else {
          stockDestino = await tx.stock.update({
            where: { id: stockDestino.id },
            data: {
              cantidad: { increment: cantDecimal },
            },
          });
        }

        const movEntrada = await tx.movimientoStock.create({
          data: {
            tipo: 'TRASLADO_ENTRADA',
            insumo_id: insumoId,
            lugar_id: lugarDestinoId,
            cantidad: cantDecimal,
            nota: dto.motivo?.trim() || `Traslado desde ${lugar.nombre}`,
            por: usuario.partyId,
          },
        });

        return {
          movSalida,
          movEntrada,
          nuevoStockOrigen: Number(stockOrigen.cantidad),
          nuevoStockDestino: Number(stockDestino.cantidad),
        };
      });

      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'stock',
        accion: 'TRASLADO_STOCK',
        resultado: 'OK',
        entidad: 'insumo',
        entidadId: insumoId,
        motivo: dto.motivo,
        despues: {
          origen: lugar.nombre,
          destino: destino.nombre,
          cantidad: cantidadAlmacen,
          nuevoOrigen: resultado.nuevoStockOrigen,
          nuevoDestino: resultado.nuevoStockDestino,
        },
        partyId: usuario.partyId,
        ip,
      });

      this.eventosGateway?.emitirAdmin('stock:cambio', {
        insumoId: insumoId.toString(),
        lugarId: lugarId.toString(),
        nuevoStock: resultado.nuevoStockOrigen,
      });
      this.eventosGateway?.emitirAdmin('stock:cambio', {
        insumoId: insumoId.toString(),
        lugarId: lugarDestinoId.toString(),
        nuevoStock: resultado.nuevoStockDestino,
      });

      if (resultado.nuevoStockOrigen <= Number(insumo.minimo)) {
        this.eventosGateway?.emitirAdmin('stock:bajo', {
          insumoId: insumoId.toString(),
          lugarId: lugarId.toString(),
          nombre: insumo.nombre,
          saldo: resultado.nuevoStockOrigen,
        });
      }

      return {
        ok: true,
        tipo: 'TRASLADO',
        cantidadAlmacen,
        origen: { lugarId: lugarId.toString(), saldo: resultado.nuevoStockOrigen },
        destino: { lugarId: lugarDestinoId.toString(), saldo: resultado.nuevoStockDestino },
      };
    }

    // 3. Otros tipos: ENTRADA, SALIDA, AJUSTE, MERMA, DEVOLUCION
    let delta = cantDecimal;
    if (dto.tipo === 'SALIDA' || dto.tipo === 'MERMA') {
      delta = cantDecimal.negated();
    } else if (dto.tipo === 'AJUSTE') {
      if (dto.accionAjuste === 'RESTAR') {
        delta = cantDecimal.negated();
      }
    }

    const { mov, nuevoStock } = await this.prisma.$transaction(async (tx) => {
      let st = await tx.stock.findFirst({
        where: { insumo_id: insumoId, lugar_id: lugarId },
      });

      if (!st) {
        st = await tx.stock.create({
          data: {
            insumo_id: insumoId,
            lugar_id: lugarId,
            cantidad: delta,
          },
        });
      } else {
        st = await tx.stock.update({
          where: { id: st.id },
          data: {
            cantidad: { increment: delta },
          },
        });
      }

      const movimiento = await tx.movimientoStock.create({
        data: {
          tipo: dto.tipo,
          insumo_id: insumoId,
          lugar_id: lugarId,
          cantidad: cantDecimal,
          nota: dto.motivo?.trim() || null,
          por: usuario.partyId,
        },
      });

      return { mov: movimiento, nuevoStock: Number(st.cantidad) };
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'stock',
      accion: `MOVIMIENTO_${dto.tipo}`,
      resultado: 'OK',
      entidad: 'insumo',
      entidadId: insumoId,
      motivo: dto.motivo,
      despues: {
        tipo: dto.tipo,
        lugar: lugar.nombre,
        cantidad: cantidadAlmacen,
        nuevoStock,
      },
      partyId: usuario.partyId,
      ip,
    });

    this.eventosGateway?.emitirAdmin('stock:cambio', {
      insumoId: insumoId.toString(),
      lugarId: lugarId.toString(),
      nuevoStock,
    });

    if (nuevoStock < 0) {
      this.eventosGateway?.emitirAdmin('stock:negativo', {
        insumoId: insumoId.toString(),
        lugarId: lugarId.toString(),
        nombre: insumo.nombre,
        saldo: nuevoStock,
      });
    }

    if (nuevoStock <= Number(insumo.minimo)) {
      this.eventosGateway?.emitirAdmin('stock:bajo', {
        insumoId: insumoId.toString(),
        lugarId: lugarId.toString(),
        nombre: insumo.nombre,
        saldo: nuevoStock,
      });
    }

    if (delta.greaterThan(0)) {
      await this.verificarYReactivarAgotados([insumoId]);
    }

    return {
      ok: true,
      movimientoId: mov.id.toString(),
      tipo: mov.tipo,
      insumoId: insumoId.toString(),
      lugarId: lugarId.toString(),
      cantidadAlmacen,
      nuevoStock,
    };
  }

  async listarMovimientos(query: MovimientosQueryDto) {
    const where: Prisma.MovimientoStockWhereInput = {};

    if (query.insumo) {
      where.insumo_id = this.parsearId(query.insumo, 'insumo');
    }
    if (query.lugar) {
      where.lugar_id = this.parsearId(query.lugar, 'lugar_stock');
    }
    if (query.tipo && query.tipo.trim()) {
      where.tipo = query.tipo.trim().toUpperCase();
    }
    if (query.desde || query.hasta) {
      where.en = {};
      if (query.desde) {
        where.en.gte = new Date(query.desde);
      }
      if (query.hasta) {
        const h = new Date(query.hasta);
        h.setHours(23, 59, 59, 999);
        where.en.lte = h;
      }
    }

    const pagina = Math.max(1, Number(query.pagina) || 1);
    const limite = Math.min(100, Math.max(1, Number(query.limite) || 20));
    const skip = (pagina - 1) * limite;

    const [total, items] = await Promise.all([
      this.prisma.movimientoStock.count({ where }),
      this.prisma.movimientoStock.findMany({
        where,
        include: {
          insumo: true,
          lugar: true,
          pedido: true,
        },
        orderBy: {
          en: 'desc',
        },
        skip,
        take: limite,
      }),
    ]);

    return {
      total,
      pagina,
      limite,
      totalPaginas: Math.ceil(total / limite),
      items: items.map((m) => ({
        id: m.id.toString(),
        tipo: m.tipo,
        insumoId: m.insumo_id ? m.insumo_id.toString() : null,
        insumoNombre: m.insumo?.nombre ?? null,
        unidadAlmacen: m.insumo?.unidad_almacen ?? null,
        lugarId: m.lugar_id.toString(),
        lugarNombre: m.lugar.nombre,
        cantidad: Number(m.cantidad),
        nota: m.nota,
        pedidoId: m.pedido_id ? m.pedido_id.toString() : null,
        por: m.por.toString(),
        en: m.en,
      })),
    };
  }

  async obtenerExistenciasPorLugar() {
    const [lugares, insumos, stocks] = await Promise.all([
      this.prisma.lugarStock.findMany({
        include: { area: true },
        orderBy: { id: 'asc' },
      }),
      this.prisma.insumo.findMany({
        where: { activo: true },
        include: { lugarConsumo: true },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.stock.findMany({
        include: { lugar: true, insumo: true },
      }),
    ]);

    const mapaStocks = new Map<string, number>();
    for (const st of stocks) {
      if (st.insumo_id) {
        const key = `${st.insumo_id}_${st.lugar_id}`;
        mapaStocks.set(key, Number(st.cantidad));
      }
    }

    const alertas: Array<{
      insumoId: string;
      nombre: string;
      lugarId: string;
      lugarNombre: string;
      saldo: number;
      minimo: number;
      tipo: 'NEGATIVO' | 'BAJO' | 'AGOTADO';
    }> = [];

    const matrizInsumos = insumos.map((ins) => {
      let total = 0;
      const existenciasLugar: Record<string, number> = {};

      for (const lug of lugares) {
        const cant = mapaStocks.get(`${ins.id}_${lug.id}`) || 0;
        existenciasLugar[lug.id.toString()] = cant;
        total += cant;

        if (cant < 0) {
          alertas.push({
            insumoId: ins.id.toString(),
            nombre: ins.nombre,
            lugarId: lug.id.toString(),
            lugarNombre: lug.nombre,
            saldo: cant,
            minimo: Number(ins.minimo),
            tipo: 'NEGATIVO',
          });
        } else if (cant === 0) {
          alertas.push({
            insumoId: ins.id.toString(),
            nombre: ins.nombre,
            lugarId: lug.id.toString(),
            lugarNombre: lug.nombre,
            saldo: 0,
            minimo: Number(ins.minimo),
            tipo: 'AGOTADO',
          });
        }
      }

      if (total <= Number(ins.minimo) && total > 0) {
        alertas.push({
          insumoId: ins.id.toString(),
          nombre: ins.nombre,
          lugarId: 'total',
          lugarNombre: 'Total general',
          saldo: total,
          minimo: Number(ins.minimo),
          tipo: 'BAJO',
        });
      }

      return {
        id: ins.id.toString(),
        nombre: ins.nombre,
        unidadAlmacen: ins.unidad_almacen,
        minimo: Number(ins.minimo),
        intermedio: ins.intermedio != null ? Number(ins.intermedio) : null,
        maximo: Number(ins.maximo),
        lugarConsumoId: ins.lugar_consumo_id ? ins.lugar_consumo_id.toString() : null,
        lugarConsumoNombre: ins.lugarConsumo?.nombre ?? null,
        existencias: existenciasLugar,
        total: Math.round(total * 1000) / 1000,
      };
    });

    return {
      lugares: lugares.map((l) => ({
        id: l.id.toString(),
        nombre: l.nombre,
        tipo: l.tipo,
        areaId: l.area_id ? l.area_id.toString() : null,
        areaNombre: l.area?.nombre ?? null,
      })),
      insumos: matrizInsumos,
      alertas,
    };
  }

  /** ¿Está encendido el control de almacén? Parámetro `stock_control_activo` («si»/«no»); sin parámetro, apagado. */
  async controlActivo(db: any = this.prisma): Promise<boolean> {
    return controlAlmacenActivo(db);
  }

  /**
   * Estado del control para la pantalla de Configuración: si está encendido y cuántos insumos con receta
   * no tienen stock cargado (esos productos se agotarían al primer cobro al encenderlo).
   */
  async estadoControl() {
    const activo = await this.controlActivo();
    const lineas = await this.prisma.recetaLinea.findMany({
      where: { receta: { es_produccion: false } },
      select: { insumo_id: true, receta: { select: { producto_id: true } } },
    });
    const insumosConReceta = new Set<string>(lineas.map((l: any) => l.insumo_id.toString()));
    const stocks = insumosConReceta.size
      ? await this.prisma.stock.findMany({
          where: { insumo_id: { in: [...insumosConReceta].map((x) => BigInt(x)) } },
          select: { insumo_id: true, cantidad: true },
        })
      : [];
    const saldo = new Map<string, number>();
    for (const st of stocks as any[]) {
      const k = st.insumo_id.toString();
      saldo.set(k, (saldo.get(k) ?? 0) + Number(st.cantidad));
    }
    const sinStock = new Set<string>([...insumosConReceta].filter((k) => (saldo.get(k) ?? 0) <= 0));
    const productosEnRiesgo = new Set<string>(
      (lineas as any[]).filter((l) => sinStock.has(l.insumo_id.toString())).map((l) => l.receta.producto_id.toString()),
    );
    const productosControlados = await this.prisma.producto.count({ where: { controla_stock: true, oculto: false } });
    return {
      activo,
      insumosConReceta: insumosConReceta.size,
      insumosSinStock: sinStock.size,
      productosEnRiesgo: productosEnRiesgo.size,
      productosControlados,
    };
  }

  /** Corre `fn` en la transacción externa si la hay; si no, abre una propia. */
  private enTransaccion<T>(txExterno: any, fn: (db: any) => Promise<T>): Promise<T> {
    return txExterno ? fn(txExterno) : this.prisma.$transaction((tx: any) => fn(tx));
  }

  /** Bloquea la fila del pedido hasta el final de la transacción (serializa cobros y anulaciones del mismo pedido). */
  private async bloquearPedido(db: any, pedidoId: bigint) {
    if (typeof db.$queryRaw === 'function') await db.$queryRaw`SELECT id FROM pedido WHERE id = ${pedidoId} FOR UPDATE`;
  }

  /**
   * FT-STK-03: Método público idempotent que descuenta por receta al COBRAR.
   * Si ya existen movimientos de tipo 'VENTA' para ese pedido, devuelve sin duplicar.
   * Un producto sin receta no descuenta nada ni da error.
   * Si el stock no alcanza, se deja vender (permite saldo negativo) y se emiten alertas.
   * Cuando un insumo llega a 0 o menos en su lugar de consumo, apaga los productos que lo usan
   * escribiendo `agotado_hasta` en Producto y fila en Agotado, y emite 'carta:disponibilidad'.
   */
  async descontarPorPedido(pedidoId: bigint | string | number, txExterno?: any) {
    const id = this.parsearId(pedidoId, 'pedido');
    const runner = txExterno || this.prisma;

    // Interruptor «Control de almacén» (Configuración): apagado, vender no toca el stock, no apaga productos
    // ni avisa de insumos. Las entradas y movimientos manuales siguen registrándose.
    if (!(await this.controlActivo(runner))) {
      return { ok: true, motivo: 'Control de almacén apagado' };
    }

    // 1. Idempotencia: ya se descontaron insumos o productos por tanda de este pedido.
    // Los productos que controlan stock se descuentan al crear el pedido (producto-controlado.ts): no cuentan aquí.
    const ventasPrevias = await runner.movimientoStock.findFirst({
      where: {
        pedido_id: id,
        tipo: 'VENTA',
        OR: [{ insumo_id: { not: null } }, { producto: { controla_stock: false } }],
        // Un cobro anulado devolvió sus insumos: al cobrar de nuevo se descuentan otra vez
        movimientosRevertidos: { none: {} },
      },
    });

    if (ventasPrevias) {
      return { ok: true, yaDescontado: true };
    }

    // 2. Leer pedido con sus líneas y opciones
    const pedido = await runner.pedido.findUnique({
      where: { id },
      include: {
        lineas: {
          include: {
            opcionesElegidas: true,
          },
        },
      },
    });

    if (!pedido) {
      return { ok: false, mensaje: 'Pedido no encontrado' };
    }
    if (pedido.estado === 'ANULADO' || pedido.estado === 'RECHAZADO') {
      return { ok: true, motivo: 'Pedido anulado o rechazado no descuenta' };
    }

    const almacenCentral = await runner.lugarStock.findFirst({
      where: { tipo: 'ALMACEN' },
    });
    const lugarCocina = await runner.lugarStock.findFirst({
      where: { nombre: 'Salados' },
    });
    const lugaresAreas =
      (await runner.lugarStock.findMany({
        where: { tipo: 'AREA' },
      })) || [];
    const mapaAreaLugar = new Map<string, bigint>();
    for (const la of lugaresAreas) {
      if (la.area_id) {
        mapaAreaLugar.set(la.area_id.toString(), la.id);
      }
    }

    const insumosAgotadosDetectados = new Set<string>();
    const productosAgotadosDetectados = new Set<string>();
    const insumosModificados = new Set<string>();
    const productosModificados = new Set<string>();
    const alertasNegativo: Array<{ insumoId?: string; productoId?: string; lugarId: string; nombre: string; saldo: number }> = [];
    const alertasBajo: Array<{ insumoId?: string; lugarId: string; nombre: string; saldo: number }> = [];

    let yaDescontadoEnTx = false;
    await this.enTransaccion(txExterno, async (tx: any) => {
      const db = txExterno || tx;

      // Dos cobros a la vez del mismo pedido: el segundo espera al primero y ve sus movimientos (no duplica insumos)
      await this.bloquearPedido(db, id);
      const repetida = await db.movimientoStock.findFirst({
        where: {
          pedido_id: id,
          tipo: 'VENTA',
          OR: [{ insumo_id: { not: null } }, { producto: { controla_stock: false } }],
          movimientosRevertidos: { none: {} },
        },
      });
      if (repetida) {
        yaDescontadoEnTx = true;
        return;
      }

      const controladosCobro = new Set<string>(
        (
          await db.producto.findMany({
            where: { id: { in: pedido.lineas.map((l: any) => l.producto_id).filter(Boolean) }, controla_stock: true },
            select: { id: true },
          })
        ).map((p: any) => p.id.toString()),
      );

      for (const linea of pedido.lineas) {
        if (!linea.producto_id) continue;

        // Buscar recetas del producto (producción unitaria / al momento)
        const recetas = await db.receta.findMany({
          where: {
            producto_id: linea.producto_id,
            es_produccion: false,
          },
          include: {
            lineas: {
              include: {
                insumo: true,
              },
            },
          },
        });

        // Si no tiene receta unitaria, verificar si es producto terminado / por tanda (DT-58)
        if (recetas.length === 0) {
          // Producto que controla stock: su saldo se descontó al crear el pedido
          if (controladosCobro.has(linea.producto_id.toString())) continue;
          const recetaTanda = db.receta?.findFirst
            ? await db.receta.findFirst({
                where: {
                  producto_id: linea.producto_id,
                  es_produccion: true,
                },
              })
            : null;

          let lugarProdADescontar = linea.area_id
            ? (mapaAreaLugar.get(linea.area_id.toString()) || null)
            : null;
          if (!lugarProdADescontar && lugarCocina) {
            lugarProdADescontar = lugarCocina.id;
          }
          if (!lugarProdADescontar && almacenCentral) {
            lugarProdADescontar = almacenCentral.id;
          }

          if (lugarProdADescontar) {
            let st = await db.stock.findFirst({
              where: { producto_id: linea.producto_id, lugar_id: lugarProdADescontar },
            });

            if (recetaTanda || st) {
              const cantDecimal = new Prisma.Decimal(linea.cantidad);
              if (!st) {
                st = await db.stock.create({
                  data: {
                    producto_id: linea.producto_id,
                    lugar_id: lugarProdADescontar,
                    cantidad: cantDecimal.negated(),
                  },
                });
              } else {
                st = await db.stock.update({
                  where: { id: st.id },
                  data: {
                    cantidad: { decrement: cantDecimal },
                  },
                });
              }

              await db.movimientoStock.create({
                data: {
                  tipo: 'VENTA',
                  producto_id: linea.producto_id,
                  lugar_id: lugarProdADescontar,
                  cantidad: cantDecimal,
                  pedido_id: id,
                  por: pedido.party_id || BigInt(1),
                  nota: `Venta · pedido ${id}`,
                },
              });

              const nuevoSaldo = Number(st.cantidad);
              productosModificados.add(linea.producto_id.toString());

              if (nuevoSaldo <= 0) {
                productosAgotadosDetectados.add(linea.producto_id.toString());
              }

              if (nuevoSaldo < 0) {
                const prodDb = await db.producto.findUnique({
                  where: { id: linea.producto_id },
                  select: { nombre: true },
                });
                alertasNegativo.push({
                  productoId: linea.producto_id.toString(),
                  lugarId: lugarProdADescontar.toString(),
                  nombre: prodDb?.nombre || `Producto ${linea.producto_id}`,
                  saldo: nuevoSaldo,
                });
              }
            }
          }
          continue;
        }

        // Determinar tamano_valor_id
        let tamanoValorId: bigint | null = null;
        if (linea.tamano) {
          const pt = await db.productoTamano.findFirst({
            where: {
              producto_id: linea.producto_id,
              tamano_valor: {
                nombre: linea.tamano,
              },
            },
          });
          if (pt) tamanoValorId = pt.tamano_valor_id;
        }

        // Obtener ajustes de opciones para las opciones elegidas
        const opcionesIds = (linea.opcionesElegidas || [])
          .map((oe: any) => oe.opcion_id)
          .filter(Boolean);

        let ajustes: any[] = [];
        if (opcionesIds.length > 0) {
          ajustes = await db.ajusteOpcion.findMany({
            where: {
              opcion_id: { in: opcionesIds },
            },
          });
        }

        // Calcular insumos requeridos
        const insumosCalculados = insumosDeLinea(
          recetas,
          ajustes,
          tamanoValorId,
          opcionesIds,
          linea.cantidad,
        );

        for (const item of insumosCalculados) {
          const insumoIdBig = BigInt(item.insumoId);
          const insumoDb = await db.insumo.findUnique({ where: { id: insumoIdBig } });
          if (!insumoDb) continue;

          // Determinar lugar de descuento:
          // 1. Insumo.lugar_consumo_id
          // 2. Lugar del área de la línea de pedido
          // 3. Almacén central
          let lugarIdADescontar = insumoDb.lugar_consumo_id;
          if (!lugarIdADescontar && linea.area_id) {
            lugarIdADescontar = mapaAreaLugar.get(linea.area_id.toString()) || null;
          }
          if (!lugarIdADescontar && lugarCocina) {
            lugarIdADescontar = lugarCocina.id;
          }
          if (!lugarIdADescontar && almacenCentral) {
            lugarIdADescontar = almacenCentral.id;
          }
          if (!lugarIdADescontar) continue;

          const cantidadEnAlmacen = convertirAUnidadAlmacen(
            item.cantidad,
            'receta',
            insumoDb.factor_compra,
            insumoDb.factor_receta,
          );
          const cantDecimal = new Prisma.Decimal(cantidadEnAlmacen).toDecimalPlaces(3);

          // Actualizar stock de forma atómica (permite negativo: se deja vender)
          let st = await db.stock.findFirst({
            where: { insumo_id: insumoIdBig, lugar_id: lugarIdADescontar },
          });

          if (!st) {
            st = await db.stock.create({
              data: {
                insumo_id: insumoIdBig,
                lugar_id: lugarIdADescontar,
                cantidad: cantDecimal.negated(),
              },
            });
          } else {
            st = await db.stock.update({
              where: { id: st.id },
              data: {
                cantidad: { decrement: cantDecimal },
              },
            });
          }

          // Registrar movimiento VENTA
          await db.movimientoStock.create({
            data: {
              tipo: 'VENTA',
              insumo_id: insumoIdBig,
              lugar_id: lugarIdADescontar,
              cantidad: cantDecimal,
              pedido_id: id,
              por: pedido.party_id || BigInt(1),
              nota: `Venta · pedido ${id}`,
            },
          });

          const nuevoSaldo = Number(st.cantidad);
          insumosModificados.add(insumoIdBig.toString());

          if (nuevoSaldo <= 0) {
            insumosAgotadosDetectados.add(insumoIdBig.toString());
          }

          if (nuevoSaldo < 0) {
            alertasNegativo.push({
              insumoId: insumoIdBig.toString(),
              lugarId: lugarIdADescontar.toString(),
              nombre: insumoDb.nombre,
              saldo: nuevoSaldo,
            });
          }

          if (nuevoSaldo <= Number(insumoDb.minimo)) {
            alertasBajo.push({
              insumoId: insumoIdBig.toString(),
              lugarId: lugarIdADescontar.toString(),
              nombre: insumoDb.nombre,
              saldo: nuevoSaldo,
            });
          }
        }
      }

      const ahora = new Date();
      // Si algún insumo llegó a 0 o menos, apagar productos que lo usan (escribiendo agotado_hasta como cocina)
      // Exclusivo para recetas unitarias/al momento: los productos por tanda se apagan cuando se agota su producto terminado
      if (insumosAgotadosDetectados.size > 0) {
        for (const insIdStr of insumosAgotadosDetectados) {
          const recsConInsumo = await db.recetaLinea.findMany({
            where: { insumo_id: BigInt(insIdStr) },
            include: { receta: true },
          });

          const prodsAgotar = new Set<bigint>();
          for (const rl of recsConInsumo) {
            if (rl.receta && !rl.receta.es_produccion) {
              prodsAgotar.add(rl.receta.producto_id);
            }
          }

          for (const prodId of prodsAgotar) await this.apagarProductoAutomatico(db, prodId, ahora);
        }
      }

      // Si algún producto terminado por tanda llegó a 0 o menos, apagarlo
      if (productosAgotadosDetectados.size > 0) {
        for (const prodIdStr of productosAgotadosDetectados) {
          await this.apagarProductoAutomatico(db, BigInt(prodIdStr), ahora);
        }
      }
    });
    if (yaDescontadoEnTx) return { ok: true, yaDescontado: true };

    // Emitir eventos en vivo fuera de la transacción
    if (this.eventosGateway) {
      for (const insId of insumosModificados) {
        this.eventosGateway.emitirAdmin('stock:cambio', { insumoId: insId });
      }
      for (const prodId of productosModificados) {
        this.eventosGateway.emitirAdmin('stock:cambio', { productoId: prodId });
      }

      for (const alerta of alertasNegativo) {
        this.eventosGateway.emitirAdmin('stock:negativo', alerta);
      }
      for (const alerta of alertasBajo) {
        this.eventosGateway.emitirAdmin('stock:bajo', alerta);
      }

      if (insumosAgotadosDetectados.size > 0 || productosAgotadosDetectados.size > 0) {
        // Consultar productos actualmente agotados y emitir carta:disponibilidad
        const ahora = new Date();
        const productosAgotados = await this.prisma.producto.findMany({
          where: { agotado_hasta: { gt: ahora } },
          select: { id: true },
        });
        const saboresAgotados = await this.prisma.sabor.findMany({
          where: { agotado_hasta: { gt: ahora } },
          select: { id: true },
        });
        const opcionesAgotadas = await this.prisma.opcion.findMany({
          where: { agotado_hasta: { gt: ahora } },
          select: { id: true },
        });

        this.eventosGateway.emitirAdmin('carta:disponibilidad', {
          productos: productosAgotados.map((p) => p.id.toString()),
          sabores: saboresAgotados.map((s) => s.id.toString()),
          opciones: opcionesAgotadas.map((o) => o.id.toString()),
          productoIds: productosAgotados.map((p) => p.id.toString()),
          saborIds: saboresAgotados.map((s) => s.id.toString()),
          opcionIds: opcionesAgotadas.map((o) => o.id.toString()),
        });
      }
    }

    // Avisos al equipo (Almacén). Con transacción externa se encolan dentro de ella (el llamador
    // despierta el envío tras el commit); sin ella cada aviso se encola por su cuenta, en segundo plano.
    if (this.avisosInternosService) {
      if (txExterno) {
        for (const insIdStr of insumosAgotadosDetectados) {
          await this.avisosInternosService.notificarInsumoAgotado(insIdStr, txExterno);
        }
        for (const alerta of alertasBajo) {
          if (alerta.insumoId) await this.avisosInternosService.notificarInsumoBajoStock(alerta.insumoId, txExterno);
        }
      } else {
        for (const insIdStr of insumosAgotadosDetectados) {
          setImmediate(() => {
            this.avisosInternosService?.notificarInsumoAgotado(insIdStr).catch(() => {});
          });
        }
        for (const alerta of alertasBajo) {
          if (alerta.insumoId) {
            const insId = alerta.insumoId;
            setImmediate(() => {
              this.avisosInternosService?.notificarInsumoBajoStock(insId).catch(() => {});
            });
          }
        }
      }
    }

    return { ok: true, descontado: true };
  }

  /**
   * FT-STK-03: Revierte lo descontado al anular un pedido (movimiento ANULACION).
   * Idempotente: si ya tiene movimientos ANULACION, no duplica.
   */
  async revertirPorPedido(
    pedidoId: bigint | string | number,
    txExterno?: any,
    porUsuarioId?: bigint | string | number,
    opciones: { soloInsumos?: boolean } = {},
  ) {
    const id = this.parsearId(pedidoId, 'pedido');
    const runner = txExterno || this.prisma;
    const porId = porUsuarioId ? this.parsearId(porUsuarioId, 'usuario') : BigInt(1);

    const insumosRevertidos: bigint[] = [];
    const productosRevertidos: bigint[] = [];
    const saboresRevertidos: bigint[] = [];

    // Todo en una transacción (la externa si la hay). El pedido se bloquea primero: dos anulaciones a la vez se
    // turnan y la segunda ya no encuentra ventas sin revertir (nunca se devuelve dos veces).
    const ventas: any[] = await this.enTransaccion(txExterno, async (db: any) => {
      await this.bloquearPedido(db, id);
      // Movimientos VENTA de este pedido que todavía no se revirtieron (idempotente por movimiento).
      // soloInsumos: al anular solo el cobro vuelven los insumos y los productos sin control de saldo (se descontaron
      // al cobrar); los productos que controlan stock siguen vendidos (el pedido sigue vivo).
      const pendientes = await db.movimientoStock.findMany({
        where: {
          pedido_id: id,
          tipo: 'VENTA',
          movimientosRevertidos: { none: {} },
          ...(opciones.soloInsumos
            ? { OR: [{ insumo_id: { not: null } }, { producto: { controla_stock: false } }] }
            : {}),
        },
      });

      for (const mov of pendientes) {
        if (!mov.insumo_id && !mov.producto_id) continue;

        if (mov.insumo_id) {
          insumosRevertidos.push(mov.insumo_id);
          // Reponer stock insumo de forma atómica
          const st = await db.stock.findFirst({
            where: { insumo_id: mov.insumo_id, lugar_id: mov.lugar_id },
          });

          if (!st) {
            await db.stock.create({
              data: {
                insumo_id: mov.insumo_id,
                lugar_id: mov.lugar_id,
                cantidad: mov.cantidad,
              },
            });
          } else {
            await db.stock.update({
              where: { id: st.id },
              data: {
                cantidad: { increment: mov.cantidad },
              },
            });
          }
        } else if (mov.sabor_id) {
          // Producto por sabor: se repone el saldo de ese sabor (no el del producto)
          saboresRevertidos.push(mov.sabor_id);
          await db.stockSabor.upsert({
            where: { sabor_id: mov.sabor_id },
            update: { cantidad: { increment: mov.cantidad } },
            create: { sabor_id: mov.sabor_id, cantidad: mov.cantidad },
          });
        } else if (mov.producto_id) {
          productosRevertidos.push(mov.producto_id);
          // Reponer stock producto terminado de forma atómica
          const st = await db.stock.findFirst({
            where: { producto_id: mov.producto_id, lugar_id: mov.lugar_id },
          });

          if (!st) {
            await db.stock.create({
              data: {
                producto_id: mov.producto_id,
                lugar_id: mov.lugar_id,
                cantidad: mov.cantidad,
              },
            });
          } else {
            await db.stock.update({
              where: { id: st.id },
              data: {
                cantidad: { increment: mov.cantidad },
              },
            });
          }
        }

        // Crear movimiento ANULACION
        await db.movimientoStock.create({
          data: {
            tipo: 'ANULACION',
            insumo_id: mov.insumo_id || null,
            producto_id: mov.producto_id || null,
            sabor_id: mov.sabor_id || null,
            lugar_id: mov.lugar_id,
            cantidad: mov.cantidad,
            pedido_id: id,
            movimiento_anulado_id: mov.id,
            por: porId,
            nota: `Anulación · pedido ${id}`,
          },
        });
      }
      return pendientes;
    });

    if (ventas.length === 0) return { ok: true, movimientosRevertidos: 0 };

    // Reactivar disponibilidad si corresponde (insumo o producto repuesto)
    await this.verificarYReactivarAgotados(insumosRevertidos, productosRevertidos);
    for (const sid of saboresRevertidos) {
      const saldo = await saldoSabor(runner, sid);
      if (saldo > 0) await sincronizarAgotadoSabor(runner, sid, saldo, new Date(), porId);
    }

    if (this.eventosGateway) {
      for (const mov of ventas) {
        if (mov.insumo_id) {
          this.eventosGateway.emitirAdmin('stock:cambio', {
            insumoId: mov.insumo_id.toString(),
            lugarId: mov.lugar_id.toString(),
          });
        }
        if (mov.producto_id) {
          this.eventosGateway.emitirAdmin('stock:cambio', {
            productoId: mov.producto_id.toString(),
            lugarId: mov.lugar_id.toString(),
          });
        }
      }
    }

    return { ok: true, movimientosRevertidos: ventas.length };
  }

  /**
   * Agotado AUTOMATICO por saldo 0 (insumo o producto terminado por tanda). Si ya está agotado (a mano o por
   * stock) no se toca: un agotado MANUAL conserva su origen y no se duplica la fila de historial.
   */
  private async apagarProductoAutomatico(db: any, prodId: bigint, ahora: Date) {
    const actual = await db.producto.findUnique?.({ where: { id: prodId }, select: { agotado_hasta: true } });
    if (actual?.agotado_hasta && new Date(actual.agotado_hasta) > ahora) return;
    await db.producto.update({
      where: { id: prodId },
      data: { agotado_hasta: FECHA_HASTA_REACTIVAR, agotado_origen: ORIGEN_AUTOMATICO },
    });
    if (db.agotado?.create) {
      await db.agotado.create({
        data: {
          producto_id: prodId,
          tipo: 'PRODUCTO',
          alcance: 'HASTA_REACTIVAR',
          desde: ahora,
          hasta: FECHA_HASTA_REACTIVAR,
          por: BigInt(1),
          reactivado_en: null,
          origen: ORIGEN_AUTOMATICO,
        },
      });
    }
  }

  /**
   * FT-STK-01 / RN-CAP-041: Reactivación automática de productos cuando entra stock.
   * Si un producto o insumo estaba agotado y ahora tiene stock disponible (> 0),
   * se limpia agotado_hasta y se cierra el registro de Agotado correspondiente. Solo el agotado AUTOMATICO:
   * lo apagado a mano se queda hasta que alguien lo quite.
   */
  async verificarYReactivarAgotados(
    insumosIds: Array<bigint | string | number> = [],
    productosIds: Array<bigint | string | number> = [],
    tx?: any,
  ) {
    const db = tx || this.prisma;
    const ahora = new Date();
    const reactivados: bigint[] = [];

    // 1. Reactivar productos por tanda / terminados directamente si tienen stock > 0
    for (const pId of productosIds) {
      if (!pId) continue;
      const prodId = this.parsearId(pId, 'producto');
      const stocks = (await db.stock?.findMany?.({
        where: { producto_id: prodId },
      })) || [];
      const totalStock = stocks.reduce((acc: number, s: any) => acc + Number(s.cantidad), 0);
      if (totalStock > 0) {
        const prod = await db.producto?.findUnique?.({ where: { id: prodId } });
        if (prod && prod.agotado_hasta && prod.agotado_hasta > ahora && esAgotadoAutomatico(prod.agotado_origen)) {
          await db.producto?.update?.({
            where: { id: prodId },
            data: { agotado_hasta: null, agotado_origen: null },
          });
          if (db.agotado?.updateMany) {
            await db.agotado.updateMany({
              where: {
                producto_id: prodId,
                reactivado_en: null,
              },
              data: { reactivado_en: ahora },
            });
          }
          reactivados.push(prodId);
        }
      }
    }

    // 2. Reactivar productos basados en insumos
    for (const iId of insumosIds) {
      if (!iId) continue;
      const insumoId = this.parsearId(iId, 'insumo');
      const lineas = (await db.recetaLinea?.findMany?.({
        where: { insumo_id: insumoId },
        include: { receta: true },
      })) || [];

      const prodsCandidatos = new Set<bigint>();
      for (const l of lineas) {
        if (l.receta && !l.receta.es_produccion) {
          prodsCandidatos.add(l.receta.producto_id);
        }
      }

      for (const prodId of prodsCandidatos) {
        const prod = await db.producto?.findUnique?.({ where: { id: prodId } });
        if (prod && prod.agotado_hasta && prod.agotado_hasta > ahora && esAgotadoAutomatico(prod.agotado_origen)) {
          // Verificar si TODOS los insumos requeridos por sus recetas tienen stock > 0
          const todasLineas = (await db.recetaLinea?.findMany?.({
            where: {
              receta: {
                producto_id: prodId,
                es_produccion: false,
              },
            },
            select: { insumo_id: true },
          })) || [];

          let todosConStock = true;
          for (const tl of todasLineas) {
            const stInsumo = (await db.stock?.findMany?.({
              where: { insumo_id: tl.insumo_id },
            })) || [];
            const totalInsumo = stInsumo.reduce((acc: number, s: any) => acc + Number(s.cantidad), 0);
            if (totalInsumo <= 0) {
              todosConStock = false;
              break;
            }
          }

          if (todosConStock) {
            await db.producto?.update?.({
              where: { id: prodId },
              data: { agotado_hasta: null, agotado_origen: null },
            });
            if (db.agotado?.updateMany) {
              await db.agotado.updateMany({
                where: {
                  producto_id: prodId,
                  reactivado_en: null,
                },
                data: { reactivado_en: ahora },
              });
            }
            reactivados.push(prodId);
          }
        }
      }
    }

    // Emitir carta:disponibilidad si hubo reactivaciones
    if (reactivados.length > 0 && this.eventosGateway) {
      const productosAgotados = await this.prisma.producto.findMany({
        where: { agotado_hasta: { gt: ahora } },
        select: { id: true },
      });
      const saboresAgotados = await this.prisma.sabor.findMany({
        where: { agotado_hasta: { gt: ahora } },
        select: { id: true },
      });
      const opcionesAgotadas = await this.prisma.opcion.findMany({
        where: { agotado_hasta: { gt: ahora } },
        select: { id: true },
      });

      this.eventosGateway.emitirAdmin('carta:disponibilidad', {
        productos: productosAgotados.map((p: any) => p.id.toString()),
        sabores: saboresAgotados.map((s: any) => s.id.toString()),
        opciones: opcionesAgotadas.map((o: any) => o.id.toString()),
        productoIds: productosAgotados.map((p: any) => p.id.toString()),
        saborIds: saboresAgotados.map((s: any) => s.id.toString()),
        opcionIds: opcionesAgotadas.map((o: any) => o.id.toString()),
      });
    }

    return { reactivados: reactivados.map((id) => id.toString()) };
  }
}
