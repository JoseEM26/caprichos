import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Pedido, Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { ZonasService } from '../zonas/zonas.service';
import { calcularEnvioDelivery } from '../ofertas/envio-gratis-promo';
import { Ventana24hService } from '../chatbot/servicios/ventana-24h.service';
import { obtenerFechaHoraLima } from '../local/local.util';
import { aCentimos, bloquearCaja, enPesos, MEDIOS_COBRO } from '../caja/caja.calculo';
import { nombresDePartes } from './devolucion-pedido.util';
import { calcularAjusteCobro, ESTADOS_CERRADOS_UBICACION, textoAvisoEnvio } from './cambio-ubicacion.util';
import { UbicarPedidoDto } from './dto/ubicar-pedido.dto';
import { LiquidarAjusteUbicacionDto } from './dto/liquidar-ajuste-ubicacion.dto';

export interface PuntoCambio {
  lat: number;
  lng: number;
  direccion?: string;
  referencia?: string;
}

/** Propuesta del repartidor que Caja aprueba: se marca APROBADA dentro de la misma transacción. */
export interface PropuestaAplicada {
  id: bigint;
  propuestoPor: bigint;
  nota: string | null;
}

/** Números de un cambio de punto antes de tocar nada: zona, envío y total, y el ajuste de cobro si ya estaba pagado. */
export interface CalculoCambio {
  zona: { zonaId: bigint; codigo: string };
  envioAnterior: number;
  envioNuevo: number;
  diferencia: number;
  totalAnterior: number;
  totalNuevo: number;
  pagado: boolean;
  montoPagado: number | null;
  ajuste: { tipo: 'SALDO' | 'DEVOLUCION'; monto: number } | null;
  promo: { id: string } | null;
}

type Cliente = Prisma.TransactionClient;

/**
 * Cambio del punto de un delivery por Caja (RN cambio de ubicación): se previsualiza zona, envío y total, se
 * confirma y se aplica. Si el pedido ya estaba pagado, la diferencia queda como saldo por cobrar (envío mayor) o
 * devolución pendiente (envío menor) hasta que Caja la liquida. Solo el de Caja: lo aplican también las propuestas
 * del repartidor aprobadas por Caja (PropuestaUbicacionService).
 */
