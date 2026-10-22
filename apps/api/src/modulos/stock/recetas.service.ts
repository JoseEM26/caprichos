import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { GuardarRecetaDto } from './dto/guardar-receta.dto';
import { AjusteOpcionDto } from './dto/ajuste-opcion.dto';
import { calcularCostoYMargen } from './receta.util';

@Injectable()
export class RecetasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private parsearId(id: bigint | string | number, entidad = 'producto'): bigint {
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
   * GET /admin/recetas
   * Devuelve todos los productos con su costo, margen y estado «sin receta».
   * Incluye la cuenta de platos sin margen (RQ-STK-02-05, RQ-STK-02-06).
   */
  async listarProductosConMargen() {
    const productos = await this.prisma.producto.findMany({
      where: {
        oculto: false,
      },
      include: {
        categoria: true,
        tamanos: {
          include: {
            tamano_valor: true,
          },
          orderBy: {
            tamano_valor_id: 'asc',
          },
        },
        recetas: {
          where: {
            es_produccion: false,
          },
          include: {
            lineas: {
              include: {
                insumo: true,
              },
            },
          },
        },
      },
      orderBy: {
        nombre: 'asc',
      },
    });

    let platosSinMargen = 0;

    const lista = productos.map((prod) => {
      const tieneReceta = prod.recetas.some((r) => r.lineas.length > 0);
      if (!tieneReceta) {
        platosSinMargen++;
      }

      // Tomamos el primer tamaño o el tamaño por defecto para el resumen en la lista
      const primerTamano = prod.tamanos[0];
      const precioVenta = primerTamano ? Number(primerTamano.precio) : Number(prod.precio);

      // Calcular costo de insumos de la receta que aplique al primer tamaño
      let costoTotal: number | null = null;
      if (tieneReceta) {
        let recetaTamano = prod.recetas.find(
          (r) => primerTamano && r.tamano_valor_id === primerTamano.tamano_valor_id,
        );
        if (!recetaTamano) {
          recetaTamano = prod.recetas.find((r) => r.tamano_valor_id === null) || prod.recetas[0];
        }

        if (recetaTamano && recetaTamano.lineas.length > 0) {
          let suma = 0;
          for (const l of recetaTamano.lineas) {
            const factor = Number(l.insumo.factor_receta) || 1;
            const costoUnitAlmacen = Number(l.insumo.costo_unit) || 0;
            const costoUnitReceta = costoUnitAlmacen / factor;
            suma += Number(l.cantidad) * costoUnitReceta;
          }
          costoTotal = suma;
        }
      }

      const { costo, margenSoles, margenPorcentaje } = calcularCostoYMargen(
        costoTotal,
        precioVenta,
      );

      return {
        id: prod.id.toString(),
        nombre: prod.nombre,
        categoriaId: prod.categoria_id?.toString() ?? null,
        categoriaNombre: prod.categoria?.nombre ?? null,
        tieneReceta,
        precio: precioVenta,
        costo,
        margenSoles,
        margenPorcentaje,
        cantidadTamanos: prod.tamanos.length,
      };
    });

    return {
      productos: lista,
      totalProductos: productos.length,
      platosSinMargen,
    };
  }

