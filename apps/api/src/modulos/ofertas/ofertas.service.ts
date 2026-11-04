import { montoElegiblePuntos } from './puntos-elegibles.util';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import {
  CrearOfertaDto,
} from './dto/crear-oferta.dto';
import { ActualizarOfertaDto } from './dto/actualizar-oferta.dto';
import { ActualizarReglasDto } from './dto/actualizar-reglas.dto';
import { CrearCuponDto } from './dto/crear-cupon.dto';
import { ActualizarCuponDto } from './dto/actualizar-cupon.dto';
import { AnularCuponEmitidoDto } from './dto/anular-cupon-emitido.dto';
import { CanjearCuponDto } from './dto/canjear-cupon.dto';
import { partyClienteDelPedido } from '../clientes/cliente-del-pedido';
import { ValidarCuponDto } from './dto/validar-cupon.dto';
import {
  CuponEmitidoItem,
  CuponItem,
  DesgloseDescuentosPedido,
  DetalleDescuentoAplicado,
  OfertaItem,
  ReglaAcumulacionItem,
} from './ofertas.tipos';
import { calcularDisponibilidadCombo, ProductoDisp } from './combo-disponibilidad.util';
import {
  estaVigente,
  formatearFecha,
  formatearHora,
  generarCodigoCuponUnico,
  obtenerAhoraLima,
} from './ofertas.util';
import { urlPublicaCarta } from '../chatbot/servicios/carrusel.util';

/** Si la promoción (DESCUENTO o LLEVA_PAGA) alcanza a esta línea según su alcance: categoría, producto o toda la carta. */
function alcanceCubreLinea(
  d: { alcance_categoria_id: bigint | null; alcance_producto_id: bigint | null },
  l: { productoId: bigint; categoriaId?: bigint | null },
): boolean {
  if (d.alcance_categoria_id) return !!l.categoriaId && l.categoriaId === d.alcance_categoria_id;
  if (d.alcance_producto_id) return l.productoId === d.alcance_producto_id;
  return true;
}

const INCLUDE_PARTES = {
  include: { reemplazos: { orderBy: { orden: 'asc' as const }, include: { producto: true } } },
};

@Injectable()
export class OfertasService {
  private readonly logger = new Logger(OfertasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly auditoriaService: AuditoriaService,
    private readonly eventosGateway: EventosGateway,
  ) {}

  // ==========================================
  // OFERTAS Y COMBOS
  // ==========================================

  async listarOfertas(tipo?: string, soloActivas = false, canal?: string): Promise<OfertaItem[]> {
    const where: Prisma.OfertaWhereInput = {};

    if (tipo) {
      where.tipo = tipo.toUpperCase();
    }
    if (soloActivas) {
      where.activo = true;
    }

    const ofertasDb = await this.prisma.oferta.findMany({
      where,
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
      include: {
        categoria: true,
        producto: true,
        imagen_archivo: true,
        combosPrecio: {
          include: { tamano_valor: true },
        },
        combosParte: INCLUDE_PARTES,
      },
    });

    return this.conDisponibilidad(ofertasDb.map((o) => this.mapearOferta(o, canal)));
  }

  async obtenerOfertaPorId(id: bigint | string | number): Promise<OfertaItem> {
    const ofertaDb = await this.prisma.oferta.findUnique({
      where: { id: BigInt(id) },
      include: {
        categoria: true,
        producto: true,
        imagen_archivo: true,
        combosPrecio: {
          include: { tamano_valor: true },
        },
        combosParte: INCLUDE_PARTES,
      },
    });

    if (!ofertaDb) {
      throw new NotFoundException({
        codigo: 'OFERTA_NO_ENCONTRADA',
        mensaje: `No se encontró la oferta con id ${id}`,
      });
    }

    return (await this.conDisponibilidad([this.mapearOferta(ofertaDb)]))[0];
  }

  async crearOferta(dto: CrearOfertaDto, usuario?: any): Promise<OfertaItem> {
    const nombreLimpio = dto.nombre.trim();

    // RN-CAP-085 (2.ª) / RQ-OFE-01-03: El nombre del combo no puede repetir el de un producto
    if (dto.tipo === 'COMBO') {
      const productoExistente = await this.prisma.producto.findFirst({
        where: {
          nombre: { equals: nombreLimpio, mode: 'insensitive' },
        },
      });

      if (productoExistente) {
        throw new ConflictException({
          codigo: 'NOMBRE_REPETIDO_PRODUCTO',
          mensaje: 'El nombre de un combo no puede repetir el nombre de un producto existente',
        });
      }
    }

    const ofertaExistente = await this.prisma.oferta.findUnique({
      where: { nombre: nombreLimpio },
    });

    if (ofertaExistente) {
      throw new ConflictException({
        codigo: 'OFERTA_NOMBRE_DUPLICADO',
        mensaje: 'Ya existe una oferta o promoción con ese nombre',
      });
    }

    const tipoFinal = dto.tipo === 'DESCUENTO_AUTOMATICO' ? 'DESCUENTO' : dto.tipo;
    const descTipoFinal = dto.descuentoTipo === 'MONTO_FIJO' ? 'MONTO' : dto.descuentoTipo;

    // Validación de límites de descuento y compra mínima
    if (dto.descuentoValor !== undefined && dto.descuentoValor !== null) {
      if (descTipoFinal === 'PORCENTAJE') {
        if (dto.descuentoValor < 1 || dto.descuentoValor > 100) {
          throw new BadRequestException({
            codigo: 'DESCUENTO_PORCENTAJE_INVALIDO',
            mensaje: 'El porcentaje de descuento debe estar entre 1 y 100',
          });
        }
      } else if (descTipoFinal === 'MONTO') {
        if (dto.descuentoValor <= 0) {
          throw new BadRequestException({
            codigo: 'DESCUENTO_MONTO_INVALIDO',
            mensaje: 'El monto de descuento debe ser mayor que 0',
          });
        }
      }
    }
    if (dto.compraMinima !== undefined && dto.compraMinima !== null && dto.compraMinima < 0) {
      throw new BadRequestException({
        codigo: 'COMPRA_MINIMA_INVALIDA',
        mensaje: 'La compra mínima debe ser mayor o igual a 0',
      });
    }
    const diasFinal = dto.dias ?? dto.diasSemana ?? [];
    const horaDesdeStr = dto.horaDesde ?? dto.horaInicio;
    const horaHastaStr = dto.horaHasta ?? dto.horaFin;
    const fechaDesdeStr = dto.fechaDesde ?? dto.fechaInicio;
    const fechaHastaStr = dto.fechaHasta ?? dto.fechaFin;

    const horaDesdeDate = horaDesdeStr ? new Date(`1970-01-01T${horaDesdeStr}:00.000Z`) : null;
    const horaHastaDate = horaHastaStr ? new Date(`1970-01-01T${horaHastaStr}:00.000Z`) : null;
    const fechaDesdeDate = fechaDesdeStr ? new Date(`${fechaDesdeStr.slice(0, 10)}T00:00:00.000Z`) : null;
    const fechaHastaDate = fechaHastaStr ? new Date(`${fechaHastaStr.slice(0, 10)}T00:00:00.000Z`) : null;
    const soloPrimeraCompra = dto.soloPrimeraCompra ?? false;
    this.validarPrimeraCompra({ tipo: tipoFinal, soloPrimeraCompra, fechaDesde: fechaDesdeDate, fechaHasta: fechaHastaDate });

    const creada = await this.prisma.$transaction(async (tx) => {
      const oferta = await tx.oferta.create({
        data: {
          tipo: tipoFinal,
          nombre: nombreLimpio,
          descripcion: dto.descripcion?.trim() || null,
          lleva: dto.lleva ?? null,
          paga: dto.paga ?? null,
          alcance_categoria_id: dto.alcanceCategoriaId ? BigInt(dto.alcanceCategoriaId) : null,
          alcance_producto_id: dto.alcanceProductoId ? BigInt(dto.alcanceProductoId) : null,
          descuento_tipo: descTipoFinal ?? null,
          descuento_valor: dto.descuentoValor !== undefined && dto.descuentoValor !== null ? new Prisma.Decimal(dto.descuentoValor) : null,
          compra_minima: dto.compraMinima !== undefined && dto.compraMinima !== null ? new Prisma.Decimal(dto.compraMinima) : null,
          dias: diasFinal,
          hora_desde: horaDesdeDate,
          hora_hasta: horaHastaDate,
          fecha_desde: fechaDesdeDate,
          fecha_hasta: fechaHastaDate,
          // La primera compra solo se canjea en la carta web
          canales: soloPrimeraCompra ? ['CARTA'] : dto.canales ?? ['CARTA', 'ADMIN', 'BOT'],
          limite_usos: dto.limiteUsos ?? null,
          no_suma_beneficios: dto.noSumaBeneficios ?? false,
          mostrar_en_saludo_bot: dto.mostrarEnSaludoBot ?? false,
          solo_primera_compra: soloPrimeraCompra,
          orden: dto.orden ?? 0,
          activo: dto.activo ?? false,
          imagen_archivo_id: dto.imagenArchivoId ? BigInt(dto.imagenArchivoId) : null,
        },
      });

      const tamanosFinal = dto.tamanos ?? dto.combosPrecios;
      if (tipoFinal === 'COMBO' && Array.isArray(tamanosFinal)) {
        for (const t of tamanosFinal) {
          let tamanoId: bigint = 1n;
          if (t.tamanoValorId) {
            tamanoId = BigInt(t.tamanoValorId);
          } else {
            let tv = await tx.listaValor.findFirst({
              where: { nombre: { contains: t.tamanoNombre || 'Regular', mode: 'insensitive' } },
            });
            if (!tv) {
              tv = await tx.listaValor.findFirst();
              if (!tv) {
                let lista = await tx.lista.findFirst({ where: { codigo: 'TAMANOS' } });
                if (!lista) {
                  lista = await tx.lista.create({
                    data: { codigo: 'TAMANOS', nombre: 'Tamaños' },
                  });
                }
                tv = await tx.listaValor.create({
                  data: {
                    lista_id: lista.id,
                    nombre: t.tamanoNombre || 'Único',
                    orden: 1,
                    activo: true,
                  },
                });
              }
            }
            tamanoId = tv.id;
          }
          await tx.comboPrecio.create({
            data: {
              oferta_id: oferta.id,
              tamano_valor_id: tamanoId,
              precio: new Prisma.Decimal(t.precio),
            },
          });
        }
      }

      const partesFinal = dto.partes ?? dto.combosPartes;
      if (tipoFinal === 'COMBO' && Array.isArray(partesFinal)) {
        for (const p of partesFinal) {
          const tipoParte = p.tipo ?? (p.tipoParte === 'OPCIONES' ? 'A_ELECCION' : p.tipoParte) ?? 'A_ELECCION';
          const catIds: bigint[] = [];
          for (const c of p.categorias || []) {
            if (typeof c === 'bigint') {
              catIds.push(c);
            } else if (typeof c === 'number' || (typeof c === 'string' && /^\d+$/.test(c))) {
              catIds.push(BigInt(c));
            } else if (typeof c === 'string' && c.trim()) {
              const cat = await tx.categoria.findFirst({
                where: { nombre: { contains: c.trim(), mode: 'insensitive' } },
              });
              if (cat) catIds.push(cat.id);
            }
          }
          const prodIds: bigint[] = [];
          for (const pr of p.productos || []) {
            const val = typeof pr === 'object' ? pr.productoId || pr.id : pr;
            if (typeof val === 'bigint') {
              prodIds.push(val);
            } else if (typeof val === 'number' || (typeof val === 'string' && /^\d+$/.test(val))) {
              prodIds.push(BigInt(val));
            } else if (typeof val === 'string' && val.trim()) {
              const prod = await tx.producto.findFirst({
                where: { nombre: { contains: val.trim(), mode: 'insensitive' } },
              });
              if (prod) prodIds.push(prod.id);
            }
          }
          const parteCreada = await tx.comboParte.create({
            data: {
              oferta_id: oferta.id,
              tipo: tipoParte,
              cantidad: p.cantidad || 1,
              categorias: catIds,
              productos: prodIds,
            },
          });
          await this.guardarReemplazos(tx, parteCreada.id, tipoParte, prodIds, p.reemplazos);
        }
      }

      return tx.oferta.findUnique({
        where: { id: oferta.id },
        include: {
          categoria: true,
          producto: true,
          imagen_archivo: true,
          combosPrecio: { include: { tamano_valor: true } },
          combosParte: INCLUDE_PARTES,
        },
      });
    });

    await this.auditoriaService.registrar({
      categoria: 'CAMBIO',
      modulo: 'ofertas',
      accion: 'crear',
      entidad: 'oferta',
      entidadId: creada!.id,
      despues: dto,
      partyId: usuario?.partyId,
    });

    this.eventosGateway.emitirAdmin('ofertas:actualizado', { id: creada!.id.toString() });

    return (await this.conDisponibilidad([this.mapearOferta(creada!)]))[0];
  }

