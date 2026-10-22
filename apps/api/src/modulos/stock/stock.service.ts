import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
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

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly eventosGateway?: EventosGateway,
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
              cantidad: stockOrigen.cantidad.minus(cantDecimal),
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
              cantidad: stockDestino.cantidad.plus(cantDecimal),
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
            cantidad: st.cantidad.plus(delta),
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

    // 1. Idempotencia: Verificar si ya hay movimientos de venta de este pedido
    const ventasPrevias = await runner.movimientoStock.findFirst({
      where: {
        pedido_id: id,
        tipo: 'VENTA',
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
    const insumosModificados = new Set<string>();

    await (txExterno ? Promise.resolve() : this.prisma.$transaction(async (tx: any) => {
      const db = txExterno || tx;

      for (const linea of pedido.lineas) {
        if (!linea.producto_id) continue;

        // Buscar recetas del producto
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

        // Un producto sin receta no descuenta nada ni da error
        if (recetas.length === 0) continue;

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
          if (!lugarIdADescontar && almacenCentral) {
            lugarIdADescontar = almacenCentral.id;
          }
          if (!lugarIdADescontar) continue;

          const factorReceta = Number(insumoDb.factor_receta) || 1;
          const cantidadEnAlmacen = item.cantidad / factorReceta;
          const cantDecimal = new Prisma.Decimal(cantidadEnAlmacen);

          // Actualizar stock (permite negativo: se deja vender)
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
                cantidad: st.cantidad.minus(cantDecimal),
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
        }
      }

      // Si algún insumo llegó a 0 o menos, apagar productos que lo usan (escribiendo agotado_hasta como cocina)
      if (insumosAgotadosDetectados.size > 0) {
        const ahora = new Date();
        for (const insIdStr of insumosAgotadosDetectados) {
          const recsConInsumo = await db.recetaLinea.findMany({
            where: { insumo_id: BigInt(insIdStr) },
            include: { receta: true },
          });

          for (const rl of recsConInsumo) {
            const prodId = rl.receta.producto_id;
            await db.producto.update({
              where: { id: prodId },
              data: { agotado_hasta: FECHA_HASTA_REACTIVAR },
            });

            await db.agotado.create({
              data: {
                producto_id: prodId,
                tipo: 'PRODUCTO',
                alcance: 'HASTA_REACTIVAR',
                desde: ahora,
                hasta: FECHA_HASTA_REACTIVAR,
                por: BigInt(1),
                reactivado_en: null,
              },
            });
          }
        }
      }
    }));

    // Emitir eventos en vivo fuera de la transacción
    if (this.eventosGateway) {
      for (const insId of insumosModificados) {
        this.eventosGateway.emitirAdmin('stock:cambio', { insumoId: insId });
      }

      if (insumosAgotadosDetectados.size > 0) {
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

    return { ok: true, descontado: true };
  }

  /**
   * FT-STK-03: Revierte lo descontado al anular un pedido (movimiento ANULACION).
   * Idempotente: si ya tiene movimientos ANULACION, no duplica.
   */
  async revertirPorPedido(pedidoId: bigint | string | number, txExterno?: any) {
    const id = this.parsearId(pedidoId, 'pedido');
    const runner = txExterno || this.prisma;

    // Verificar si ya fue revertido
    const previaAnulacion = await runner.movimientoStock.findFirst({
      where: {
        pedido_id: id,
        tipo: 'ANULACION',
      },
    });

    if (previaAnulacion) {
      return { ok: true, yaRevertido: true };
    }

    // Buscar movimientos VENTA de este pedido
    const ventas = await runner.movimientoStock.findMany({
      where: {
        pedido_id: id,
        tipo: 'VENTA',
      },
    });

    if (ventas.length === 0) {
      return { ok: true, movimientosRevertidos: 0 };
    }

    await (txExterno ? Promise.resolve() : this.prisma.$transaction(async (tx: any) => {
      const db = txExterno || tx;

      for (const mov of ventas) {
        if (!mov.insumo_id) continue;

        // Reponer stock
        let st = await db.stock.findFirst({
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
              cantidad: st.cantidad.plus(mov.cantidad),
            },
          });
        }

        // Crear movimiento ANULACION
        await db.movimientoStock.create({
          data: {
            tipo: 'ANULACION',
            insumo_id: mov.insumo_id,
            lugar_id: mov.lugar_id,
            cantidad: mov.cantidad,
            pedido_id: id,
            movimiento_anulado_id: mov.id,
            por: BigInt(1),
            nota: `Anulación · pedido ${id}`,
          },
        });
      }
    }));

    if (this.eventosGateway) {
      for (const mov of ventas) {
        if (mov.insumo_id) {
          this.eventosGateway.emitirAdmin('stock:cambio', {
            insumoId: mov.insumo_id.toString(),
            lugarId: mov.lugar_id.toString(),
          });
        }
      }
    }

    return { ok: true, movimientosRevertidos: ventas.length };
  }
}