  /**
   * GET /admin/recetas/:productoId
   * Ficha completa de la receta de un producto con desglose por tamaño, costo y margen.
   */
  async obtenerRecetaProducto(productoId: bigint | string | number) {
    const id = this.parsearId(productoId, 'producto');

    const producto = await this.prisma.producto.findUnique({
      where: { id },
      include: {
        categoria: true,
        tamanos: {
          include: {
            tamano_valor: true,
          },
          orderBy: {
            tamano_valor_id: 'asc',
          },
        },
        recetas: {
          where: {
            es_produccion: false,
          },
          include: {
            lineas: {
              include: {
                insumo: true,
              },
            },
          },
        },
      },
    });

    if (!producto) {
      throw new NotFoundException({
        codigo: 'PRODUCTO_NO_ENCONTRADO',
        mensaje: 'El producto no existe',
      });
    }

    const tieneReceta = producto.recetas.some((r) => r.lineas.length > 0);

    const recetaGeneral = producto.recetas.find((r) => r.tamano_valor_id === null);

    const tamanos = producto.tamanos.map((pt) => {
      const receta =
        producto.recetas.find((r) => r.tamano_valor_id === pt.tamano_valor_id) ||
        recetaGeneral;

      let costoTotal: number | null = null;
      const lineasCalculadas: any[] = [];

      if (receta && receta.lineas.length > 0) {
        let suma = 0;
        for (const l of receta.lineas) {
          const factor = Number(l.insumo.factor_receta) || 1;
          const costoUnitAlmacen = Number(l.insumo.costo_unit) || 0;
          const costoUnitReceta = costoUnitAlmacen / factor;
          const cant = Number(l.cantidad);
          const subtotal = cant * costoUnitReceta;
          suma += subtotal;

          lineasCalculadas.push({
            insumoId: l.insumo_id.toString(),
            insumoNombre: l.insumo.nombre,
            unidadReceta: l.insumo.unidad_receta,
            cantidad: cant,
            costoUnitarioReceta: Math.round(costoUnitReceta * 10000) / 10000,
            subtotalCosto: Math.round(subtotal * 100) / 100,
          });
        }
        costoTotal = suma;
      }

      const precio = Number(pt.precio);
      const { costo, margenSoles, margenPorcentaje } = calcularCostoYMargen(
        costoTotal,
        precio,
      );

      return {
        tamanoId: pt.tamano_valor_id.toString(),
        tamanoNombre: pt.tamano_valor.nombre,
        precio,
        costo,
        margenSoles,
        margenPorcentaje,
        tieneRecetaTamano: !!receta && receta.lineas.length > 0,
        lineas: lineasCalculadas,
      };
    });

    return {
      productoId: producto.id.toString(),
      productoNombre: producto.nombre,
      categoria: producto.categoria?.nombre ?? null,
      tieneReceta,
      tamanos,
    };
  }

  /**
   * PUT /admin/recetas/:productoId
   * Reemplaza las líneas de la receta de un producto para un tamaño específico (o general).
   * Audita antes y después. Una receta nueva no cambia ventas pasadas (RQ-STK-02-08).
   */
  async guardarReceta(
    productoId: bigint | string | number,
    dto: GuardarRecetaDto,
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    const id = this.parsearId(productoId, 'producto');

    const producto = await this.prisma.producto.findUnique({
      where: { id },
    });
    if (!producto) {
      throw new NotFoundException({
        codigo: 'PRODUCTO_NO_ENCONTRADO',
        mensaje: 'El producto no existe',
      });
    }

    const tamanoValorId = dto.tamano_valor_id
      ? this.parsearId(dto.tamano_valor_id, 'tamano_valor')
      : null;

    const esProduccion = dto.es_produccion ?? false;

    // Obtener receta previa para auditar
    const recetaPrevia = await this.prisma.receta.findFirst({
      where: {
        producto_id: id,
        tamano_valor_id: tamanoValorId,
        es_produccion: esProduccion,
      },
      include: {
        lineas: true,
      },
    });

    // Guardar en transacción
    const recetaGuardada = await this.prisma.$transaction(async (tx) => {
      let rec = await tx.receta.findFirst({
        where: {
          producto_id: id,
          tamano_valor_id: tamanoValorId,
          es_produccion: esProduccion,
        },
      });

      if (!rec) {
        rec = await tx.receta.create({
          data: {
            producto_id: id,
            tamano_valor_id: tamanoValorId,
            es_produccion: esProduccion,
            rinde: dto.rinde != null ? new Prisma.Decimal(dto.rinde) : null,
          },
        });
      } else {
        rec = await tx.receta.update({
          where: { id: rec.id },
          data: {
            rinde: dto.rinde != null ? new Prisma.Decimal(dto.rinde) : null,
          },
        });
      }

      // Eliminar líneas viejas
      await tx.recetaLinea.deleteMany({
        where: { receta_id: rec.id },
      });

      // Insertar nuevas líneas
      for (const linea of dto.lineas) {
        const insumoId = this.parsearId(linea.insumo_id, 'insumo');
        const prodTamanoId = linea.producto_tamano_id
          ? this.parsearId(linea.producto_tamano_id, 'producto_tamano')
          : null;

        await tx.recetaLinea.create({
          data: {
            receta_id: rec.id,
            insumo_id: insumoId,
            cantidad: new Prisma.Decimal(linea.cantidad),
            producto_tamano_id: prodTamanoId,
          },
        });
      }

      return rec;
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'recetas',
      accion: 'GUARDAR_RECETA',
      resultado: 'OK',
      entidad: 'receta',
      entidadId: recetaGuardada.id,
      antes: recetaPrevia
        ? {
            lineas: recetaPrevia.lineas.map((l) => ({
              insumo_id: l.insumo_id.toString(),
              cantidad: l.cantidad.toString(),
            })),
          }
        : null,
      despues: {
        productoId: id.toString(),
        tamanoValorId: tamanoValorId?.toString() ?? null,
        lineas: dto.lineas.map((l) => ({
          insumo_id: l.insumo_id.toString(),
          cantidad: l.cantidad.toString(),
        })),
      },
      partyId: usuario.partyId,
      ip,
    });

    return this.obtenerRecetaProducto(id);
  }

