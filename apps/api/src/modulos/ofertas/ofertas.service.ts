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
import { calcularDescuentoPersonal, descuentoPersonalDeCuenta, resolverPctPersonal, validarColaborador } from '../creditos';
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
import { ValidarCuponCajaDto } from './dto/validar-cupon-caja.dto';
import {
  CuponEmitidoItem,
  CuponItem,
  DesgloseDescuentosPedido,
  DetalleDescuentoAplicado,
  OfertaItem,
  OpcionDetalleCombo,
  ParteResueltaCombo,
  ReglaAcumulacionItem,
  ResolucionCombo,
} from './ofertas.tipos';
import {
  admiteProducto,
  calcularDisponibilidadCombo,
  conSaboresDeParte,
  esParteBebidas,
  parteArmable,
  productoDisponible,
  motivoProductoBloqueado,
  productosDeParte,
  ProductoDisp,
  saborDisponible,
  cuposDeProducto,
} from './combo-disponibilidad.util';
import { estaDisponible, obtenerFotoUrl } from '../catalogo/catalogo.service';
import { sincronizarAnfitrionCombo } from './combo-anfitrion';
import { resolverTamanoValorId } from './combo-tamanos';
import { anfitrionBloqueadoPorPaso, opcionesSinStock } from '../stock/opcion-requiere';
import {
  canalesPorDefecto,
  canalOferta,
  estaVigente,
  ofertaIncluyeCanal,
  ofertaAplicaA,
  ofertaIncluyeModalidad,
  formatearFecha,
  formatearHora,
  categoriasAlcance,
  idsCategoriaDto,
  generarCodigoCuponUnico,
  obtenerAhoraLima,
} from './ofertas.util';
import { urlPublicaCarta } from '../chatbot/servicios/carrusel.util';
import { canalOfertaParaEnvio, CAMPOS_BENEFICIO_ENVIO } from './envio-gratis-promo';

/** Si la promoción (DESCUENTO o LLEVA_PAGA) alcanza a esta línea según su alcance: categoría, producto o toda la carta. */
function alcanceCubreLinea(
  d: { alcance_categoria_id: bigint | null; alcance_categoria_ids?: bigint[]; alcance_producto_id: bigint | null },
  l: { productoId: bigint; categoriaId?: bigint | null },
): boolean {
  const cats = categoriasAlcance(d);
  if (cats.length) return !!l.categoriaId && cats.includes(l.categoriaId);
  if (d.alcance_producto_id) return l.productoId === d.alcance_producto_id;
  return true;
}

/** Horario del cupón con la misma regla de vigencia que las ofertas. Sin horario vale siempre. */
function cuponEnHorario(cupon: any, ahora: Date): boolean {
  return estaVigente(
    {
      activo: true,
      dias: cupon.dias,
      hora_desde: cupon.hora_desde,
      hora_hasta: cupon.hora_hasta,
      fecha_desde: cupon.fecha_desde,
      fecha_hasta: cupon.fecha_hasta,
    },
    undefined,
    ahora,
  );
}

/** «HH:mm» a Date para columnas @db.Time (igual que las ofertas). */
function horaCupon(v?: string | null): Date | null {
  return v ? new Date(`1970-01-01T${v}:00.000Z`) : null;
}

/** «YYYY-MM-DD» a Date para columnas @db.Date. */
function fechaCupon(v?: string | null): Date | null {
  return v ? new Date(`${v.slice(0, 10)}T00:00:00.000Z`) : null;
}

/** Datos de un producto de combo que necesita la resolución de partes. */
interface InfoProductoCombo extends ProductoDisp {
  categoriaNombre: string | null;
  areaId: bigint | null;
  areaNombre: string | null;
}

/** Línea de cocina de una parte: el producto, su área (la de su categoría) y la nota «Combo: …». */
function parteResuelta(
  ofertaNombre: string,
  parteId: string,
  tipo: 'FIJO' | 'A_ELECCION',
  productoId: string,
  cantidad: number,
  cambio: string | null,
  info: Map<string, InfoProductoCombo>,
): ParteResueltaCombo {
  const p = info.get(productoId);
  return {
    parteId: BigInt(parteId),
    tipo,
    productoId: BigInt(productoId),
    nombre: p?.nombre ?? '',
    cantidad,
    areaId: p?.areaId ?? null,
    areaNombre: p?.areaNombre ?? null,
    categoriaNombre: p?.categoriaNombre ?? null,
    nota: [cambio, `Combo: ${ofertaNombre}`].filter(Boolean).join(' · '),
  };
}

/** Campos de stock que necesitan los combos para saber si una elección tiene saldo (producto y sabores activos). */
const SELECT_STOCK_COMBO = {
  controla_stock: true,
  stocks: { select: { cantidad: true } },
  sabores: {
    where: { activo: true },
    select: { id: true, nombre: true, activo: true, agotado_hasta: true, stockSabor: { select: { cantidad: true } } },
  },
};

/** Saldo y sabores de un producto leído con SELECT_STOCK_COMBO. */
function stockDeProducto(f: any): Pick<ProductoDisp, 'controlaStock' | 'saldo' | 'sabores'> {
  return {
    controlaStock: !!f.controla_stock,
    saldo: (f.stocks ?? []).reduce((acc: number, s: any) => acc + Number(s.cantidad), 0),
    sabores: (f.sabores ?? []).map((s: any) => ({
      id: s.id.toString(),
      nombre: s.nombre,
      activo: !!s.activo,
      agotadoHasta: s.agotado_hasta ?? null,
      saldo: Number(s.stockSabor?.cantidad ?? 0),
    })),
  };
}

/** Opción de una parte con lista o alternativa: nombre, si se puede elegir ahora y, por sabor, cada sabor con su saldo. */
function detalleOpcion(id: string, productos: ProductoDisp[]): OpcionDetalleCombo {
  const f = productos.find((x) => x.id === id);
  const sabores = f?.controlaStock && (f.sabores ?? []).length > 0
    ? f.sabores!.map((s) => ({ id: s.id, nombre: s.nombre, disponible: saborDisponible(s), saldo: Math.max(0, Math.floor(s.saldo)) }))
    : undefined;
  const disponible = !!f && productoDisponible(f);
  // Bloqueada solo por saldo (no por ocultar ni agotar a mano): la carta dice «No hay stock»
  const sinStock = !disponible && !!f && estaDisponible(f.agotadoHasta) && !!f.controlaStock;
  return { id, nombre: f?.nombre ?? '', disponible, ...(sinStock ? { sinStock } : {}), ...(sabores ? { sabores } : {}), ...(f?.fotoUrl ? { fotoUrl: f.fotoUrl } : {}), ...(f?.categoriaNombre ? { categoria: f.categoriaNombre } : {}) };
}

