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
import { MovimientoAlmacenDto } from './dto/movimiento-almacen.dto';
import { MermaMultipleDto } from './dto/merma-multiple.dto';
import { ProduccionTandasDto } from './dto/produccion-tandas.dto';
import { CierreDiaDto } from './dto/cierre-dia.dto';
import { AlmacenQueryDto } from './dto/almacen-query.dto';

@Injectable()
export class AlmacenService {
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
        where.tipo = { in: ['SALIDA', 'PRODUCCION_CONSUMO', 'TRASLADO_SALIDA'] };
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
        where.en.gte = new Date(`${query.fechaDesde}T00:00:00.000Z`);
      }
      if (query.fechaHasta) {
        where.en.lte = new Date(`${query.fechaHasta}T23:59:59.999Z`);
      }
    }

    const movimientos = await this.prisma.movimientoStock.findMany({
      where,
      include: {
        insumo: true,
        producto: true,
        lugar: true,
      },
      orderBy: { en: 'desc' },
      take: 100,
    });

    const baseWhereDate: Prisma.MovimientoStockWhereInput = {};
    if (query.fechaDesde || query.fechaHasta) {
      baseWhereDate.en = {};
      if (query.fechaDesde) baseWhereDate.en.gte = new Date(`${query.fechaDesde}T00:00:00.000Z`);
      if (query.fechaHasta) baseWhereDate.en.lte = new Date(`${query.fechaHasta}T23:59:59.999Z`);
    }

    const todosMovs = await this.prisma.movimientoStock.findMany({
      where: baseWhereDate,
      select: { tipo: true },
    });

    const conteos = {
      todos: todosMovs.length,
      entradas: todosMovs.filter((m) =>
        ['ENTRADA', 'PRODUCCION_ALTA', 'TRASLADO_ENTRADA'].includes(m.tipo),
      ).length,
      salidas: todosMovs.filter((m) =>
        ['SALIDA', 'PRODUCCION_CONSUMO', 'TRASLADO_SALIDA'].includes(m.tipo),
      ).length,
      mermas: todosMovs.filter((m) =>
        ['MERMA', 'DIFERENCIA_CONTEO'].includes(m.tipo),
      ).length,
      devoluciones: todosMovs.filter((m) => m.tipo === 'DEVOLUCION').length,
    };

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

    let resultadoFiltrado = formateados;
    if (query.q) {
      const q = query.q.toLowerCase();
      resultadoFiltrado = resultadoFiltrado.filter(
        (m) =>
          m.insumo.toLowerCase().includes(q) ||
          m.documento.toLowerCase().includes(q) ||
          m.nota.toLowerCase().includes(q) ||
          m.origen.toLowerCase().includes(q),
      );
    }

    return {
      conteos,
      movimientos: resultadoFiltrado,
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

    if (['SALIDA', 'MERMA', 'DEVOLUCION'].includes(dto.tipo)) {
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

    return {
      ok: true,
      id: resultado.mov.id.toString(),
      tipo: dto.tipo,
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
        const insumoId = this.parsearId(linea.insumoId, 'insumo');
        const origenLugar = await this.obtenerLugarPorNombre(linea.origen);
        const cantDecimal = new Prisma.Decimal(linea.cantidad);

        await tx.stock.updateMany({
          where: { insumo_id: insumoId, lugar_id: origenLugar.id },
          data: { cantidad: { decrement: cantDecimal } },
        });

        const mov = await tx.movimientoStock.create({
          data: {
            tipo: 'MERMA',
            insumo_id: insumoId,
            lugar_id: origenLugar.id,
            cantidad: cantDecimal.negated(),
            nota: `Merma múltiple (${linea.destino})`,
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

    if (movOriginal.tipo === 'ANULACION' || movOriginal.tipo === 'VENTA') {
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
      if (movOriginal.insumo_id) {
        await tx.stock.updateMany({
          where: {
            insumo_id: movOriginal.insumo_id,
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

    return { ok: true, id: resultado.id.toString() };
  }

  // ==========================================
  // PRODUCCIÓN DEL DÍA POR TANDA
  // ==========================================
  async listarRecetasProduccion() {
    const recetas = await this.prisma.receta.findMany({
      where: { es_produccion: true },
      include: {
        producto: true,
        lineas: {
          include: { insumo: true },
        },
      },
    });

    const cocinaLugar = await this.obtenerLugarPorNombre('Cocina');
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
          stockCocina: cantCocina,
          stockAlmacen: cantAlm,
          stockTotal: cantTotal,
        });
      }

      const yieldUnidades = Number(rec.rinde || 24);

      resultado.push({
        id: rec.id.toString(),
        nombre: rec.producto.nombre,
        productoId: rec.producto_id.toString(),
        tandaBase: yieldUnidades,
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
        producto: true,
        lineas: { include: { insumo: true } },
      },
    });

    if (!receta) {
      throw new NotFoundException({
        codigo: 'RECETA_NO_ENCONTRADA',
        mensaje: 'La receta no existe',
      });
    }

    const cocinaLugar = await this.obtenerLugarPorNombre('Cocina');
    const almacenLugar = await this.obtenerLugarPorNombre('Almacén central');

    const faltantes: string[] = [];
    let maxAlcanza = 99999;

    for (const lin of receta.lineas) {
      const ins = lin.insumo;
      const necPorTanda = Number(lin.cantidad);
      const necTotal = necPorTanda * dto.tandas;

      const stockCocina = await this.prisma.stock.findFirst({
        where: { insumo_id: ins.id, lugar_id: cocinaLugar.id },
      });
      const stockAlm = await this.prisma.stock.findFirst({
        where: { insumo_id: ins.id, lugar_id: almacenLugar.id },
      });

      const cantCocina = stockCocina ? Number(stockCocina.cantidad) : 0;
      const cantAlm = stockAlm ? Number(stockAlm.cantidad) : 0;
      const cantTotal = cantCocina + cantAlm;

      const tandasPosibles = necPorTanda > 0 ? cantTotal / necPorTanda : 999;
      if (tandasPosibles < maxAlcanza) {
        maxAlcanza = tandasPosibles;
      }

      if (cantTotal < necTotal) {
        faltantes.push(`${ins.nombre} (faltan ${(necTotal - cantTotal).toFixed(2)} ${ins.unidad_almacen})`);
      }
    }

    if (faltantes.length > 0) {
      const tandasMaxFloor = Math.floor(maxAlcanza * 10) / 10;
      throw new BadRequestException({
        codigo: 'STOCK_MATERIA_PRIMA_INSUFICIENTE',
        mensaje: `No alcanza el stock para ${dto.tandas} tandas: faltan ${faltantes.join(', ')}. Con lo que hay solo alcanzan ${tandasMaxFloor} tandas.`,
      });
    }

    const yieldTotal =
      dto.unidadesReales !== undefined
        ? dto.unidadesReales
        : Math.round(Number(receta.rinde || 24) * dto.tandas);

    const resultado = await this.prisma.$transaction(async (tx) => {
      for (const lin of receta.lineas) {
        const ins = lin.insumo;
        const necPorTanda = Number(lin.cantidad);
        let restante = necPorTanda * dto.tandas;

        const stockCocina = await tx.stock.findFirst({
          where: { insumo_id: ins.id, lugar_id: cocinaLugar.id },
        });
        const cantCocina = stockCocina ? Number(stockCocina.cantidad) : 0;

        const aTomarCocina = Math.min(cantCocina, restante);
        if (aTomarCocina > 0) {
          await tx.stock.update({
            where: { id: stockCocina!.id },
            data: { cantidad: { decrement: new Prisma.Decimal(aTomarCocina) } },
          });

          await tx.movimientoStock.create({
            data: {
              tipo: 'PRODUCCION_CONSUMO',
              insumo_id: ins.id,
              lugar_id: cocinaLugar.id,
              cantidad: new Prisma.Decimal(-aTomarCocina),
              nota: `Producción de ${receta.producto.nombre} (${dto.tandas} tandas)`,
              por: usuario ? usuario.partyId : BigInt(1),
            },
          });

          restante -= aTomarCocina;
        }

        if (restante > 0) {
          await tx.stock.updateMany({
            where: { insumo_id: ins.id, lugar_id: almacenLugar.id },
            data: { cantidad: { decrement: new Prisma.Decimal(restante) } },
          });

          await tx.movimientoStock.create({
            data: {
              tipo: 'PRODUCCION_CONSUMO',
              insumo_id: ins.id,
              lugar_id: almacenLugar.id,
              cantidad: new Prisma.Decimal(-restante),
              nota: `Producción de ${receta.producto.nombre} (${restante.toFixed(2)} ${ins.unidad_almacen} salieron de almacén central)`,
              por: usuario ? usuario.partyId : BigInt(1),
            },
          });
        }
      }

      const prod = await tx.produccion.create({
        data: {
          receta_id: recetaId,
          tandas: new Prisma.Decimal(dto.tandas),
          unidades: new Prisma.Decimal(yieldTotal),
          por: usuario ? usuario.partyId : BigInt(1),
        },
      });

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
          nota: `Producción del día · PRD-${prod.id.toString()}`,
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

    const cocinaLugar = await this.obtenerLugarPorNombre('Cocina');

    await this.prisma.$transaction(async (tx) => {
      await tx.produccion.update({
        where: { id: prodId },
        data: {
          anulado_en: new Date(),
          motivo_anulacion: motivo,
        },
      });

      await tx.stock.updateMany({
        where: { producto_id: prod.receta.producto_id, lugar_id: cocinaLugar.id },
        data: { cantidad: { decrement: prod.unidades } },
      });

      await tx.movimientoStock.create({
        data: {
          tipo: 'ANULACION',
          producto_id: prod.receta.producto_id,
          lugar_id: cocinaLugar.id,
          cantidad: new Prisma.Decimal(-Number(prod.unidades)),
          produccion_id: prodId,
          nota: `Anulación producción: ${motivo}`,
          por: usuario ? usuario.partyId : BigInt(1),
        },
      });

      for (const lin of prod.receta.lineas) {
        const necPorTanda = Number(lin.cantidad);
        const cantDevolver = necPorTanda * Number(prod.tandas);

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

    return { ok: true, id: prodId.toString() };
  }

  // ==========================================
  // CIERRE DEL DÍA CON CONTEO Y MERMA
  // ==========================================
  async obtenerProductosDelDia() {
    const recetas = await this.prisma.receta.findMany({
      where: { es_produccion: true },
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

    for (const r of recetas) {
      if (r.producto) {
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
    const cocinaLugar = await this.obtenerLugarPorNombre('Cocina');

    const resultado = await this.prisma.$transaction(async (tx) => {
      for (const fila of dto.filas) {
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
      area: p.area?.nombre || 'Cocina',
      detalle: p.detalle,
      estado: p.estado,
      en: p.en,
    }));
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

    const actualizado = await this.prisma.pedidoInterno.update({
      where: { id: pedId },
      data: {
        estado: 'ENTREGADO',
        entregado_por: usuario ? usuario.partyId : BigInt(1),
        entregado_en: new Date(),
      },
    });

    if (usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'almacen',
        accion: 'ENTREGAR_PEDIDO_INTERNO',
        entidad: 'pedido_interno',
        entidadId: pedId,
        partyId: usuario.partyId,
        despues: { estado: 'ENTREGADO' },
        ip,
      });
    }

    return { ok: true, id: pedId.toString(), estado: actualizado.estado };
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

    return { ok: true, id: trasladoId.toString(), estado: 'RECIBIDO' };
  }
}