  async actualizarOferta(id: bigint | string | number, dto: ActualizarOfertaDto, usuario?: any): Promise<OfertaItem> {
    const ofertaExistente = await this.prisma.oferta.findUnique({
      where: { id: BigInt(id) },
    });

    if (!ofertaExistente) {
      throw new NotFoundException({
        codigo: 'OFERTA_NO_ENCONTRADA',
        mensaje: `No se encontró la oferta con id ${id}`,
      });
    }

    if (dto.nombre && dto.nombre.trim() !== ofertaExistente.nombre) {
      const nombreLimpio = dto.nombre.trim();
      if ((dto.tipo || ofertaExistente.tipo) === 'COMBO') {
        const prodRepetido = await this.prisma.producto.findFirst({
          where: { nombre: { equals: nombreLimpio, mode: 'insensitive' } },
        });
        if (prodRepetido) {
          throw new ConflictException({
            codigo: 'NOMBRE_REPETIDO_PRODUCTO',
            mensaje: 'El nombre de un combo no puede repetir el nombre de un producto existente',
          });
        }
      }
      const nombreDuplicado = await this.prisma.oferta.findFirst({
        where: { nombre: nombreLimpio, id: { not: BigInt(id) } },
      });
      if (nombreDuplicado) {
        throw new ConflictException({
          codigo: 'OFERTA_NOMBRE_DUPLICADO',
          mensaje: 'Ya existe otra oferta con ese nombre',
        });
      }
    }

    const descTipoCheck = dto.descuentoTipo !== undefined
      ? (dto.descuentoTipo === 'MONTO_FIJO' ? 'MONTO' : dto.descuentoTipo)
      : ofertaExistente.descuento_tipo;
    if (dto.descuentoValor !== undefined && dto.descuentoValor !== null) {
      if (descTipoCheck === 'PORCENTAJE') {
        if (dto.descuentoValor < 1 || dto.descuentoValor > 100) {
          throw new BadRequestException({
            codigo: 'DESCUENTO_PORCENTAJE_INVALIDO',
            mensaje: 'El porcentaje de descuento debe estar entre 1 y 100',
          });
        }
      } else if (descTipoCheck === 'MONTO') {
        if (dto.descuentoValor <= 0) {
          throw new BadRequestException({
            codigo: 'DESCUENTO_MONTO_INVALIDO',
            mensaje: 'El monto de descuento debe ser mayor que 0',
          });
        }
      }
    }
    if (dto.compraMinima !== undefined && dto.compraMinima !== null && dto.compraMinima < 0) {
      throw new BadRequestException({
        codigo: 'COMPRA_MINIMA_INVALIDA',
        mensaje: 'La compra mínima debe ser mayor o igual a 0',
      });
    }

    const data: Prisma.OfertaUpdateInput = {};
    if (dto.tipo !== undefined) data.tipo = dto.tipo === 'DESCUENTO_AUTOMATICO' ? 'DESCUENTO' : dto.tipo;
    if (dto.nombre !== undefined) data.nombre = dto.nombre.trim();
    if (dto.descripcion !== undefined) data.descripcion = dto.descripcion?.trim() || null;
    if (dto.lleva !== undefined) data.lleva = dto.lleva;
    if (dto.paga !== undefined) data.paga = dto.paga;
    if (dto.alcanceCategoriaId !== undefined) {
      data.categoria = dto.alcanceCategoriaId ? { connect: { id: BigInt(dto.alcanceCategoriaId) } } : { disconnect: true };
    }
    if (dto.alcanceProductoId !== undefined) {
      data.producto = dto.alcanceProductoId ? { connect: { id: BigInt(dto.alcanceProductoId) } } : { disconnect: true };
    }
    if (dto.descuentoTipo !== undefined) data.descuento_tipo = dto.descuentoTipo === 'MONTO_FIJO' ? 'MONTO' : dto.descuentoTipo;
    if (dto.descuentoValor !== undefined) {
      data.descuento_valor = dto.descuentoValor !== null ? new Prisma.Decimal(dto.descuentoValor) : null;
    }
    if (dto.compraMinima !== undefined) {
      data.compra_minima = dto.compraMinima !== null ? new Prisma.Decimal(dto.compraMinima) : null;
    }
    const diasActualizar = dto.dias !== undefined ? dto.dias : dto.diasSemana;
    if (diasActualizar !== undefined) data.dias = diasActualizar ?? [];

    const horaDesdeActualizar = dto.horaDesde !== undefined ? dto.horaDesde : dto.horaInicio;
    if (horaDesdeActualizar !== undefined) {
      data.hora_desde = horaDesdeActualizar ? new Date(`1970-01-01T${horaDesdeActualizar}:00.000Z`) : null;
    }
    const horaHastaActualizar = dto.horaHasta !== undefined ? dto.horaHasta : dto.horaFin;
    if (horaHastaActualizar !== undefined) {
      data.hora_hasta = horaHastaActualizar ? new Date(`1970-01-01T${horaHastaActualizar}:00.000Z`) : null;
    }
    const fechaDesdeActualizar = dto.fechaDesde !== undefined ? dto.fechaDesde : dto.fechaInicio;
    if (fechaDesdeActualizar !== undefined) {
      data.fecha_desde = fechaDesdeActualizar ? new Date(`${fechaDesdeActualizar.slice(0, 10)}T00:00:00.000Z`) : null;
    }
    const fechaHastaActualizar = dto.fechaHasta !== undefined ? dto.fechaHasta : dto.fechaFin;
    if (fechaHastaActualizar !== undefined) {
      data.fecha_hasta = fechaHastaActualizar ? new Date(`${fechaHastaActualizar.slice(0, 10)}T00:00:00.000Z`) : null;
    }
    if (dto.canales !== undefined) data.canales = dto.canales ?? [];
    if (dto.limiteUsos !== undefined) data.limite_usos = dto.limiteUsos;
    if (dto.noSumaBeneficios !== undefined) data.no_suma_beneficios = dto.noSumaBeneficios;
    if (dto.mostrarEnSaludoBot !== undefined) data.mostrar_en_saludo_bot = dto.mostrarEnSaludoBot;
    if (dto.soloPrimeraCompra !== undefined) data.solo_primera_compra = dto.soloPrimeraCompra;
    const soloPrimeraFinal = data.solo_primera_compra ?? ofertaExistente.solo_primera_compra;
    if (soloPrimeraFinal) {
      this.validarPrimeraCompra({
        tipo: ofertaExistente.tipo,
        soloPrimeraCompra: true,
        fechaDesde: data.fecha_desde !== undefined ? (data.fecha_desde as Date | null) : ofertaExistente.fecha_desde,
        fechaHasta: data.fecha_hasta !== undefined ? (data.fecha_hasta as Date | null) : ofertaExistente.fecha_hasta,
      });
      data.canales = ['CARTA'];
    }
    if (dto.orden !== undefined) data.orden = dto.orden;
    if (dto.activo !== undefined) data.activo = dto.activo;
    if (dto.visibleCarta !== undefined) data.visible_carta = dto.visibleCarta;
    if (dto.imagenArchivoId !== undefined) {
      data.imagen_archivo = dto.imagenArchivoId
        ? { connect: { id: BigInt(dto.imagenArchivoId) } }
        : { disconnect: true };
    }

    const actualizada = await this.prisma.$transaction(async (tx) => {
      await tx.oferta.update({
        where: { id: BigInt(id) },
        data,
      });

      const tamanosFinal = dto.tamanos !== undefined ? dto.tamanos : dto.combosPrecios;
      if (tamanosFinal !== undefined) {
        await tx.comboPrecio.deleteMany({ where: { oferta_id: BigInt(id) } });
        for (const t of tamanosFinal) {
          let tamanoId: bigint = 1n;
          if (t.tamanoValorId) {
            tamanoId = BigInt(t.tamanoValorId);
          } else {
            let tv = await tx.listaValor.findFirst({
              where: { nombre: { contains: t.tamanoNombre || 'Regular', mode: 'insensitive' } },
            });
            if (!tv) {
              tv = await tx.listaValor.findFirst();
              if (!tv) {
                let lista = await tx.lista.findFirst({ where: { codigo: 'TAMANOS' } });
                if (!lista) {
                  lista = await tx.lista.create({
                    data: { codigo: 'TAMANOS', nombre: 'Tamaños' },
                  });
                }
                tv = await tx.listaValor.create({
                  data: {
                    lista_id: lista.id,
                    nombre: t.tamanoNombre || 'Único',
                    orden: 1,
                    activo: true,
                  },
                });
              }
            }
            tamanoId = tv.id;
          }
          await tx.comboPrecio.create({
            data: {
              oferta_id: BigInt(id),
              tamano_valor_id: tamanoId,
              precio: new Prisma.Decimal(t.precio),
            },
          });
        }
      }

      const partesFinal = dto.partes !== undefined ? dto.partes : dto.combosPartes;
      if (partesFinal !== undefined) {
        await tx.comboParte.deleteMany({ where: { oferta_id: BigInt(id) } });
        for (const p of partesFinal) {
          const tipoParte = p.tipo ?? (p.tipoParte === 'OPCIONES' ? 'A_ELECCION' : p.tipoParte) ?? 'A_ELECCION';
          const catIds: bigint[] = [];
          for (const c of p.categorias || []) {
            if (typeof c === 'bigint') {
              catIds.push(c);
            } else if (typeof c === 'number' || (typeof c === 'string' && /^\d+$/.test(c))) {
              catIds.push(BigInt(c));
            } else if (typeof c === 'string' && c.trim()) {
              const cat = await tx.categoria.findFirst({
                where: { nombre: { contains: c.trim(), mode: 'insensitive' } },
              });
              if (cat) catIds.push(cat.id);
            }
          }
          const prodIds: bigint[] = [];
          for (const pr of p.productos || []) {
            const val = typeof pr === 'object' ? pr.productoId || pr.id : pr;
            if (typeof val === 'bigint') {
              prodIds.push(val);
            } else if (typeof val === 'number' || (typeof val === 'string' && /^\d+$/.test(val))) {
              prodIds.push(BigInt(val));
            } else if (typeof val === 'string' && val.trim()) {
              const prod = await tx.producto.findFirst({
                where: { nombre: { contains: val.trim(), mode: 'insensitive' } },
              });
              if (prod) prodIds.push(prod.id);
            }
          }
          const parteCreada = await tx.comboParte.create({
            data: {
              oferta_id: BigInt(id),
              tipo: tipoParte,
              cantidad: p.cantidad || 1,
              categorias: catIds,
              productos: prodIds,
            },
          });
          await this.guardarReemplazos(tx, parteCreada.id, tipoParte, prodIds, p.reemplazos);
        }
      }

      return tx.oferta.findUnique({
        where: { id: BigInt(id) },
        include: {
          categoria: true,
          producto: true,
          imagen_archivo: true,
          combosPrecio: { include: { tamano_valor: true } },
          combosParte: INCLUDE_PARTES,
        },
      });
    });

    await this.auditoriaService.registrar({
      categoria: 'CAMBIO',
      modulo: 'ofertas',
      accion: 'editar',
      entidad: 'oferta',
      entidadId: BigInt(id),
      antes: ofertaExistente,
      despues: dto,
      partyId: usuario?.partyId,
    });

    this.eventosGateway.emitirAdmin('ofertas:actualizado', { id: id.toString() });

    return (await this.conDisponibilidad([this.mapearOferta(actualizada!)]))[0];
  }

