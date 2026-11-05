import { PuntosService } from '../clientes/puntos.service';
import { ImpresionService } from '../impresion/impresion.service';
import { StockService } from '../stock/stock.service';
import { OfertasService } from '../ofertas/ofertas.service';
import { SalonService } from '../salon/salon.service';
import { ComprobantesService } from '../comprobantes/comprobantes.service';
import { esComprobanteElegible, validarDocumentoComprobante } from '../comprobantes/comprobantes.util';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import {
  exigirPinNoBloqueado,
  limpiarIntentosPin,
  registrarFalloPin,
} from '../../comun/redis/intentos-pin';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import {
  SupervisorCodigoService,
  autorizarAdminSinCodigo,
} from '../supervisor-codigo/supervisor-codigo.service';
import { obtenerFechaHoraLima } from '../local/local.util';
import { enmascararDni } from '../usuarios/usuarios.util';
import {
  MEDIOS_COBRO,
  aCentimos,
  bloquearCaja,
  exigirCajaAbiertaHoy,
  cobroVigente,
  enPesos,
  errorCajaAnteriorAbierta,
  esCentimosValidos,
} from './caja.calculo';
import { CobrarDto } from './dto/cobrar.dto';
import { AnularCobroDto } from './dto/anular-cobro.dto';
import { RechazarCobroMozoDto } from './dto/rechazar-cobro-mozo.dto';
import { MarcarCoordinadoDto } from './dto/marcar-coordinado.dto';
import { exigirComprobanteDigital } from './comprobante-pago.util';

/** Bloqueo de PIN de supervisor tras 3 fallos seguidos (FT-CAJ-02, RQ-CAJ-02-12). */