@Injectable()
export class CambioUbicacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zonas: ZonasService,
    private readonly auditoria: AuditoriaService,
    private readonly ventana: Ventana24hService,
    @Optional() private readonly eventosGateway?: EventosGateway,
  ) {}

  /** Id del pedido (texto de la URL) o 400. */
  parseId(idRaw: string): bigint {
    if (!/^\d+$/.test(String(idRaw))) {
      throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'El identificador del pedido no es válido' });
    }
    return BigInt(idRaw);
  }

  /** Pedido delivery que todavía admite cambio de punto (no ENTREGADO ni ANULADO). */
  async pedidoEditable(id: bigint) {
    const pedido = await this.prisma.pedido.findUnique({ where: { id } });
    if (!pedido) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    this.exigirEditable(pedido);
    return pedido;
  }

  exigirEditable(pedido: { modalidad: string; estado: string }) {
    if (pedido.modalidad !== 'DELIVERY') {
      throw new ConflictException({ codigo: 'NO_ES_DELIVERY', mensaje: 'Solo se cambia la ubicación de pedidos de delivery' });
    }
    if (ESTADOS_CERRADOS_UBICACION.includes(pedido.estado)) {
      throw new ConflictException({
        codigo: 'PEDIDO_CERRADO',
        mensaje: `No se puede cambiar la ubicación de un pedido en estado ${pedido.estado}`,
      });
    }
  }

  /** El pedido canjeó un cupón de envío gratis (de campaña o emitido). */
  private async pedidoTieneCuponEnvio(db: Cliente, pedido: { cupon_id: bigint | null; cupon_emitido_id: bigint | null }): Promise<boolean> {
    if (pedido.cupon_emitido_id) {
      const emitido = await db.cuponEmitido.findUnique({ where: { id: pedido.cupon_emitido_id }, include: { cupon: true } });
      return emitido?.cupon.descuento_tipo === 'ENVIO_GRATIS';
    }
    if (pedido.cupon_id) {
      const cupon = await db.cupon.findUnique({ where: { id: pedido.cupon_id } });
      return cupon?.descuento_tipo === 'ENVIO_GRATIS';
    }
    return false;
  }

  /**
   * Calcula zona, envío, total y ajuste de cobro para un punto nuevo. No escribe nada. Las reglas son las de
   * siempre: zona por polígono, promo ENVIO_GRATIS con la hora de creación del pedido, cupón de envío gratis.
   */
  async calcular(db: Cliente, pedido: Pedido, lat: number, lng: number): Promise<CalculoCambio> {
    const zona = await this.zonas.detectar(lat, lng);
    if (!zona) {
      throw new ConflictException({
        codigo: 'FUERA_DE_COBERTURA',
        mensaje: 'La ubicación indicada está fuera de la zona de cobertura',
      });
    }
    const subtotal = Number(pedido.subtotal);
    const envioGratisCupon = await this.pedidoTieneCuponEnvio(db, pedido);
    const { envio, promo } = await calcularEnvioDelivery(db as unknown as PrismaService, {
      subtotal,
      tarifaZona: Number(zona.tarifa),
      canal: pedido.canal,
      ahora: pedido.creado_en,
      envioGratisCupon,
    });
    const totalNuevo = Number((subtotal - Number(pedido.descuento) + envio).toFixed(2));
    const envioAnterior = Number(pedido.envio ?? 0);
    const totalAnterior = Number(pedido.total);
    const pagado = pedido.pago_estado === 'PAGADO';

    let ajuste: CalculoCambio['ajuste'] = null;
    let montoPagado: number | null = null;
    if (pagado) {
      // Lo que ya hay en caja por este pedido: el cobro vigente, más saldos cobrados, menos devoluciones hechas
      const cobro = await db.cobro.findFirst({ where: { pedido_id: pedido.id, anulado_en: null }, select: { total: true } });
      const resueltos = await db.pedidoCambioUbicacion.findMany({
        where: { pedido_id: pedido.id, ajuste_estado: { in: ['COBRADO', 'DEVUELTO'] } },
        select: { ajuste_estado: true, ajuste_monto: true },
      });
      let pagadoC = aCentimos(cobro ? cobro.total : pedido.total);
      for (const r of resueltos) {
        pagadoC += r.ajuste_estado === 'COBRADO' ? aCentimos(r.ajuste_monto) : -aCentimos(r.ajuste_monto);
      }
      montoPagado = enPesos(pagadoC);
      const a = calcularAjusteCobro(true, pagadoC, aCentimos(totalNuevo));
      ajuste = a ? { tipo: a.tipo, monto: enPesos(a.montoC) } : null;
    }

    return {
      zona: { zonaId: zona.zonaId, codigo: zona.codigo },
      envioAnterior,
      envioNuevo: envio,
      diferencia: Number((envio - envioAnterior).toFixed(2)),
      totalAnterior,
      totalNuevo,
      pagado,
      montoPagado,
      ajuste,
      promo: promo ? { id: String(promo.id) } : null,
    };
  }

  /** Vista previa para Caja: lo que pasaría si se confirma, sin guardar nada. */
  async previsualizar(idRaw: string, lat: number, lng: number) {
    const pedido = await this.pedidoEditable(this.parseId(idRaw));
    const c = await this.calcular(this.prisma, pedido, lat, lng);
    return this.salidaCalculo(c);
  }

  private salidaCalculo(c: CalculoCambio) {
    return {
      zona: c.zona.codigo,
      envioAnterior: c.envioAnterior,
      envioNuevo: c.envioNuevo,
      diferencia: c.diferencia,
      totalAnterior: c.totalAnterior,
      totalNuevo: c.totalNuevo,
      pagado: c.pagado,
      montoPagado: c.montoPagado,
      ajuste: c.ajuste,
      cambiaEnvio: c.diferencia !== 0,
    };
  }

  /** Caja cambia el punto de un delivery (en cualquier momento mientras no esté ENTREGADO ni ANULADO). */
  async cambiarPorCaja(idRaw: string, dto: UbicarPedidoDto, usuario: UsuarioAutenticado, ip?: string) {
    const id = this.parseId(idRaw);
    await this.pedidoEditable(id);
    return this.aplicarCambio(id, dto, { origen: 'CAJA', usuario, ip });
  }

  /**
   * Aplica un punto nuevo en una transacción (con el pedido bloqueado): recalcula, actualiza el pedido, registra el
   * historial y, si hay ajuste, lo deja pendiente. Después audita, avisa por socket y, solo si cambió el envío,
   * avisa al cliente por WhatsApp (sin plantilla y solo dentro de la ventana de 24 h).
   */
  async aplicarCambio(
    pedidoId: bigint,
    punto: PuntoCambio,
    ctx: { origen: 'CAJA' | 'REPARTIDOR'; usuario: UsuarioAutenticado; propuesta?: PropuestaAplicada; ip?: string },
  ) {
    const usuarioId = BigInt(ctx.usuario.partyId);
    const { pedido, calc, fila } = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM pedido WHERE id = ${pedidoId} FOR UPDATE`;
      const actual = await tx.pedido.findUnique({ where: { id: pedidoId } });
      if (!actual) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
      this.exigirEditable(actual);

      if (ctx.propuesta) {
        const vigente = await tx.pedidoCambioUbicacion.findUnique({ where: { id: ctx.propuesta.id }, select: { estado: true } });
        if (vigente?.estado !== 'PROPUESTA') {
          throw new ConflictException({ codigo: 'PROPUESTA_NO_VIGENTE', mensaje: 'La propuesta ya no está pendiente' });
        }
      }

      const pendiente = await tx.pedidoCambioUbicacion.findFirst({
        where: { pedido_id: pedidoId, ajuste_estado: 'PENDIENTE' },
        select: { id: true },
      });
      if (pendiente) {
        throw new ConflictException({
          codigo: 'AJUSTE_PENDIENTE',
          mensaje: 'Hay un saldo o una devolución sin resolver en este pedido: resuélvelo antes de cambiar la ubicación',
        });
      }

      const c = await this.calcular(tx, actual, punto.lat, punto.lng);
      const ahora = new Date();

      await tx.pedido.update({
        where: { id: pedidoId },
        data: {
          entrega_lat: new Prisma.Decimal(punto.lat),
          entrega_lng: new Prisma.Decimal(punto.lng),
          entrega_origen: 'MAPA',
          zona_id: c.zona.zonaId,
          envio: new Prisma.Decimal(c.envioNuevo),
          total: new Prisma.Decimal(c.totalNuevo),
          ubicacion_editada_en: ahora,
          ...(punto.direccion?.trim() ? { entrega_direccion: punto.direccion.trim() } : {}),
          ...(punto.referencia?.trim() ? { entrega_referencia: punto.referencia.trim() } : {}),
        },
      });
      // La promo de envío ya contó su uso al crear el pedido (envío 0): solo cuenta si ahora aplica sobre un envío que cobrábamos
      if (c.promo && c.envioAnterior > 0) {
        await tx.oferta.update({ where: { id: BigInt(c.promo.id) }, data: { usos_actuales: { increment: 1 } } });
      }
      // Pago sin cobrar con plan declarado: la diferencia se suma al renglón de efectivo (o al último) para que el plan cuadre
      if (!c.pagado && c.diferencia !== 0) {
        await this.ajustarPlanPago(tx, pedidoId, c.totalNuevo - c.totalAnterior);
      }

      const datos = {
        lat_nueva: punto.lat,
        lng_nueva: punto.lng,
        direccion_nueva: punto.direccion?.trim() || null,
        referencia_nueva: punto.referencia?.trim() || null,
        zona_nueva_id: c.zona.zonaId,
        envio_nuevo: c.envioNuevo,
        total_nuevo: c.totalNuevo,
        diferencia_envio: c.diferencia,
        ajuste_tipo: c.ajuste?.tipo ?? null,
        ajuste_monto: c.ajuste?.monto ?? null,
        ajuste_estado: c.ajuste ? 'PENDIENTE' : null,
        estado: 'APROBADA',
        resuelto_por_party_id: usuarioId,
        resuelto_en: ahora,
      };
      const historia = {
        lat_anterior: actual.entrega_lat != null ? Number(actual.entrega_lat) : null,
        lng_anterior: actual.entrega_lng != null ? Number(actual.entrega_lng) : null,
        direccion_anterior: actual.entrega_direccion,
        referencia_anterior: actual.entrega_referencia,
        zona_anterior_id: actual.zona_id,
        envio_anterior: c.envioAnterior,
        total_anterior: c.totalAnterior,
      };

      // Propuesta aprobada: la fila ya existe y se completa; cambio directo de Caja: se crea
      const fila = ctx.propuesta
        ? await tx.pedidoCambioUbicacion.update({ where: { id: ctx.propuesta.id }, data: { ...datos, ...historia } })
        : await tx.pedidoCambioUbicacion.create({
            data: {
              ...datos,
              ...historia,
              pedido_id: pedidoId,
              origen: ctx.origen,
              propuesto_por_party_id: usuarioId,
              propuesto_en: ahora,
            },
          });

      await this.auditoria.registrar(
        {
          categoria: 'CAMBIO',
          modulo: 'pedidos',
          accion: ctx.origen === 'CAJA' ? 'CAMBIAR_UBICACION' : 'APROBAR_PROPUESTA_UBICACION',
          resultado: 'OK',
          entidad: 'pedido',
          entidadId: pedidoId,
          antes: { lat: historia.lat_anterior, lng: historia.lng_anterior, envio: c.envioAnterior, total: c.totalAnterior },
          despues: { lat: punto.lat, lng: punto.lng, zona: c.zona.codigo, envio: c.envioNuevo, total: c.totalNuevo, ajuste: c.ajuste },
          partyId: usuarioId,
          ip: ctx.ip,
        },
        tx,
      );
      return { pedido: actual, calc: c, fila };
    });

    // Aviso al cliente solo si cambió el envío (ventana 24 h, sin plantilla). Fuera de la transacción: nunca la tumba.
    let avisoCliente: string | null = null;
    if (calc.diferencia !== 0) {
      avisoCliente = await this.avisarCliente(pedido.cliente_telefono, {
        codigo: pedido.codigo,
        envioAnterior: calc.envioAnterior,
        envioNuevo: calc.envioNuevo,
        diferencia: calc.diferencia,
      });
      await this.prisma.pedidoCambioUbicacion.update({ where: { id: fila.id }, data: { aviso_cliente: avisoCliente } });
    }

    this.eventosGateway?.emitirAdmin('pedido:estado', {
      id: Number(pedido.id),
      codigo: pedido.codigo,
      estado: pedido.estado,
    });

    return {
      id: String(pedido.id),
      cambioId: String(fila.id),
      codigo: pedido.codigo,
      ...this.salidaCalculo(calc),
      avisoCliente,
    };
  }

  /** Renglón de efectivo (o el último) del plan de pago absorbe la diferencia. Negativo = el plan no alcanza: 409. */
  private async ajustarPlanPago(tx: Cliente, pedidoId: bigint, diferenciaPesos: number) {
    const plan = await tx.pedidoPagoPlan.findMany({ where: { pedido_id: pedidoId }, orderBy: { orden: 'asc' } });
    if (plan.length === 0) return;
    const fila = plan.find((r) => r.medio === 'EFECTIVO') ?? plan[plan.length - 1];
    const nuevoC = aCentimos(fila.monto) + aCentimos(diferenciaPesos);
    if (nuevoC < 0) {
      throw new ConflictException({
        codigo: 'PLAN_PAGO_NO_ALCANZA',
        mensaje: 'El nuevo envío deja el plan de pago por debajo de cero: rehaz el plan de pago',
      });
    }
    await tx.pedidoPagoPlan.update({ where: { id: fila.id }, data: { monto: enPesos(nuevoC) } });
  }

  /** Aviso de cambio de envío: solo con WhatsApp, dentro de la ventana de 24 h y sin plantilla. Devuelve el estado. */
  async avisarCliente(
    telefono: string | null,
    datos: { codigo: string; envioAnterior: number; envioNuevo: number; diferencia: number },
  ): Promise<string> {
    if (!telefono) return 'SIN_WHATSAPP';
    try {
      if (!(await this.ventana.esVentanaAbierta(telefono))) return 'NO_ENVIADO_VENTANA';
      const r = await this.ventana.enviarMensajeNegocio(telefono, { textoLibre: textoAvisoEnvio(datos) });
      if (r.exito) return 'ENVIADO';
      return r.errorCodigo === 'CLIENTE_BAJA' ? 'NO_ENVIADO_BAJA' : 'FALLIDO';
    } catch {
      return 'FALLIDO';
    }
  }

  /** Historial de cambios de ubicación del pedido (más reciente primero), con nombres y cifras. */
  async historial(idRaw: string) {
    const id = this.parseId(idRaw);
    const pedido = await this.prisma.pedido.findUnique({ where: { id }, select: { id: true, ubicacion_editada_en: true } });
    if (!pedido) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    const filas = await this.prisma.pedidoCambioUbicacion.findMany({
      where: { pedido_id: id },
      orderBy: { id: 'desc' },
      include: { zonaAnterior: { select: { codigo: true } }, zonaNueva: { select: { codigo: true } } },
    });
    const nombres = await nombresDePartes(
      this.prisma,
      filas.flatMap((f) => [f.propuesto_por_party_id, f.resuelto_por_party_id, f.ajuste_por_party_id].filter((x): x is bigint => x != null)),
    );
    return {
      editada: pedido.ubicacion_editada_en != null,
      cambios: filas.map((f) => salidaCambio(f, nombres)),
    };
  }

  /**
   * Caja cobra el saldo (envío mayor) o marca la devolución hecha (envío menor), con su medio. En efectivo mueve la
   * caja de hoy (ingreso o egreso), así el cierre cuadra; en digital queda en el neto digital del cierre.
   */
  async liquidarAjuste(
    idRaw: string,
    cambioIdRaw: string,
    dto: LiquidarAjusteUbicacionDto,
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    const id = this.parseId(idRaw);
    if (!/^\d+$/.test(String(cambioIdRaw))) {
      throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'El cambio no es válido' });
    }
    const cambioId = BigInt(cambioIdRaw);
    if (!MEDIOS_COBRO.includes(dto.medio)) {
      throw new BadRequestException({ codigo: 'MEDIO_INVALIDO', mensaje: 'Medio de pago no válido' });
    }
    const codigoOperacion = (dto.codigoOperacion ?? '').trim();
    if (dto.medio !== 'EFECTIVO' && !codigoOperacion) {
      throw new BadRequestException({ codigo: 'CODIGO_OPERACION_REQUERIDO', mensaje: 'Escribe el código de operación' });
    }
    const usuarioId = BigInt(usuario.partyId);

    const salida = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM pedido WHERE id = ${id} FOR UPDATE`;
      const pedido = await tx.pedido.findUnique({ where: { id } });
      if (!pedido) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
      const fila = await tx.pedidoCambioUbicacion.findUnique({ where: { id: cambioId } });
      if (!fila || fila.pedido_id !== id) {
        throw new NotFoundException({ codigo: 'CAMBIO_NO_ENCONTRADO', mensaje: 'El cambio no existe en este pedido' });
      }
      if (fila.ajuste_estado !== 'PENDIENTE' || !fila.ajuste_tipo || fila.ajuste_monto == null) {
        throw new ConflictException({ codigo: 'AJUSTE_NO_PENDIENTE', mensaje: 'Este cambio no tiene saldo ni devolución pendiente' });
      }

      const esSaldo = fila.ajuste_tipo === 'SALDO';
      const nuevoEstado = esSaldo ? 'COBRADO' : 'DEVUELTO';
      let movimientoId: bigint | null = null;
      if (dto.medio === 'EFECTIVO') {
        // Mismo criterio que la devolución de pedidos: la caja de hoy tiene que estar abierta y se bloquea
        const { fechaIso } = obtenerFechaHoraLima();
        const caja = await tx.caja.findUnique({ where: { fecha: new Date(`${fechaIso}T00:00:00.000Z`) } });
        const bloqueada = caja ? await bloquearCaja(tx, caja.id) : null;
        if (!bloqueada || bloqueada.estado !== 'ABIERTA') {
          throw new ConflictException({ codigo: 'CAJA_CERRADA', mensaje: 'Abre la caja para mover efectivo' });
        }
        const monto = Number(fila.ajuste_monto);
        const mov = await tx.movimientoCaja.create({
          data: {
            caja_id: bloqueada.id,
            tipo: esSaldo ? 'INGRESO' : 'EGRESO',
            monto: new Prisma.Decimal(monto),
            motivo: `${esSaldo ? 'Cobro' : 'Devolución'} de envío por cambio de ubicación ${pedido.codigo}`,
          },
          select: { id: true },
        });
        movimientoId = mov.id;
      }

      // Condición de estado en el UPDATE: dos cobros a la vez no pueden resolver el mismo ajuste
      const cambiadas = await tx.pedidoCambioUbicacion.updateMany({
        where: { id: cambioId, ajuste_estado: 'PENDIENTE' },
        data: {
          ajuste_estado: nuevoEstado,
          ajuste_medio: dto.medio,
          ajuste_codigo_operacion: dto.medio === 'EFECTIVO' ? null : codigoOperacion,
          ajuste_por_party_id: usuarioId,
          ajuste_en: new Date(),
          ajuste_movimiento_caja_id: movimientoId,
        },
      });
      if (cambiadas.count !== 1) {
        throw new ConflictException({ codigo: 'AJUSTE_NO_PENDIENTE', mensaje: 'Este cambio ya se resolvió' });
      }

      await this.auditoria.registrar(
        {
          categoria: 'CAMBIO',
          modulo: 'pedidos',
          accion: esSaldo ? 'COBRAR_SALDO_UBICACION' : 'DEVOLVER_ENVIO_UBICACION',
          resultado: 'OK',
          entidad: 'pedido_cambio_ubicacion',
          entidadId: cambioId,
          despues: { pedido: pedido.codigo, monto: Number(fila.ajuste_monto), medio: dto.medio },
          partyId: usuarioId,
          ip,
        },
        tx,
      );
      return { id: String(cambioId), pedidoId: String(id), ajusteEstado: nuevoEstado, monto: Number(fila.ajuste_monto), medio: dto.medio };
    });

    return salida;
  }

}

