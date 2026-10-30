import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { CrearInsumoDto } from './dto/crear-insumo.dto';
import { ActualizarInsumoDto } from './dto/actualizar-insumo.dto';
import { InsumosQueryDto } from './dto/insumos-query.dto';
import { calcularSemaforoYEstado } from './receta.util';

@Injectable()
export class InsumosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private parsearId(id: bigint | string | number, entidad = 'insumo'): bigint {
    try {
      return BigInt(id);
    } catch {
      throw new BadRequestException({
        codigo: 'ID_INVALIDO',
        mensaje: `El identificador de ${entidad} no es válido`,
      });
    }
  }

  private validarNiveles(minimo: number, intermedio: number | null | undefined, maximo: number) {
    if (minimo < 0 || maximo <= 0) {
      throw new BadRequestException({
        codigo: 'NIVELES_INVALIDOS',
        mensaje: 'Los niveles de stock deben ser valores positivos',
      });
    }
    if (intermedio !== null && intermedio !== undefined) {
      if (minimo >= intermedio || intermedio >= maximo) {
        throw new BadRequestException({
          codigo: 'NIVELES_INVALIDOS',
          mensaje: 'El nivel mínimo debe ser menor que el intermedio y este menor que el máximo',
        });
      }
    } else if (minimo >= maximo) {
      throw new BadRequestException({
        codigo: 'NIVELES_INVALIDOS',
        mensaje: 'El nivel mínimo debe ser menor que el máximo',
      });
    }
  }

  private validarProveedores(
    a?: string | number | bigint | null,
    b?: string | number | bigint | null,
    c?: string | number | bigint | null,
  ) {
    const list = [a, b, c].filter((p) => p !== null && p !== undefined && p !== '').map(String);
    const unique = new Set(list);
    if (unique.size < list.length) {
      throw new BadRequestException({
        codigo: 'PROVEEDORES_DUPLICADOS',
        mensaje: 'Los proveedores A, B y C no pueden repetirse',
      });
    }
  }

  async listarLugares() {
    const lugares = await this.prisma.lugarStock.findMany({
      include: {
        area: true,
      },
      orderBy: {
        id: 'asc',
      },
    });

    return lugares.map((l) => ({
      id: l.id.toString(),
      nombre: l.nombre,
      tipo: l.tipo,
      area_id: l.area_id ? l.area_id.toString() : null,
      areaNombre: l.area?.nombre ?? null,
    }));
  }

  async listar(query: InsumosQueryDto) {
    const where: Prisma.InsumoWhereInput = {};

    if (query.activo !== 'todos') {
      where.activo = query.activo === 'false' ? false : true;
    }

    if (query.q && query.q.trim()) {
      where.nombre = {
        contains: query.q.trim(),
        mode: 'insensitive',
      };
    }

    const insumos = await this.prisma.insumo.findMany({
      where,
      include: {
        lugarConsumo: true,
        stocks: {
          include: {
            lugar: true,
          },
        },
      },
      orderBy: {
        nombre: 'asc',
      },
    });

    let resultado = insumos.map((ins) => {
      let stockTotal = 0;
      const stockPorLugar = ins.stocks.map((st) => {
        const cant = Number(st.cantidad);
        stockTotal += cant;
        return {
          lugarId: st.lugar_id.toString(),
          lugarNombre: st.lugar.nombre,
          cantidad: cant,
        };
      });

      const minimo = Number(ins.minimo);
      const intermedio = ins.intermedio != null ? Number(ins.intermedio) : null;
      const maximo = Number(ins.maximo);

      const semaforoInfo = calcularSemaforoYEstado(stockTotal, minimo, intermedio, maximo);

      return {
        id: ins.id.toString(),
        nombre: ins.nombre,
        unidad_compra: ins.unidad_compra,
        unidad_almacen: ins.unidad_almacen,
        unidad_receta: ins.unidad_receta,
        factor_compra: Number(ins.factor_compra),
        factor_receta: Number(ins.factor_receta),
        minimo,
        intermedio,
        maximo,
        costo_unit: ins.costo_unit != null ? Number(ins.costo_unit) : null,
        lugar_consumo_id: ins.lugar_consumo_id ? ins.lugar_consumo_id.toString() : null,
        lugar_consumo_nombre: ins.lugarConsumo?.nombre ?? null,
        proveedor_a: ins.proveedor_a ? ins.proveedor_a.toString() : null,
        proveedor_b: ins.proveedor_b ? ins.proveedor_b.toString() : null,
        proveedor_c: ins.proveedor_c ? ins.proveedor_c.toString() : null,
        activo: ins.activo,
        stock_total: Math.round(stockTotal * 1000) / 1000,
        stock_por_lugar: stockPorLugar,
        semaforo: semaforoInfo.semaforo,
        estado: semaforoInfo.estado,
        porcentaje_llenado: semaforoInfo.porcentaje,
      };
    });

    // Filtro por estado si fue indicado
    if (query.estado && query.estado.trim()) {
      const e = query.estado.toLowerCase().trim();
      resultado = resultado.filter((item) => {
        if (e === 'agotado') return item.estado === 'Agotado';
        if (e === 'poco') return item.estado === 'Poco' || item.estado === 'Agotado';
        if (e === 'por_acabarse' || e === 'por acabarse') return item.estado === 'Por acabarse';
        if (e === 'bien' || e === 'normal') return item.estado === 'Bien';
        if (e === 'lleno') return item.estado === 'Lleno';
        return true;
      });
    }

    // Filtro por lugar si fue indicado
    if (query.lugar && query.lugar.trim()) {
      const l = query.lugar.trim();
      resultado = resultado.filter(
        (item) =>
          item.lugar_consumo_id === l ||
          item.stock_por_lugar.some((spl) => spl.lugarId === l || spl.lugarNombre.toLowerCase() === l.toLowerCase()),
      );
    }

    return resultado;
  }

  async obtenerPorId(id: bigint | string | number) {
    const entidadId = this.parsearId(id);
    const ins = await this.prisma.insumo.findUnique({
      where: { id: entidadId },
      include: {
        lugarConsumo: true,
        stocks: {
          include: {
            lugar: true,
          },
        },
      },
    });

    if (!ins) {
      throw new NotFoundException({
        codigo: 'INSUMO_NO_ENCONTRADO',
        mensaje: 'El insumo no existe',
      });
    }

    let stockTotal = 0;
    const stockPorLugar = ins.stocks.map((st) => {
      const cant = Number(st.cantidad);
      stockTotal += cant;
      return {
        lugarId: st.lugar_id.toString(),
        lugarNombre: st.lugar.nombre,
        cantidad: cant,
      };
    });

    const minimo = Number(ins.minimo);
    const intermedio = ins.intermedio != null ? Number(ins.intermedio) : null;
    const maximo = Number(ins.maximo);
    const semaforoInfo = calcularSemaforoYEstado(stockTotal, minimo, intermedio, maximo);

    return {
      id: ins.id.toString(),
      nombre: ins.nombre,
      unidad_compra: ins.unidad_compra,
      unidad_almacen: ins.unidad_almacen,
      unidad_receta: ins.unidad_receta,
      factor_compra: Number(ins.factor_compra),
      factor_receta: Number(ins.factor_receta),
      minimo,
      intermedio,
      maximo,
      costo_unit: ins.costo_unit != null ? Number(ins.costo_unit) : null,
      lugar_consumo_id: ins.lugar_consumo_id ? ins.lugar_consumo_id.toString() : null,
      lugar_consumo_nombre: ins.lugarConsumo?.nombre ?? null,
      proveedor_a: ins.proveedor_a ? ins.proveedor_a.toString() : null,
      proveedor_b: ins.proveedor_b ? ins.proveedor_b.toString() : null,
      proveedor_c: ins.proveedor_c ? ins.proveedor_c.toString() : null,
      activo: ins.activo,
      stock_total: Math.round(stockTotal * 1000) / 1000,
      stock_por_lugar: stockPorLugar,
      semaforo: semaforoInfo.semaforo,
      estado: semaforoInfo.estado,
      porcentaje_llenado: semaforoInfo.porcentaje,
    };
  }

  async crear(dto: CrearInsumoDto, usuario: UsuarioAutenticado, ip?: string) {
    this.validarNiveles(dto.minimo, dto.intermedio, dto.maximo);
    this.validarProveedores(dto.proveedor_a, dto.proveedor_b, dto.proveedor_c);

    const existe = await this.prisma.insumo.findUnique({
      where: { nombre: dto.nombre.trim() },
    });
    if (existe) {
      throw new BadRequestException({
        codigo: 'NOMBRE_DUPLICADO',
        mensaje: 'Ya existe un insumo con ese nombre',
      });
    }

    const lugarConsumoId = dto.lugar_consumo_id
      ? this.parsearId(dto.lugar_consumo_id, 'lugar_stock')
      : null;

    const proveedorA = dto.proveedor_a ? this.parsearId(dto.proveedor_a, 'proveedor') : null;
    const proveedorB = dto.proveedor_b ? this.parsearId(dto.proveedor_b, 'proveedor') : null;
    const proveedorC = dto.proveedor_c ? this.parsearId(dto.proveedor_c, 'proveedor') : null;

    const insumo = await this.prisma.insumo.create({
      data: {
        nombre: dto.nombre.trim(),
        unidad_compra: dto.unidad_compra.trim(),
        unidad_almacen: dto.unidad_almacen.trim(),
        unidad_receta: dto.unidad_receta.trim(),
        factor_compra: new Prisma.Decimal(dto.factor_compra),
        factor_receta: new Prisma.Decimal(dto.factor_receta),
        minimo: new Prisma.Decimal(dto.minimo),
        intermedio: dto.intermedio != null ? new Prisma.Decimal(dto.intermedio) : null,
        maximo: new Prisma.Decimal(dto.maximo),
        costo_unit: dto.costo_unit != null ? new Prisma.Decimal(dto.costo_unit) : null,
        lugar_consumo_id: lugarConsumoId,
        proveedor_a: proveedorA,
        proveedor_b: proveedorB,
        proveedor_c: proveedorC,
        activo: true,
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'stock',
      accion: 'CREAR_INSUMO',
      resultado: 'OK',
      entidad: 'insumo',
      entidadId: insumo.id,
      despues: {
        nombre: insumo.nombre,
        minimo: insumo.minimo.toString(),
        maximo: insumo.maximo.toString(),
      },
      partyId: usuario.partyId,
      ip,
    });

    return this.obtenerPorId(insumo.id);
  }

  async actualizar(id: string | number | bigint, dto: ActualizarInsumoDto, usuario: UsuarioAutenticado, ip?: string) {
    const entidadId = this.parsearId(id);
    const existente = await this.prisma.insumo.findUnique({
      where: { id: entidadId },
    });
    if (!existente) {
      throw new NotFoundException({
        codigo: 'INSUMO_NO_ENCONTRADO',
        mensaje: 'El insumo no existe',
      });
    }

    const nuevoMinimo = dto.minimo !== undefined ? dto.minimo : Number(existente.minimo);
    const nuevoIntermedio =
      dto.intermedio !== undefined
        ? dto.intermedio
        : existente.intermedio != null
        ? Number(existente.intermedio)
        : null;
    const nuevoMaximo = dto.maximo !== undefined ? dto.maximo : Number(existente.maximo);

    this.validarNiveles(nuevoMinimo, nuevoIntermedio, nuevoMaximo);

    const provA = dto.proveedor_a !== undefined ? dto.proveedor_a : existente.proveedor_a;
    const provB = dto.proveedor_b !== undefined ? dto.proveedor_b : existente.proveedor_b;
    const provC = dto.proveedor_c !== undefined ? dto.proveedor_c : existente.proveedor_c;
    this.validarProveedores(provA, provB, provC);

    if (dto.nombre && dto.nombre.trim() !== existente.nombre) {
      const otro = await this.prisma.insumo.findUnique({
        where: { nombre: dto.nombre.trim() },
      });
      if (otro && otro.id !== entidadId) {
        throw new BadRequestException({
          codigo: 'NOMBRE_DUPLICADO',
          mensaje: 'Ya existe otro insumo con ese nombre',
        });
      }
    }

    const data: Prisma.InsumoUpdateInput = {};
    if (dto.nombre !== undefined) data.nombre = dto.nombre.trim();
    if (dto.unidad_compra !== undefined) data.unidad_compra = dto.unidad_compra.trim();
    if (dto.unidad_almacen !== undefined) data.unidad_almacen = dto.unidad_almacen.trim();
    if (dto.unidad_receta !== undefined) data.unidad_receta = dto.unidad_receta.trim();
    if (dto.factor_compra !== undefined) data.factor_compra = new Prisma.Decimal(dto.factor_compra);
    if (dto.factor_receta !== undefined) data.factor_receta = new Prisma.Decimal(dto.factor_receta);
    if (dto.minimo !== undefined) data.minimo = new Prisma.Decimal(dto.minimo);
    if (dto.intermedio !== undefined) {
      data.intermedio = dto.intermedio != null ? new Prisma.Decimal(dto.intermedio) : null;
    }
    if (dto.maximo !== undefined) data.maximo = new Prisma.Decimal(dto.maximo);
    if (dto.costo_unit !== undefined) {
      data.costo_unit = dto.costo_unit != null ? new Prisma.Decimal(dto.costo_unit) : null;
    }
    if (dto.lugar_consumo_id !== undefined) {
      data.lugarConsumo = dto.lugar_consumo_id
        ? { connect: { id: this.parsearId(dto.lugar_consumo_id, 'lugar_stock') } }
        : { disconnect: true };
    }
    if (dto.proveedor_a !== undefined) {
      data.proveedor_a = dto.proveedor_a ? this.parsearId(dto.proveedor_a, 'proveedor') : null;
    }
    if (dto.proveedor_b !== undefined) {
      data.proveedor_b = dto.proveedor_b ? this.parsearId(dto.proveedor_b, 'proveedor') : null;
    }
    if (dto.proveedor_c !== undefined) {
      data.proveedor_c = dto.proveedor_c ? this.parsearId(dto.proveedor_c, 'proveedor') : null;
    }

    const actualizado = await this.prisma.insumo.update({
      where: { id: entidadId },
      data,
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'stock',
      accion: 'EDITAR_INSUMO',
      resultado: 'OK',
      entidad: 'insumo',
      entidadId: actualizado.id,
      antes: {
        nombre: existente.nombre,
        minimo: existente.minimo.toString(),
        maximo: existente.maximo.toString(),
      },
      despues: {
        nombre: actualizado.nombre,
        minimo: actualizado.minimo.toString(),
        maximo: actualizado.maximo.toString(),
      },
      partyId: usuario.partyId,
      ip,
    });

    return this.obtenerPorId(actualizado.id);
  }

  async desactivar(id: string | number | bigint, usuario: UsuarioAutenticado, ip?: string) {
    const entidadId = this.parsearId(id);
    const insumo = await this.prisma.insumo.update({
      where: { id: entidadId },
      data: { activo: false },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'stock',
      accion: 'DESACTIVAR_INSUMO',
      resultado: 'OK',
      entidad: 'insumo',
      entidadId: insumo.id,
      partyId: usuario.partyId,
      ip,
    });

    return { ok: true, id: insumo.id.toString(), activo: false };
  }

  async activar(id: string | number | bigint, usuario: UsuarioAutenticado, ip?: string) {
    const entidadId = this.parsearId(id);
    const insumo = await this.prisma.insumo.update({
      where: { id: entidadId },
      data: { activo: true },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'stock',
      accion: 'ACTIVAR_INSUMO',
      resultado: 'OK',
      entidad: 'insumo',
      entidadId: insumo.id,
      partyId: usuario.partyId,
      ip,
    });

    return { ok: true, id: insumo.id.toString(), activo: true };
  }
}
