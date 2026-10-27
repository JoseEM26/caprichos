import { PuntosService } from '../clientes/puntos.service';
import { StockService } from '../stock/stock.service';
import { OfertasService } from '../ofertas/ofertas.service';
import { SalonService } from '../salon/salon.service';
import { ComprobantesService } from '../comprobantes/comprobantes.service';
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
import { SupervisorCodigoService } from '../supervisor-codigo/supervisor-codigo.service';
import { obtenerFechaHoraLima } from '../local/local.util';
import { enmascararDni } from '../usuarios/usuarios.util';
import {
  MEDIOS_COBRO,
  aCentimos,
  bloquearCaja,
  cobroVigente,
  enPesos,
  errorCajaAnteriorAbierta,
  esCentimosValidos,
} from './caja.calculo';
import { CobrarDto } from './dto/cobrar.dto';
import { AnularCobroDto } from './dto/anular-cobro.dto';

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
   * 3 intentos fallidos consecutivos bloquean 5 minutos en Redis.
   */
  async verificarPinSupervisor(
    pinSupervisor?: string,
    partyIdOperador?: bigint | string,
    ip?: string,
    cobroId?: bigint,
  ): Promise<{ party_id?: bigint; id?: bigint }> {
    if (this.supervisorCodigoService) {
      return this.supervisorCodigoService.verificarYConsumirCodigo(
        pinSupervisor,
        partyIdOperador,
        'caja/anular_cobro',
        ip,
        'cobro',
        cobroId,
      );
    }

    // Fallback de seguridad si no está inyectado directamente
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

  private async registrarCobro(
    dto: CobrarDto,
    usuario: any,
    ip: string | undefined,
    cajaId: bigint | null,
    enCierre: boolean,
  ) {
    // La caja se bloquea antes de leer el pedido: dos cobros no pasan a la vez y no se cobra en una caja que se cierra
    const { cobro, pedidoActualizado, pedidoCodigo, pagoMetodo } = await this.prisma.$transaction(async (tx) => {
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
        include: { cobros: true },
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

      // Exigencia para el mozo en el cobro digital (vch-api)
      const esMozo = (usuario?.rol || '').toUpperCase() === 'MOZO';
      const tieneMedioDigital = dto.pagos.some((p) =>
        ['YAPE', 'PLIN'].includes(p.medio.toUpperCase()),
      );

      if (esMozo && tieneMedioDigital) {
        const paramMozoObligatorio = await tx.parametro.findUnique({
          where: { clave: 'voucher_mozo_obligatorio' },
        });
        const obligatorio =
          paramMozoObligatorio?.valor !== false &&
          String(paramMozoObligatorio?.valor).toLowerCase().trim() !== 'false';

        if (obligatorio) {
          const voucher = await tx.voucherPago.findFirst({
            where: { pedido_id: pedido.id },
            orderBy: { creado_en: 'desc' },
          });

          if (!voucher) {
            throw new HttpException(
              {
                codigo: 'VOUCHER_REQUERIDO',
                mensaje:
                  'Es obligatorio subir la foto del voucher para cobrar con Yape o Plin en mesa.',
              },
              HttpStatus.BAD_REQUEST,
            );
          }

          const extraido = (voucher.extraido as any) || {};
          if (voucher.semaforo === 'ILEGIBLE' || extraido.legible === false) {
            throw new HttpException(
              {
                codigo: 'VOUCHER_NO_LEGIBLE',
                mensaje: 'Este voucher no se lee bien. Vuelve a tomar la foto, por favor.',
              },
              HttpStatus.BAD_REQUEST,
            );
          }
        }
      }

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

      return { cobro: nuevoCobro, pedidoActualizado: pedAct, pedidoCodigo: pedido.codigo, pagoMetodo };
    });

    // el cobro genera la nota de venta con su correlativo (RQ-LEG-01-01); es idempotente y también se
    // crea al consultarla, así que un fallo aquí no deshace el cobro
    try {
      await this.comprobantesService?.emitirParaPedido(cobro.pedido_id, undefined, usuario);
    } catch {
      // se genera al pedir el comprobante
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

    // 8. Auditar
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'caja',
      accion: enCierre ? 'COBRAR_EN_CIERRE' : 'COBRAR',
      resultado: 'OK',
      entidad: 'cobro',
      entidadId: cobro.id,
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      despues: {
        cobro_id: cobro.id.toString(),
        pedido_id: cobro.pedido_id.toString(),
        total: Number(cobro.total),
        pago_estado: 'PAGADO',
        pago_metodo: pagoMetodo,
        cobrado_durante_cierre: enCierre,
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

    // el cobro anulado devuelve el stock y reversa los puntos que había sumado
    for (const paso of [
      () => this.puntosService?.reversarPorPedido(cobro.pedido_id),
      () => this.stockService?.revertirPorPedido(cobro.pedido_id, undefined, usuario?.partyId),
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
  async marcarCoordinado(id: bigint | string | number, usuario: any, ip?: string) {
    const pedidoId = this.parsearId(id);

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
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
      accion: 'MARCAR_COORDINADO',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedido.id,
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      antes: {
        pago_estado: pedido.pago_estado,
      },
      despues: {
        pago_estado: 'COORDINADO',
        pago_coordinado_en: ahora.toISOString(),
      },
      ip,
    });

    return {
      id: actualizado.id.toString(),
      codigo: actualizado.codigo,
      pago_estado: actualizado.pago_estado,
      pago_coordinado_en: actualizado.pago_coordinado_en,
      pago_coordinado_por: actualizado.pago_coordinado_por?.toString() ?? null,
    };
  }
}