@Injectable()
export class CobrosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly eventosGateway?: EventosGateway,
    @Optional() private readonly salonService?: SalonService,
    @Optional() private readonly comprobantesService?: ComprobantesService,
    @Optional() private readonly puntosService?: PuntosService,
    @Optional() private readonly stockService?: StockService,
    @Optional() private readonly ofertasService?: OfertasService,
    @Optional() private readonly supervisorCodigoService?: SupervisorCodigoService,
    @Optional() private readonly impresionService?: ImpresionService,
  ) {}

  private parsearId(id: bigint | string | number): bigint {
    try {
      return BigInt(id);
    } catch {
      throw new BadRequestException({
        codigo: 'ID_INVALIDO',
        mensaje: 'El identificador no es válido',
      });
    }
  }

  private obtenerFechaHoyLima(): { fechaDate: Date; fechaIso: string } {
    const { fechaIso } = obtenerFechaHoraLima();
    const fechaDate = new Date(`${fechaIso}T00:00:00.000Z`);
    return { fechaDate, fechaIso };
  }

  /**
   * Verifica el código rotativo de 6 dígitos del supervisor (RFC 6238 TOTP).
   * 3 intentos fallidos consecutivos bloquean 1 minuto en Redis.
   */
  async verificarPinSupervisor(
    pinSupervisor?: string,
    partyIdOperador?: bigint | string,
    ip?: string,
    cobroId?: bigint,
    accion = 'caja/anular_cobro',
  ): Promise<{ party_id?: bigint; id?: bigint; supervisorPartyId?: bigint }> {
    if (this.supervisorCodigoService) {
      return this.supervisorCodigoService.verificarYConsumirCodigo(
        pinSupervisor,
        partyIdOperador,
        accion,
        ip,
        'cobro',
        cobroId,
      );
    }

    // Fallback de seguridad si no está inyectado directamente
    // Mismo criterio que el servicio: el ADMIN no da código.
    const admin = await autorizarAdminSinCodigo(this.prisma, this.auditoria, partyIdOperador, accion, ip, 'cobro', cobroId);
    if (admin) return { party_id: admin.party_id, id: admin.id, supervisorPartyId: admin.party_id };

    const claveIntentos = `pin:supervisor:intentos:${partyIdOperador ?? 'general'}`;
    const redis = this.redisService.obtenerCliente();
    await exigirPinNoBloqueado(redis, claveIntentos);
    await registrarFalloPin(redis, claveIntentos);
    throw new HttpException(
      {
        codigo: 'CODIGO_INVALIDO',
        mensaje: 'Código de supervisor inválido o no proporcionado',
      },
      HttpStatus.FORBIDDEN,
    );
  }

  /**
   * Realiza el cobro de un pedido.
   * Valida caja abierta, estado del pedido, cuadre de montos y cálculo de vuelto en efectivo.
   * Admite tanto (dto, usuario, ip) como (pedidoId, pagos, usuario).
   */
  async cobrar(
    dtoOrPedidoId: CobrarDto | bigint | string | number,
    usuarioOrPagos?: any,
    ipOrUsuario?: any,
    posibleIp?: string,
  ) {
    let dto: CobrarDto;
    let usuario: any;
    let ip: string | undefined;

    if (
      dtoOrPedidoId &&
      typeof dtoOrPedidoId === 'object' &&
      'pagos' in (dtoOrPedidoId as any)
    ) {
      dto = dtoOrPedidoId as CobrarDto;
      usuario = usuarioOrPagos;
      ip = ipOrUsuario;
    } else {
      dto = {
        pedidoId:
          typeof dtoOrPedidoId === 'bigint'
            ? dtoOrPedidoId.toString()
            : (dtoOrPedidoId as string | number),
        pagos: usuarioOrPagos,
      };
      usuario = ipOrUsuario;
      ip = posibleIp;
    }

    this.validarPagos(dto);

    const { fechaDate } = this.obtenerFechaHoyLima();
    const cajaHoy = await this.prisma.caja.findUnique({
      where: { fecha: fechaDate },
    });

    return this.registrarCobro(dto, usuario, ip, cajaHoy?.id ?? null, false);
  }

  /**
   * Cobra un pedido pendiente desde «Caja y cierres» (FT-CIE-02, cobro durante el cierre): el cobro
   * va a la caja que se está cerrando, sea del día que sea, y el pedido queda con la fecha real del cobro.
   */
  async cobrarEnCierre(cajaId: bigint, dto: CobrarDto, usuario: any, ip?: string) {
    this.validarPagos(dto);
    return this.registrarCobro(dto, usuario, ip, cajaId, true);
  }

  private validarPagos(dto: CobrarDto) {
    if (!dto.pagos || !Array.isArray(dto.pagos) || dto.pagos.length === 0) {
      throw new BadRequestException({
        codigo: 'PAGOS_REQUERIDOS',
        mensaje: 'Debe ingresar al menos un pago',
      });
    }

    for (const p of dto.pagos) {
      const medio = String(p.medio || '').toUpperCase();
      if (!MEDIOS_COBRO.includes(medio)) {
        throw new BadRequestException({
          codigo: 'MEDIO_INVALIDO',
          mensaje: `Medio de pago no admitido: ${p.medio}`,
        });
      }
      if (!esCentimosValidos(Number(p.monto)) || (p.recibido != null && !esCentimosValidos(Number(p.recibido)))) {
        throw new BadRequestException({
          codigo: 'MONTO_INVALIDO',
          mensaje: 'Los montos admiten como máximo dos decimales',
        });
      }
    }
  }

  /**
   * Nota de venta vigente que el mozo emitió al enviar el cobro a Caja: el envío marca cobro_mozo_en y
   * emite la nota (su ticket ya salió en la ticketera). Una anulada (rechazo del cobro) no cuenta.
   */
  private async notaDelMozoVigente(pedidoId: bigint): Promise<boolean> {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: {
        cobro_mozo_en: true,
        comprobante: { where: { tipo: 'NOTA_VENTA', anulado_en: null }, select: { id: true }, take: 1 },
      },
    });
    return !!pedido?.cobro_mozo_en && (pedido.comprobante?.length ?? 0) > 0;
  }

  /** Enlaza una foto ya subida al pedido que se cobra (prueba del cobro). Dentro de la transacción del cobro. */
  private async vincularVoucherAPedido(
    tx: Prisma.TransactionClient,
    voucherId: string | number,
    pedidoId: bigint,
  ) {
    const id = this.parsearId(voucherId);
    const voucher = await tx.voucherPago.findUnique({
      where: { id },
      select: { id: true, pedido_id: true, reemplazado_en: true },
    });

    if (!voucher) {
      throw new HttpException(
        { codigo: 'VOUCHER_NO_ENCONTRADO', mensaje: 'El voucher especificado no existe' },
        HttpStatus.NOT_FOUND,
      );
    }
    // Un voucher reemplazado ya no es el comprobante: el cobro usa solo los vigentes
    if (voucher.reemplazado_en != null) {
      throw new HttpException(
        { codigo: 'VOUCHER_REEMPLAZADO', mensaje: 'Ese voucher fue reemplazado por otro; usa el vigente' },
        HttpStatus.CONFLICT,
      );
    }
    if (voucher.pedido_id !== null && voucher.pedido_id !== pedidoId) {
      throw new HttpException(
        { codigo: 'VOUCHER_DE_OTRO_PEDIDO', mensaje: 'Ese voucher pertenece a otro pedido' },
        HttpStatus.CONFLICT,
      );
    }
    if (voucher.pedido_id === null) {
      await tx.voucherPago.update({ where: { id }, data: { pedido_id: pedidoId } });
    }
  }

  private async registrarCobro(
    dto: CobrarDto,
    usuario: any,
    ip: string | undefined,
    cajaId: bigint | null,
    enCierre: boolean,
  ) {
    // La caja se bloquea antes de leer el pedido: dos cobros no pasan a la vez y no se cobra en una caja que se cierra
    const { cobro, pedidoActualizado, pedidoCodigo, pagoMetodo, sinVoucherAutorizado } = await this.prisma.$transaction(async (tx) => {
      const caja = cajaId ? await bloquearCaja(tx, cajaId) : null;

      if (!caja) {
        throw (
          (await errorCajaAnteriorAbierta(tx)) ??
          new HttpException(
            {
              codigo: 'CAJA_CERRADA',
              mensaje: 'Abre la caja para cobrar',
            },
            HttpStatus.CONFLICT,
          )
        );
      }

      if (caja.estado !== 'ABIERTA') {
        throw new HttpException(
          {
            codigo: 'CAJA_CERRADA',
            mensaje: 'La caja de hoy ya está cerrada; no se puede cobrar',
          },
          HttpStatus.CONFLICT,
        );
      }

      // Obtener pedido
      const pedidoId = this.parsearId(dto.pedidoId);
      const pedido = await tx.pedido.findUnique({
        where: { id: pedidoId },
        include: { cobros: true, planPago: true },
      });

      if (!pedido) {
        throw new HttpException(
          {
            codigo: 'PEDIDO_NO_ENCONTRADO',
            mensaje: 'El pedido no existe',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      if (pedido.estado === 'ANULADO') {
        throw new HttpException(
          {
            codigo: 'PEDIDO_ANULADO',
            mensaje: 'No se puede cobrar un pedido anulado',
          },
          HttpStatus.CONFLICT,
        );
      }

      if (pedido.pago_estado === 'PAGADO' || cobroVigente(pedido.cobros)) {
        throw new HttpException(
          {
            codigo: 'YA_COBRADO',
            mensaje: 'El pedido ya fue cobrado',
          },
          HttpStatus.CONFLICT,
        );
      }

      // Boleta o factura obligatoria (pedidos históricos sin ella: hay que elegirla antes de cobrar)
      if (!esComprobanteElegible(pedido.comprobante_tipo)) {
        throw new HttpException(
          {
            codigo: 'COMPROBANTE_OBLIGATORIO',
            mensaje: 'Elige boleta o factura antes de cobrar. Usa «Cambiar comprobante».',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Boleta o factura sin documento válido (p. ej. boleta de más de S/ 700 sin DNI): no se cobra en silencio
      const docComprobante = validarDocumentoComprobante(
        pedido.comprobante_tipo,
        pedido.comprobante_doc,
        pedido.comprobante_razon,
        Number(pedido.total),
      );
      if (!docComprobante.valido) {
        throw new HttpException(
          {
            codigo: 'COMPROBANTE_DATOS_FALTANTES',
            mensaje: `${docComprobante.motivo}. Usa «Cambiar comprobante» para corregirlo antes de cobrar.`,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Los montos de los pagos deben sumar exactamente el total (en céntimos, sin floats)
      const totalPedido = aCentimos(pedido.total);
      const totalPagos = dto.pagos.reduce((acc, p) => acc + aCentimos(p.monto), 0);
      const diferencia = totalPagos - totalPedido;

      if (diferencia !== 0) {
        throw new HttpException(
          {
            codigo: 'PAGO_NO_CUADRA',
            mensaje: `La suma de los pagos (S/ ${enPesos(totalPagos).toFixed(2)}) no coincide con el total del pedido (S/ ${enPesos(totalPedido).toFixed(2)})`,
            diferencia: enPesos(diferencia),
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validar vuelto y efectivo
      for (const p of dto.pagos) {
        if (p.medio.toUpperCase() === 'EFECTIVO' && p.recibido !== undefined && p.recibido !== null) {
          if (aCentimos(p.recibido) < aCentimos(p.monto)) {
            throw new HttpException(
              {
                codigo: 'EFECTIVO_INSUFICIENTE',
                mensaje: 'El efectivo recibido es menor al monto a pagar',
              },
              HttpStatus.BAD_REQUEST,
            );
          }
        }
      }

      // Comprobante del pago digital (Yape, Plin, transferencia): hace falta una foto útil (no ILEGIBLE) enlazada
      // al pedido. Sin ella, cualquier rol que cobra (Caja, Admin o Mozo) puede seguir con motivo y código del
      // supervisor, que le dicta el supervisor presente; el código lo verifica el mismo helper y queda auditado.
      if (dto.voucherId !== undefined && dto.voucherId !== null && dto.voucherId !== '') {
        await this.vincularVoucherAPedido(tx, dto.voucherId, pedido.id);
      }

      const sinVoucherAutorizado = await exigirComprobanteDigital({
        db: tx,
        pedidoId: pedido.id,
        medios: dto.pagos.map((p) => p.medio),
        planPago: pedido.planPago,
        sinVoucher: dto.sinVoucher,
        permiteExcepcion: true,
        verificarPin: (pin) =>
          this.verificarPinSupervisor(pin, usuario?.partyId, ip, undefined, 'caja/cobrar_sin_voucher'),
      });

      // Determinar método de pago (el medio o MIXTO si hay más de uno)
      const distinctMedios = Array.from(new Set(dto.pagos.map((p) => p.medio.toUpperCase())));
      const pagoMetodo = distinctMedios.length > 1 ? 'MIXTO' : distinctMedios[0];

      // Un pedido puede tener varios cobros, pero solo uno vigente (lo garantiza el índice parcial).
      // El cobro anulado anterior se conserva con quién, cuándo y por qué (RNF-CAP-014).
      const nuevoCobro = await tx.cobro.create({
        data: {
          pedido_id: pedido.id,
          caja_id: caja.id,
          total: pedido.total,
          credito_personal: Boolean(pedido.es_personal),
          cobrado_por: BigInt(usuario.partyId),
          pagos: {
            create: dto.pagos.map((p) => {
              const esEfectivo = p.medio.toUpperCase() === 'EFECTIVO';
              const conRecibido = esEfectivo && p.recibido !== undefined && p.recibido !== null;
              return {
                medio: p.medio.toUpperCase(),
                monto: new Prisma.Decimal(enPesos(aCentimos(p.monto))),
                recibido: conRecibido ? new Prisma.Decimal(enPesos(aCentimos(p.recibido))) : null,
                vuelto: conRecibido
                  ? new Prisma.Decimal(enPesos(aCentimos(p.recibido) - aCentimos(p.monto)))
                  : null,
              };
            }),
          },
        },
        include: { pagos: true },
      });

      const pedAct = await tx.pedido.update({
        where: { id: pedido.id },
        data: {
          pago_estado: 'PAGADO',
          pago_metodo: pagoMetodo,
        },
      });

      // Nota de venta, boleta o factura en la MISMA transacción (outbox): si el cobro se deshace, no queda
      // comprobante ni número consumido. Si el proceso muere después del commit, la fila pendiente la envía el worker.
      await this.comprobantesService?.emitirParaPedido(pedido.id, tx, usuario, ip);

      return {
        cobro: nuevoCobro,
        pedidoActualizado: pedAct,
        pedidoCodigo: pedido.codigo,
        pagoMetodo,
        sinVoucherAutorizado,
      };
    });

    // Si el mozo ya emitió la nota de venta al enviar a Caja, su ticket salió ya en la ticketera: no se repite.
    // Se mira antes de emitir (el cobro podría emitir otra nota si el comprobante cambió).
    const ticketYaSalioConMozo = await this.notaDelMozoVigente(cobro.pedido_id).catch(() => false);

    // Boleta/factura electrónica: se FIRMA aquí (local, sin red) para que el ticket salga con hash y QR.
    // Si la firma falla, el cobro no se deshace: la fila queda PENDIENTE_ENVIO con aviso y el envío la reintenta.
    try {
      await this.comprobantesService?.firmarPorPedido(cobro.pedido_id, usuario, ip);
    } catch {
      // el servicio ya lo registra y avisa
    }

    // la mesa se libera al cobrar (RN-CAP-054); si falla no se deshace el cobro: se libera a mano
    try {
      await this.salonService?.liberarMesasDePedido(cobro.pedido_id);
    } catch {
      // idempotente: el mozo o caja pueden liberarla a mano con Sí/No
    }

    // lo que se enciende con el cobro; todo es idempotente y, si falla, no deshace el cobro
    // (los servicios guardan su propio registro para reintentar):
    //   puntos del cliente (5 %, DT-55), descuento de stock por receta (FT-STK-03) y cupones impresos (DT-56)
    for (const paso of [
      () => this.puntosService?.acumularPorPedido(cobro.pedido_id),
      () => this.stockService?.descontarPorPedido(cobro.pedido_id),
      () => this.ofertasService?.emitirCuponesParaPedido(cobro.pedido_id),
    ]) {
      try {
        await paso();
      } catch {
        // se puede reintentar al volver a consultar el pedido
      }
    }

    // ticket de pago para la ticketera: idempotente, nunca deshace el cobro
    if (!ticketYaSalioConMozo) {
      try {
        await this.impresionService?.encolarTicketPedido(cobro.pedido_id);
      } catch {
        // se puede reimprimir desde el pedido
      }
    }

    // La transmisión a SUNAT va en segundo plano: el cobro y el ticket no esperan a SUNAT (sin doble envío: lease).
    try {
      this.comprobantesService?.transmitirEnSegundoPlano(cobro.pedido_id);
    } catch {
      // nunca deshace ni retrasa el cobro: el worker de comprobantes lo envía
    }

    // 8. Auditar
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'caja',
      accion: sinVoucherAutorizado
        ? 'COBRAR_SIN_VOUCHER'
        : enCierre
          ? 'COBRAR_EN_CIERRE'
          : 'COBRAR',
      resultado: 'OK',
      entidad: 'cobro',
      entidadId: cobro.id,
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ...(sinVoucherAutorizado
        ? { conPinAdmin: true, motivo: sinVoucherAutorizado.motivo }
        : {}),
      despues: {
        cobro_id: cobro.id.toString(),
        pedido_id: cobro.pedido_id.toString(),
        total: Number(cobro.total),
        pago_estado: 'PAGADO',
        pago_metodo: pagoMetodo,
        cobrado_durante_cierre: enCierre,
        sin_voucher: sinVoucherAutorizado
          ? { motivo: sinVoucherAutorizado.motivo, aprobado_por: sinVoucherAutorizado.supervisorPartyId }
          : null,
        pagos: cobro.pagos.map((p) => ({
          medio: p.medio,
          monto: Number(p.monto),
          recibido: p.recibido !== null && p.recibido !== undefined ? Number(p.recibido) : null,
          vuelto: p.vuelto !== null && p.vuelto !== undefined ? Number(p.vuelto) : null,
        })),
      },
      ip,
    });

    // 9. Emitir evento en vivo para pantallas de administración
    try {
      this.eventosGateway?.emitirAdmin?.('pedido:pago', {
        id: cobro.pedido_id.toString(),
        codigo: pedidoCodigo,
        pago_estado: 'PAGADO',
        cambio: 'cobrado',
      });
    } catch {
      // Ignorar fallo de socket
    }

    return {
      id: cobro.id.toString(),
      pedido_id: cobro.pedido_id.toString(),
      caja_id: cobro.caja_id.toString(),
      total: Number(cobro.total),
      credito_personal: cobro.credito_personal,
      cobrado_por: cobro.cobrado_por.toString(),
      en: cobro.en,
      pago_metodo: pagoMetodo,
      pago_estado: pedidoActualizado.pago_estado,
      pagos: cobro.pagos.map((p) => ({
        id: p.id.toString(),
        medio: p.medio,
        monto: Number(p.monto),
        recibido: p.recibido !== null && p.recibido !== undefined ? Number(p.recibido) : null,
        vuelto: p.vuelto !== null && p.vuelto !== undefined ? Number(p.vuelto) : null,
      })),
    };
  }

  /**
   * Caja rechaza el cobro que envió el mozo (todavía sin cobro): quita la marca y anula con motivo la nota de
   * venta que se emitió al enviarlo. No cambia pago_estado: el pedido sigue por cobrar. El voucher no se borra.
   */
  async rechazarCobroMozo(
    id: bigint | string | number,
    dto: RechazarCobroMozoDto,
    usuario: any,
    ip?: string,
  ) {
    const motivo = dto?.motivo?.trim() || '';
    if (motivo.length < 5) {
      throw new BadRequestException({
        codigo: 'MOTIVO_REQUERIDO',
        mensaje: 'El motivo es obligatorio y debe tener al menos 5 caracteres',
      });
    }
    const pedidoId = this.parsearId(id);
    const ahora = new Date();

    const { previo, nota } = await this.prisma.$transaction(async (tx) => {
      const previo = await tx.pedido.findUnique({
        where: { id: pedidoId },
        select: { cobro_mozo_en: true, cobro_mozo_medio: true, cobro_mozo_recibido: true, pago_estado: true },
      });
      if (!previo) {
        throw new HttpException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'El pedido no existe' }, HttpStatus.NOT_FOUND);
      }
      if (!previo.cobro_mozo_en || previo.pago_estado === 'PAGADO') {
        throw new HttpException(
          { codigo: 'COBRO_MOZO_NO_VIGENTE', mensaje: 'El mozo no envió un cobro pendiente de este pedido' },
          HttpStatus.CONFLICT,
        );
      }

      const nota = await tx.comprobante.findFirst({
        where: { pedido_id: pedidoId, tipo: 'NOTA_VENTA', anulado_en: null },
      });
      if (nota) {
        await tx.comprobante.update({
          where: { id: nota.id },
          data: { anulado_en: ahora, anulado_motivo: motivo },
        });
      }

      await tx.pedido.update({
        where: { id: pedidoId },
        data: { cobro_mozo_en: null, cobro_mozo_medio: null, cobro_mozo_party_id: null, cobro_mozo_recibido: null },
      });
      return { previo, nota };
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'caja',
      accion: 'RECHAZAR_COBRO_MOZO',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedidoId,
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      motivo,
      antes: {
        cobro_mozo_en: previo.cobro_mozo_en?.toISOString() ?? null,
        cobro_mozo_medio: previo.cobro_mozo_medio,
        cobro_mozo_recibido: previo.cobro_mozo_recibido != null ? Number(previo.cobro_mozo_recibido) : null,
        nota_venta: nota?.numero_texto ?? null,
      },
      despues: { cobro_mozo_en: null, nota_anulada: nota ? nota.numero_texto : null, motivo },
      ip,
    });

    // Caja y Pedidos quitan la marca del mozo al recibir el aviso
    this.eventosGateway?.emitirAdmin?.('pedido:pago', {
      id: pedidoId.toString(),
      pago_estado: 'PENDIENTE',
      cambio: 'cobro_mozo_rechazado',
    });

    return {
      id: pedidoId.toString(),
      cobro_mozo: null,
      nota_anulada: nota?.numero_texto ?? null,
    };
  }

  /**
   * Anula un cobro con motivo y PIN de supervisor.
   * Exige que el cobro pertenezca a una caja abierta.
   * Regresa el pedido a pago_estado = 'PENDIENTE'.
   */
  async anularCobro(
    id: bigint | string | number,
    dto: AnularCobroDto,
    pinSupervisor: string | undefined,
    usuario: any,
    ip?: string,
    codigoVerificado = false,
  ) {
    const motivo = dto?.motivo?.trim() || '';
    if (motivo.length < 5) {
      throw new BadRequestException({
        codigo: 'MOTIVO_REQUERIDO',
        mensaje: 'El motivo de anulación es obligatorio y debe tener al menos 5 caracteres',
      });
    }

    const cobroId = this.parsearId(id);

    // 1. Validar código de supervisor (quien aprueba queda registrado)
    const supervisor = codigoVerificado
      ? { party_id: usuario?.partyId ? BigInt(usuario.partyId) : undefined }
      : await this.verificarPinSupervisor(pinSupervisor, usuario?.partyId, ip, cobroId);

    const cobroCaja = await this.prisma.cobro.findUnique({
      where: { id: cobroId },
      select: { caja_id: true },
    });

    if (!cobroCaja) {
      throw new HttpException(
        {
          codigo: 'COBRO_NO_ENCONTRADO',
          mensaje: 'El cobro no existe',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const ahora = new Date();

    // 2. Con la caja bloqueada: el cobro se revisa y se anula en una sola operación
    const cobro = await this.prisma.$transaction(async (tx) => {
      await bloquearCaja(tx, cobroCaja.caja_id);

      const actual = await tx.cobro.findUnique({
        where: { id: cobroId },
        include: { caja: true, pagos: true },
      });

      if (!actual) {
        throw new HttpException(
          {
            codigo: 'COBRO_NO_ENCONTRADO',
            mensaje: 'El cobro no existe',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      if (actual.anulado_en) {
        throw new HttpException(
          {
            codigo: 'COBRO_YA_ANULADO',
            mensaje: 'El cobro ya fue previamente anulado',
          },
          HttpStatus.CONFLICT,
        );
      }

      // RN-CAP-096: solo con el cobro en la caja abierta
      if (actual.caja.estado !== 'ABIERTA') {
        throw new HttpException(
          {
            codigo: 'CAJA_CERRADA',
            mensaje: 'Solo se puede anular un cobro perteneciente a una caja abierta',
          },
          HttpStatus.CONFLICT,
        );
      }

      const marcados = await tx.cobro.updateMany({
        where: { id: actual.id, anulado_en: null },
        data: {
          anulado_en: ahora,
          anulado_por: BigInt(usuario.partyId),
          motivo_anulacion: dto.motivo.trim(),
        },
      });

      if (marcados.count === 0) {
        throw new HttpException(
          {
            codigo: 'COBRO_YA_ANULADO',
            mensaje: 'El cobro ya fue previamente anulado',
          },
          HttpStatus.CONFLICT,
        );
      }

      await tx.pedido.update({
        where: { id: actual.pedido_id },
        data: {
          pago_estado: 'PENDIENTE',
        },
      });

      return actual;
    });

    // el cobro anulado devuelve el stock de insumos y reversa los puntos; los productos que controlan stock
    // siguen vendidos (el pedido sigue vivo y se descontaron al crearlo)
    for (const paso of [
      () => this.puntosService?.reversarPorPedido(cobro.pedido_id),
      () => this.stockService?.revertirPorPedido(cobro.pedido_id, undefined, usuario?.partyId, { soloInsumos: true }),
    ]) {
      try {
        await paso();
      } catch {
        // idempotente: se reintenta desde el historial
      }
    }

    // 3. Auditar: quién pidió, quién aprobó con su PIN, motivo y los pagos anulados
    //    (el cobro anulado se conserva como fila; si el pedido se vuelve a cobrar, el nuevo cobro es otra fila)
    const pagosAnulados = cobro.pagos.map((p) => ({
      medio: p.medio,
      monto: Number(p.monto),
      recibido: p.recibido !== null && p.recibido !== undefined ? Number(p.recibido) : null,
      vuelto: p.vuelto !== null && p.vuelto !== undefined ? Number(p.vuelto) : null,
    }));

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'caja',
      accion: 'ANULAR_COBRO',
      resultado: 'OK',
      entidad: 'cobro',
      entidadId: cobro.id,
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      conPinAdmin: true,
      motivo: dto.motivo.trim(),
      antes: {
        anulado_en: null,
        pago_estado: 'PAGADO',
        pagos: pagosAnulados,
      },
      despues: {
        anulado_en: ahora.toISOString(),
        anulado_por: usuario.partyId.toString(),
        aprobado_por: String(supervisor.party_id),
        motivo: dto.motivo.trim(),
        pago_estado: 'PENDIENTE',
      },
      ip,
    });

    // Avisa a Caja/Cocina/Repartos que el pedido volvió a quedar por cobrar (ya con el cobro anulado guardado)
    this.eventosGateway?.emitirAdmin?.('pedido:pago', { id: cobro.pedido_id.toString(), pago_estado: 'PENDIENTE', cambio: 'anulado' });

    return {
      id: cobro.id.toString(),
      pedido_id: cobro.pedido_id.toString(),
      anulado_en: ahora,
      anulado_por: usuario.partyId.toString(),
      motivo_anulacion: dto.motivo.trim(),
      pago_estado: 'PENDIENTE',
    };
  }

  /**
   * Cola de pedidos por coordinar (CARTA / BOT con pago PENDIENTE o COORDINADO).
   * Ordenados por los más viejos primero, con minutos de espera.
   * DNI/RUC enmascarado salvo para rol ADMIN.
   */
  async listarPorCobrar(usuario: any) {
    const pedidos = await this.prisma.pedido.findMany({
      where: {
        canal: { in: ['CARTA', 'BOT', 'CHATBOT'] },
        pago_estado: { in: ['PENDIENTE', 'COORDINADO'] },
        estado: { not: 'ANULADO' },
      },
      orderBy: { creado_en: 'asc' },
    });

    const esAdmin = usuario?.rol === 'ADMIN';
    const ahora = new Date();

    return pedidos.map((p) => {
      const creado = new Date(p.creado_en);
      const minutosEspera = Math.max(0, Math.floor((ahora.getTime() - creado.getTime()) / 60000));

      return {
        id: p.id.toString(),
        codigo: p.codigo,
        canal: p.canal,
        modalidad: p.modalidad,
        estado: p.estado,
        pago_estado: p.pago_estado,
        pago_preferido: p.pago_preferido,
        pago_metodo: p.pago_metodo,
        total: Number(p.total),
        cliente_nombre: p.cliente_nombre,
        cliente_telefono: p.cliente_telefono,
        comprobante_tipo: p.comprobante_tipo,
        comprobante_doc: esAdmin ? p.comprobante_doc : enmascararDni(p.comprobante_doc || ''),
        comprobante_razon: p.comprobante_razon,
        creado_en: p.creado_en,
        minutosEspera,
      };
    });
  }

  /**
   * Marca el pago del pedido como COORDINADO (pedidos de la carta, DT-57).
   */
  async marcarCoordinado(
    id: bigint | string | number,
    usuario: any,
    ip?: string,
    dto?: MarcarCoordinadoDto,
  ) {
    const pedidoId = this.parsearId(id);

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { planPago: true },
    });

    if (!pedido) {
      throw new HttpException(
        {
          codigo: 'PEDIDO_NO_ENCONTRADO',
          mensaje: 'El pedido no existe',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    if (pedido.estado === 'ANULADO') {
      throw new HttpException(
        {
          codigo: 'PEDIDO_ANULADO',
          mensaje: 'No se puede coordinar el pago de un pedido anulado',
        },
        HttpStatus.CONFLICT,
      );
    }

    if (pedido.pago_estado === 'PAGADO') {
      throw new HttpException(
        {
          codigo: 'YA_COBRADO',
          mensaje: 'El pedido ya fue pagado',
        },
        HttpStatus.CONFLICT,
      );
    }

    // Coordinar (aprobar) el pago digital exige caja abierta
    await exigirCajaAbiertaHoy(this.prisma);

    // Medio digital del pedido: exige voucher útil (no ILEGIBLE) o excepción con código del supervisor.
    const sinVoucherAutorizado = await exigirComprobanteDigital({
      db: this.prisma,
      pedidoId: pedido.id,
      medios: [pedido.pago_preferido || pedido.pago_metodo],
      planPago: pedido.planPago,
      sinVoucher: dto?.sinVoucher,
      permiteExcepcion: true,
      verificarPin: (pin) =>
        this.verificarPinSupervisor(pin, usuario?.partyId, ip, undefined, 'caja/coordinado_sin_voucher'),
    });

    const ahora = new Date();

    const actualizado = await this.prisma.pedido.update({
      where: { id: pedido.id },
      data: {
        pago_estado: 'COORDINADO',
        pago_coordinado_en: ahora,
        pago_coordinado_por: BigInt(usuario.partyId),
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'caja',
      accion: sinVoucherAutorizado ? 'MARCAR_COORDINADO_SIN_VOUCHER' : 'MARCAR_COORDINADO',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedido.id,
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ...(sinVoucherAutorizado ? { conPinAdmin: true, motivo: sinVoucherAutorizado.motivo } : {}),
      antes: {
        pago_estado: pedido.pago_estado,
      },
      despues: {
        pago_estado: 'COORDINADO',
        pago_coordinado_en: ahora.toISOString(),
        sin_voucher: sinVoucherAutorizado
          ? { motivo: sinVoucherAutorizado.motivo, aprobado_por: sinVoucherAutorizado.supervisorPartyId }
          : null,
      },
      ip,
    });

    this.eventosGateway?.emitirAdmin?.('pedido:pago', { id: actualizado.id.toString(), codigo: actualizado.codigo, pago_estado: 'COORDINADO', cambio: 'coordinado' });

    return {
      id: actualizado.id.toString(),
      codigo: actualizado.codigo,
      pago_estado: actualizado.pago_estado,
      pago_coordinado_en: actualizado.pago_coordinado_en,
      pago_coordinado_por: actualizado.pago_coordinado_por?.toString() ?? null,
    };
  }
}
