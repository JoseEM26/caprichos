import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { obtenerFechaHoraLima } from '../local/local.util';
import { ComprobantesService } from '../comprobantes/comprobantes.service';
import { aCentimos, enPesos, esCentimosValidos, registrarEgresoDevolucionCajaHoy } from '../caja/caja.calculo';
import { RegistrarDevolucionDto } from './dto/registrar-devolucion.dto';
import {
  BAJA_HECHA,
  FILTRO_CANCELADO_NO_RECIBIR,
  PAGOS_DEVOLVIBLES,
  nombresDePartes,
  salidaDevolucion,
  sugerirDevolucion,
} from './devolucion-pedido.util';

const MEDIOS_ORIGINALES = ['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA'];
const AVISO_CONTADOR = 'Consulta al contador por el comprobante';

/**
 * Devolución manual de un pedido cancelado por no recibir que ya estaba pagado. Una por pedido,
 * nunca automática: la registra quien aprueba (queda auditada a nombre de quien la registra).
 */
@Injectable()
export class DevolucionPedidoService {
  private readonly logger = new Logger(DevolucionPedidoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly comprobantes: ComprobantesService,
  ) {}

  /** Valida que el pedido sea devolvible: cancelado por no recibir, pagado y sin devolución previa. */
  private async pedidoDevolvible(idRaw: string) {
    if (!/^\d+$/.test(String(idRaw))) {
      throw new BadRequestException({ codigo: 'PEDIDO_INVALIDO', mensaje: 'El pedido no es válido' });
    }
    const id = BigInt(idRaw);
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      include: {
        devolucion: true,
        comprobante: {
          where: { anulado_en: null, tipo: { in: ['BOLETA', 'FACTURA'] } },
          orderBy: { id: 'desc' },
          take: 1,
        },
      },
    });
    if (!pedido) {
      throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'El pedido no existe' });
    }
    const cancelado = await this.prisma.pedido.count({ where: { id, ...FILTRO_CANCELADO_NO_RECIBIR } });
    if (!cancelado) {
      throw new ConflictException({
        codigo: 'PEDIDO_NO_DEVOLVIBLE',
        mensaje: 'Solo se devuelve un pedido cancelado porque el cliente no lo recibió',
      });
    }
    if (!PAGOS_DEVOLVIBLES.includes(String(pedido.pago_estado))) {
      throw new ConflictException({ codigo: 'PEDIDO_SIN_PAGO', mensaje: 'Este pedido no está pagado: no hay dinero que devolver' });
    }
    if (pedido.devolucion) {
      throw new ConflictException({ codigo: 'DEVOLUCION_YA_REGISTRADA', mensaje: 'Ya hay una devolución registrada para este pedido' });
    }
    return pedido;
  }

  /** Datos para prellenar el diálogo: lo pagado, el envío, el monto sugerido, el medio original y el comprobante. */
  async sugerencia(idRaw: string) {
    const p = await this.pedidoDevolvible(idRaw);
    const cifras = sugerirDevolucion(Number(p.total), Number(p.envio ?? 0));
    const c = p.comprobante[0];
    return {
      pedidoId: String(p.id),
      codigo: p.codigo,
      montoPagado: cifras.pagado,
      montoEnvio: cifras.envio,
      montoSugerido: cifras.sugerido,
      medioOriginal: MEDIOS_ORIGINALES.includes(String(p.pago_metodo)) ? p.pago_metodo : null,
      comprobante: c ? { tipo: c.tipo, numero: c.numero_texto, bajaEstado: c.baja_estado ?? null } : null,
    };
  }

  /**
   * Registra la devolución. Orden: validar; si es efectivo, exigir caja abierta hoy; dar de baja el
   * comprobante (fuera de la transacción, nunca la tumba); y en una transacción guardar la devolución
   * y, si es efectivo, el egreso de caja.
   */
  async registrar(
    idRaw: string,
    dto: RegistrarDevolucionDto,
    usuario: UsuarioAutenticado,
    autorizadoPorPartyId: bigint,
    ip?: string,
  ) {
    const p = await this.pedidoDevolvible(idRaw);
    const cifras = sugerirDevolucion(Number(p.total), Number(p.envio ?? 0));
    const pagadoC = aCentimos(cifras.pagado);
    const sugeridoC = aCentimos(cifras.sugerido);
    const devueltoC = aCentimos(dto.montoDevuelto);

    if (!esCentimosValidos(dto.montoDevuelto)) {
      throw new BadRequestException({ codigo: 'MONTO_INVALIDO', mensaje: 'El monto admite como máximo dos decimales' });
    }
    if (devueltoC > pagadoC) {
      throw new BadRequestException({
        codigo: 'MONTO_SUPERA_PAGADO',
        mensaje: `La devolución no puede pasar de lo pagado (S/ ${cifras.pagado.toFixed(2)})`,
      });
    }
    const codigo = (dto.codigoOperacion ?? '').trim();
    if (dto.medio !== 'EFECTIVO' && !codigo) {
      throw new BadRequestException({
        codigo: 'CODIGO_OPERACION_REQUERIDO',
        mensaje: 'Escribe el código de operación de la devolución',
      });
    }
    const motivo = (dto.motivo ?? '').trim();
    if (devueltoC !== sugeridoC && motivo.length < 10) {
      throw new BadRequestException({
        codigo: 'MOTIVO_REQUERIDO',
        mensaje: 'Explica por qué devuelves otro monto (mínimo 10 letras)',
      });
    }

    if (dto.medio === 'EFECTIVO') {
      // Pre-chequeo sin bloqueo: no damos de baja un comprobante si la caja no está abierta. La transacción lo revalida.
      await this.exigirCajaHoyAbierta();
    }

    const comprobante = p.comprobante[0];
    const bajaEstado = comprobante ? await this.darDeBaja(comprobante.id, p.codigo, usuario, ip) : null;
    const aviso = comprobante && !BAJA_HECHA.includes(bajaEstado ?? '') ? AVISO_CONTADOR : null;

    let fila;
    try {
      fila = await this.prisma.$transaction(async (tx) => {
        const egreso =
          dto.medio === 'EFECTIVO'
            ? await registrarEgresoDevolucionCajaHoy(tx, enPesos(devueltoC), `Devolución ${p.codigo}`)
            : null;
        return tx.devolucionPedido.create({
          data: {
            pedido_id: p.id,
            monto_pagado: enPesos(pagadoC),
            monto_envio: cifras.envio,
            monto_sugerido: enPesos(sugeridoC),
            monto_devuelto: enPesos(devueltoC),
            medio: dto.medio,
            codigo_operacion: dto.medio === 'EFECTIVO' ? null : codigo,
            motivo: motivo || null,
            por_party_id: BigInt(usuario.partyId),
            autorizado_por_party_id: autorizadoPorPartyId,
            comprobante_baja_estado: comprobante ? bajaEstado : null,
            movimiento_caja_id: egreso?.id ?? null,
          },
        });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ codigo: 'DEVOLUCION_YA_REGISTRADA', mensaje: 'Ya hay una devolución registrada para este pedido' });
      }
      throw e;
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'pedidos',
      accion: 'DEVOLUCION_PEDIDO',
      resultado: 'OK',
      entidad: 'devolucion_pedido',
      entidadId: fila.id,
      motivo: motivo || undefined,
      despues: {
        pedido: p.codigo,
        montoDevuelto: enPesos(devueltoC),
        montoSugerido: enPesos(sugeridoC),
        medio: dto.medio,
        comprobanteBajaEstado: fila.comprobante_baja_estado,
        autorizadoPor: String(autorizadoPorPartyId),
      },
      partyId: BigInt(usuario.partyId),
      ip,
    });

    const nombres = await nombresDePartes(this.prisma, [fila.por_party_id, fila.autorizado_por_party_id]);
    return { ...salidaDevolucion(fila, nombres), pedidoId: String(p.id), avisoComprobante: aviso };
  }

  private async exigirCajaHoyAbierta(): Promise<void> {
    const { fechaIso } = obtenerFechaHoraLima();
    const caja = await this.prisma.caja.findUnique({ where: { fecha: new Date(`${fechaIso}T00:00:00.000Z`) } });
    if (caja?.estado !== 'ABIERTA') {
      throw new ConflictException({ codigo: 'CAJA_CERRADA', mensaje: 'Abre la caja para devolver en efectivo' });
    }
  }

  /**
   * Comunicación de baja del comprobante vigente. Nunca lanza: si no se puede (plazo, SUNAT sin
   * respuesta, ya dado de baja) devuelve el estado que quedó guardado o NO_ANULADO.
   */
  private async darDeBaja(comprobanteId: bigint, codigoPedido: string, usuario: UsuarioAutenticado, ip?: string): Promise<string> {
    try {
      const r = await this.comprobantes.anularElectronico(
        comprobanteId,
        `Devolución del pedido ${codigoPedido}, no recibido por el cliente`,
        usuario,
        ip,
      );
      return r.baja_estado ?? 'NO_ANULADO';
    } catch (e) {
      this.logger.warn(`Baja del comprobante ${comprobanteId} no registrada: ${(e as Error).message}`);
      const fila = await this.prisma.comprobante.findUnique({ where: { id: comprobanteId }, select: { baja_estado: true } });
      return fila?.baja_estado ?? 'NO_ANULADO';
    }
  }
}