/** Forma de salida de un cambio del historial: sin IDs internos, con nombres de quien lo propuso, aprobó o cobró. */
export function salidaCambio(
  f: {
    id: bigint;
    origen: string;
    estado: string;
    propuesto_por_party_id: bigint;
    propuesto_en: Date;
    resuelto_por_party_id: bigint | null;
    resuelto_en: Date | null;
    nota: string | null;
    motivo: string | null;
    lat_anterior: Prisma.Decimal | null;
    lng_anterior: Prisma.Decimal | null;
    direccion_anterior: string | null;
    referencia_anterior: string | null;
    zonaAnterior: { codigo: string } | null;
    lat_nueva: Prisma.Decimal;
    lng_nueva: Prisma.Decimal;
    direccion_nueva: string | null;
    referencia_nueva: string | null;
    zonaNueva: { codigo: string } | null;
    envio_anterior: Prisma.Decimal;
    envio_nuevo: Prisma.Decimal | null;
    total_anterior: Prisma.Decimal;
    total_nuevo: Prisma.Decimal | null;
    diferencia_envio: Prisma.Decimal | null;
    ajuste_tipo: string | null;
    ajuste_monto: Prisma.Decimal | null;
    ajuste_estado: string | null;
    ajuste_medio: string | null;
    ajuste_codigo_operacion: string | null;
    ajuste_por_party_id: bigint | null;
    ajuste_en: Date | null;
    aviso_cliente: string | null;
  },
  nombres: Map<string, string>,
) {
  const num = (v: Prisma.Decimal | null | undefined) => (v == null ? null : Number(v));
  return {
    id: String(f.id),
    origen: f.origen,
    estado: f.estado,
    propuestoPorNombre: nombres.get(String(f.propuesto_por_party_id)) ?? null,
    propuestoEn: f.propuesto_en,
    resueltoPorNombre: f.resuelto_por_party_id != null ? nombres.get(String(f.resuelto_por_party_id)) ?? null : null,
    resueltoEn: f.resuelto_en,
    nota: f.nota,
    motivo: f.motivo,
    anterior: { lat: num(f.lat_anterior), lng: num(f.lng_anterior), direccion: f.direccion_anterior, referencia: f.referencia_anterior, zona: f.zonaAnterior?.codigo ?? null },
    nueva: { lat: Number(f.lat_nueva), lng: Number(f.lng_nueva), direccion: f.direccion_nueva, referencia: f.referencia_nueva, zona: f.zonaNueva?.codigo ?? null },
    envioAnterior: num(f.envio_anterior),
    envioNuevo: num(f.envio_nuevo),
    totalAnterior: num(f.total_anterior),
    totalNuevo: num(f.total_nuevo),
    diferencia: num(f.diferencia_envio),
    ajuste:
      f.ajuste_tipo == null
        ? null
        : {
            tipo: f.ajuste_tipo,
            monto: num(f.ajuste_monto),
            estado: f.ajuste_estado,
            medio: f.ajuste_medio,
            codigoOperacion: f.ajuste_codigo_operacion,
            porNombre: f.ajuste_por_party_id != null ? nombres.get(String(f.ajuste_por_party_id)) ?? null : null,
            en: f.ajuste_en,
          },
    avisoCliente: f.aviso_cliente,
  };
}