  /**
   * GET /admin/recetas/opciones/:opcionId
   */
  async obtenerAjusteOpcion(opcionId: bigint | string | number) {
    const id = this.parsearId(opcionId, 'opcion');
    const ajustes = await this.prisma.ajusteOpcion.findMany({
      where: { opcion_id: id },
      include: {
        insumo: true,
        reemplazaInsumo: true,
        opcion: {
          include: {
            valor: true,
          },
        },
      },
    });

    return ajustes.map((a) => ({
      opcionId: a.opcion_id.toString(),
      opcionNombre: a.opcion?.valor?.nombre ?? null,
      insumoId: a.insumo_id.toString(),
      insumoNombre: a.insumo.nombre,
      efecto: a.efecto,
      reemplazaInsumoId: a.reemplaza_insumo_id ? a.reemplaza_insumo_id.toString() : null,
      reemplazaInsumoNombre: a.reemplazaInsumo?.nombre ?? null,
      cantidad: a.cantidad != null ? Number(a.cantidad) : null,
    }));
  }

  /**
   * PUT /admin/recetas/opciones/:opcionId
   */
  async guardarAjusteOpcion(
    opcionId: bigint | string | number,
    dto: AjusteOpcionDto,
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    const id = this.parsearId(opcionId, 'opcion');
    const insumoId = this.parsearId(dto.insumo_id, 'insumo');
    const reemplazaId = dto.reemplaza_insumo_id
      ? this.parsearId(dto.reemplaza_insumo_id, 'insumo')
      : null;

    const guardado = await this.prisma.ajusteOpcion.upsert({
      where: {
        opcion_id_insumo_id: {
          opcion_id: id,
          insumo_id: insumoId,
        },
      },
      update: {
        efecto: dto.efecto,
        reemplaza_insumo_id: reemplazaId,
        cantidad: dto.cantidad != null ? new Prisma.Decimal(dto.cantidad) : null,
      },
      create: {
        opcion_id: id,
        insumo_id: insumoId,
        efecto: dto.efecto,
        reemplaza_insumo_id: reemplazaId,
        cantidad: dto.cantidad != null ? new Prisma.Decimal(dto.cantidad) : null,
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'recetas',
      accion: 'GUARDAR_AJUSTE_OPCION',
      resultado: 'OK',
      entidad: 'ajuste_opcion',
      despues: {
        opcionId: id.toString(),
        insumoId: insumoId.toString(),
        efecto: dto.efecto,
        reemplazaId: reemplazaId?.toString() ?? null,
      },
      partyId: usuario.partyId,
      ip,
    });

    return {
      ok: true,
      opcionId: guardado.opcion_id.toString(),
      insumoId: guardado.insumo_id.toString(),
      efecto: guardado.efecto,
      reemplazaInsumoId: guardado.reemplaza_insumo_id
        ? guardado.reemplaza_insumo_id.toString()
        : null,
      cantidad: guardado.cantidad != null ? Number(guardado.cantidad) : null,
    };
  }
}
