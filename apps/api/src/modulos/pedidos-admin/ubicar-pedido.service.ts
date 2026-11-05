import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { ZonasService } from '../zonas/zonas.service';
import { calcularEnvioDelivery } from '../ofertas/envio-gratis-promo';
import { UbicarPedidoDto } from './dto/ubicar-pedido.dto';

const ESTADOS_CERRADOS = ['ENTREGADO', 'ANULADO'];

/**
 * Ubicar un delivery que llegó sin punto (RN-CAP-104, RQ-CAJ-01-09): se fija el punto,
 * se detecta la zona y se recalculan envío y total.
 */
@Injectable()
export class UbicarPedidoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zonas: ZonasService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly eventosGateway?: EventosGateway,
  ) {}

  /** El pedido canjeó un cupón de envío gratis (de campaña o emitido). */
  private async pedidoTieneCuponEnvio(pedido: { cupon_id: bigint | null; cupon_emitido_id: bigint | null }): Promise<boolean> {
    if (pedido.cupon_emitido_id) {
      const emitido = await this.prisma.cuponEmitido.findUnique({ where: { id: pedido.cupon_emitido_id }, include: { cupon: true } });
      return emitido?.cupon.descuento_tipo === 'ENVIO_GRATIS';
    }
    if (pedido.cupon_id) {
      const cupon = await this.prisma.cupon.findUnique({ where: { id: pedido.cupon_id } });
      return cupon?.descuento_tipo === 'ENVIO_GRATIS';
    }
    return false;
  }

  async ubicar(id: string, dto: UbicarPedidoDto, usuario: UsuarioAutenticado, ip?: string) {
    let pedidoId: bigint;
    try {
      pedidoId = BigInt(id);
    } catch {
      throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'El identificador del pedido no es válido' });
    }

    const pedido = await this.prisma.pedido.findUnique({ where: { id: pedidoId } });
    if (!pedido) {
      throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    }
    if (pedido.modalidad !== 'DELIVERY') {
      throw new ConflictException({ codigo: 'NO_ES_DELIVERY', mensaje: 'Solo se ubican pedidos de delivery' });
    }
    if (ESTADOS_CERRADOS.includes(pedido.estado)) {
      throw new ConflictException({
        codigo: 'PEDIDO_CERRADO',
        mensaje: `No se puede ubicar un pedido en estado ${pedido.estado}`,
      });
    }

    const zona = await this.zonas.detectar(dto.lat, dto.lng);
    if (!zona) {
      throw new ConflictException({
        codigo: 'FUERA_DE_COBERTURA',
        mensaje: 'La ubicación indicada está fuera de la zona de cobertura',
      });
    }

    // Con la hora de creación del pedido (no la de ahora): la promo ENVIO_GRATIS rige como si se hubiera pedido entonces
    const subtotal = Number(pedido.subtotal);
    const envioGratisCupon = await this.pedidoTieneCuponEnvio(pedido);
    const { envio, promo } = await calcularEnvioDelivery(this.prisma, {
      subtotal,
      tarifaZona: Number(zona.tarifa),
      canal: pedido.canal,
      ahora: pedido.creado_en,
      envioGratisCupon,
    });
    const total = Number((subtotal - Number(pedido.descuento) + envio).toFixed(2));

    // Con el pago ya cobrado el total no puede moverse: hay que anular y rehacer
    if (pedido.pago_estado === 'PAGADO' && total !== Number(pedido.total)) {
      throw new ConflictException({
        codigo: 'PEDIDO_PAGADO',
        mensaje: 'El pedido ya está pagado y el envío de esa zona cambiaría el total',
      });
    }

    const actualizado = await this.prisma.$transaction(async (tx) => {
      const pedidoActualizado = await tx.pedido.update({
        where: { id: pedido.id },
        data: {
          entrega_lat: new Prisma.Decimal(dto.lat),
          entrega_lng: new Prisma.Decimal(dto.lng),
          entrega_origen: 'MAPA',
          zona_id: zona.zonaId,
          envio: new Prisma.Decimal(envio),
          total: new Prisma.Decimal(total),
          ...(dto.direccion?.trim() ? { entrega_direccion: dto.direccion.trim() } : {}),
          ...(dto.referencia?.trim() ? { entrega_referencia: dto.referencia.trim() } : {}),
        },
      });
      if (promo) {
        await tx.oferta.update({ where: { id: BigInt(promo.id) }, data: { usos_actuales: { increment: 1 } } });
      }
      return pedidoActualizado;
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'pedidos',
      accion: 'UBICAR_PEDIDO',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedido.id,
      antes: {
        lat: pedido.entrega_lat != null ? Number(pedido.entrega_lat) : null,
        lng: pedido.entrega_lng != null ? Number(pedido.entrega_lng) : null,
        envio: pedido.envio != null ? Number(pedido.envio) : null,
        total: Number(pedido.total),
      },
      despues: { lat: dto.lat, lng: dto.lng, zona: zona.codigo, envio, total },
      partyId: usuario.partyId,
      ip,
    });

    this.eventosGateway?.emitirAdmin('pedido:estado', {
      id: Number(pedido.id),
      codigo: pedido.codigo,
      estado: pedido.estado,
    });

    return {
      id: String(actualizado.id),
      codigo: actualizado.codigo,
      zona: zona.codigo,
      envio,
      total,
      lat: dto.lat,
      lng: dto.lng,
    };
  }
}
