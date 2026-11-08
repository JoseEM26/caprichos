import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { puedeAnularPedidos } from '../acceso/roles-usuario';
import { obtenerFechaHoraLima } from '../cocina/cocina.util';

const ESTADOS_DESTINO = ['LISTO', 'EN_CAMINO'];

/**
 * «Volver atrás» de un pedido ENTREGADO por error: regresa al estado anterior según el historial (LISTO o EN_CAMINO).
 * Solo ADMIN y CAJERO (mismo criterio que anular; se reutiliza pedidos/anular), el mismo día de Lima y con la caja de ese día abierta.
 * NO revierte lo ya enviado al cliente (aviso de WhatsApp «entregado»): queda intacto y, al volver a entregar, no se repite
 * porque avisar() es idempotente por (pedido, etapa) con la fila de mensaje_reparto. Los puntos se acumulan al cobrar, no al entregar.
 */
@Injectable()
export class ReabrirPedidoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  async reabrir(idRaw: string, motivoRaw: string | undefined, usuario: UsuarioAutenticado, ip?: string) {
    if (!puedeAnularPedidos(usuario)) {
      throw new ForbiddenException({ codigo: 'SIN_PERMISO', mensaje: 'Solo Caja o Administrador pueden volver atrás un pedido' });
    }
    if (!/^\d+$/.test(String(idRaw))) {
      throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'El identificador del pedido no es válido' });
    }
    const motivo = (motivoRaw ?? '').trim();
    if (motivo.length < 5) {
      throw new BadRequestException({ codigo: 'MOTIVO_REQUERIDO', mensaje: 'Escribe el motivo (al menos 5 letras)' });
    }
    const id = BigInt(idRaw);
    const pedido = await this.prisma.pedido.findUnique({ where: { id } });
    if (!pedido) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    if (pedido.estado !== 'ENTREGADO') {
      throw new ConflictException({
        codigo: 'TRANSICION_INVALIDA',
        mensaje:
          pedido.estado === 'ANULADO' || pedido.estado === 'RECHAZADO'
            ? 'Un pedido anulado no se puede reabrir: crea uno nuevo'
            : `Solo se vuelve atrás un pedido entregado (está ${pedido.estado})`,
      });
    }

    const ultima = await this.prisma.pedidoEstadoHistorial.findFirst({
      where: { pedido_id: id, estado_nuevo: 'ENTREGADO' },
      orderBy: { en: 'desc' },
    });
    const entregadoEn: Date = pedido.entregado_en ?? ultima?.en ?? new Date();
    // Estado al que vuelve: el anterior del historial; sin dato, delivery despachado → EN_CAMINO y el resto → LISTO
    let destino = ultima?.estado_anterior && ESTADOS_DESTINO.includes(ultima.estado_anterior) ? ultima.estado_anterior : null;
    if (!destino) destino = pedido.modalidad === 'DELIVERY' && pedido.despachado_en ? 'EN_CAMINO' : 'LISTO';
    if (destino === 'EN_CAMINO' && pedido.modalidad !== 'DELIVERY') destino = 'LISTO';

    // Ventana: solo el mismo día de Lima en que se entregó
    if (obtenerFechaHoraLima(entregadoEn).fechaIso !== obtenerFechaHoraLima().fechaIso) {
      throw new ConflictException({ codigo: 'FUERA_DE_VENTANA', mensaje: 'Solo se vuelve atrás un pedido entregado hoy' });
    }
    // Caja de ese día cerrada, o cobro del pedido en una caja cerrada: ya entró al cierre
    const cajaDia = await this.prisma.caja.findUnique({ where: { fecha: new Date(`${obtenerFechaHoraLima(entregadoEn).fechaIso}T00:00:00.000Z`) } });
    const cobros = await this.prisma.cobro.findMany({ where: { pedido_id: id, anulado_en: null }, select: { caja: { select: { estado: true } } } });
    if ((cajaDia && cajaDia.estado !== 'ABIERTA') || cobros.some((c: any) => c.caja?.estado === 'CERRADA')) {
      throw new ConflictException({ codigo: 'CIERRE_CERRADO', mensaje: 'Ya cerró la caja del día' });
    }
    // Delivery ya liquidado por su repartidor: el efectivo contra entrega ya se rindió
    if (pedido.modalidad === 'DELIVERY' && pedido.repartidor_party_id != null) {
      const liq = await this.prisma.liquidacion.findFirst({
        where: { repartidor_party_id: pedido.repartidor_party_id, en: { gte: entregadoEn } },
        select: { id: true },
      });
      if (liq) {
        throw new ConflictException({ codigo: 'REPARTO_LIQUIDADO', mensaje: 'El repartidor ya liquidó este pedido: no se puede volver atrás' });
      }
    }

    const ahora = new Date();
    const actualizado = await this.prisma.$transaction(async (tx) => {
      // Condición en el UPDATE: dos clics a la vez no lo reabren dos veces
      const r = await tx.pedido.updateMany({
        where: { id, estado: 'ENTREGADO' },
        data: { estado: destino, entregado_en: null },
      });
      if (r.count === 0) throw new ConflictException({ codigo: 'TRANSICION_INVALIDA', mensaje: 'El pedido ya no está entregado' });
      await tx.pedidoEstadoHistorial.create({
        data: {
          pedido_id: id,
          estado_anterior: 'ENTREGADO',
          estado_nuevo: destino!,
          motivo: `Volvió atrás: ${motivo}`,
          por_party_id: usuario.partyId,
          en: ahora,
        },
      });
      // Si su ruta se cerró al entregar, vuelve a estar en curso (si el repartidor no abrió otra)
      if (destino === 'EN_CAMINO' && pedido.ruta_reparto_id && pedido.repartidor_party_id != null) {
        const otra = await tx.rutaReparto.findFirst({ where: { repartidor_party_id: pedido.repartidor_party_id, estado: 'EN_CURSO' }, select: { id: true } });
        if (!otra) {
          await tx.rutaReparto.updateMany({ where: { id: pedido.ruta_reparto_id, estado: 'TERMINADA' }, data: { estado: 'EN_CURSO', terminada_en: null } });
        }
      }
      return tx.pedido.findUnique({ where: { id } });
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'pedidos',
      accion: 'REABRIR_PEDIDO',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: id,
      antes: { estado: 'ENTREGADO' },
      despues: { estado: destino, motivo },
      motivo,
      partyId: usuario.partyId,
      ip,
    });
    this.eventos?.emitirAdmin('pedido:estado', { id: Number(id), codigo: pedido.codigo, estado: destino });
    return { ...actualizado, estado: destino, estadoAnterior: 'ENTREGADO' };
  }
}