  async cambiarEstadoOferta(id: bigint | string | number, activo: boolean, usuario?: any): Promise<OfertaItem> {
    const actualizada = await this.prisma.oferta.update({
      where: { id: BigInt(id) },
      data: { activo },
      include: {
        categoria: true,
        producto: true,
        imagen_archivo: true,
        combosPrecio: { include: { tamano_valor: true } },
        combosParte: INCLUDE_PARTES,
      },
    });

    await this.auditoriaService.registrar({
      categoria: 'CAMBIO',
      modulo: 'ofertas',
      accion: activo ? 'activar' : 'desactivar',
      entidad: 'oferta',
      entidadId: BigInt(id),
      despues: { activo },
      partyId: usuario?.partyId,
    });

    this.eventosGateway.emitirAdmin('ofertas:actualizado', { id: id.toString() });

    return (await this.conDisponibilidad([this.mapearOferta(actualizada)]))[0];
  }

  // ==========================================
  // REGLAS GENERALES DE ACUMULACIÓN
  // ==========================================

  async obtenerReglasAcumulacion(): Promise<ReglaAcumulacionItem> {
    const regla = await this.prisma.reglaAcumulacion.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        cupon_con_descuento: false,
        promo_con_descuento: false,
        cupones_por_comprobante: 2,
        texto_pie: 'Cupones válidos por 15 días para tu siguiente compra en salón o carta.',
      },
    });

    return {
      id: regla.id,
      cuponConDescuento: regla.cupon_con_descuento,
      promoConDescuento: regla.promo_con_descuento,
      cuponesPorComprobante: regla.cupones_por_comprobante,
      textoPie: regla.texto_pie,
    };
  }

  async actualizarReglasAcumulacion(dto: ActualizarReglasDto, usuario?: any): Promise<ReglaAcumulacionItem> {
    const antes = await this.obtenerReglasAcumulacion();

    const data: Prisma.ReglaAcumulacionUpdateInput = {};
    if (dto.cuponConDescuento !== undefined) data.cupon_con_descuento = dto.cuponConDescuento;
    if (dto.promoConDescuento !== undefined) data.promo_con_descuento = dto.promoConDescuento;
    if (dto.cuponesPorComprobante !== undefined) data.cupones_por_comprobante = dto.cuponesPorComprobante;
    if (dto.textoPie !== undefined) data.texto_pie = dto.textoPie?.trim() || null;

    const actualizada = await this.prisma.reglaAcumulacion.update({
      where: { id: 1 },
      data,
    });

    await this.auditoriaService.registrar({
      categoria: 'CAMBIO',
      modulo: 'ofertas',
      accion: 'editar_reglas',
      entidad: 'regla_acumulacion',
      entidadId: BigInt(1),
      antes,
      despues: dto,
      partyId: usuario?.partyId,
    });

    this.eventosGateway.emitirAdmin('reglas:actualizado', { id: 1 });

    return {
      id: actualizada.id,
      cuponConDescuento: actualizada.cupon_con_descuento,
      promoConDescuento: actualizada.promo_con_descuento,
      cuponesPorComprobante: actualizada.cupones_por_comprobante,
      textoPie: actualizada.texto_pie,
    };
  }

  // ==========================================
  // CUPONES
  // ==========================================

  async listarCupones(soloActivos = false): Promise<CuponItem[]> {
    const where: Prisma.CuponWhereInput = {};
    if (soloActivos) {
      where.activo = true;
    }

    const cuponesDb = await this.prisma.cupon.findMany({
      where,
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
      include: {
        categoria: true,
        producto: true,
      },
    });

    return cuponesDb.map(this.mapearCupon);
  }

  async obtenerCuponPorId(id: bigint | string | number): Promise<CuponItem> {
    const cuponDb = await this.prisma.cupon.findUnique({
      where: { id: BigInt(id) },
      include: {
        categoria: true,
        producto: true,
      },
    });

    if (!cuponDb) {
      throw new NotFoundException({
        codigo: 'CUPON_NO_ENCONTRADO',
        mensaje: `No se encontró el cupón con id ${id}`,
      });
    }

    return this.mapearCupon(cuponDb);
  }

  async crearCupon(dto: CrearCuponDto, usuario?: any): Promise<CuponItem> {
    const codigoBaseLimpio = dto.codigoBase.trim().toUpperCase();

    // RN-CAP-134 / RQ-OFE-03-02: si es compartido, tope de usos obligatorio
    if (dto.modo === 'COMPARTIDO' && (!dto.topeUsos || dto.topeUsos <= 0)) {
      throw new BadRequestException({
        codigo: 'TOPE_USOS_REQUERIDO',
        mensaje: 'Un cupón compartido exige un tope de usos obligatorio mayor a cero',
      });
    }

    const existente = await this.prisma.cupon.findUnique({
      where: { codigo_base: codigoBaseLimpio },
    });

    if (existente) {
      throw new ConflictException({
        codigo: 'CUPON_CODIGO_DUPLICADO',
        mensaje: 'Ya existe un cupón con ese código base',
      });
    }

    const creado = await this.prisma.cupon.create({
      data: {
        modo: dto.modo,
        codigo_base: codigoBaseLimpio,
        descripcion: dto.descripcion?.trim() || null,
        descuento_tipo: dto.descuentoTipo,
        descuento_valor: new Prisma.Decimal(dto.descuentoValor),
        compra_minima: dto.compraMinima !== undefined && dto.compraMinima !== null ? new Prisma.Decimal(dto.compraMinima) : null,
        categoria_id: dto.categoriaId ? BigInt(dto.categoriaId) : null,
        producto_id: dto.productoId ? BigInt(dto.productoId) : null,
        canales: dto.canales ?? ['CARTA', 'CAJA', 'BOT'],
        requiere_cuenta: dto.requiereCuenta ?? false,
        dias_validez: dto.diasValidez ?? 15,
        tope_usos: dto.modo === 'COMPARTIDO' ? dto.topeUsos : null,
        max_por_cliente: dto.maxPorCliente ?? null,
        orden: dto.orden ?? 0,
        activo: dto.activo ?? true,
      },
      include: {
        categoria: true,
        producto: true,
      },
    });

    await this.auditoriaService.registrar({
      categoria: 'CAMBIO',
      modulo: 'cupones',
      accion: 'crear',
      entidad: 'cupon',
      entidadId: creado.id,
      despues: dto,
      partyId: usuario?.partyId,
    });

    this.eventosGateway.emitirAdmin('cupones:actualizado', { id: creado.id.toString() });

    return this.mapearCupon(creado);
  }

  async actualizarCupon(id: bigint | string | number, dto: ActualizarCuponDto, usuario?: any): Promise<CuponItem> {
    const cuponExistente = await this.prisma.cupon.findUnique({
      where: { id: BigInt(id) },
    });

    if (!cuponExistente) {
      throw new NotFoundException({
        codigo: 'CUPON_NO_ENCONTRADO',
        mensaje: `No se encontró el cupón con id ${id}`,
      });
    }

    const modoFinal = dto.modo || cuponExistente.modo;
    if (modoFinal === 'COMPARTIDO') {
      const topeFinal = dto.topeUsos !== undefined ? dto.topeUsos : cuponExistente.tope_usos;
      if (!topeFinal || topeFinal <= 0) {
        throw new BadRequestException({
          codigo: 'TOPE_USOS_REQUERIDO',
          mensaje: 'Un cupón compartido exige un tope de usos obligatorio mayor a cero',
        });
      }
    }

    if (dto.codigoBase) {
      const nuevoCodigo = dto.codigoBase.trim().toUpperCase();
      if (nuevoCodigo !== cuponExistente.codigo_base) {
        const duplicado = await this.prisma.cupon.findFirst({
          where: { codigo_base: nuevoCodigo, id: { not: BigInt(id) } },
        });
        if (duplicado) {
          throw new ConflictException({
            codigo: 'CUPON_CODIGO_DUPLICADO',
            mensaje: 'Ya existe otro cupón con ese código base',
          });
        }
      }
    }

    const data: Prisma.CuponUpdateInput = {};
    if (dto.modo !== undefined) data.modo = dto.modo;
    if (dto.codigoBase !== undefined) data.codigo_base = dto.codigoBase.trim().toUpperCase();
    if (dto.descripcion !== undefined) data.descripcion = dto.descripcion?.trim() || null;
    if (dto.descuentoTipo !== undefined) data.descuento_tipo = dto.descuentoTipo;
    if (dto.descuentoValor !== undefined) data.descuento_valor = new Prisma.Decimal(dto.descuentoValor);
    if (dto.compraMinima !== undefined) {
      data.compra_minima = dto.compraMinima !== null ? new Prisma.Decimal(dto.compraMinima) : null;
    }
    if (dto.categoriaId !== undefined) {
      data.categoria = dto.categoriaId ? { connect: { id: BigInt(dto.categoriaId) } } : { disconnect: true };
    }
    if (dto.productoId !== undefined) {
      data.producto = dto.productoId ? { connect: { id: BigInt(dto.productoId) } } : { disconnect: true };
    }
    if (dto.canales !== undefined) data.canales = dto.canales ?? [];
    if (dto.requiereCuenta !== undefined) data.requiere_cuenta = dto.requiereCuenta;
    if (dto.diasValidez !== undefined) data.dias_validez = dto.diasValidez;
    if (dto.topeUsos !== undefined) data.tope_usos = dto.topeUsos;
    if (dto.maxPorCliente !== undefined) data.max_por_cliente = dto.maxPorCliente;
    if (dto.orden !== undefined) data.orden = dto.orden;
    if (dto.activo !== undefined) data.activo = dto.activo;

    const actualizado = await this.prisma.cupon.update({
      where: { id: BigInt(id) },
      data,
      include: {
        categoria: true,
        producto: true,
      },
    });

    await this.auditoriaService.registrar({
      categoria: 'CAMBIO',
      modulo: 'cupones',
      accion: 'editar',
      entidad: 'cupon',
      entidadId: BigInt(id),
      antes: cuponExistente,
      despues: dto,
      partyId: usuario?.partyId,
    });

    this.eventosGateway.emitirAdmin('cupones:actualizado', { id: id.toString() });

    return this.mapearCupon(actualizado);
  }

  async cambiarEstadoCupon(id: bigint | string | number, activo: boolean, usuario?: any): Promise<CuponItem> {
    const actualizado = await this.prisma.cupon.update({
      where: { id: BigInt(id) },
      data: { activo },
      include: {
        categoria: true,
        producto: true,
      },
    });

    await this.auditoriaService.registrar({
      categoria: 'CAMBIO',
      modulo: 'cupones',
      accion: activo ? 'activar' : 'desactivar',
      entidad: 'cupon',
      entidadId: BigInt(id),
      despues: { activo },
      partyId: usuario?.partyId,
    });

    this.eventosGateway.emitirAdmin('cupones:actualizado', { id: id.toString() });

    return this.mapearCupon(actualizado);
  }

  async reordenarCupon(id: bigint | string | number, nuevoOrden: number, usuario?: any): Promise<CuponItem> {
    const actualizado = await this.prisma.cupon.update({
      where: { id: BigInt(id) },
      data: { orden: nuevoOrden },
      include: {
        categoria: true,
        producto: true,
      },
    });

    await this.auditoriaService.registrar({
      categoria: 'CAMBIO',
      modulo: 'cupones',
      accion: 'reordenar',
      entidad: 'cupon',
      entidadId: BigInt(id),
      despues: { orden: nuevoOrden },
      partyId: usuario?.partyId,
    });

    this.eventosGateway.emitirAdmin('cupones:actualizado', { id: id.toString() });

    return this.mapearCupon(actualizado);
  }

  // ==========================================
  // CUPONES EMITIDOS
  // ==========================================

  async listarCuponesEmitidos(estado?: string, q?: string): Promise<CuponEmitidoItem[]> {
    const where: Prisma.CuponEmitidoWhereInput = {};

    if (estado && estado !== 'all') {
      where.estado = estado.toUpperCase();
    }

    if (q && q.trim().length > 0) {
      const termino = q.trim();
      where.OR = [
        { codigo: { contains: termino, mode: 'insensitive' } },
        { pedidoOrigen: { codigo: { contains: termino, mode: 'insensitive' } } },
        { pedidoCanje: { codigo: { contains: termino, mode: 'insensitive' } } },
      ];
    }

    const emitidosDb = await this.prisma.cuponEmitido.findMany({
      where,
      orderBy: { creado_en: 'desc' },
      include: {
        cupon: true,
        pedidoOrigen: { select: { id: true, codigo: true } },
        pedidoCanje: { select: { id: true, codigo: true } },
      },
      take: 200,
    });

    const ahora = new Date();
    return emitidosDb.map((e) => {
      let estadoCalculado = e.estado as any;
      if (estadoCalculado === 'VIGENTE' && e.vence_en && e.vence_en < ahora) {
        estadoCalculado = 'VENCIDO';
      }

      return {
        id: e.id.toString(),
        cuponId: e.cupon_id.toString(),
        codigo: e.codigo,
        pedidoOrigenId: e.pedidoOrigen ? e.pedidoOrigen.codigo : (e.pedido_origen_id ? e.pedido_origen_id.toString() : null),
        venceEn: e.vence_en ? e.vence_en.toISOString() : null,
        estado: estadoCalculado,
        canjeadoEn: e.canjeado_en ? e.canjeado_en.toISOString() : null,
        pedidoCanjeId: e.pedidoCanje ? e.pedidoCanje.codigo : (e.pedido_canje_id ? e.pedido_canje_id.toString() : null),
        motivoAnulacion: e.motivo_anulacion,
        anuladoEn: e.anulado_en ? e.anulado_en.toISOString() : null,
        anuladoPor: e.anulado_por ? e.anulado_por.toString() : null,
        creadoEn: e.creado_en.toISOString(),
        cuponCodigoBase: e.cupon.codigo_base,
        cuponDescripcion: e.cupon.descripcion,
        descuentoTipo: e.cupon.descuento_tipo as any,
        descuentoValor: Number(e.cupon.descuento_valor),
      };
    });
  }

  async anularCuponEmitido(id: bigint | string | number, dto: AnularCuponEmitidoDto, usuario?: any): Promise<CuponEmitidoItem> {
    const emitido = await this.prisma.cuponEmitido.findUnique({
      where: { id: BigInt(id) },
      include: { cupon: true },
    });

    if (!emitido) {
      throw new NotFoundException({
        codigo: 'CUPON_EMITIDO_NO_ENCONTRADO',
        mensaje: `No se encontró el cupón emitido con id ${id}`,
      });
    }

    if (emitido.estado !== 'VIGENTE') {
      throw new BadRequestException({
        codigo: 'CUPON_NO_VIGENTE',
        mensaje: `Solo se pueden anular cupones en estado VIGENTE (estado actual: ${emitido.estado})`,
      });
    }

    const anulado = await this.prisma.cuponEmitido.update({
      where: { id: BigInt(id) },
      data: {
        estado: 'ANULADO',
        motivo_anulacion: dto.motivo.trim(),
        anulado_en: new Date(),
        anulado_por: usuario?.partyId ? BigInt(usuario.partyId) : null,
      },
      include: { cupon: true },
    });

    await this.auditoriaService.registrar({
      categoria: 'CAMBIO',
      modulo: 'cupones',
      accion: 'anular_emitido',
      entidad: 'cupon_emitido',
      entidadId: BigInt(id),
      motivo: dto.motivo.trim(),
      despues: { estado: 'ANULADO', motivo: dto.motivo.trim() },
      partyId: usuario?.partyId,
    });

    this.eventosGateway.emitirAdmin('cupones:emitido_anulado', { id: id.toString(), codigo: anulado.codigo });

    return {
      id: anulado.id.toString(),
      cuponId: anulado.cupon_id.toString(),
      codigo: anulado.codigo,
      pedidoOrigenId: anulado.pedido_origen_id ? anulado.pedido_origen_id.toString() : null,
      venceEn: anulado.vence_en ? anulado.vence_en.toISOString() : null,
      estado: 'ANULADO',
      canjeadoEn: anulado.canjeado_en ? anulado.canjeado_en.toISOString() : null,
      pedidoCanjeId: anulado.pedido_canje_id ? anulado.pedido_canje_id.toString() : null,
      motivoAnulacion: anulado.motivo_anulacion,
      anuladoEn: anulado.anulado_en ? anulado.anulado_en.toISOString() : null,
      anuladoPor: anulado.anulado_por ? anulado.anulado_por.toString() : null,
      creadoEn: anulado.creado_en.toISOString(),
      cuponCodigoBase: anulado.cupon.codigo_base,
      cuponDescripcion: anulado.cupon.descripcion,
      descuentoTipo: anulado.cupon.descuento_tipo as any,
      descuentoValor: Number(anulado.cupon.descuento_valor),
    };
  }

  // ==========================================
  // VALIDACIÓN Y CANJE DE CUPONES
  // ==========================================

  async validarCuponParaCarta(dto: ValidarCuponDto, ipCliente?: string) {
    const claveBloqueo = `bloqueo_cupon:${ipCliente || 'anon'}`;
    const redis = this.redisService.obtenerCliente();

    // V11 / RN-CAP-133: Bloqueo de 5 intentos fallidos durante 5 minutos (300 s)
    try {
      const intentos = await redis.get(claveBloqueo);
      if (intentos && parseInt(intentos, 10) >= 5) {
        throw new HttpException(
          {
            codigo: 'CUPON_BLOQUEADO',
            mensaje: 'Demasiados intentos fallidos con códigos. Intenta de nuevo en 5 minutos.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (e) {
      if (e instanceof HttpException) throw e;
      // Si redis falla, no detenemos la consulta
    }

    try {
      const res = await this.validarCuponInterno(dto);
      // Éxito: borra intentos fallidos
      try {
        await redis.del(claveBloqueo);
      } catch {
        // Ignora
      }
      return res;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException) {
        try {
          const actual = await redis.incr(claveBloqueo);
          if (actual === 1) {
            await redis.expire(claveBloqueo, 300);
          }
        } catch {
          // Ignora
        }
      }
      throw error;
    }
  }

  private async validarCuponInterno(dto: ValidarCuponDto) {
    const codigoNorm = dto.codigo.trim().toUpperCase();
    const ahora = new Date();

    // 1. Verificar si es un cupón emitido (UNICO_COMPROBANTE)
    const cuponEmitido = await this.prisma.cuponEmitido.findUnique({
      where: { codigo: codigoNorm },
      include: {
        cupon: {
          include: { categoria: true, producto: true },
        },
      },
    });

    if (cuponEmitido) {
      if (cuponEmitido.estado === 'CANJEADO') {
        throw new BadRequestException({
          codigo: 'CUPON_YA_CANJEADO',
          mensaje: 'Este cupón ya fue canjeado',
        });
      }
      if (cuponEmitido.estado === 'ANULADO') {
        throw new BadRequestException({
          codigo: 'CUPON_ANULADO',
          mensaje: 'Este cupón fue anulado',
        });
      }
      if (cuponEmitido.estado === 'VENCIDO' || (cuponEmitido.vence_en && cuponEmitido.vence_en < ahora)) {
        throw new BadRequestException({
          codigo: 'CUPON_VENCIDO',
          mensaje: 'Este cupón está vencido',
        });
      }
      if (!cuponEmitido.cupon.activo) {
        throw new BadRequestException({
          codigo: 'CUPON_INACTIVO',
          mensaje: 'La campaña de este cupón ya no se encuentra activa',
        });
      }

      const cuponPadre = cuponEmitido.cupon;
      return this.calcularDescuentoCupon(cuponPadre, dto, cuponEmitido.id);
    }

    // 2. Verificar si es un cupón de campaña (COMPARTIDO)
    const cuponCompartido = await this.prisma.cupon.findUnique({
      where: { codigo_base: codigoNorm },
      include: { categoria: true, producto: true },
    });

    if (!cuponCompartido) {
      throw new NotFoundException({
        codigo: 'CUPON_INVALIDO',
        mensaje: 'El código de cupón no existe',
      });
    }

    if (cuponCompartido.modo !== 'COMPARTIDO') {
      throw new BadRequestException({
        codigo: 'CUPON_NO_CANJEABLE',
        mensaje: 'Este código corresponde a una plantilla de comprobante, no a un cupón emitido',
      });
    }

    if (!cuponCompartido.activo) {
      throw new BadRequestException({
        codigo: 'CUPON_INACTIVO',
        mensaje: 'Este cupón no se encuentra activo',
      });
    }

    if (cuponCompartido.tope_usos !== null && cuponCompartido.usos_actuales >= cuponCompartido.tope_usos) {
      throw new BadRequestException({
        codigo: 'CUPON_AGOTADO',
        mensaje: 'Se agotaron los usos de este cupón',
      });
    }

    if (cuponCompartido.requiere_cuenta && !dto.clientePartyId) {
      throw new BadRequestException({
        codigo: 'CUPON_REQUIERE_CUENTA',
        mensaje: 'Este cupón requiere que realices el pedido con tu cuenta de cliente',
      });
    }

    if (cuponCompartido.max_por_cliente && dto.clientePartyId) {
      const canjesCliente = await this.prisma.cuponCanjeCompartido.count({
        where: {
          cupon_id: cuponCompartido.id,
          party_id: BigInt(dto.clientePartyId),
        },
      });

      if (canjesCliente >= cuponCompartido.max_por_cliente) {
        throw new BadRequestException({
          codigo: 'CUPON_LIMITE_CLIENTE',
          mensaje: 'Ya alcanzaste el límite de usos permitidos para este cupón',
        });
      }
    }

    return this.calcularDescuentoCupon(cuponCompartido, dto, null);
  }

  private calcularDescuentoCupon(cupon: any, dto: ValidarCuponDto, cuponEmitidoId: bigint | null) {
    const compraMinima = cupon.compra_minima ? Number(cupon.compra_minima) : 0;
    if (dto.subtotal < compraMinima) {
      throw new BadRequestException({
        codigo: 'COMPRA_MINIMA_NO_ALCANZADA',
        mensaje: `Este cupón exige una compra mínima de S/ ${compraMinima.toFixed(2)} (subtotal actual: S/ ${dto.subtotal.toFixed(2)})`,
      });
    }

    // Base imponible del descuento según alcance (toda la carta, categoría o producto)
    let baseCalculo = dto.subtotal;
    if (cupon.categoria_id && Array.isArray(dto.lineas)) {
      const catIdStr = cupon.categoria_id.toString();
      const lineasCat = dto.lineas.filter((l) => l.categoriaId && l.categoriaId.toString() === catIdStr);
      baseCalculo = lineasCat.reduce((acc, l) => acc + (l.subtotal || 0), 0);
      if (baseCalculo <= 0) {
        throw new BadRequestException({
          codigo: 'ALCANCE_CATEGORIA',
          mensaje: `Este cupón solo aplica a productos de la categoría ${cupon.categoria?.nombre || ''}`,
        });
      }
    } else if (cupon.producto_id && Array.isArray(dto.lineas)) {
      const prodIdStr = cupon.producto_id.toString();
      const lineasProd = dto.lineas.filter((l) => l.productoId && l.productoId.toString() === prodIdStr);
      baseCalculo = lineasProd.reduce((acc, l) => acc + (l.subtotal || 0), 0);
      if (baseCalculo <= 0) {
        throw new BadRequestException({
          codigo: 'ALCANCE_PRODUCTO',
          mensaje: `Este cupón solo aplica al producto ${cupon.producto?.nombre || ''}`,
        });
      }
    }

    const valor = Number(cupon.descuento_valor);
    let descuentoMonto = 0;
    if (cupon.descuento_tipo === 'PORCENTAJE') {
      descuentoMonto = Number(((baseCalculo * valor) / 100).toFixed(2));
    } else {
      descuentoMonto = Math.min(valor, baseCalculo);
    }

    return {
      valido: true,
      mensaje: `Cupón ${cupon.codigo_base} aplicado con éxito`,
      cupon: {
        id: cupon.id.toString(),
        emitidoId: cuponEmitidoId ? cuponEmitidoId.toString() : null,
        codigoBase: cupon.codigo_base,
        descripcion: cupon.descripcion,
        tipo: cupon.descuento_tipo,
        valor,
        descuentoCalculado: Number(descuentoMonto.toFixed(2)),
      },
    };
  }

  async canjearCuponEnCaja(dto: CanjearCuponDto, usuario?: any) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: BigInt(dto.pedidoId) },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: `No se encontró el pedido ${dto.pedidoId}`,
      });
    }

    const validacion = await this.validarCuponParaCarta({
      codigo: dto.codigo,
      subtotal: Number(pedido.subtotal),
      clientePartyId: partyClienteDelPedido(pedido),
    });

    const descuento = validacion.cupon.descuentoCalculado;
    const nuevoTotal = Math.max(0, Number((Number(pedido.subtotal) - descuento + (Number(pedido.envio) || 0)).toFixed(2)));

    await this.prisma.$transaction(async (tx) => {
      if (validacion.cupon.emitidoId) {
        await tx.cuponEmitido.update({
          where: { id: BigInt(validacion.cupon.emitidoId) },
          data: {
            estado: 'CANJEADO',
            canjeado_en: new Date(),
            pedido_canje_id: pedido.id,
          },
        });
      } else {
        await tx.cupon.update({
          where: { id: BigInt(validacion.cupon.id) },
          data: { usos_actuales: { increment: 1 } },
        });

        await tx.cuponCanjeCompartido.create({
          data: {
            cupon_id: BigInt(validacion.cupon.id),
            pedido_id: pedido.id,
            party_id: partyClienteDelPedido(pedido),
          },
        });
      }

      await tx.pedido.update({
        where: { id: pedido.id },
        data: {
          cupon_id: BigInt(validacion.cupon.id),
          cupon_emitido_id: validacion.cupon.emitidoId ? BigInt(validacion.cupon.emitidoId) : null,
          descuento: new Prisma.Decimal(descuento),
          total: new Prisma.Decimal(nuevoTotal),
          descuento_detalle: {
            tipo: 'CUPON',
            codigo: dto.codigo.trim().toUpperCase(),
            monto: descuento,
          },
        },
      });
    });

    await this.auditoriaService.registrar({
      categoria: 'CAMBIO',
      modulo: 'cupones',
      accion: 'canjear',
      entidad: 'pedido',
      entidadId: pedido.id,
      despues: { codigo: dto.codigo, descuento, nuevoTotal },
      partyId: usuario?.partyId,
    });

    this.eventosGateway.emitirAdmin('pedidos:actualizado', { id: pedido.id.toString() });

    return {
      canjeado: true,
      descuento,
      totalActualizado: nuevoTotal,
    };
  }

  // ==========================================
  // EMISIÓN DE CUPONES EN COMPROBANTE (RN-CAP-135, IDEMPOTENTE)
  // ==========================================

  async emitirCuponesParaPedido(pedidoId: bigint | string | number): Promise<CuponEmitidoItem[]> {
    const idBig = BigInt(pedidoId);

    // 1. Idempotencia estricta: si ya se emitieron cupones para este pedido, devolver los existentes (RN-CAP-135)
    const existentes = await this.prisma.cuponEmitido.findMany({
      where: { pedido_origen_id: idBig },
      include: { cupon: true },
    });

    if (existentes.length > 0) {
      return existentes.map((e) => ({
        id: e.id.toString(),
        cuponId: e.cupon_id.toString(),
        codigo: e.codigo,
        pedidoOrigenId: pedidoId.toString(),
        venceEn: e.vence_en ? e.vence_en.toISOString() : null,
        estado: e.estado as any,
        canjeadoEn: e.canjeado_en ? e.canjeado_en.toISOString() : null,
        pedidoCanjeId: e.pedido_canje_id ? e.pedido_canje_id.toString() : null,
        motivoAnulacion: e.motivo_anulacion,
        anuladoEn: e.anulado_en ? e.anulado_en.toISOString() : null,
        anuladoPor: e.anulado_por ? e.anulado_por.toString() : null,
        creadoEn: e.creado_en.toISOString(),
        cuponCodigoBase: e.cupon.codigo_base,
        cuponDescripcion: e.cupon.descripcion,
        descuentoTipo: e.cupon.descuento_tipo as any,
        descuentoValor: Number(e.cupon.descuento_valor),
      }));
    }

    // 2. Consultar regla de acumulación para saber cuántos cupones sortear (por defecto 2)
    const regla = await this.obtenerReglasAcumulacion();
    const cantidadASortear = regla.cuponesPorComprobante;
    if (cantidadASortear <= 0) {
      return [];
    }

    // 3. Buscar cupones de modo UNICO_COMPROBANTE activos
    const cuponesCandidatos = await this.prisma.cupon.findMany({
      where: {
        modo: 'UNICO_COMPROBANTE',
        activo: true,
      },
    });

    if (cuponesCandidatos.length === 0) {
      return [];
    }

    // 4. Sorteo al azar de hasta N cupones
    const barajados = [...cuponesCandidatos].sort(() => 0.5 - Math.random());
    const seleccionados = barajados.slice(0, Math.min(cantidadASortear, barajados.length));

    const ahora = new Date();
    const nuevosEmitidos: any[] = [];

    for (const c of seleccionados) {
      const codigoUnico = generarCodigoCuponUnico(c.codigo_base);
      const dias = c.dias_validez || 15;
      const venceEn = new Date(ahora.getTime() + dias * 24 * 60 * 60 * 1000);

      const emitido = await this.prisma.cuponEmitido.create({
        data: {
          cupon_id: c.id,
          codigo: codigoUnico,
          pedido_origen_id: idBig,
          vence_en: venceEn,
          estado: 'VIGENTE',
        },
        include: { cupon: true },
      });

      nuevosEmitidos.push(emitido);
    }

    this.eventosGateway.emitirAdmin('cupones:emitidos', {
      pedidoId: pedidoId.toString(),
      cantidad: nuevosEmitidos.length,
    });

    return nuevosEmitidos.map((e) => ({
      id: e.id.toString(),
      cuponId: e.cupon_id.toString(),
      codigo: e.codigo,
      pedidoOrigenId: pedidoId.toString(),
      venceEn: e.vence_en ? e.vence_en.toISOString() : null,
      estado: e.estado as any,
      canjeadoEn: null,
      pedidoCanjeId: null,
      motivoAnulacion: null,
      anuladoEn: null,
      anuladoPor: null,
      creadoEn: e.creado_en.toISOString(),
      cuponCodigoBase: e.cupon.codigo_base,
      cuponDescripcion: e.cupon.descripcion,
      descuentoTipo: e.cupon.descuento_tipo as any,
      descuentoValor: Number(e.cupon.descuento_valor),
    }));
  }

  // ==========================================
  // CÁLCULO DE DESCUENTOS Y PROMOCIONES PARA PEDIDO
  // ==========================================

  /** Igual que al crear el pedido, pero sin guardar nada: sirve para mostrar el total antes de enviar. */
  async vistaPreviaDescuentos(
    lineas: { productoId: string; cantidad: number; subtotal: number; precioUnitario: number }[],
    cuponCodigo?: string,
    clientePartyId?: string | null,
  ): Promise<{ descuentoTotal: number; montoCanjeable: number; puntosEstimados: number; puntosPorcentaje: number; detalles: { tipo: string; nombre: string; monto: number }[] }> {
    const param = await Promise.resolve().then(() => this.prisma.parametro.findUnique({ where: { clave: 'puntos_porcentaje' } })).catch(() => null);
    const puntosPorcentaje = param && param.valor !== null && param.valor !== undefined ? Number(param.valor) : 5;
    const validas = (lineas || []).filter((l) => /^\d+$/.test(String(l.productoId)) && Number(l.cantidad) > 0);
    if (validas.length === 0) return { descuentoTotal: 0, montoCanjeable: 0, puntosEstimados: 0, puntosPorcentaje, detalles: [] };
    const productos = await this.prisma.producto.findMany({
      where: { id: { in: validas.map((l) => BigInt(l.productoId)) } },
      select: { id: true, categoria_id: true, no_suma_beneficios: true },
    });
    const porId = new Map(productos.map((p) => [String(p.id), p]));
    const lineasCalc = validas.map((l) => {
      const prod = porId.get(String(l.productoId));
      return {
        productoId: BigInt(l.productoId),
        categoriaId: prod?.categoria_id ?? null,
        cantidad: Number(l.cantidad),
        subtotal: Number(l.subtotal),
        precioUnitario: Number(l.precioUnitario),
        noSumaBeneficios: prod?.no_suma_beneficios ?? false,
      };
    });
    const subtotal = Number(lineasCalc.reduce((a, l) => a + l.subtotal, 0).toFixed(2));
    const desglose = await this.calcularDescuentosParaPedido({
      subtotal,
      lineas: lineasCalc,
      canal: 'CARTA',
      cuponCodigo: cuponCodigo || null,
      clientePartyId: clientePartyId || null,
      clienteConSesion: !!clientePartyId,
    });
    const conCupon = !!(desglose.cuponId || desglose.cuponEmitidoId);
    const montoCanjeable = montoElegiblePuntos(lineasCalc, conCupon ? [] : desglose.detalles);
    return {
      descuentoTotal: desglose.descuentoTotal,
      montoCanjeable,
      // con cupón no se suman puntos (DT-56); misma base y porcentaje que PuntosService.acumularPorPedido
      puntosEstimados: conCupon ? 0 : Math.round(montoCanjeable * (puntosPorcentaje / 100) * 100) / 100,
      puntosPorcentaje,
      detalles: (desglose.detalles || []).map((d: any) => ({ tipo: String(d.tipo ?? ''), nombre: String(d.nombre ?? ''), monto: Number(d.montoDescontado ?? 0) })),
    };
  }

  async calcularDescuentosParaPedido(params: {
    subtotal: number;
    lineas: Array<{
      productoId: bigint;
      categoriaId?: bigint | null;
      cantidad: number;
      subtotal: number;
      precioUnitario: number;
      noSumaBeneficios?: boolean;
    }>;
    canal: string;
    cuponCodigo?: string | null;
    clientePartyId?: bigint | string | number | null;
    /** true solo si el cliente tiene sesión iniciada en la carta (cuenta con celular verificado) */
    clienteConSesion?: boolean;
  }): Promise<DesgloseDescuentosPedido> {
    const { subtotal, lineas, canal, cuponCodigo, clientePartyId, clienteConSesion } = params;

    // Bot de WhatsApp (decisión del dueño): sin promociones, combos, 2x1 ni cupones. El total es el precio de lista.
    // Los pedidos de carta, caja y mozo no cambian. El envío y el pedido mínimo de delivery se calculan aparte.
    if (canal === 'BOT' || canal === 'WHATSAPP') {
      return { descuentoTotal: 0, ofertaId: null, cuponId: null, cuponEmitidoId: null, detalles: [] };
    }

    const regla = await this.obtenerReglasAcumulacion();
    const ahora = new Date();

    // 1. Evaluar descuentos automáticos y promociones vigentes (RN-CAP-132, RQ-OFE-02-05, RQ-OFE-01-04)
    const descuentosCandidatos = await this.prisma.oferta.findMany({
      where: {
        tipo: { in: ['DESCUENTO', 'LLEVA_PAGA'] },
        activo: true,
      },
      include: { categoria: true, producto: true },
    });

    const descuentosVigentes = descuentosCandidatos.filter((d) => estaVigente(d, canal, ahora));

    // Primera compra: solo sobre líneas que no estén en otra promoción automática vigente (no se acumulan)
    const promosAutomaticas = descuentosVigentes.filter((d) => !d.solo_primera_compra);

    // Un combo tiene precio propio: su producto nunca recibe descuento ni entra a 2x1 (además de no_suma_beneficios, DT-65)
    const combos = await this.prisma.oferta.findMany({
      where: { tipo: 'COMBO', alcance_producto_id: { not: null } },
      select: { alcance_producto_id: true },
    });
    const productosCombo = new Set(combos.map((c) => String(c.alcance_producto_id)));
    const lineasElegibles = lineas.filter(
      (l) => !l.noSumaBeneficios && !productosCombo.has(String(l.productoId)),
    );

    const lineasSinPromo = lineasElegibles.filter((l) => !promosAutomaticas.some((p) => alcanceCubreLinea(p, l)));
    let primeraCompraPermitida: boolean | null = null;

    let mejorDescuentoAutomatico: {
      oferta: any;
      monto: number;
      detalles: DetalleDescuentoAplicado;
    } | null = null;

    for (const d of descuentosVigentes) {
      const minCompra = d.compra_minima ? Number(d.compra_minima) : 0;
      if (subtotal < minCompra) continue;

      let monto = 0;
      const lineasAfectadas: any[] = [];

      if (d.solo_primera_compra) {
        if (!clienteConSesion || !clientePartyId) continue;
        primeraCompraPermitida ??= await this.clienteEsPrimeraCompra(BigInt(clientePartyId));
        if (!primeraCompraPermitida) continue;
      }

      if (d.tipo === 'DESCUENTO') {
        let baseLinea = 0;
        const elegibles = d.solo_primera_compra ? lineasSinPromo : lineasElegibles;

        if (d.alcance_categoria_id) {
          const matching = elegibles.filter(
            (l) => l.categoriaId && l.categoriaId === d.alcance_categoria_id,
          );
          for (const m of matching) {
            baseLinea += m.subtotal;
            lineasAfectadas.push({
              productoId: m.productoId.toString(),
              cantidad: m.cantidad,
              subtotal: m.subtotal,
              descuento: 0,
            });
          }
        } else if (d.alcance_producto_id) {
          const matching = elegibles.filter((l) => l.productoId === d.alcance_producto_id);
          for (const m of matching) {
            baseLinea += m.subtotal;
            lineasAfectadas.push({
              productoId: m.productoId.toString(),
              cantidad: m.cantidad,
              subtotal: m.subtotal,
              descuento: 0,
            });
          }
        } else {
          // Toda la carta
          baseLinea = elegibles.reduce((acc, l) => acc + l.subtotal, 0);
          for (const l of elegibles) {
            lineasAfectadas.push({
              productoId: l.productoId.toString(),
              cantidad: l.cantidad,
              subtotal: l.subtotal,
              descuento: 0,
            });
          }
        }

        if (baseLinea <= 0) continue;

        const valor = Number(d.descuento_valor);
        if (d.descuento_tipo === 'PORCENTAJE') {
          monto = Number(((baseLinea * valor) / 100).toFixed(2));
        } else {
          monto = Math.min(valor, baseLinea);
        }
      } else if (d.tipo === 'LLEVA_PAGA') {
        const lleva = d.lleva || 2;
        const paga = d.paga || 1;
        if (lleva <= paga || lleva <= 0) continue;

        let matching: typeof lineasElegibles = [];
        if (d.alcance_producto_id) {
          matching = lineasElegibles.filter((l) => l.productoId === d.alcance_producto_id);
        } else if (d.alcance_categoria_id) {
          matching = lineasElegibles.filter((l) => l.categoriaId && l.categoriaId === d.alcance_categoria_id);
        } else {
          matching = lineasElegibles;
        }

        if (matching.length === 0) continue;

        const preciosUnidades: number[] = [];
        for (const m of matching) {
          for (let u = 0; u < m.cantidad; u++) {
            preciosUnidades.push(m.precioUnitario);
          }
          lineasAfectadas.push({
            productoId: m.productoId.toString(),
            cantidad: m.cantidad,
            subtotal: m.subtotal,
            descuento: 0,
          });
        }

        const totalUnidades = preciosUnidades.length;
        if (totalUnidades < lleva) continue;

        const numGrupos = Math.floor(totalUnidades / lleva);
        const unidadesBonificadas = numGrupos * (lleva - paga);

        preciosUnidades.sort((a, b) => a - b);
        monto = Number(
          preciosUnidades.slice(0, unidadesBonificadas).reduce((acc, p) => acc + p, 0).toFixed(2),
        );
      }

      if (monto <= 0) continue;

      if (!mejorDescuentoAutomatico || monto > mejorDescuentoAutomatico.monto) {
        mejorDescuentoAutomatico = {
          oferta: d,
          monto,
          detalles: {
            tipo: d.tipo === 'LLEVA_PAGA' ? 'PROMO' : 'DESCUENTO',
            id: d.id.toString(),
            nombre: d.nombre,
            descuentoTipo: d.tipo === 'LLEVA_PAGA' ? 'MONTO' : (d.descuento_tipo as any),
            descuentoValor: d.tipo === 'LLEVA_PAGA' ? monto : Number(d.descuento_valor),
            montoDescontado: monto,
            alcance: d.alcance_categoria_id ? 'CATEGORIA' : (d.alcance_producto_id ? 'PRODUCTO' : 'TODA'),
            alcanceId: d.alcance_categoria_id ? d.alcance_categoria_id.toString() : (d.alcance_producto_id ? d.alcance_producto_id.toString() : null),
            lineasAfectadas,
          },
        };
      }
    }

    // 2. Evaluar cupón si fue ingresado
    let cuponEvaluado: {
      cuponId: string;
      cuponEmitidoId: string | null;
      monto: number;
      detalles: DetalleDescuentoAplicado;
    } | null = null;

    if (cuponCodigo && cuponCodigo.trim().length > 0) {
      try {
        const val = await this.validarCuponParaCarta({
          codigo: cuponCodigo,
          subtotal,
          lineas: lineasElegibles.map((l) => ({
            productoId: l.productoId.toString(),
            categoriaId: l.categoriaId ? l.categoriaId.toString() : undefined,
            cantidad: l.cantidad,
            subtotal: l.subtotal,
          })),
          clientePartyId,
        });

        cuponEvaluado = {
          cuponId: val.cupon.id,
          cuponEmitidoId: val.cupon.emitidoId,
          monto: val.cupon.descuentoCalculado,
          detalles: {
            tipo: 'CUPON',
            id: val.cupon.id,
            codigo: cuponCodigo.trim().toUpperCase(),
            nombre: `Cupón ${val.cupon.codigoBase}`,
            descuentoTipo: val.cupon.tipo as any,
            descuentoValor: val.cupon.valor,
            montoDescontado: val.cupon.descuentoCalculado,
          },
        };
      } catch (err: any) {
        this.logger.warn(`Cupón ${cuponCodigo} no aplicó: ${err.message}`);
        throw err;
      }
    }

    // 3. Resolver acumulación (RN-CAP-070, D-10)
    // cupon_con_descuento indica si un cupón se combina con descuento automático
    const permiteAcumulacion = regla.cuponConDescuento;

    const detallesFinales: DetalleDescuentoAplicado[] = [];
    let ofertaIdFinal: string | null = null;
    let cuponIdFinal: string | null = null;
    let cuponEmitidoIdFinal: string | null = null;
    let descuentoTotal = 0;

    if (cuponEvaluado && mejorDescuentoAutomatico) {
      if (permiteAcumulacion) {
        detallesFinales.push(mejorDescuentoAutomatico.detalles);
        detallesFinales.push(cuponEvaluado.detalles);
        ofertaIdFinal = mejorDescuentoAutomatico.oferta.id.toString();
        cuponIdFinal = cuponEvaluado.cuponId;
        cuponEmitidoIdFinal = cuponEvaluado.cuponEmitidoId;
        descuentoTotal = Number((mejorDescuentoAutomatico.monto + cuponEvaluado.monto).toFixed(2));
      } else {
        // Si no acumulan, aplica el cupón ingresado voluntariamente por el usuario (o el mejor)
        if (cuponEvaluado.monto >= mejorDescuentoAutomatico.monto) {
          detallesFinales.push(cuponEvaluado.detalles);
          cuponIdFinal = cuponEvaluado.cuponId;
          cuponEmitidoIdFinal = cuponEvaluado.cuponEmitidoId;
          descuentoTotal = cuponEvaluado.monto;
        } else {
          detallesFinales.push(mejorDescuentoAutomatico.detalles);
          ofertaIdFinal = mejorDescuentoAutomatico.oferta.id.toString();
          descuentoTotal = mejorDescuentoAutomatico.monto;
        }
      }
    } else if (cuponEvaluado) {
      detallesFinales.push(cuponEvaluado.detalles);
      cuponIdFinal = cuponEvaluado.cuponId;
      cuponEmitidoIdFinal = cuponEvaluado.cuponEmitidoId;
      descuentoTotal = cuponEvaluado.monto;
    } else if (mejorDescuentoAutomatico) {
      detallesFinales.push(mejorDescuentoAutomatico.detalles);
      ofertaIdFinal = mejorDescuentoAutomatico.oferta.id.toString();
      descuentoTotal = mejorDescuentoAutomatico.monto;
    }

    return {
      descuentoTotal: Number(descuentoTotal.toFixed(2)),
      ofertaId: ofertaIdFinal,
      cuponId: cuponIdFinal,
      cuponEmitidoId: cuponEmitidoIdFinal,
      detalles: detallesFinales,
    };
  }

  // ==========================================
  // MAPEOS AUXILIARES
  // ==========================================

  /**
   * Al crear el pedido: cada parte FIJO elegida debe ser el principal disponible o un reemplazo disponible.
   * Devuelve la nota para comanda y ticket, p. ej. «Combo Dúo · Empanada (en lugar de Club Sandwich)».
   */
  async validarEleccionesCombo(
    ofertaId: bigint | string | number,
    elecciones: { parteId: string | number; productoId: string | number }[],
  ): Promise<string> {
    const oferta = await this.obtenerOfertaPorId(ofertaId);
    if (oferta.tipo !== 'COMBO') return '';
    const noDisponible = (mensaje: string) =>
      new ConflictException({ codigo: 'COMBO_PARTE_NO_DISPONIBLE', mensaje });
    if (oferta.disponible === false) throw noDisponible(`${oferta.nombre} está agotado: ${oferta.motivoAgotado ?? ''}`.trim());

    const cambios: string[] = [];
    for (const parte of (oferta.combosParte ?? []).filter((p) => p.tipo === 'FIJO')) {
      const elegido = elecciones.find((e) => String(e.parteId) === parte.id)?.productoId;
      const idElegido = elegido !== undefined ? String(elegido) : parte.opcionesDisponibles?.[0];
      if (!idElegido || !parte.opcionesDisponibles?.includes(idElegido)) {
        const prod = idElegido
          ? await this.prisma.producto.findMany({ where: { id: { in: [BigInt(idElegido)] } }, select: { nombre: true } })
          : [];
        throw noDisponible(`${prod[0]?.nombre ?? 'El producto elegido'} se acaba de agotar; elige otro reemplazo`);
      }
      if (idElegido !== parte.productos[0]) {
        const nombres = await this.prisma.producto.findMany({
          where: { id: { in: [BigInt(idElegido), BigInt(parte.productos[0])] } },
          select: { id: true, nombre: true },
        });
        const n = (id: string) => nombres.find((x) => x.id.toString() === id)?.nombre ?? '';
        cambios.push(`${n(idElegido)} (en lugar de ${n(parte.productos[0])})`);
      }
    }
    return cambios.length ? `${oferta.nombre} · ${cambios.join(' · ')}` : '';
  }

  /** Reemplazos (plan B, C...) de una parte FIJO: sin repetir, sin el principal y solo productos que existan. */
  private async guardarReemplazos(
    tx: Prisma.TransactionClient,
    partePk: bigint,
    tipo: string,
    principales: bigint[],
    reemplazos?: (string | number)[],
  ): Promise<void> {
    if (tipo !== 'FIJO' || !Array.isArray(reemplazos) || reemplazos.length === 0) return;
    const ids = reemplazos.map((r) => BigInt(r));
    if (new Set(ids.map(String)).size !== ids.length || ids.some((i) => principales.includes(i))) {
      throw new BadRequestException({
        codigo: 'COMBO_REEMPLAZO_INVALIDO',
        mensaje: 'Los reemplazos no pueden repetirse ni incluir el producto principal',
      });
    }
    const existentes = await tx.producto.findMany({ where: { id: { in: ids } }, select: { id: true } });
    if (existentes.length !== ids.length) {
      throw new BadRequestException({
        codigo: 'COMBO_REEMPLAZO_INVALIDO',
        mensaje: 'Algún reemplazo no es un producto de la carta',
      });
    }
    await tx.comboParteReemplazo.createMany({
      data: ids.map((producto_id, orden) => ({ combo_parte_id: partePk, producto_id, orden })),
    });
  }

  /** Agrega `disponible`, `motivoAgotado` y por parte `opcionesDisponibles` a los combos (tiempo real, no toca `activo`). */
  private async conDisponibilidad(items: OfertaItem[]): Promise<OfertaItem[]> {
    const combos = items.filter((i) => i.tipo === 'COMBO' && i.combosParte?.length);
    if (combos.length === 0) return items;
    const partes = combos.flatMap((c) => c.combosParte!);
    const ids = new Set<bigint>();
    const cats = new Set<bigint>();
    for (const p of partes) {
      [...p.productos, ...(p.reemplazos ?? [])].forEach((x) => ids.add(BigInt(x)));
      p.categorias.forEach((x) => cats.add(BigInt(x)));
    }
    const filas = await this.prisma.producto.findMany({
      where: { OR: [{ id: { in: [...ids] } }, { categoria_id: { in: [...cats] } }] },
      select: { id: true, nombre: true, categoria_id: true, oculto: true, agotado_hasta: true },
    });
    const productos: ProductoDisp[] = filas.map((f) => ({
      id: f.id.toString(),
      nombre: f.nombre,
      categoriaId: f.categoria_id.toString(),
      oculto: f.oculto,
      agotadoHasta: f.agotado_hasta,
    }));
    for (const c of combos) {
      const r = calcularDisponibilidadCombo(
        c.combosParte!.map((p) => ({ ...p, reemplazos: p.reemplazos ?? [] })),
        productos,
      );
      c.disponible = r.disponible;
      c.motivoAgotado = r.motivoAgotado;
      c.combosParte!.forEach((p, i) => {
        p.disponible = r.partes[i].disponible;
        p.opcionesDisponibles = r.partes[i].opcionesDisponibles;
        if (p.tipo === 'FIJO') p.principalNombre = productos.find((x) => x.id === p.productos[0])?.nombre ?? '';
      });
    }
    return items;
  }

  /** Reglas de la promoción de primera compra: solo descuentos, solo carta web y como máximo un mes de vigencia. */
  private validarPrimeraCompra(o: { tipo: string; soloPrimeraCompra: boolean; fechaDesde: Date | null; fechaHasta: Date | null }): void {
    if (!o.soloPrimeraCompra) return;
    if (o.tipo !== 'DESCUENTO') {
      throw new BadRequestException({ codigo: 'PRIMERA_COMPRA_SOLO_DESCUENTO', mensaje: 'La promoción de primera compra solo puede ser un descuento automático' });
    }
    if (!o.fechaHasta) {
      throw new BadRequestException({ codigo: 'PRIMERA_COMPRA_VIGENCIA', mensaje: 'La promoción de primera compra debe tener fecha de fin (máximo un mes)' });
    }
    const inicio = o.fechaDesde ?? new Date(`${obtenerAhoraLima().fechaIso}T00:00:00.000Z`);
    const limite = new Date(inicio);
    limite.setUTCMonth(limite.getUTCMonth() + 1);
    if (o.fechaHasta > limite) {
      throw new BadRequestException({ codigo: 'PRIMERA_COMPRA_VIGENCIA', mensaje: 'La promoción de primera compra dura como máximo un mes' });
    }
  }

  /**
   * Primera compra del cliente: su celular (de la cuenta con sesión) no tiene ningún pedido válido (no anulado),
   * ni de otra cuenta ni de invitado con el mismo número. Un pedido con esta oferta ya es un pedido válido,
   * así que también cubre "ya usó esta oferta". Se busca por celular, no por nombre.
   */
  async clienteEsPrimeraCompra(partyId: bigint): Promise<boolean> {
    const cuenta = await this.prisma.customerAccount.findFirst({
      where: { party_id: partyId, activo: true },
      select: { telefono: true },
    });
    const celular = cuenta?.telefono ?? null;
    if (!celular || !/^9\d{8}$/.test(celular)) return false;
    const variantes = [celular, `51${celular}`];
    const [cuentas, contactos] = await Promise.all([
      this.prisma.customerAccount.findMany({ where: { telefono: celular }, select: { party_id: true } }),
      this.prisma.contactMechanism.findMany({
        where: { tipo: { in: ['TELEFONO', 'WHATSAPP'] }, valor: { in: variantes } },
        select: { party_id: true },
      }),
    ]);
    const partyIds = [partyId, ...cuentas.map((c) => c.party_id), ...contactos.map((c) => c.party_id)];
    const previo = await this.prisma.pedido.findFirst({
      where: {
        estado: { not: 'ANULADO' },
        OR: [
          { party_id: { in: partyIds } },
          { cliente_party_id: { in: partyIds } },
          { cliente_telefono: { in: variantes } },
        ],
      },
      select: { id: true },
    });
    return !previo;
  }

  /**
   * Promoción para el saludo del chat de WhatsApp: la activa, vigente hoy, marcada para el saludo y de menor orden.
   * Solo se muestra una. El bot la enchufa en su saludo.
   */
  async promoParaSaludo(ahora: Date = new Date()): Promise<{ titulo: string; texto: string; enlaceCarta: string } | null> {
    const candidatas = await this.prisma.oferta.findMany({
      where: { mostrar_en_saludo_bot: true, activo: true, visible_carta: true, tipo: 'DESCUENTO' },
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
    });
    const oferta = candidatas.find((o) => estaVigente(o, 'CARTA', ahora));
    if (!oferta) return null;
    const texto = oferta.solo_primera_compra
      ? `${oferta.descuento_tipo === 'MONTO' ? `S/ ${Number(oferta.descuento_valor)}` : `${Number(oferta.descuento_valor)} %`} de descuento en tu primera compra en nuestra carta online. No aplica a promociones ni combos.`
      : `${(oferta.descripcion || oferta.nombre).trim()}. Pide en nuestra carta online.`;
    const origen = urlPublicaCarta((clave) => process.env[clave]) || 'https://caprichos.pe';
    // La carta web vive en la raíz (/); /carta lo atiende la API (JSON), así que no se agrega
    return { titulo: oferta.nombre, texto, enlaceCarta: origen.replace(/\/$/, '') };
  }

  private mapearOferta(o: any, canal?: string): OfertaItem {
    return {
      id: o.id.toString(),
      tipo: o.tipo,
      nombre: o.nombre,
      descripcion: o.descripcion,
      lleva: o.lleva,
      paga: o.paga,
      alcanceCategoriaId: o.alcance_categoria_id ? o.alcance_categoria_id.toString() : null,
      alcanceProductoId: o.alcance_producto_id ? o.alcance_producto_id.toString() : null,
      descuentoTipo: o.descuento_tipo,
      descuentoValor: o.descuento_valor !== null ? Number(o.descuento_valor) : null,
      compraMinima: o.compra_minima !== null ? Number(o.compra_minima) : null,
      dias: o.dias || [],
      horaDesde: formatearHora(o.hora_desde),
      horaHasta: formatearHora(o.hora_hasta),
      fechaDesde: formatearFecha(o.fecha_desde),
      fechaHasta: formatearFecha(o.fecha_hasta),
      canales: o.canales || [],
      limiteUsos: o.limite_usos,
      usosActuales: o.usos_actuales,
      noSumaBeneficios: o.no_suma_beneficios,
      mostrarEnSaludoBot: o.mostrar_en_saludo_bot ?? false,
      soloPrimeraCompra: o.solo_primera_compra ?? false,
      orden: o.orden,
      activo: o.activo,
      visibleCarta: o.visible_carta ?? true,
      creadoEn: o.creado_en.toISOString(),
      categoriaNombre: o.categoria?.nombre || null,
      productoNombre: o.producto?.nombre || null,
      vigenteAhora: estaVigente(o, canal),
      imagenArchivoId: o.imagen_archivo_id ? o.imagen_archivo_id.toString() : null,
      imagenUrl: o.imagen_archivo
        ? o.imagen_archivo.ruta.startsWith('http')
          ? o.imagen_archivo.ruta
          : `/archivos/${o.imagen_archivo.ruta}`
        : null,
      combosPrecio: Array.isArray(o.combosPrecio)
        ? o.combosPrecio.map((cp: any) => ({
            tamanoValorId: cp.tamano_valor_id.toString(),
            tamanoNombre: cp.tamano_valor?.nombre || '',
            precio: Number(cp.precio),
          }))
        : [],
      combosParte: Array.isArray(o.combosParte)
        ? o.combosParte.map((cp: any) => ({
            id: cp.id.toString(),
            tipo: cp.tipo,
            cantidad: cp.cantidad,
            categorias: (cp.categorias || []).map((c: any) => c.toString()),
            productos: (cp.productos || []).map((p: any) => p.toString()),
            reemplazos: (cp.reemplazos || []).map((r: any) => r.producto_id.toString()),
            reemplazosDetalle: (cp.reemplazos || []).map((r: any) => ({
              id: r.producto_id.toString(),
              nombre: r.producto?.nombre ?? '',
            })),
          }))
        : [],
    };
  }

  private mapearCupon(c: any): CuponItem {
    return {
      id: c.id.toString(),
      modo: c.modo,
      codigoBase: c.codigo_base,
      descripcion: c.descripcion,
      descuentoTipo: c.descuento_tipo,
      descuentoValor: Number(c.descuento_valor),
      compraMinima: c.compra_minima !== null ? Number(c.compra_minima) : null,
      categoriaId: c.categoria_id ? c.categoria_id.toString() : null,
      productoId: c.producto_id ? c.producto_id.toString() : null,
      canales: c.canales || [],
      requiereCuenta: c.requiere_cuenta,
      diasValidez: c.dias_validez,
      topeUsos: c.tope_usos,
      usosActuales: c.usos_actuales,
      maxPorCliente: c.max_por_cliente,
      orden: c.orden,
      activo: c.activo,
      creadoEn: c.creado_en.toISOString(),
      categoriaNombre: c.categoria?.nombre || null,
      productoNombre: c.producto?.nombre || null,
    };
  }
}
