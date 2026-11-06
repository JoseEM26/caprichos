import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { controlaPorSabor, descontarVentaProductos, validarSaboresLinea } from '../stock/producto-controlado';
import { etiquetaMotivo, validarMotivoCortesia } from './cortesia.tipos';
import { FilaCortesia, resumenCortesias } from './cortesias-informe';
import { FiltroCortesiasDto, RegistrarCortesiaDto } from './dto/cortesias.dto';

/** Fecha de Lima (UTC-5, sin horario de verano) a instante, para filtrar creado_en por día. */
function inicioDiaLima(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000-05:00`);
}
function finDiaLima(fecha: string): Date {
  return new Date(`${fecha}T23:59:59.999-05:00`);
}

/** Estados en que el pedido ya no se puede tocar. */
const ESTADOS_NO_VIGENTES = ['ANULADO', 'RECHAZADO'];

@Injectable()
export class CortesiasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Cortesía por separado (sin pedido propio): descuenta stock como una venta y queda ligada a su pedido de referencia. */
  async registrarSeparada(
    dto: RegistrarCortesiaDto,
    usuario: UsuarioAutenticado,
    supervisorPartyId?: bigint,
    ip?: string,
  ) {
    const { motivo, nota } = validarMotivoCortesia(dto.motivo, dto.nota);
    const cantidad = Math.floor(Number(dto.cantidad));

    const referencia = await this.prisma.pedido.findUnique({
      where: { id: this.id(dto.pedidoReferenciaId, 'PEDIDO_REFERENCIA_INVALIDO') },
      select: { id: true, codigo: true },
    });
    if (!referencia) {
      throw new NotFoundException({ codigo: 'PEDIDO_REFERENCIA_NO_ENCONTRADO', mensaje: 'No encontramos el pedido de referencia' });
    }

    const producto = await this.prisma.producto.findUnique({
      where: { id: this.id(dto.productoId, 'PRODUCTO_INVALIDO') },
      include: { categoria: true, tamanos: { include: { tamano_valor: true } }, sabores: true },
    });
    if (!producto) {
      throw new NotFoundException({ codigo: 'PRODUCTO_NO_ENCONTRADO', mensaje: 'Producto no encontrado' });
    }

    let precioBase = Number(producto.precio);
    let unidades = 1;
    if (producto.tamanos.length > 0) {
      if (!dto.tamanoId) {
        throw new BadRequestException({ codigo: 'TAMANO_REQUERIDO', mensaje: `Elige el tamaño de ${producto.nombre}` });
      }
      const tam = producto.tamanos.find((t) => t.id === this.id(dto.tamanoId, 'TAMANO_INVALIDO'));
      if (!tam) {
        throw new BadRequestException({ codigo: 'TAMANO_INVALIDO', mensaje: `El tamaño no pertenece a ${producto.nombre}` });
      }
      precioBase = Number(tam.precio);
      unidades = tam.unidades ?? 1;
    }

    const ahora = new Date();
    // Producto por sabor: el sabor elegido se lleva todas las unidades (tamaño × cantidad)
    const enviados = dto.sabores ?? (dto.saborId ? [{ saborId: dto.saborId, cantidad: unidades * cantidad }] : undefined);
    const sabores = controlaPorSabor(producto)
      ? validarSaboresLinea(producto, unidades, cantidad, enviados, ahora)
      : [];
    const unidadesStock = unidades * cantidad;
    const valorLista = Number((precioBase * cantidad).toFixed(2));
    const porId = usuario.partyId;

    return this.prisma.$transaction(async (tx) => {
      const cortesia = await tx.cortesia.create({
        data: {
          producto_id: producto.id,
          sabor_id: sabores[0]?.saborId ?? null,
          cantidad,
          valor_lista: valorLista,
          motivo,
          nota,
          pedido_id: null,
          pedido_referencia_id: referencia.id,
          dada_por_party_id: porId,
          autorizada_por_party_id: supervisorPartyId ?? null,
        },
      });
      await descontarVentaProductos(
        tx,
        null,
        [{ productoId: producto.id, cantidad: unidadesStock, areaId: producto.categoria?.area_id ?? null, sabores }],
        porId,
        ahora,
        { tipo: 'CORTESIA' },
      );
      await this.auditoria.registrar(
        {
          categoria: 'CAMBIO',
          modulo: 'cortesias',
          accion: 'REGISTRAR_SEPARADA',
          entidad: 'cortesia',
          entidadId: cortesia.id,
          despues: { producto: producto.nombre, cantidad, valorLista, motivo, pedidoReferencia: referencia.codigo, nota },
          partyId: porId,
          ip,
        },
        tx,
      );
      return { id: cortesia.id.toString(), valorLista, cantidad, referencia: referencia.codigo };
    });
  }

  /**
   * Cortesía sobre una línea de un pedido: la línea queda a S/ 0 con su valor de lista, el pedido baja su subtotal y total.
   * Solo mientras el pedido no esté cobrado, sin comprobante, sin descuento y sin oferta en esa línea (ver README del plan).
   */
  async darEnLinea(
    pedidoIdRaw: string,
    lineaIdRaw: string,
    dto: { motivo: string; nota?: string },
    usuario: UsuarioAutenticado,
    supervisorPartyId?: bigint,
    ip?: string,
  ) {
    const { motivo, nota } = validarMotivoCortesia(dto.motivo, dto.nota);
    const pedidoId = this.id(pedidoIdRaw, 'ID_INVALIDO');
    const lineaId = this.id(lineaIdRaw, 'ID_INVALIDO');

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: {
        lineas: true,
        cobros: { where: { anulado_en: null }, select: { id: true } },
        comprobante: { where: { anulado_en: null }, select: { id: true } },
      },
    });
    if (!pedido) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    if (ESTADOS_NO_VIGENTES.includes(pedido.estado)) {
      throw new ConflictException({ codigo: 'PEDIDO_NO_VIGENTE', mensaje: 'El pedido está anulado o rechazado' });
    }
    if (pedido.pago_estado === 'PAGADO' || pedido.cobros.length > 0) {
      throw new ConflictException({
        codigo: 'PEDIDO_YA_COBRADO',
        mensaje: 'El pedido ya está cobrado: registra la cortesía por separado',
      });
    }
    if (pedido.comprobante.length > 0) {
      throw new ConflictException({ codigo: 'COMPROBANTE_EMITIDO', mensaje: 'El pedido ya tiene comprobante' });
    }
    if (Number(pedido.descuento) !== 0) {
      throw new ConflictException({
        codigo: 'PEDIDO_CON_DESCUENTO',
        mensaje: 'El pedido tiene descuento: registra la cortesía por separado',
      });
    }

    const linea = pedido.lineas.find((l) => l.id === lineaId);
    if (!linea) throw new NotFoundException({ codigo: 'LINEA_NO_ENCONTRADA', mensaje: 'La línea no está en este pedido' });
    if (linea.es_cortesia) {
      throw new ConflictException({ codigo: 'YA_ES_CORTESIA', mensaje: 'Esta línea ya es cortesía' });
    }
    if (linea.linea_combo_id !== null || linea.oferta_id !== null || linea.producto_id === null) {
      throw new ConflictException({
        codigo: 'LINEA_EN_OFERTA',
        mensaje: 'Las líneas de combo o de promoción no se pueden marcar como cortesía',
      });
    }

    const valorLista = Number(linea.subtotal ?? Number(linea.precio_unit) * linea.cantidad);
    const subtotalNuevo = Number((Number(pedido.subtotal) - valorLista).toFixed(2));
    if (subtotalNuevo <= 0) {
      throw new ConflictException({
        codigo: 'PEDIDO_SOLO_CORTESIA',
        mensaje: 'Un pedido solo de cortesías no se puede cobrar: registra la cortesía por separado',
      });
    }
    const totalNuevo = Number(Math.max(0, subtotalNuevo - Number(pedido.descuento) + Number(pedido.envio ?? 0)).toFixed(2));
    const delta = Number((totalNuevo - Number(pedido.total)).toFixed(2));
    const porId = usuario.partyId;

    return this.prisma.$transaction(async (tx) => {
      await tx.pedidoLinea.update({
        where: { id: linea.id },
        data: { es_cortesia: true, precio_unit: 0, subtotal: 0 },
      });
      const cortesia = await tx.cortesia.create({
        data: {
          producto_id: linea.producto_id!,
          cantidad: linea.cantidad,
          valor_lista: valorLista,
          motivo,
          nota,
          pedido_id: pedido.id,
          pedido_linea_id: linea.id,
          dada_por_party_id: porId,
          autorizada_por_party_id: supervisorPartyId ?? null,
        },
      });
      await tx.pedido.update({
        where: { id: pedido.id },
        data: { subtotal: subtotalNuevo, total: totalNuevo },
      });
      if (delta !== 0) await this.ajustarPlanPago(tx, pedido.id, delta);
      await this.auditoria.registrar(
        {
          categoria: 'CAMBIO',
          modulo: 'cortesias',
          accion: 'DAR_EN_PEDIDO',
          entidad: 'pedido',
          entidadId: pedido.id,
          antes: { total: Number(pedido.total), linea: linea.nombre, subtotalLinea: valorLista },
          despues: { total: totalNuevo, motivo, nota, cortesiaId: cortesia.id.toString() },
          partyId: porId,
          ip,
        },
        tx,
      );
      return { cortesiaId: cortesia.id.toString(), subtotal: subtotalNuevo, total: totalNuevo, valorLista };
    });
  }

  /** Listado con filtros de fecha (día de Lima), motivo y producto, con el resumen del informe. */
  async consultar(filtro: FiltroCortesiasDto) {
    const where: any = {};
    if (filtro.desde || filtro.hasta) {
      where.creado_en = {
        ...(filtro.desde ? { gte: inicioDiaLima(filtro.desde) } : {}),
        ...(filtro.hasta ? { lte: finDiaLima(filtro.hasta) } : {}),
      };
    }
    if (filtro.motivo) where.motivo = filtro.motivo;
    if (filtro.productoId) where.producto_id = this.id(filtro.productoId, 'PRODUCTO_INVALIDO');

    const filas = await this.prisma.cortesia.findMany({
      where,
      orderBy: { creado_en: 'desc' },
      include: {
        producto: { select: { nombre: true } },
        sabor: { select: { nombre: true } },
        pedido: { select: { codigo: true } },
        pedidoReferencia: { select: { codigo: true } },
        pedidoLinea: { select: { pedido: { select: { codigo: true } } } },
      },
    });

    const ids = new Set<bigint>();
    for (const c of filas) {
      ids.add(c.dada_por_party_id);
      if (c.autorizada_por_party_id) ids.add(c.autorizada_por_party_id);
    }
    const personas = ids.size
      ? await this.prisma.person.findMany({
          where: { party_id: { in: [...ids] } },
          select: { party_id: true, nombres: true, apellidos: true },
        })
      : [];
    const nombre = (partyId: bigint | null) => {
      if (partyId === null) return null;
      const p = personas.find((x) => x.party_id === partyId);
      return p ? [p.nombres, p.apellidos].filter(Boolean).join(' ') : `Usuario ${partyId}`;
    };

    const detalle: FilaCortesia[] = filas.map((c) => ({
      id: c.id.toString(),
      creadoEn: c.creado_en,
      productoId: c.producto_id.toString(),
      producto: c.producto.nombre,
      sabor: c.sabor?.nombre ?? null,
      cantidad: c.cantidad,
      valorLista: Number(c.valor_lista),
      motivo: c.motivo,
      nota: c.nota,
      pedido: c.pedido?.codigo ?? c.pedidoLinea?.pedido.codigo ?? null,
      pedidoReferencia: c.pedidoReferencia?.codigo ?? null,
      dadaPorId: c.dada_por_party_id.toString(),
      dadaPor: nombre(c.dada_por_party_id) ?? '',
      autorizadaPor: nombre(c.autorizada_por_party_id),
    }));

    return {
      desde: filtro.desde ?? null,
      hasta: filtro.hasta ?? null,
      ...resumenCortesias(detalle),
      detalle: detalle.map((f) => ({ ...f, motivoEtiqueta: etiquetaMotivo(f.motivo) })),
    };
  }

  /** Igual que en el alta de pedidos: si el plan de pago existe, el efectivo absorbe el cambio de total. */
  private async ajustarPlanPago(tx: any, pedidoId: bigint, diferenciaPesos: number) {
    const plan = await tx.pedidoPagoPlan.findMany({ where: { pedido_id: pedidoId }, orderBy: { orden: 'asc' } });
    if (plan.length === 0) return;
    const fila = plan.find((r: any) => r.medio === 'EFECTIVO') ?? plan[plan.length - 1];
    const nuevo = Math.round(Number(fila.monto) * 100) + Math.round(diferenciaPesos * 100);
    if (nuevo < 0) {
      throw new ConflictException({
        codigo: 'PLAN_PAGO_NO_ALCANZA',
        mensaje: 'La cortesía deja el plan de pago por debajo de cero: rehaz el plan de pago',
      });
    }
    await tx.pedidoPagoPlan.update({ where: { id: fila.id }, data: { monto: nuevo / 100 } });
  }

  private id(raw: unknown, codigo: string): bigint {
    if (typeof raw === 'number' || (typeof raw === 'string' && /^\d+$/.test(raw))) {
      return BigInt(raw);
    }
    throw new BadRequestException({ codigo, mensaje: 'El identificador no es válido' });
  }
}
