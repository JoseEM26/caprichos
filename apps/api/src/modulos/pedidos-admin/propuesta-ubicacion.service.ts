import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { nombresDePartes } from './devolucion-pedido.util';
import { CambioUbicacionService, OrigenCambio, salidaCambio } from './cambio-ubicacion.service';
import { ProponerUbicacionDto } from './dto/proponer-ubicacion.dto';
import { RechazarPropuestaUbicacionDto } from './dto/rechazar-propuesta-ubicacion.dto';

/** Pedidos en los que el repartidor puede proponer: asignados a él y en curso. */
const ESTADOS_EN_CURSO = ['LISTO', 'EN_CAMINO'];

/**
 * El repartidor propone el punto real del cliente (solo en SUS pedidos en curso). La propuesta no cambia el pedido:
 * Caja la aprueba (se aplica como un cambio de Caja) o la rechaza. Una sola pendiente por pedido.
 */
@Injectable()
export class PropuestaUbicacionService {
  private readonly logger = new Logger(PropuestaUbicacionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cambio: CambioUbicacionService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly eventosGateway?: EventosGateway,
  ) {}

  /** Pedido del repartidor autenticado y en curso; cualquier otro es 403 (aislamiento de repartos). */
  private async pedidoDelRepartidor(idRaw: string, usuario: UsuarioAutenticado) {
    const id = this.cambio.parseId(idRaw);
    const pedido = await this.prisma.pedido.findUnique({ where: { id } });
    if (!pedido) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    if (pedido.repartidor_party_id == null || BigInt(pedido.repartidor_party_id) !== BigInt(usuario.partyId)) {
      throw new ForbiddenException({ codigo: 'PEDIDO_AJENO', mensaje: 'Este pedido no está asignado a ti' });
    }
    if (pedido.modalidad !== 'DELIVERY' || !ESTADOS_EN_CURSO.includes(pedido.estado)) {
      throw new ConflictException({ codigo: 'ESTADO_INVALIDO', mensaje: 'Solo puedes proponer ubicación en un pedido en curso' });
    }
    return pedido;
  }

