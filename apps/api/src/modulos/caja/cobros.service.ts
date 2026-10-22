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
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { obtenerFechaHoraLima } from '../local/local.util';
import { enmascararDni } from '../usuarios/usuarios.util';
import { CobrarDto } from './dto/cobrar.dto';
import { AnularCobroDto } from './dto/anular-cobro.dto';

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
   * Verifica el PIN de 6 dígitos contra algún usuario ADMIN activo en la base de datos (DT-61).
   * 3 intentos fallidos consecutivos bloquean 10 minutos en Redis.
   */
  async verificarPinSupervisor(
    pinSupervisor?: string,
    partyIdOperador?: bigint | string,
    ip?: string,
    cobroId?: bigint,
  ): Promise<{ party_id: bigint; id: bigint }> {
    const claveIntentos = `pin:supervisor:intentos:${partyIdOperador ?? 'general'}`;
    const redis = this.redisService.obtenerCliente();

    // 1. Verificar si está bloqueado por demasiados intentos fallidos (DT-61)
    if (redis) {
      const intentosActuales = await redis.get(claveIntentos);
      if (intentosActuales && parseInt(intentosActuales, 10) >= 3) {
        throw new HttpException(
          {
            codigo: 'PIN_BLOQUEADO',
            mensaje: 'Demasiados intentos fallidos de PIN de supervisor. Bloqueado temporalmente por 10 minutos.',
          },
          HttpStatus.FORBIDDEN,
        );
      }
    }

    // 2. Validar formato del PIN (exactamente 6 dígitos numéricos)
    const pinLimpio = typeof pinSupervisor === 'string' ? pinSupervisor.trim() : '';
    const formatoValido = /^\d{6}$/.test(pinLimpio);

    let supervisorValido: { party_id: bigint; id: bigint } | null = null;

    if (formatoValido) {
      // 3. Buscar supervisores activos con rol ADMIN y PIN configurado
      const admins = await this.prisma.userAccount.findMany({
        where: {
          rol: 'ADMIN',
          activo: true,
          pin_hash: { not: null },
        },
      });

      for (const admin of admins) {
        if (admin.pin_hash) {
          try {
            const coincide = await argon2.verify(admin.pin_hash, pinLimpio);
            if (coincide) {
              supervisorValido = { party_id: admin.party_id, id: admin.id };
              break;
            }
          } catch {
            // Continuar evaluando otros administradores
          }
        }
      }
    }

    // 4. Si el PIN es incorrecto o no se proveyó
    if (!supervisorValido) {
      if (redis) {
        const fallos = await redis.incr(claveIntentos);
        if (fallos === 1) {
          await redis.expire(claveIntentos, 10 * 60); // 10 minutos
        }
      }

      await this.auditoria.registrar({
        categoria: 'ACCESO',
        modulo: 'caja',
        accion: 'PIN_FALLIDO',
        resultado: 'RECHAZADO',
        entidad: 'cobro',
        entidadId: cobroId,
        motivo: 'Intento de anulación de cobro con PIN de supervisor inválido o no proporcionado',
        partyId: partyIdOperador ? BigInt(partyIdOperador) : undefined,
        ip,
      });

      throw new HttpException(
        {
          codigo: 'PIN_INVALIDO',
          mensaje: 'PIN de supervisor inválido o no proporcionado',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // 5. PIN válido: reiniciar contador de fallos
    if (redis) {
      await redis.del(claveIntentos);
    }

    return supervisorValido;
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

    if (!dto.pagos || !Array.isArray(dto.pagos) || dto.pagos.length === 0) {
      throw new BadRequestException({
        codigo: 'PAGOS_REQUERIDOS',
        mensaje: 'Debe ingresar al menos un pago',
      });
    }

    // 1. Validar que exista una caja ABIERTA hoy
    const { fechaDate } = this.obtenerFechaHoyLima();
    const caja = await this.prisma.caja.findUnique({
      where: { fecha: fechaDate },
    });

    if (!caja || caja.estado !== 'ABIERTA') {
      throw new HttpException(
        {
          codigo: 'CAJA_CERRADA',
          mensaje: 'No hay una caja abierta para hoy; no se puede cobrar',
        },
        HttpStatus.CONFLICT,
      );
    }

    // 2. Obtener pedido
    const pedidoId = this.parsearId(dto.pedidoId);
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { cobro: true },
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

    // 3. Validar estado del pedido
    if (pedido.estado === 'ANULADO') {
      throw new HttpException(
        {
          codigo: 'PEDIDO_ANULADO',
          mensaje: 'No se puede cobrar un pedido anulado',
        },
        HttpStatus.CONFLICT,
      );
    }

    if (pedido.pago_estado === 'PAGADO' || (pedido.cobro && !pedido.cobro.anulado_en)) {
      throw new HttpException(
        {
          codigo: 'YA_COBRADO',
          mensaje: 'El pedido ya fue cobrado',
        },
        HttpStatus.CONFLICT,
      );
    }

    // 4. Validar que la suma de los pagos cuadre exactamente con el total del pedido
    const totalPedido = Number(pedido.total);
    const totalPagos = Number(
      dto.pagos.reduce((acc, p) => acc + Number(p.monto), 0).toFixed(2),
    );
    const diferencia = Number((totalPagos - totalPedido).toFixed(2));

    if (Math.abs(diferencia) > 0.001) {
      throw new HttpException(
        {
          codigo: 'PAGO_NO_CUADRA',
          mensaje: `La suma de los pagos (S/ ${totalPagos.toFixed(2)}) no coincide con el total del pedido (S/ ${totalPedido.toFixed(2)})`,
          diferencia,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 5. Validar vuelto y efectivo
    for (const p of dto.pagos) {
      if (p.medio.toUpperCase() === 'EFECTIVO' && p.recibido !== undefined && p.recibido !== null) {
        if (Number(p.recibido) < Number(p.monto)) {
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

    // 6. Determinar método de pago (el medio o MIXTO si hay más de uno)
    const distinctMedios = Array.from(new Set(dto.pagos.map((p) => p.medio.toUpperCase())));
    const pagoMetodo = distinctMedios.length > 1 ? 'MIXTO' : distinctMedios[0];

    // 7. Transacción en base de datos
    const { cobro, pedidoActualizado } = await this.prisma.$transaction(async (tx) => {
      // un pedido tiene un solo cobro: si el anterior fue anulado, se reemplaza por el nuevo.
      // La anulación (quién, cuándo, motivo y montos) queda en la auditoría encadenada.
      if (pedido.cobro && pedido.cobro.anulado_en) {
        await tx.cobroPago.deleteMany({ where: { cobro_id: pedido.cobro.id } });
        await tx.cobro.delete({ where: { id: pedido.cobro.id } });
      }
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
              const recibido =
                esEfectivo && p.recibido !== undefined && p.recibido !== null
                  ? new Prisma.Decimal(p.recibido)
                  : null;
              const vuelto =
                esEfectivo && p.recibido !== undefined && p.recibido !== null
                  ? new Prisma.Decimal(Number((Number(p.recibido) - Number(p.monto)).toFixed(2)))
                  : null;

              return {
                medio: p.medio.toUpperCase(),
                monto: new Prisma.Decimal(p.monto),
                recibido,
                vuelto,
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

      return { cobro: nuevoCobro, pedidoActualizado: pedAct };
    });

    // el cobro genera la nota de venta con su correlativo (RQ-LEG-01-01); es idempotente y también se
    // crea al consultarla, así que un fallo aquí no deshace el cobro
    try {
      await this.comprobantesService?.emitirParaPedido(pedido.id, undefined, usuario);
    } catch {
      // se genera al pedir el comprobante
    }

    // la mesa se libera al cobrar (RN-CAP-054); si falla no se deshace el cobro: se libera a mano
    try {
      await this.salonService?.liberarMesasDePedido(pedido.id);
    } catch {
      // idempotente: el mozo o caja pueden liberarla a mano con Sí/No
    }

    // lo que se enciende con el cobro; todo es idempotente y, si falla, no deshace el cobro
    // (los servicios guardan su propio registro para reintentar):
    //   puntos del cliente (5 %, DT-55), descuento de stock por receta (FT-STK-03) y cupones impresos (DT-56)
    for (const paso of [
      () => this.puntosService?.acumularPorPedido(pedido.id),
      () => this.stockService?.descontarPorPedido(pedido.id),
      () => this.ofertasService?.emitirCuponesParaPedido(pedido.id),
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
      accion: 'COBRAR',
      resultado: 'OK',
      entidad: 'cobro',
      entidadId: cobro.id,
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      antes: {
        pago_estado: pedido.pago_estado,
        pago_metodo: pedido.pago_metodo,
      },
      despues: {
        cobro_id: cobro.id.toString(),
        pedido_id: pedido.id.toString(),
        total: Number(cobro.total),
        pago_estado: 'PAGADO',
        pago_metodo: pagoMetodo,
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
        id: pedido.id.toString(),
        codigo: pedido.codigo,
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
  ) {
    const motivo = dto?.motivo?.trim() || '';
    if (motivo.length < 5) {
      throw new BadRequestException({
        codigo: 'MOTIVO_REQUERIDO',
        mensaje: 'El motivo de anulación es obligatorio y debe tener al menos 5 caracteres',
      });
    }

    const cobroId = this.parsearId(id);

    // 1. Validar PIN de supervisor
    await this.verificarPinSupervisor(pinSupervisor, usuario?.partyId, ip, cobroId);

    // 2. Buscar cobro
    const cobro = await this.prisma.cobro.findUnique({
      where: { id: cobroId },
      include: { caja: true, pedido: true },
    });

    if (!cobro) {
      throw new HttpException(
        {
          codigo: 'COBRO_NO_ENCONTRADO',
          mensaje: 'El cobro no existe',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    if (cobro.anulado_en) {
      throw new HttpException(
        {
          codigo: 'COBRO_YA_ANULADO',
          mensaje: 'El cobro ya fue previamente anulado',
        },
        HttpStatus.CONFLICT,
      );
    }

    // RN-CAP-096: solo con el cobro en la caja abierta
    if (cobro.caja.estado !== 'ABIERTA') {
      throw new HttpException(
        {
          codigo: 'CAJA_CERRADA',
          mensaje: 'Solo se puede anular un cobro perteneciente a una caja abierta',
        },
        HttpStatus.CONFLICT,
      );
    }

    const ahora = new Date();

    // 3. Transacción para marcar anulado y regresar pedido a PENDIENTE
    await this.prisma.$transaction(async (tx) => {
      await tx.cobro.update({
        where: { id: cobro.id },
        data: {
          anulado_en: ahora,
          anulado_por: BigInt(usuario.partyId),
          motivo_anulacion: dto.motivo.trim(),
        },
      });

      await tx.pedido.update({
        where: { id: cobro.pedido_id },
        data: {
          pago_estado: 'PENDIENTE',
        },
      });
    });

    // el cobro anulado devuelve el stock y reversa los puntos que había sumado
    for (const paso of [
      () => this.puntosService?.reversarPorPedido(cobro.pedido_id),
      () => this.stockService?.revertirPorPedido(cobro.pedido_id),
    ]) {
      try {
        await paso();
      } catch {
        // idempotente: se reintenta desde el historial
      }
    }

    // 4. Auditar
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
      },
      despues: {
        anulado_en: ahora.toISOString(),
        anulado_por: usuario.partyId.toString(),
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