const INCLUDE_PARTES = {
  include: {
    reemplazos: { orderBy: { orden: 'asc' as const }, include: { producto: true } },  // reemplazos = alternativas de la parte
    tamano: { include: { tamano_valor: true } },  // tamaño de la parte FIJO (producto_tamano)
  },
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

  /**
   * `paraCarta`: lo que pinta la carta virtual. Activas, y las desactivadas que el dueño dejó
   * «Mostrar como No disponible» (visible_carta). Las desactivadas con visible_carta=false no salen.
   */
  async listarOfertas(tipo?: string, soloActivas = false, canal?: string, paraCarta = false, modalidad?: string): Promise<OfertaItem[]> {
    const where: Prisma.OfertaWhereInput = {};

    if (tipo) {
      where.tipo = tipo.toUpperCase();
    }
    if (soloActivas) {
      where.activo = true;
    }
    if (paraCarta) {
      where.OR = [{ activo: true }, { visible_carta: true }];
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

    let items = ofertasDb.map((o) => this.mapearOferta(o, canal, modalidad));
    // Con modalidad conocida (caja, mozo, carta ya elegida) solo salen las ofertas que valen para ella
    if (modalidad) items = items.filter((o) => ofertaIncluyeModalidad(o.modalidades, modalidad));
    // Bot de WhatsApp: solo lista lo que vale por WhatsApp (casilla «WhatsApp (bot)»); no ofrece lo que hoy no se puede armar
    const esBot = !!canal && canalOferta(canal) === 'BOT';
    if (esBot) items = items.filter((o) => ofertaIncluyeCanal(o.canales, 'BOT'));
    // Carta web y local comparten esta lista: un combo solo para WhatsApp no aparece en ninguna de las dos
    if (paraCarta) items = items.filter((o) => o.tipo !== 'COMBO' || ofertaIncluyeCanal(o.canales, 'CARTA') || ofertaIncluyeCanal(o.canales, 'ADMIN'));
    items = await this.conDisponibilidad(items);
    // La carta pública solo sabe si está agotado, no por qué: el motivo es del panel del dueño
    if (paraCarta) for (const o of items) { delete o.motivoAgotado; delete o.piezasBloqueadas; }
    if (esBot) return items.filter((o) => !(o.tipo === 'COMBO' && o.disponible === false));
    // Panel de administración: cuándo y quién la desactivó por última vez (de la auditoría, sin tabla nueva)
    if (!canal && !paraCarta) await this.conUltimaDesactivacion(items);
    return items;
  }

  /** Agrega `desactivadaEn` y `desactivadaPor` a las ofertas desactivadas a mano, según la auditoría de «desactivar». */
  private async conUltimaDesactivacion(items: OfertaItem[]): Promise<void> {
    const apagadas = items.filter((o) => !o.activo);
    if (apagadas.length === 0) return;
    const filas = await this.prisma.auditoria.findMany({
      where: { modulo: 'ofertas', accion: 'desactivar', entidad: 'oferta', entidad_id: { in: apagadas.map((o) => BigInt(o.id)) } },
      orderBy: { en: 'desc' },
      select: { entidad_id: true, en: true, party_id: true },
    });
    const ultima = new Map<string, { en: Date; party: bigint | null }>();
    for (const f of filas) if (f.entidad_id !== null && !ultima.has(String(f.entidad_id))) ultima.set(String(f.entidad_id), { en: f.en, party: f.party_id });
    const partys = [...new Set([...ultima.values()].map((u) => u.party).filter((x): x is bigint => x !== null))];
    const personas = partys.length
      ? await this.prisma.person.findMany({ where: { party_id: { in: partys } }, select: { party_id: true, nombres: true, apellidos: true } })
      : [];
    const nombres = new Map(personas.map((p) => [String(p.party_id), `${p.nombres} ${p.apellidos ?? ''}`.trim()]));
    for (const o of apagadas) {
      const u = ultima.get(o.id);
      if (!u) continue;
      o.desactivadaEn = u.en.toISOString();
      o.desactivadaPor = u.party ? nombres.get(String(u.party)) ?? null : null;
    }
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
    const esEnvio = tipoFinal === 'ENVIO_GRATIS';
    const descTipoFinal = dto.descuentoTipo === 'MONTO_FIJO' ? 'MONTO' : dto.descuentoTipo;

    // Validación de límites de descuento y compra mínima (el envío gratis no lleva descuento)
    if (!esEnvio && dto.descuentoValor !== undefined && dto.descuentoValor !== null) {
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
    this.validarModalidadesEnvio(tipoFinal, dto.modalidades);

    const creada = await this.prisma.$transaction(async (tx) => {
      const oferta = await tx.oferta.create({
        data: {
          tipo: tipoFinal,
          nombre: nombreLimpio,
          descripcion: dto.descripcion?.trim() || null,
          ...(esEnvio
            ? CAMPOS_BENEFICIO_ENVIO
            : {
                lleva: dto.lleva ?? null,
                paga: dto.paga ?? null,
                alcance_categoria_id: idsCategoriaDto(dto)[0] ?? null,
                alcance_categoria_ids: idsCategoriaDto(dto),
                alcance_producto_id: dto.alcanceProductoId ? BigInt(dto.alcanceProductoId) : null,
                descuento_tipo: descTipoFinal ?? null,
                descuento_valor: dto.descuentoValor !== undefined && dto.descuentoValor !== null ? new Prisma.Decimal(dto.descuentoValor) : null,
              }),
          compra_minima: dto.compraMinima !== undefined && dto.compraMinima !== null ? new Prisma.Decimal(dto.compraMinima) : null,
          dias: diasFinal,
          hora_desde: horaDesdeDate,
          hora_hasta: horaHastaDate,
          fecha_desde: fechaDesdeDate,
          fecha_hasta: fechaHastaDate,
          // La primera compra solo se canjea en la carta web
          // Por defecto no vale por WhatsApp (casilla desmarcada); el envío gratis sí sale marcado
          canales: soloPrimeraCompra ? ['CARTA'] : dto.canales ?? canalesPorDefecto(tipoFinal),
          modalidades: dto.modalidades ?? [],
          limite_usos: dto.limiteUsos ?? null,
          no_suma_beneficios: dto.noSumaBeneficios ?? false,
          mostrar_en_saludo_bot: dto.mostrarEnSaludoBot ?? false,
          solo_primera_compra: soloPrimeraCompra,
          orden: dto.orden ?? 0,
          activo: dto.activo ?? false,
          imagen_archivo_id: dto.imagenArchivoId ? BigInt(dto.imagenArchivoId) : null,
        },
      });

      const preciosCombo: { tamanoValorId: bigint; precio: number }[] = [];
      const tamanosFinal = dto.tamanos ?? dto.combosPrecios;
      if (tipoFinal === 'COMBO' && Array.isArray(tamanosFinal)) {
        for (const t of tamanosFinal) {
          const tamanoId = await resolverTamanoValorId(tx, t);
          await tx.comboPrecio.create({
            data: {
              oferta_id: oferta.id,
              tamano_valor_id: tamanoId,
              precio: new Prisma.Decimal(t.precio),
            },
          });
          preciosCombo.push({ tamanoValorId: tamanoId, precio: Number(t.precio) });
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
              sabores_ids: this.idsNumericos(p.saboresIds),
              productos_excluidos_ids: this.idsNumericos(p.productosExcluidos),
              tamano_id: await this.tamanoDeParte(tx, tipoParte, prodIds, p.tamanoId),
              ...this.paqueteDeParte(tipoParte, p),
              ...this.opcionalDeParte(tipoParte, p),
              ...(await this.cuposDeParte(tx, tipoParte, p.cantidad || 1, prodIds, catIds, p.cuposProducto)),
            },
          });
          await this.guardarAlternativas(tx, parteCreada.id, prodIds, p.alternativas);
        }
      }

      // El combo se pide desde un producto anfitrión: se crea (o se enlaza) solo, el dueño no toca Productos
      if (tipoFinal === 'COMBO' && !dto.alcanceProductoId) {
        await sincronizarAnfitrionCombo(
          tx,
          {
            id: oferta.id,
            alcanceProductoId: oferta.alcance_producto_id,
            nombre: oferta.nombre,
            descripcion: oferta.descripcion,
            imagenArchivoId: oferta.imagen_archivo_id,
            oculto: !oferta.activo,
          },
          preciosCombo,
        );
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
        // Su propio producto anfitrión (se renombra junto con el combo) no cuenta como repetido
        if (prodRepetido && prodRepetido.id !== ofertaExistente.alcance_producto_id) {
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

    const esEnvioActualizado = (dto.tipo === 'DESCUENTO_AUTOMATICO' ? 'DESCUENTO' : (dto.tipo ?? ofertaExistente.tipo)) === 'ENVIO_GRATIS';
    const descTipoCheck = dto.descuentoTipo !== undefined
      ? (dto.descuentoTipo === 'MONTO_FIJO' ? 'MONTO' : dto.descuentoTipo)
      : ofertaExistente.descuento_tipo;
    if (!esEnvioActualizado && dto.descuentoValor !== undefined && dto.descuentoValor !== null) {
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
    if (dto.alcanceCategoriaIds !== undefined || dto.alcanceCategoriaId !== undefined) {
      const ids = idsCategoriaDto(dto);
      data.categoria = ids.length ? { connect: { id: ids[0] } } : { disconnect: true };
      data.alcance_categoria_ids = ids;
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
    if (dto.modalidades !== undefined) data.modalidades = dto.modalidades ?? [];
    this.validarModalidadesEnvio(ofertaExistente.tipo, (data.modalidades as string[] | undefined) ?? ofertaExistente.modalidades);
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

    if (esEnvioActualizado) {
      // El envío gratis no lleva descuento, lleva/paga ni productos: se vacían al pasar a este tipo
      Object.assign(data, {
        lleva: null,
        paga: null,
        descuento_tipo: null,
        descuento_valor: null,
        categoria: { disconnect: true },
        alcance_categoria_ids: [],
        producto: { disconnect: true },
      });
    }

    const actualizada = await this.prisma.$transaction(async (tx) => {
      await tx.oferta.update({
        where: { id: BigInt(id) },
        data,
      });

      let preciosCombo: { tamanoValorId: bigint; precio: number }[] | undefined;
      const tamanosFinal = dto.tamanos !== undefined ? dto.tamanos : dto.combosPrecios;
      if (tamanosFinal !== undefined) {
        preciosCombo = [];
        await tx.comboPrecio.deleteMany({ where: { oferta_id: BigInt(id) } });
        for (const t of tamanosFinal) {
          const tamanoId = await resolverTamanoValorId(tx, t);
          await tx.comboPrecio.create({
            data: {
              oferta_id: BigInt(id),
              tamano_valor_id: tamanoId,
              precio: new Prisma.Decimal(t.precio),
            },
          });
          preciosCombo.push({ tamanoValorId: tamanoId, precio: Number(t.precio) });
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
              sabores_ids: this.idsNumericos(p.saboresIds),
              productos_excluidos_ids: this.idsNumericos(p.productosExcluidos),
              tamano_id: await this.tamanoDeParte(tx, tipoParte, prodIds, p.tamanoId),
              ...this.paqueteDeParte(tipoParte, p),
              ...this.opcionalDeParte(tipoParte, p),
              ...(await this.cuposDeParte(tx, tipoParte, p.cantidad || 1, prodIds, catIds, p.cuposProducto)),
            },
          });
          await this.guardarAlternativas(tx, parteCreada.id, prodIds, p.alternativas);
        }
      }

      // Combo: su producto anfitrión se mantiene solo (nombre, foto, descripción y precio por tamaño que lleguen)
      if ((dto.tipo === 'DESCUENTO_AUTOMATICO' ? 'DESCUENTO' : dto.tipo ?? ofertaExistente.tipo) === 'COMBO') {
        const hostActual = dto.alcanceProductoId !== undefined ? (dto.alcanceProductoId ? BigInt(dto.alcanceProductoId) : null) : ofertaExistente.alcance_producto_id;
        if (!hostActual && preciosCombo === undefined) {
          const filas = await tx.comboPrecio.findMany({ where: { oferta_id: BigInt(id) } });
          preciosCombo = filas.map((f) => ({ tamanoValorId: f.tamano_valor_id, precio: Number(f.precio) }));
        }
        await sincronizarAnfitrionCombo(
          tx,
          {
            id: BigInt(id),
            alcanceProductoId: hostActual,
            nombre: dto.nombre !== undefined ? dto.nombre.trim() : ofertaExistente.nombre,
            descripcion: dto.descripcion !== undefined ? dto.descripcion?.trim() || null : ofertaExistente.descripcion,
            imagenArchivoId: dto.imagenArchivoId !== undefined ? (dto.imagenArchivoId ? BigInt(dto.imagenArchivoId) : null) : ofertaExistente.imagen_archivo_id,
            oculto: dto.activo !== undefined ? !dto.activo : undefined,
          },
          preciosCombo,
          { nombre: dto.nombre !== undefined, descripcion: dto.descripcion !== undefined, foto: dto.imagenArchivoId !== undefined },
        );
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

    if (dto.canales !== undefined && JSON.stringify([...(ofertaExistente.canales ?? [])].sort()) !== JSON.stringify([...(actualizada!.canales ?? [])].sort())) {
      await this.auditoriaService.registrar({
        categoria: 'CAMBIO',
        modulo: 'ofertas',
        accion: 'cambiar_canales',
        entidad: 'oferta',
        entidadId: BigInt(id),
        antes: { canales: ofertaExistente.canales },
        despues: { canales: actualizada!.canales },
        partyId: usuario?.partyId,
      });
    }

    this.eventosGateway.emitirAdmin('ofertas:actualizado', { id: id.toString() });

    return (await this.conDisponibilidad([this.mapearOferta(actualizada!)]))[0];
  }

  /**
   * Activa o desactiva. Si llega `visibleCarta`, se guarda junto (al desactivar: true = la carta la
   * muestra como «No disponible»; false = la oculta). Si no llega, no se toca.
   */
  async cambiarEstadoOferta(
    id: bigint | string | number,
    activo: boolean,
    usuario?: any,
    visibleCarta?: boolean,
  ): Promise<OfertaItem> {
    const actualizada = await this.prisma.oferta.update({
      where: { id: BigInt(id) },
      data: { activo, ...(visibleCarta !== undefined ? { visible_carta: visibleCarta } : {}) },
      include: {
        categoria: true,
        producto: true,
        imagen_archivo: true,
        combosPrecio: { include: { tamano_valor: true } },
        combosParte: INCLUDE_PARTES,
      },
    });

    // Combo apagado: su anfitrión sale de la carta (la tarjeta de oferta queda como no disponible); al encender, vuelve
    if (actualizada.tipo === 'COMBO' && actualizada.alcance_producto_id) {
      await this.prisma.producto.update({ where: { id: actualizada.alcance_producto_id }, data: { oculto: !activo } });
    }

    await this.auditoriaService.registrar({
      categoria: 'CAMBIO',
      modulo: 'ofertas',
      accion: activo ? 'activar' : 'desactivar',
      entidad: 'oferta',
      entidadId: BigInt(id),
      despues: { activo, ...(visibleCarta !== undefined ? { visibleCarta } : {}) },
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
        descuento_valor: new Prisma.Decimal(dto.descuentoTipo === 'ENVIO_GRATIS' ? 0 : dto.descuentoValor),
        compra_minima: dto.compraMinima !== undefined && dto.compraMinima !== null ? new Prisma.Decimal(dto.compraMinima) : null,
        categoria_id: dto.categoriaId ? BigInt(dto.categoriaId) : null,
        producto_id: dto.productoId ? BigInt(dto.productoId) : null,
        canales: dto.canales ?? ['CARTA', 'CAJA'],
        dias: dto.dias ?? [],
        hora_desde: horaCupon(dto.horaDesde),
        hora_hasta: horaCupon(dto.horaHasta),
        fecha_desde: fechaCupon(dto.fechaDesde),
        fecha_hasta: fechaCupon(dto.fechaHasta),
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
    if ((dto.descuentoTipo ?? cuponExistente.descuento_tipo) === 'ENVIO_GRATIS') data.descuento_valor = new Prisma.Decimal(0);
    if (dto.dias !== undefined) data.dias = dto.dias ?? [];
    if (dto.horaDesde !== undefined) data.hora_desde = horaCupon(dto.horaDesde);
    if (dto.horaHasta !== undefined) data.hora_hasta = horaCupon(dto.horaHasta);
    if (dto.fechaDesde !== undefined) data.fecha_desde = fechaCupon(dto.fechaDesde);
    if (dto.fechaHasta !== undefined) data.fecha_hasta = fechaCupon(dto.fechaHasta);
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

  /** Tope de consultas del descuento del equipo: 60 por cuenta y 120 por IP cada hora. Sin Redis no bloquea. */
  async limitarConsultaCelular(cuenta: string, ip?: string): Promise<void> {
    try {
      const r = this.redisService.obtenerCliente();
      const limites: [string, number][] = [[`carta:dpers:cta:${cuenta}`, 60]];
      if (ip) limites.push([`carta:dpers:ip:${ip}`, 120]);
      for (const [clave, max] of limites) {
        const n = await r.incr(clave);
        if (n === 1) await r.expire(clave, 3600);
        if (n > max) {
          throw new HttpException({ codigo: 'DEMASIADAS_CONSULTAS', mensaje: 'Espera un poco antes de volver a consultar.' }, HttpStatus.TOO_MANY_REQUESTS);
        }
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
    }
  }

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
      if (!cuponEnHorario(cuponEmitido.cupon, ahora)) {
        throw new BadRequestException({
          codigo: 'CUPON_FUERA_DE_HORARIO',
          mensaje: 'Este cupón no se puede usar en este día u horario',
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

    if (!cuponEnHorario(cuponCompartido, ahora)) {
      throw new BadRequestException({
        codigo: 'CUPON_FUERA_DE_HORARIO',
        mensaje: 'Este cupón no se puede usar en este día u horario',
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

    // Envío gratis: no descuenta productos; el pedido lo aplica (solo delivery) con la misma función de envío
    if (cupon.descuento_tipo === 'ENVIO_GRATIS') {
      return {
        valido: true,
        mensaje: `Cupón ${cupon.codigo_base}: envío gratis`,
        cupon: {
          id: cupon.id.toString(),
          emitidoId: cuponEmitidoId ? cuponEmitidoId.toString() : null,
          codigoBase: cupon.codigo_base,
          descripcion: cupon.descripcion,
          tipo: 'ENVIO_GRATIS' as const,
          valor: 0,
          descuentoCalculado: 0,
          envioGratis: true,
          canales: (cupon.canales ?? []) as string[],
        },
      };
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
        envioGratis: false,
        canales: (cupon.canales ?? []) as string[],
      },
    };
  }

  /** Vista previa de un cupón en caja/mozo: no canjea nada; el canje ocurre al crear el pedido. */
  async validarCuponParaCaja(dto: ValidarCuponCajaDto) {
    const canal = dto.canal === 'MOZO' ? 'MOZO' : 'CAJA';
    const codigo = dto.codigo.trim().toUpperCase();
    const vista = await this.vistaPreviaDescuentos(dto.lineas as any, codigo, null, canal);
    const cupon = vista.detalles.find((d) => d.tipo === 'CUPON');
    if (!cupon && !vista.envioGratisCupon) {
      // El cupón es válido pero otra oferta automática da más descuento y no se acumulan
      throw new BadRequestException({
        codigo: 'CUPON_NO_SUMA',
        mensaje: 'Este cupón no se aplica: el pedido ya tiene una promoción con mayor descuento',
      });
    }
    return {
      valido: true,
      codigo,
      descuento: cupon?.monto ?? 0,
      envioGratis: vista.envioGratisCupon,
      descuentoTotal: vista.descuentoTotal,
      mensaje: cupon ? `Cupón ${codigo} aplicado` : `Cupón ${codigo}: envío gratis`,
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

    if (Number(pedido.puntos_canjeados ?? 0) > 0) {
      throw new BadRequestException({ codigo: 'PUNTOS_CON_CUPON', mensaje: 'No se pueden usar puntos y un cupón en el mismo pedido' });
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

    // 3. Buscar cupones de modo UNICO_COMPROBANTE activos Y vigentes hoy (fechas, días y horario) y que valgan
    // en el canal del pedido: un cupón activo pero fuera de vigencia o de otro canal no debe salir en el comprobante
    const ahoraVigencia = new Date();
    const pedidoOrigen = await this.prisma.pedido.findUnique({ where: { id: idBig }, select: { canal: true } });
    const canalCupon = pedidoOrigen?.canal ? canalOferta(pedidoOrigen.canal) : undefined;
    const cuponesActivos = await this.prisma.cupon.findMany({
      where: {
        modo: 'UNICO_COMPROBANTE',
        activo: true,
      },
    });
    const cuponesCandidatos = cuponesActivos.filter(
      (c) =>
        cuponEnHorario(c, ahoraVigencia) &&
        (!canalCupon || !(c.canales ?? []).length || ofertaIncluyeCanal((c.canales ?? []) as string[], canalCupon)),
    );

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
    lineas: { productoId: string; cantidad: number; subtotal: number; precioUnitario: number; ofertaId?: string }[],
    cuponCodigo?: string,
    clientePartyId?: string | null,
    canal: string = 'CARTA',
    modalidad?: string,
    colaboradorPartyId?: string,
  ): Promise<{ descuentoTotal: number; montoCanjeable: number; puntosEstimados: number; puntosPorcentaje: number; detalles: { tipo: string; nombre: string; monto: number }[]; envioGratisCupon: boolean; descuentoPersonal?: { pct: number; monto: number }; totalDescuentos?: number }> {
    const param = await Promise.resolve().then(() => this.prisma.parametro.findUnique({ where: { clave: 'puntos_porcentaje' } })).catch(() => null);
    const puntosPorcentaje = param && param.valor !== null && param.valor !== undefined ? Number(param.valor) : 5;
    const validas = (lineas || []).filter((l) => /^\d+$/.test(String(l.productoId)) && Number(l.cantidad) > 0);
    if (validas.length === 0) return { descuentoTotal: 0, montoCanjeable: 0, puntosEstimados: 0, puntosPorcentaje, detalles: [], envioGratisCupon: false };
    const productos = await this.prisma.producto.findMany({
      where: { id: { in: validas.map((l) => BigInt(l.productoId)) } },
      select: { id: true, nombre: true, categoria_id: true, no_suma_beneficios: true },
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
        nombre: prod?.nombre ?? '',
        enPromocion: Boolean(l.ofertaId),
      };
    });
    const subtotal = Number(lineasCalc.reduce((a, l) => a + l.subtotal, 0).toFixed(2));
    const desglose = await this.calcularDescuentosParaPedido({
      subtotal,
      lineas: lineasCalc,
      canal,
      modalidad,
      cuponCodigo: cuponCodigo || null,
      clientePartyId: clientePartyId || null,
      // igual que al crear el pedido: la primera compra solo cuenta con sesión en la carta
      clienteConSesion: canal === 'CARTA' && !!clientePartyId,
    });
    const conCupon = !!(desglose.cuponId || desglose.cuponEmitidoId);
    const montoCanjeable = montoElegiblePuntos(lineasCalc, conCupon ? [] : desglose.detalles);
    // Pedido del personal: mismo cálculo y criterios que PedidosService.crear (porcentaje sobre lo elegible)
    let descuentoPersonal: { pct: number; monto: number } | undefined;
    if (colaboradorPartyId) {
      if (!/^\d+$/.test(String(colaboradorPartyId))) {
        throw new BadRequestException({ codigo: 'COLABORADOR_REQUERIDO', mensaje: 'Elige al trabajador al que se le carga el pedido del personal' });
      }
      if (canal !== 'MOZO' && canal !== 'CAJA') {
        throw new BadRequestException({ codigo: 'CANAL_NO_PERMITIDO', mensaje: 'Por la carta virtual no se consume crédito del personal' });
      }
      const colaboradorId = BigInt(colaboradorPartyId);
      await validarColaborador(this.prisma, colaboradorId);
      const pct = await resolverPctPersonal(this.prisma, colaboradorId);
      descuentoPersonal = { pct, monto: calcularDescuentoPersonal(lineasCalc, desglose.detalles as any, pct) };
    }
    // Carta con sesión: la cuenta autenticada, si es de un trabajador activo, da su descuento de personal (mismo cálculo que PedidosService.crear)
    let detallesVista = (desglose.detalles || []).map((d: any) => ({ tipo: String(d.tipo ?? ''), nombre: String(d.nombre ?? ''), monto: Number(d.montoDescontado ?? 0) }));
    let descuentoTotalVista = desglose.descuentoTotal;
    let montoCanjeableVista = montoCanjeable;
    let puntosEstimadosVista = conCupon ? 0 : Math.round(montoCanjeable * (puntosPorcentaje / 100) * 100) / 100;
    if (!colaboradorPartyId && canal === 'CARTA' && clientePartyId) {
      const dp = await descuentoPersonalDeCuenta(this.prisma, clientePartyId);
      if (dp) {
        const monto = calcularDescuentoPersonal(lineasCalc, desglose.detalles as any, dp.pct);
        if (monto > 0) {
          detallesVista = [...detallesVista, { tipo: 'PERSONAL', nombre: `Descuento por ser del equipo (${dp.pct} %)`, monto }];
          descuentoTotalVista = Number((descuentoTotalVista + monto).toFixed(2));
          montoCanjeableVista = 0; // con el descuento del equipo no se canjean puntos
          puntosEstimadosVista = 0;
        }
      }
    }
    return {
      ...(descuentoPersonal
        ? { descuentoPersonal, totalDescuentos: Number((desglose.descuentoTotal + descuentoPersonal.monto).toFixed(2)) }
        : {}),
      envioGratisCupon: desglose.envioGratisCupon ?? false,
      descuentoTotal: descuentoTotalVista,
      montoCanjeable: montoCanjeableVista,
      // con cupón no se suman puntos (DT-56); misma base y porcentaje que PuntosService.acumularPorPedido
      puntosEstimados: puntosEstimadosVista,
      puntosPorcentaje,
      detalles: detallesVista,
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
    /** MESA/COMER_LOCAL, RECOGER/LLEVAR o DELIVERY; sin ella no se filtra por modalidad */
    modalidad?: string | null;
    cuponCodigo?: string | null;
    clientePartyId?: bigint | string | number | null;
    /** true solo si el cliente tiene sesión iniciada en la carta (cuenta con celular verificado) */
    clienteConSesion?: boolean;
  }): Promise<DesgloseDescuentosPedido> {
    const { subtotal, lineas, canal, clientePartyId, clienteConSesion } = params;

    // Bot de WhatsApp: solo promociones automáticas con la casilla «Vale también por WhatsApp» (canal BOT,
    // que estaVigente exige explícito). Nunca cupones: el bot no pide códigos y el servidor los rechaza.
    const esBot = canal === 'BOT' || canal === 'WHATSAPP';
    if (esBot && params.cuponCodigo?.trim()) {
      throw new BadRequestException({
        codigo: 'CUPON_NO_APLICA_CANAL',
        mensaje: 'Los cupones no se aceptan por WhatsApp',
      });
    }
    const cuponCodigo = params.cuponCodigo;

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

    const descuentosVigentes = descuentosCandidatos.filter((d) => ofertaAplicaA(d, { canal, fecha: ahora, modalidad: params.modalidad }));

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

        if (categoriasAlcance(d).length) {
          const matching = elegibles.filter((l) => alcanceCubreLinea(d, l));
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
        } else if (categoriasAlcance(d).length) {
          matching = lineasElegibles.filter((l) => alcanceCubreLinea(d, l));
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
            alcance: categoriasAlcance(d).length ? 'CATEGORIA' : (d.alcance_producto_id ? 'PRODUCTO' : 'TODA'),
            alcanceIds: categoriasAlcance(d).map((x) => x.toString()),
            alcanceId: categoriasAlcance(d).length ? categoriasAlcance(d)[0].toString() : (d.alcance_producto_id ? d.alcance_producto_id.toString() : null),
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
    // Cupón de envío gratis: va aparte, no compite con los descuentos automáticos
    let cuponEnvio: { cuponId: string; cuponEmitidoId: string | null; detalles: DetalleDescuentoAplicado } | null = null;

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

        if (val.cupon.envioGratis) {
          // Solo carta web y local (nunca WhatsApp/bot) y dentro de los canales del cupón
          const canalEnvio = canalOfertaParaEnvio(canal);
          // Los cupones no se piden por chat: el bot nunca aplica el cupón de envío
          if (canalEnvio === 'BOT' || !estaVigente({ activo: true, canales: val.cupon.canales }, canalEnvio, new Date())) {
            throw new BadRequestException({
              codigo: 'CUPON_NO_APLICA_CANAL',
              mensaje: 'Este cupón de envío gratis no aplica en este canal',
            });
          }
          cuponEnvio = {
            cuponId: cuponEvaluado.cuponId,
            cuponEmitidoId: cuponEvaluado.cuponEmitidoId,
            detalles: { ...cuponEvaluado.detalles, descuentoTipo: 'ENVIO_GRATIS', descuentoValor: 0, montoDescontado: 0 },
          };
          cuponEvaluado = null;
        }
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

    if (cuponEnvio) {
      detallesFinales.push(cuponEnvio.detalles);
      cuponIdFinal = cuponEnvio.cuponId;
      cuponEmitidoIdFinal = cuponEnvio.cuponEmitidoId;
    }

    return {
      descuentoTotal: Number(descuentoTotal.toFixed(2)),
      ofertaId: ofertaIdFinal,
      cuponId: cuponIdFinal,
      cuponEmitidoId: cuponEmitidoIdFinal,
      detalles: detallesFinales,
      envioGratisCupon: cuponEnvio !== null,
    };
  }

  // ==========================================
  // MAPEOS AUXILIARES
  // ==========================================

  /**
   * Al crear el pedido: cada parte FIJO elegida debe ser el principal disponible o una alternativa (con stock).
   * Devuelve la nota para comanda y ticket, p. ej. «Combo Dúo · Empanada (en lugar de Club Sandwich)».
   */
  async validarEleccionesCombo(
    ofertaId: bigint | string | number,
    elecciones: { parteId: string | number; productoId: string | number; saborId?: string | number }[],
  ): Promise<string> {
    return (await this.resolverPartesCombo(ofertaId, elecciones)).nota;
  }

  /**
   * Al pedido: qué sale de cada parte del combo, una línea por producto (ParteResueltaCombo).
   * FIJO: el principal (si alcanza) o una alternativa con stock elegida. A_ELECCION con lista de productos o
   * categorías: exactamente `cantidad × unidades` elegidas, sin agotados. Una alternativa (producto y cantidad
   * propios) solo se acepta si el original NO alcanza con el saldo; no cambia el precio del combo.
   * `nota` va a comanda y ticket.
   */
  async resolverPartesCombo(
    ofertaId: bigint | string | number,
    elecciones: { parteId: string | number; productoId: string | number; saborId?: string | number; cantidad?: number }[],
    unidades = 1,
    canal?: string,
    /** Tamaño del combo pedido (valor de la lista TAMANO): cada producto de las partes usa SU tamaño equivalente. */
    tamanoValorId?: bigint | string | number | null,
    modalidad?: string | null,
  ): Promise<ResolucionCombo> {
    const oferta = await this.obtenerOfertaPorId(ofertaId);
    if (oferta.tipo !== 'COMBO') return { nota: '', partes: [] };
    // Misma regla de canal que el resto de ofertas: con la casilla del canal apagada, el id no sirve
    if (canal && !ofertaIncluyeCanal(oferta.canales, canalOferta(canal))) {
      throw new BadRequestException({ codigo: 'OFERTA_NO_APLICA_CANAL', mensaje: `${oferta.nombre} no está disponible en este canal` });
    }
    if (modalidad && !ofertaIncluyeModalidad(oferta.modalidades, modalidad)) {
      throw new BadRequestException({ codigo: 'OFERTA_NO_APLICA_MODALIDAD', mensaje: `${oferta.nombre} no vale para este tipo de pedido` });
    }
    const noDisponible = (mensaje: string) =>
      new ConflictException({ codigo: 'COMBO_PARTE_NO_DISPONIBLE', mensaje });
    if (oferta.disponible === false) throw noDisponible(`${oferta.nombre} está agotado: ${oferta.motivoAgotado ?? ''}`.trim());

    const partesTodas = (oferta.combosParte ?? []).map((p) => ({ ...p, alternativas: p.alternativas ?? [] }));
    // Complemento a elegir: de cada grupo vale el ÚNICO paquete con elecciones; las piezas de los otros no cuentan
    const paquetesElegidos = new Map<string, string>();
    for (const grupo of new Set(partesTodas.map((p) => p.paqueteGrupo).filter((g): g is string => !!g))) {
      const conEleccion = new Set(
        partesTodas
          .filter((p) => p.paqueteGrupo === grupo && elecciones.some((e) => String(e.parteId) === p.id))
          .map((p) => p.paqueteNombre ?? ''),
      );
      if (conEleccion.size === 0) {
        throw new BadRequestException({ codigo: 'COMBO_ELECCION_INCOMPLETA', mensaje: `Elige tu ${grupo.toLowerCase()} para ${oferta.nombre}` });
      }
      if (conEleccion.size > 1) {
        throw new BadRequestException({ codigo: 'COMBO_PARTE_NO_PERMITIDA', mensaje: `Elige una sola opción de ${grupo.toLowerCase()} para ${oferta.nombre}` });
      }
      paquetesElegidos.set(grupo, [...conEleccion][0]);
    }
    const partesOferta = partesTodas.filter((p) => !p.paqueteGrupo || paquetesElegidos.get(p.paqueteGrupo) === (p.paqueteNombre ?? ''));
    const ids = new Set<string>();
    const cats = new Set<string>();
    for (const p of partesOferta) {
      [...p.productos, ...p.alternativas.map((a) => a.id)].forEach((x) => ids.add(String(x)));
      elecciones.filter((e) => String(e.parteId) === p.id).forEach((e) => ids.add(String(e.productoId)));
      // Con alternativas, el original se mira por sus categorías: hay que cargar esos productos también
      // y una parte de bebidas por categorías (A_ELECCION sin lista) necesita ver los productos de sus categorías
      if (p.alternativas.length > 0 || p.paqueteGrupo || (p.tipo === 'A_ELECCION' && p.productos.length === 0)) {
        p.categorias.forEach((c) => cats.add(String(c)));
      }
    }
    const filas = ids.size || cats.size
      ? await this.prisma.producto.findMany({
          where: {
            OR: [
              { id: { in: [...ids].map((x) => BigInt(x)) } },
              { categoria_id: { in: [...cats].map((x) => BigInt(x)) } },
            ],
          },
          select: {
            id: true,
            nombre: true,
            categoria_id: true,
            oculto: true,
            agotado_hasta: true,
            categoria: { select: { nombre: true, area_id: true, area: { select: { nombre: true } } } },
            tamanos: { where: { activo: true }, select: { tamano_valor_id: true, unidades: true, tamano_valor: { select: { nombre: true } } } },
            ...SELECT_STOCK_COMBO,
          },
        })
      : [];
    // Tamaño equivalente por producto: el del valor del combo pedido, si el producto lo tiene
    const tamanoEquivalente = new Map<string, { nombre: string; unidades: number }>();
    if (tamanoValorId !== undefined && tamanoValorId !== null && tamanoValorId !== '') {
      for (const f of filas as any[]) {
        const t = (f.tamanos ?? []).find((x: any) => String(x.tamano_valor_id) === String(tamanoValorId));
        if (t) tamanoEquivalente.set(f.id.toString(), { nombre: t.tamano_valor?.nombre ?? '', unidades: t.unidades ?? 1 });
      }
    }
    const info = new Map<string, InfoProductoCombo>(
      filas.map((f: any) => [
        f.id.toString(),
        {
          id: f.id.toString(),
          nombre: f.nombre,
          categoriaId: f.categoria_id?.toString() ?? '',
          categoriaNombre: f.categoria?.nombre ?? null,
          areaId: f.categoria?.area_id ?? null,
          areaNombre: f.categoria?.area?.nombre ?? null,
          oculto: !!f.oculto,
          agotadoHasta: f.agotado_hasta ?? null,
          ...stockDeProducto(f),
        },
      ]),
    );
    const disp: ProductoDisp[] = [...info.values()];
    const nombreDe = (id: string) => info.get(id)?.nombre ?? 'El producto elegido';
    const tamanoPorCombo = (productoId: string) => {
      const t = tamanoEquivalente.get(productoId);
      return t ? { tamano: t.nombre, unidadesTamano: t.unidades } : {};
    };

    // Una alternativa es un producto de la lista de la parte que no es de su original (principal o categorías)
    const esAlternativa = (parte: (typeof partesOferta)[number], id: string) =>
      parte.alternativas.some((a) => a.id === id) && !productosDeParte(parte, disp).some((x) => x.id === id);

    // Líneas con cantidad por producto; `tipo` y `cambio` van a la línea de cocina
    const porParte: {
      parteId: string;
      tipo: 'FIJO' | 'A_ELECCION';
      productoId: string;
      n: number;
      sabores: Map<string, number>;
      cambio: string | null;
    }[] = [];
    const cambios: string[] = [];
    const partes: ParteResueltaCombo[] = [];
    // Partes opcionales que el cliente quitó («SIN papas») y cobro por extras sobre lo incluido
    const sin: string[] = [];
    let recargoPorCombo = 0;

    // Cada unidad elegida se valida (permitida, con stock, con sabor si lo tiene) y se acumula por producto
    const acumular = (
      parte: (typeof partesOferta)[number],
      picks: { productoId: string | number; saborId?: string | number }[],
      permitido: (prod: InfoProductoCombo) => boolean,
      tipo: 'FIJO' | 'A_ELECCION',
      cambio: string | null,
      acotarSabores = false,
    ) => {
      const porProducto = new Map<string, { n: number; sabores: Map<string, number> }>();
      for (const pk of picks) {
        const id = String(pk.productoId);
        const completo = info.get(id);
        // Parte con sabores acotados: el producto solo muestra los sabores permitidos (y sin ninguno no es opción)
        const prod = completo && acotarSabores ? conSaboresDeParte(parte, completo) : completo;
        const sinSaboresPermitidos = !!completo && !!prod && (completo.sabores ?? []).length > 0 && (prod.sabores ?? []).length === 0;
        if (!prod || sinSaboresPermitidos || !permitido(prod)) {
          throw new BadRequestException({
            codigo: 'COMBO_PARTE_NO_PERMITIDA',
            mensaje: `${prod?.nombre ?? 'El producto elegido'} no es una opción de ${oferta.nombre}`,
          });
        }
        if (!productoDisponible(prod)) {
          throw noDisponible(prod.controlaStock ? `No hay stock de ${prod.nombre}; elige otro` : `${prod.nombre} está agotado; elige otro`);
        }
        const g = porProducto.get(id) ?? { n: 0, sabores: new Map<string, number>() };
        g.n += 1;
        // Producto por sabor: cada unidad lleva su sabor (sin sabor no se puede descontar)
        if (prod.controlaStock && (prod.sabores ?? []).length > 0) {
          const saborId = String(pk.saborId ?? '');
          if (!prod.sabores!.some((s) => s.id === saborId)) {
            throw new BadRequestException({ codigo: 'SABORES_INVALIDOS', mensaje: `Elige el sabor de ${prod.nombre}` });
          }
          g.sabores.set(saborId, (g.sabores.get(saborId) ?? 0) + 1);
        }
        porProducto.set(id, g);
      }
      for (const [id, g] of porProducto) porParte.push({ parteId: parte.id!, tipo, productoId: id, n: g.n, sabores: g.sabores, cambio });
    };

    // Alternativa: una sola, con su cantidad exacta; solo si el original no alcanza (409 si alcanza)
    const resolverAlternativa = (parte: (typeof partesOferta)[number], picks: { productoId: string | number; saborId?: string | number }[]) => {
      const altId = String(picks[0].productoId);
      if (picks.some((pk) => String(pk.productoId) !== altId)) {
        throw new BadRequestException({
          codigo: 'COMBO_PARTE_NO_PERMITIDA',
          mensaje: `Elige una sola alternativa para ${oferta.nombre}`,
        });
      }
      const etiquetaOriginal = parte.tipo === 'FIJO' ? nombreDe(parte.productos[0]) : 'las opciones de la parte';
      if (parteArmable(parte, disp, unidades)) {
        throw new ConflictException({
          codigo: 'COMBO_ALTERNATIVA_NO_APLICA',
          mensaje: `Todavía hay ${etiquetaOriginal} para armar ${oferta.nombre}: no hace falta una alternativa`,
        });
      }
      const alt = parte.alternativas.find((a) => a.id === altId)!;
      const requeridas = alt.cantidad * unidades;
      if (picks.length !== requeridas) {
        throw new BadRequestException({
          codigo: 'COMBO_ELECCION_INCOMPLETA',
          mensaje: `Elige exactamente ${requeridas} ${nombreDe(altId)} para ${oferta.nombre}`,
        });
      }
      const cambio = `${nombreDe(altId)} (en lugar de ${etiquetaOriginal})`;
      cambios.push(cambio);
      acumular(parte, picks, (prod) => prod.id === altId, parte.tipo === 'FIJO' ? 'FIJO' : 'A_ELECCION', cambio);
    };

    for (const parte of partesOferta.filter((p) => p.tipo === 'FIJO')) {
      const picks = elecciones.filter((e) => String(e.parteId) === parte.id);
      // Parte opcional: cuántas unidades lleva el cliente (0..máx); el servidor valida y recalcula el cobro extra
      let llevadas = parte.cantidad;
      if (parte.opcional) {
        const min = parte.cantidadMin ?? 0;
        const max = parte.cantidadMax ?? parte.cantidad;
        const crudo = picks[0]?.cantidad;
        llevadas = crudo === undefined || crudo === null ? (parte.incluidaPorDefecto === false ? 0 : parte.cantidad) : Number(crudo);
        if (!Number.isInteger(llevadas) || llevadas < min || llevadas > max) {
          throw new BadRequestException({
            codigo: 'COMBO_CANTIDAD_INVALIDA',
            mensaje: `${nombreDe(parte.productos[0])} en ${oferta.nombre}: elige entre ${min} y ${max}`,
          });
        }
        if (llevadas === 0) {
          sin.push(nombreDe(parte.productos[0]));
          continue;
        }
      }
      if (picks.some((pk) => esAlternativa(parte, String(pk.productoId)))) {
        resolverAlternativa(parte, picks);
        continue;
      }
      const principal = parte.productos[0];
      const elegido = picks[0] !== undefined ? String(picks[0].productoId) : undefined;
      if (elegido !== undefined && elegido !== principal) {
        throw noDisponible(`${nombreDe(elegido)} no es una opción de ${oferta.nombre}`);
      }
      if (!parteArmable({ ...parte, cantidad: llevadas }, disp, unidades)) {
        if (elegido === undefined) {
          throw new BadRequestException({
            codigo: 'COMBO_ELECCION_INCOMPLETA',
            mensaje: `Elige una alternativa para ${nombreDe(principal)}: no hay stock`,
          });
        }
        throw noDisponible(`${nombreDe(principal)} se acaba de agotar; elige otro reemplazo`);
      }
      const extra = parte.opcional ? Math.max(0, llevadas - parte.cantidad) : 0;
      recargoPorCombo += extra * (parte.precioExtra ?? 0);
      partes.push({
        ...parteResuelta(oferta.nombre, parte.id!, 'FIJO', principal, llevadas * unidades, [parte.paqueteNombre, extra > 0 ? `EXTRA +${extra * unidades}` : null].filter(Boolean).join(' · ') || null, info),
        ...(extra > 0 ? { extras: extra * unidades } : {}),
        // Tamaño de la parte (solo el principal; una alternativa sale sin tamaño)
        ...(parte.tamanoId
          ? { tamano: parte.tamanoNombre ?? null, unidadesTamano: parte.tamanoUnidades ?? 1 }
          : tamanoPorCombo(principal)),
      });
    }

    for (const parte of partesOferta.filter((p) => p.tipo === 'A_ELECCION')) {
      const picks = elecciones.filter((e) => String(e.parteId) === parte.id);
      if (picks.some((pk) => esAlternativa(parte, String(pk.productoId)))) {
        resolverAlternativa(parte, picks);
        continue;
      }
      const requeridas = parte.cantidad * unidades;
      const ocupados = picks.reduce((a, pk) => a + cuposDeProducto(parte, String(pk.productoId)), 0);
      if (picks.length === 0) {
        // Con lista de productos (juguetes), paquete o bebidas por categoría es obligatoria; otra parte por categoría no genera líneas
        if (parte.productos.length > 0 || parte.paqueteGrupo || esParteBebidas(parte, disp)) {
          throw new BadRequestException({
            codigo: 'COMBO_ELECCION_INCOMPLETA',
            mensaje: `Elige ${requeridas} opción(es) para ${oferta.nombre}`,
          });
        }
        continue;
      }
      if (ocupados !== requeridas) {
        const grandes = picks.filter((pk) => cuposDeProducto(parte, String(pk.productoId)) > 1);
        const g = grandes[0] ? nombreDe(String(grandes[0].productoId)) : null;
        throw new BadRequestException({
          codigo: 'COMBO_ELECCION_INCOMPLETA',
          mensaje: g
            ? `${g} ocupa ${cuposDeProducto(parte, String(grandes[0].productoId))} lugares: elige solo ${g.toLowerCase()} o completa con productos de 1 lugar (${requeridas} lugares en total en ${oferta.nombre})`
            : `Elige exactamente ${requeridas} opción(es) para ${oferta.nombre}`,
        });
      }
      acumular(
        parte,
        picks,
        (prod) => admiteProducto(parte, prod),
        'A_ELECCION',
        parte.paqueteNombre ?? null,
        true,
      );
    }

    // Saldo: lo elegido en todas las partes suma por producto (y por sabor). Si no alcanza, no se arma el combo.
    const totales = new Map<string, { n: number; sabores: Map<string, number> }>();
    for (const x of porParte) {
      const t = totales.get(x.productoId) ?? { n: 0, sabores: new Map<string, number>() };
      t.n += x.n;
      for (const [s, n] of x.sabores) t.sabores.set(s, (t.sabores.get(s) ?? 0) + n);
      totales.set(x.productoId, t);
    }
    for (const [id, t] of totales) {
      const prod = info.get(id)!;
      if (!prod.controlaStock) continue;
      if ((prod.sabores ?? []).length > 0) {
        for (const [saborId, n] of t.sabores) {
          const sab = prod.sabores!.find((s) => s.id === saborId)!;
          const quedan = Math.max(0, Math.floor(sab.saldo));
          if (!estaDisponible(sab.agotadoHasta)) {
            throw new ConflictException({ codigo: 'SABOR_AGOTADO', mensaje: `El sabor ${sab.nombre} está agotado`, productoId: id, saborId, saborNombre: sab.nombre });
          }
          if (n > sab.saldo) {
            throw new ConflictException({
              codigo: 'STOCK_INSUFICIENTE',
              mensaje: `Solo quedan ${quedan} de ${sab.nombre}`,
              productoId: id,
              saborId,
              saborNombre: sab.nombre,
              quedan,
            });
          }
        }
      } else if (t.n > (prod.saldo ?? 0)) {
        const quedan = Math.max(0, Math.floor(prod.saldo ?? 0));
        throw new ConflictException({ codigo: 'STOCK_INSUFICIENTE', mensaje: `Solo quedan ${quedan} de ${prod.nombre}`, productoId: id, quedan });
      }
    }

    for (const x of porParte) {
      const prod = info.get(x.productoId)!;
      const sabores = [...x.sabores].map(([saborId, cantidad]) => ({
        saborId: BigInt(saborId),
        nombre: prod.sabores?.find((s) => s.id === saborId)?.nombre ?? '',
        cantidad,
      }));
      partes.push({
        ...parteResuelta(oferta.nombre, x.parteId, x.tipo, x.productoId, x.n, x.cambio, info),
        ...tamanoPorCombo(x.productoId),
        ...(sabores.length ? { sabores } : {}),
      });
    }

    // Cocina lo ve en cada pieza y en la línea del combo: «SIN papas nativas · Combo: Dúo»
    if (sin.length) {
      const marca = sin.map((n) => `SIN ${n}`).join(' · ');
      for (const pt of partes) pt.nota = `${marca} · ${pt.nota}`;
      cambios.push(marca);
    }
    return {
      nota: cambios.length ? `${oferta.nombre} · ${cambios.join(' · ')}` : '',
      partes,
      conBebidas: partesOferta.some((p) => esParteBebidas(p, disp)),
      ...(recargoPorCombo > 0 ? { recargoPorCombo: Number(recargoPorCombo.toFixed(2)) } : {}),
    };
  }

  /**
   * Parte opcional (solo FIJO): `cantidad` = incluidas en el precio; mínimo ≤ incluidas ≤ máximo; el extra no es negativo.
   * Sin opcional, todo queda en sus valores neutros (la parte se comporta como siempre).
   */
  private opcionalDeParte(
    tipo: string,
    p: { cantidad?: number; opcional?: boolean; cantidadMin?: number; cantidadMax?: number | null; incluidaPorDefecto?: boolean; precioExtra?: number | null },
  ) {
    if (!p.opcional) return { opcional: false, cantidad_min: 0, cantidad_max: null, incluida_por_defecto: true, precio_extra: null };
    const invalido = (mensaje: string) => new BadRequestException({ codigo: 'COMBO_OPCIONAL_INVALIDO', mensaje });
    if (tipo !== 'FIJO') throw invalido('Solo una parte «Siempre incluido» puede ser opcional');
    const incluidas = p.cantidad || 1;
    const min = p.cantidadMin ?? 0;
    const max = p.cantidadMax ?? null;
    if (min < 0 || min > incluidas) throw invalido('El mínimo no puede superar las unidades incluidas');
    if (max !== null && max < incluidas) throw invalido('El máximo no puede ser menor que las unidades incluidas');
    if (p.precioExtra != null && p.precioExtra < 0) throw invalido('El precio de cada extra no puede ser negativo');
    return {
      opcional: true,
      cantidad_min: min,
      cantidad_max: max,
      incluida_por_defecto: p.incluidaPorDefecto ?? true,
      precio_extra: p.precioExtra != null ? new Prisma.Decimal(p.precioExtra) : null,
    };
  }

  /**
   * Cupos por producto de una parte A_ELECCION ({ productoId: 2 }): solo productos de la parte, enteros de 2 a `cantidad`
   * (un producto de 1 cupo no se guarda). Sin cupos queda NULL y todo vale 1, como siempre.
   */
  private async cuposDeParte(
    tx: any,
    tipo: string,
    cantidad: number,
    prodIds: bigint[],
    catIds: bigint[],
    crudo?: Record<string, number> | null,
  ): Promise<{ cupos_producto?: Record<string, number> }> {
    const invalido = (mensaje: string) => new BadRequestException({ codigo: 'COMBO_CUPOS_INVALIDOS', mensaje });
    const entradas = Object.entries(crudo ?? {}).filter(([, n]) => n !== 1);
    if (entradas.length === 0) return {};
    if (tipo !== 'A_ELECCION') throw invalido('Solo una parte «El cliente elige» puede tener cupos por producto');
    const cupos: Record<string, number> = {};
    for (const [id, n] of entradas) {
      if (!/^\d+$/.test(id) || !Number.isInteger(n) || n < 1 || n > cantidad) {
        throw invalido(`Los cupos de un producto van de 1 a ${cantidad} (lo que elige el cliente en la parte)`);
      }
      cupos[id] = n;
    }
    const ids = Object.keys(cupos).map((x) => BigInt(x));
    const pertenecen =
      prodIds.length > 0
        ? ids.every((x) => prodIds.includes(x))
        : (await tx.producto.count({ where: { id: { in: ids }, categoria_id: { in: catIds } } })) === ids.length;
    if (!pertenecen) throw invalido('Los cupos solo pueden ser de productos que están en la parte');
    return { cupos_producto: cupos };
  }

  /** Ids numéricos de una lista de entrada (sabores, excluidos): sin repetir y sin valores raros. */
  private idsNumericos(lista?: (string | number)[] | null): bigint[] {
    const ids = (lista ?? []).map(String).filter((x) => /^\d+$/.test(x));
    return [...new Set(ids)].map((x) => BigInt(x));
  }

  /**
   * Paquete de una parte (complemento a elegir): grupo y nombre juntos o ninguno; solo partes FIJO o A_ELECCION
   * (las UNA_DE no se resuelven al pedir). Sin paquete devuelve null en ambos.
   */
  private paqueteDeParte(
    tipo: string,
    p: { paqueteGrupo?: string | null; paqueteNombre?: string | null },
  ): { paquete_grupo: string | null; paquete_nombre: string | null } {
    const grupo = (p.paqueteGrupo ?? '').trim();
    const nombre = (p.paqueteNombre ?? '').trim();
    if (!grupo && !nombre) return { paquete_grupo: null, paquete_nombre: null };
    if (!grupo || !nombre || (tipo !== 'FIJO' && tipo !== 'A_ELECCION')) {
      throw new BadRequestException({
        codigo: 'COMBO_PAQUETE_INVALIDO',
        mensaje: 'Cada pieza de un complemento necesita el nombre del complemento y el de su alternativa, y ser un producto fijo o una elección',
      });
    }
    return { paquete_grupo: grupo, paquete_nombre: nombre };
  }

  /**
   * Tamaño de una parte: solo FIJO de un único producto, y el producto_tamano tiene que ser de ese producto.
   * Sin tamaño (undefined, null, vacío) devuelve null.
   */
  private async tamanoDeParte(
    tx: Prisma.TransactionClient,
    tipo: string,
    prodIds: bigint[],
    tamanoId?: string | number | null,
  ): Promise<bigint | null> {
    if (tamanoId === undefined || tamanoId === null || tamanoId === '') return null;
    const id = String(tamanoId);
    const invalido = () =>
      new BadRequestException({ codigo: 'COMBO_TAMANO_INVALIDO', mensaje: 'El tamaño solo puede elegirse en una parte fija de un producto' });
    if (tipo !== 'FIJO' || prodIds.length !== 1 || !/^\d+$/.test(id)) throw invalido();
    const pt = await tx.productoTamano.findUnique({ where: { id: BigInt(id) }, select: { producto_id: true } });
    if (!pt || pt.producto_id !== prodIds[0]) throw invalido();
    return BigInt(id);
  }

  /**
   * Alternativas de una parte (producto y cantidad, en orden): sin repetir, sin productos de la parte y solo productos
   * que existan. Cualquier tipo de parte.
   */
  private async guardarAlternativas(
    tx: Prisma.TransactionClient,
    partePk: bigint,
    originales: bigint[],
    alternativas?: { productoId: string | number; cantidad?: number }[],
  ): Promise<void> {
    if (!Array.isArray(alternativas) || alternativas.length === 0) return;
    const invalidas = () =>
      new BadRequestException({ codigo: 'COMBO_REEMPLAZO_INVALIDO', mensaje: 'Las alternativas no pueden repetirse ni ser productos de la misma parte' });
    const filas = alternativas.map((a) => {
      const id = String(a.productoId);
      if (!/^\d+$/.test(id)) throw new BadRequestException({ codigo: 'COMBO_REEMPLAZO_INVALIDO', mensaje: 'Alternativa de producto no válida' });
      const cantidad = a.cantidad ?? 1;
      if (!Number.isInteger(cantidad) || cantidad < 1) {
        throw new BadRequestException({ codigo: 'COMBO_REEMPLAZO_INVALIDO', mensaje: 'La cantidad de cada alternativa debe ser al menos 1' });
      }
      return { producto_id: BigInt(id), cantidad };
    });
    const ids = filas.map((f) => f.producto_id);
    if (new Set(ids.map(String)).size !== ids.length || ids.some((i) => originales.includes(i))) throw invalidas();
    const existentes = await tx.producto.findMany({ where: { id: { in: ids } }, select: { id: true } });
    if (existentes.length !== ids.length) {
      throw new BadRequestException({
        codigo: 'COMBO_REEMPLAZO_INVALIDO',
        mensaje: 'Alguna alternativa no es un producto de la carta',
      });
    }
    await tx.comboParteReemplazo.createMany({
      data: filas.map((f, orden) => ({ combo_parte_id: partePk, producto_id: f.producto_id, orden, cantidad: f.cantidad })),
    });
  }

  /**
   * Anfitriones de combo que no se venden por un paso obligatorio sin opciones por stock y sin alternativas en el combo.
   * Misma regla que la carta (opcion-requiere.ts), con los grupos y las opciones del producto anfitrión.
   */
  private async anfitrionesBloqueadosPorPaso(combos: OfertaItem[]): Promise<Set<string>> {
    const bloqueados = new Set<string>();
    const hosts = combos.filter((c) => c.alcanceProductoId);
    if (hosts.length === 0) return bloqueados;
    const filas = await this.prisma.producto.findMany({
      where: { id: { in: hosts.map((c) => BigInt(c.alcanceProductoId!)) } },
      select: {
        id: true,
        grupos: {
          select: {
            grupo: {
              select: {
                activo: true,
                obligatorio: true,
                minimo: true,
                opciones: { where: { activo: true }, select: { id: true, agotado_hasta: true } },
              },
            },
          },
        },
      },
    });
    const sinStock = await opcionesSinStock(
      this.prisma,
      filas.flatMap((f: any) => f.grupos.flatMap((pg: any) => pg.grupo.opciones.map((o: any) => o.id))),
    );
    for (const f of filas as any[]) {
      const pasos = f.grupos
        .filter((pg: any) => pg.grupo.activo)
        .map((pg: any) => ({
          obligatorio: pg.grupo.obligatorio,
          minimo: pg.grupo.minimo,
          opciones: pg.grupo.opciones.map((o: any) => ({
            disponible: estaDisponible(o.agotado_hasta) && !sinStock.has(o.id.toString()),
            bloqueadaPorStock: sinStock.has(o.id.toString()),
          })),
        }));
      const combo = hosts.find((c) => c.alcanceProductoId === f.id.toString());
      const conAlternativas = (combo?.combosParte ?? []).some((p) => (p.alternativas ?? []).length > 0);
      if (anfitrionBloqueadoPorPaso(pasos, conAlternativas)) bloqueados.add(f.id.toString());
    }
    return bloqueados;
  }

  /** Agrega `disponible`, `motivoAgotado` y por parte `opcionesDisponibles` a los combos (tiempo real, no toca `activo`). */
  private async conDisponibilidad(items: OfertaItem[]): Promise<OfertaItem[]> {
    // Nombres de las categorías del alcance (una consulta); categoriaNombre las junta para los textos
    const idsCat = [...new Set(items.flatMap((i) => i.alcanceCategoriaIds ?? []))];
    if (idsCat.length) {
      const cats = await this.prisma.categoria.findMany({
        where: { id: { in: idsCat.map((x) => BigInt(x)) } },
        select: { id: true, nombre: true },
      });
      const nombre = new Map(cats.map((c) => [c.id.toString(), c.nombre]));
      for (const i of items) {
        if (!i.alcanceCategoriaIds?.length) continue;
        i.categoriasNombres = i.alcanceCategoriaIds.map((x) => nombre.get(x)).filter((n): n is string => !!n);
        i.categoriaNombre = i.categoriasNombres.join(', ') || i.categoriaNombre;
      }
    }
    const combos = items.filter((i) => i.tipo === 'COMBO' && i.combosParte?.length);
    if (combos.length === 0) return items;
    const partes = combos.flatMap((c) => c.combosParte!);
    const ids = new Set<bigint>();
    const cats = new Set<bigint>();
    for (const p of partes) {
      [...p.productos, ...(p.alternativas ?? []).map((a) => a.id)].forEach((x) => ids.add(BigInt(x)));
      p.categorias.forEach((x) => cats.add(BigInt(x)));
    }
    const filas = await this.prisma.producto.findMany({
      where: { OR: [{ id: { in: [...ids] } }, { categoria_id: { in: [...cats] } }] },
      select: {
        id: true,
        nombre: true,
        categoria_id: true,
        oculto: true,
        agotado_hasta: true,
        categoria: { select: { nombre: true, area: { select: { nombre: true } } } },
        foto_archivo: { select: { ruta: true } },
        ...SELECT_STOCK_COMBO,
      },
    });
    const productos: ProductoDisp[] = filas.map((f: any) => ({
      id: f.id.toString(),
      nombre: f.nombre,
      categoriaId: f.categoria_id.toString(),
      categoriaNombre: f.categoria?.nombre ?? null,
      areaNombre: f.categoria?.area?.nombre ?? null,
      fotoUrl: obtenerFotoUrl(f.foto_archivo),
      oculto: f.oculto,
      agotadoHasta: f.agotado_hasta,
      ...stockDeProducto(f),
    }));
    const hostsBloqueados = await this.anfitrionesBloqueadosPorPaso(combos);
    for (const c of combos) {
      const r = calcularDisponibilidadCombo(
        c.combosParte!.map((p) => ({ ...p, alternativas: p.alternativas ?? [] })),
        productos,
      );
      c.disponible = r.disponible;
      c.motivoAgotado = r.motivoAgotado;
      // Sin armar por saldo: alguno de sus productos (o categorías) está en 0, no solo agotado a mano
      const delCombo = productos.filter(
        (x) => c.combosParte!.some((p) => [...p.productos, ...(p.alternativas ?? []).map((a) => a.id)].includes(x.id) || p.categorias.includes(x.categoriaId)),
      );
      c.sinStock = !r.disponible && delCombo.some((x) => x.controlaStock && estaDisponible(x.agotadoHasta) && !productoDisponible(x));
      // Piezas que bloquean el combo y por qué (solo panel del dueño; la carta pública no lo recibe)
      const bloq = new Map<string, { productoId: string; nombre: string; motivo: string }>();
      for (const p of c.combosParte!) {
        for (const id of [...p.productos, ...(p.alternativas ?? []).map((a) => a.id)]) {
          const prod = productos.find((x) => x.id === id);
          const motivo = prod ? motivoProductoBloqueado(prod) : null;
          if (prod && motivo) bloq.set(id, { productoId: id, nombre: prod.nombre, motivo });
        }
      }
      c.piezasBloqueadas = [...bloq.values()];
      // El producto anfitrión (Dúo) no se vende si un paso obligatorio se quedó sin opciones por stock (misma regla que la carta)
      if (c.alcanceProductoId && hostsBloqueados.has(c.alcanceProductoId)) {
        c.disponible = false;
        c.motivoAgotado = 'Sin stock de un paso obligatorio del combo';
        c.sinStock = true;
      }
      c.combosParte!.forEach((p, i) => {
        const rp = r.partes[i];
        p.disponible = rp.disponible;
        p.opcionesDisponibles = rp.opcionesDisponibles;
        p.alternativasActivas = rp.alternativasActivas;
        if (p.tipo === 'FIJO') p.principalNombre = productos.find((x) => x.id === p.productos[0])?.nombre ?? '';
        if (p.alternativas && p.alternativas.length > 0) {
          // Todas las alternativas, con su nombre y si se puede elegir ahora (las agotadas salen bloqueadas)
          p.alternativas = p.alternativas.map((a, j) => {
            const f = productos.find((x) => x.id === a.id);
            const disponible = rp.alternativas[j]?.disponible ?? false;
            const sinStock = !disponible && !!f && estaDisponible(f.agotadoHasta) && !!f.controlaStock;
            return { ...detalleOpcion(a.id, productos), nombre: f?.nombre ?? a.nombre, cantidad: a.cantidad, disponible, ...(sinStock ? { sinStock } : {}) };
          });
        }
        if (p.tipo === 'A_ELECCION' && p.productos.length > 0) {
          // Lista explícita (p. ej. juguetes o las bebidas de un Dúo): cada opción con su nombre y si se puede elegir ahora;
          // si todas son bebidas, la parte se arma en pasos «Bebida 1..N»
          if (esParteBebidas({ ...p, alternativas: [] }, productos)) p.bebidas = true;
          const deLaParte = productosDeParte({ ...p, alternativas: [] }, productos);
          p.opcionesDetalle = p.productos
            .map((id) => deLaParte.find((x) => x.id === id))
            .filter((x): x is ProductoDisp => !!x)
            .map((x) => detalleOpcion(x.id, deLaParte));
        } else if (p.tipo === 'A_ELECCION' && esParteBebidas({ ...p, alternativas: [] }, productos)) {
          // Bebidas por categorías («Bebida 1..N»): los productos visibles de esas categorías (sin los excluidos); los agotados salen bloqueados
          const deLaParte = productosDeParte({ ...p, alternativas: [] }, productos).filter((x) => !x.oculto);
          p.bebidas = true;
          p.opcionesDetalle = deLaParte.map((x) => detalleOpcion(x.id, deLaParte));
        } else if (p.tipo === 'A_ELECCION' && p.paqueteGrupo) {
          // Pieza de un complemento por categorías (p. ej. «Donas»): sus productos visibles son las opciones
          const deLaParte = productosDeParte({ ...p, alternativas: [] }, productos).filter((x) => !x.oculto);
          p.opcionesDetalle = deLaParte.map((x) => detalleOpcion(x.id, deLaParte));
        }
        // Producto que ocupa más de un lugar en la parte: la carta, el mozo y Caja lo muestran («ocupa 2»)
        for (const o of p.opcionesDetalle ?? []) {
          const c = cuposDeProducto(p, o.id);
          if (c > 1) o.cupos = c;
        }
      });
    }
    return items;
  }

  /** Reglas de la promoción de primera compra: solo descuentos, solo carta web y como máximo un mes de vigencia. */
  /** El envío gratis solo existe en delivery: si se limita por modalidad, Delivery tiene que estar. */
  private validarModalidadesEnvio(tipo: string, modalidades?: string[] | null): void {
    if (tipo === 'ENVIO_GRATIS' && modalidades?.length && !modalidades.includes('DELIVERY')) {
      throw new BadRequestException({ codigo: 'ENVIO_GRATIS_SIN_DELIVERY', mensaje: 'El envío gratis solo vale en delivery: marca Delivery' });
    }
  }

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

  private mapearOferta(o: any, canal?: string, modalidad?: string): OfertaItem {
    return {
      id: o.id.toString(),
      tipo: o.tipo,
      nombre: o.nombre,
      descripcion: o.descripcion,
      lleva: o.lleva,
      paga: o.paga,
      alcanceCategoriaId: categoriasAlcance(o)[0]?.toString() ?? null,
      alcanceCategoriaIds: categoriasAlcance(o).map((x) => x.toString()),
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
      modalidades: o.modalidades || [],
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
      vigenteAhora: ofertaAplicaA(o, { canal, modalidad }),
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
            paqueteGrupo: cp.paquete_grupo ?? null,
            paqueteNombre: cp.paquete_nombre ?? null,
            saboresIds: (cp.sabores_ids || []).map((x: any) => x.toString()),
            productosExcluidos: (cp.productos_excluidos_ids || []).map((x: any) => x.toString()),
            ...(cp.cupos_producto && Object.keys(cp.cupos_producto).length > 0 ? { cuposProducto: cp.cupos_producto as Record<string, number> } : {}),
            opcional: !!cp.opcional,
            cantidadMin: cp.cantidad_min ?? 0,
            cantidadMax: cp.cantidad_max ?? null,
            incluidaPorDefecto: cp.incluida_por_defecto ?? true,
            precioExtra: cp.precio_extra != null ? Number(cp.precio_extra) : null,
            tamanoId: cp.tamano ? cp.tamano.id.toString() : null,
            tamanoNombre: cp.tamano?.tamano_valor?.nombre ?? null,
            tamanoUnidades: cp.tamano?.unidades ?? 1,
            alternativas: (cp.reemplazos || []).map((r: any) => ({
              id: r.producto_id.toString(),
              nombre: r.producto?.nombre ?? '',
              cantidad: r.cantidad ?? 1,
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
      dias: c.dias || [],
      horaDesde: formatearHora(c.hora_desde),
      horaHasta: formatearHora(c.hora_hasta),
      fechaDesde: formatearFecha(c.fecha_desde),
      fechaHasta: formatearFecha(c.fecha_hasta),
    };
  }
}