  async proponer(idRaw: string, dto: ProponerUbicacionDto, usuario: UsuarioAutenticado, ip?: string) {
    const pedido = await this.pedidoDelRepartidor(idRaw, usuario);
    const partyId = BigInt(usuario.partyId);
    const c = await this.cambio.calcular(this.prisma, pedido, dto.lat, dto.lng);
    const nota = dto.nota?.trim() || null;

    let fila;
    try {
      fila = await this.prisma.pedidoCambioUbicacion.create({
        data: {
          pedido_id: pedido.id,
          origen: 'REPARTIDOR',
          estado: 'PROPUESTA',
          propuesto_por_party_id: partyId,
          nota,
          lat_anterior: pedido.entrega_lat,
          lng_anterior: pedido.entrega_lng,
          direccion_anterior: pedido.entrega_direccion,
          referencia_anterior: pedido.entrega_referencia,
          zona_anterior_id: pedido.zona_id,
          lat_nueva: dto.lat,
          lng_nueva: dto.lng,
          zona_nueva_id: c.zona.zonaId,
          envio_anterior: c.envioAnterior,
          envio_nuevo: c.envioNuevo,
          total_anterior: c.totalAnterior,
          total_nuevo: c.totalNuevo,
          diferencia_envio: c.diferencia,
        },
        include: { zonaAnterior: { select: { codigo: true } }, zonaNueva: { select: { codigo: true } } },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({
          codigo: 'PROPUESTA_PENDIENTE',
          mensaje: 'Ya hay una propuesta pendiente para este pedido: espera a que Caja la revise o cancélala',
        });
      }
      throw e;
    }

    const nombre = (await nombresDePartes(this.prisma, [partyId])).get(String(partyId)) ?? 'el repartidor';
    await this.avisarCaja(pedido.codigo, nombre, fila.id);
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'repartos',
      accion: 'PROPONER_UBICACION',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedido.id,
      despues: { lat: dto.lat, lng: dto.lng, zona: c.zona.codigo, envio: c.envioNuevo, total: c.totalNuevo },
      partyId,
      ip,
    });
    return { ...salidaCambio(fila, new Map([[String(partyId), nombre]])), pedidoId: String(pedido.id), codigo: pedido.codigo };
  }

  /** Propuesta más reciente que hizo este repartidor para el pedido (cualquier estado), o null. */
  async vigente(idRaw: string, usuario: UsuarioAutenticado) {
    const id = this.cambio.parseId(idRaw);
    const partyId = BigInt(usuario.partyId);
    const fila = await this.prisma.pedidoCambioUbicacion.findFirst({
      where: { pedido_id: id, origen: 'REPARTIDOR', propuesto_por_party_id: partyId },
      orderBy: { id: 'desc' },
      include: { zonaAnterior: { select: { codigo: true } }, zonaNueva: { select: { codigo: true } } },
    });
    if (!fila) return null;
    const nombre = (await nombresDePartes(this.prisma, [partyId])).get(String(partyId)) ?? null;
    return salidaCambio(fila, new Map(nombre ? [[String(partyId), nombre]] : []));
  }

  /** El repartidor cancela su propuesta pendiente. */
  async cancelar(idRaw: string, usuario: UsuarioAutenticado, ip?: string) {
    const id = this.cambio.parseId(idRaw);
    const partyId = BigInt(usuario.partyId);
    const r = await this.prisma.pedidoCambioUbicacion.updateMany({
      where: { pedido_id: id, estado: 'PROPUESTA', propuesto_por_party_id: partyId },
      data: { estado: 'CANCELADA', resuelto_por_party_id: partyId, resuelto_en: new Date() },
    });
    if (r.count === 0) {
      throw new NotFoundException({ codigo: 'PROPUESTA_NO_ENCONTRADA', mensaje: 'No tienes una propuesta pendiente en este pedido' });
    }
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'repartos',
      accion: 'CANCELAR_PROPUESTA_UBICACION',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: id,
      partyId,
      ip,
    });
    return { cancelada: true };
  }

  /** Propuestas pendientes de todos los pedidos, para la bandeja de Caja. */
  async pendientes() {
    const filas = await this.prisma.pedidoCambioUbicacion.findMany({
      where: { estado: 'PROPUESTA' },
      orderBy: { propuesto_en: 'asc' },
      include: {
        pedido: { select: { id: true, codigo: true, cliente_nombre: true, cliente_telefono: true, entrega_direccion: true, entrega_lat: true, entrega_lng: true, envio: true, total: true, pago_estado: true, estado: true } },
        zonaAnterior: { select: { codigo: true } },
        zonaNueva: { select: { codigo: true } },
      },
    });
    const nombres = await nombresDePartes(this.prisma, filas.map((f) => f.propuesto_por_party_id).filter((x): x is bigint => x != null));
    return filas.map((f) => ({
      ...salidaCambio(f, nombres),
      pedidoId: String(f.pedido.id),
      codigo: f.pedido.codigo,
      cliente: f.pedido.cliente_nombre,
      pagoEstado: f.pedido.pago_estado,
      estadoPedido: f.pedido.estado,
      direccionActual: f.pedido.entrega_direccion,
      latActual: f.pedido.entrega_lat != null ? Number(f.pedido.entrega_lat) : null,
      lngActual: f.pedido.entrega_lng != null ? Number(f.pedido.entrega_lng) : null,
    }));
  }

  /** Caja aprueba: se aplica como un cambio suyo (recalcula zona, envío, total y ajuste) y la propuesta queda APROBADA. */
  async aprobar(idRaw: string, propuestaIdRaw: string, usuario: UsuarioAutenticado, ip?: string) {
    const pedidoId = this.cambio.parseId(idRaw);
    const propuesta = await this.propuestaPendiente(pedidoId, propuestaIdRaw);
    const salida = await this.cambio.aplicarCambio(
      pedidoId,
      { lat: Number(propuesta.lat_nueva), lng: Number(propuesta.lng_nueva) },
      {
        origen: propuesta.origen as OrigenCambio,
        usuario,
        propuesta: { id: propuesta.id, propuestoPor: propuesta.propuesto_por_party_id, nota: propuesta.nota },
        ip,
      },
    );
    this.eventosGateway?.emitirAdmin('ubicacion:propuesta', { pedidoId: String(pedidoId), propuestaId: String(propuesta.id), estado: 'APROBADA' });
    return salida;
  }

  /** Caja rechaza con motivo opcional. La ubicación original queda; el repartidor ve el resultado. */
  async rechazar(idRaw: string, propuestaIdRaw: string, dto: RechazarPropuestaUbicacionDto, usuario: UsuarioAutenticado, ip?: string) {
    const pedidoId = this.cambio.parseId(idRaw);
    const propuesta = await this.propuestaPendiente(pedidoId, propuestaIdRaw);
    const partyId = BigInt(usuario.partyId);
    const motivo = dto.motivo?.trim() || null;
    const r = await this.prisma.pedidoCambioUbicacion.updateMany({
      where: { id: propuesta.id, estado: 'PROPUESTA' },
      data: { estado: 'RECHAZADA', resuelto_por_party_id: partyId, resuelto_en: new Date(), motivo },
    });
    if (r.count !== 1) throw new ConflictException({ codigo: 'PROPUESTA_NO_VIGENTE', mensaje: 'La propuesta ya no está pendiente' });
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'pedidos',
      accion: 'RECHAZAR_PROPUESTA_UBICACION',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedidoId,
      motivo: motivo ?? undefined,
      partyId,
      ip,
    });
    this.eventosGateway?.emitirAdmin('ubicacion:propuesta', { pedidoId: String(pedidoId), propuestaId: String(propuesta.id), estado: 'RECHAZADA' });
    return { id: String(propuesta.id), estado: 'RECHAZADA', motivo };
  }

  private async propuestaPendiente(pedidoId: bigint, propuestaIdRaw: string) {
    if (!/^\d+$/.test(String(propuestaIdRaw))) {
      throw new NotFoundException({ codigo: 'PROPUESTA_NO_ENCONTRADA', mensaje: 'La propuesta no existe' });
    }
    const propuesta = await this.prisma.pedidoCambioUbicacion.findUnique({ where: { id: BigInt(propuestaIdRaw) } });
    if (!propuesta || propuesta.pedido_id !== pedidoId) {
      throw new NotFoundException({ codigo: 'PROPUESTA_NO_ENCONTRADA', mensaje: 'La propuesta no existe en este pedido' });
    }
    if (propuesta.estado !== 'PROPUESTA') {
      throw new ConflictException({ codigo: 'PROPUESTA_NO_VIGENTE', mensaje: 'La propuesta ya no está pendiente' });
    }
    return propuesta;
  }

  private async avisarCaja(codigo: string, nombre: string, propuestaId: bigint) {
    const titulo = `Cambio de ubicación propuesto por ${nombre}`;
    try {
      const notif = await this.prisma.notificacion.create({
        data: {
          tipo: 'UBICACION_PROPUESTA',
          rol_destino: 'CAJERO',
          titulo,
          mensaje: `Pedido ${codigo}: revisa el mapa y el envío antes de aprobar`,
          enlace: '/admin/caja',
        },
      });
      this.eventosGateway?.emitirAdmin('notificaciones:nueva', { id: notif.id.toString(), titulo });
    } catch (err) {
      this.logger.error(`Aviso de propuesta de ubicación no registrado: ${(err as Error).message}`);
    }
    this.eventosGateway?.emitirAdmin('ubicacion:propuesta', { codigo, propuestaId: String(propuestaId), estado: 'PROPUESTA' });
  }
}
