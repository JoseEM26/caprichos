import { ForbiddenException, HttpException, HttpStatus, Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { UbicacionRepartidorDto } from './dto/ubicacion-repartidor.dto';

/** Pasados 15 min la posición se borra: no se guarda historial de recorrido (Ley 29733). */
export const VIGENCIA_MS = 15 * 60_000;
export const EN_VIVO_MS = 5 * 60_000;
export const MIN_ENTRE_ENVIOS_MS = 5_000;
const ROLES_VEN_TODOS = ['ADMIN', 'SUPERVISOR', 'CAJERO'];

/**
 * Última posición de cada repartidor en ruta. Solo la ve el personal (sala «admin» del socket y
 * GET /admin/repartos/ubicaciones); jamás entra al seguimiento público ni a la carta.
 */
@Injectable()
export class UbicacionRepartidorService {
  private readonly logger = new Logger(UbicacionRepartidorService.name);
  // ponytail: límite en memoria por proceso; con varias réplicas se mueve a Redis.
  private readonly ultimoEnvio = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventosGateway?: EventosGateway,
  ) {}

  async registrar(dto: UbicacionRepartidorDto, usuario: UsuarioAutenticado) {
    const clave = String(usuario.partyId);
    const ahora = Date.now();
    if (ahora - (this.ultimoEnvio.get(clave) ?? 0) < MIN_ENTRE_ENVIOS_MS) {
      throw new HttpException(
        { codigo: 'UBICACION_MUY_SEGUIDA', mensaje: 'Envía tu ubicación cada 5 segundos como máximo' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const pedidos = await this.prisma.pedido.findMany({
      where: { repartidor_party_id: usuario.partyId, estado: 'EN_CAMINO' },
      select: { codigo: true },
    });
    if (pedidos.length === 0) {
      throw new ForbiddenException({
        codigo: 'SIN_PEDIDOS_EN_CAMINO',
        mensaje: 'Solo se comparte la ubicación mientras tienes pedidos en camino',
      });
    }
    this.ultimoEnvio.set(clave, ahora);
    const datos = {
      lat: dto.lat,
      lng: dto.lng,
      precision: dto.precision,
      rumbo: dto.rumbo ?? null,
      velocidad: dto.velocidad ?? null,
      actualizado_en: new Date(ahora),
    };
    await this.prisma.ubicacionRepartidor.upsert({
      where: { repartidor_party_id: usuario.partyId },
      create: { repartidor_party_id: usuario.partyId, ...datos },
      update: datos,
    });
    this.limpiarVencidas().catch(() => undefined);
    const persona = await this.prisma.person.findUnique({ where: { party_id: usuario.partyId } });
    const nombre = persona ? `${persona.nombres} ${persona.apellidos ?? ''}`.trim() : `Repartidor #${clave}`;
    // Solo a la sala del personal: nunca a la pública ni a clientes
    this.eventosGateway?.emitirAdmin('reparto:ubicacion', {
      repartidorId: clave,
      nombre,
      lat: dto.lat,
      lng: dto.lng,
      precision: dto.precision,
      en: datos.actualizado_en.toISOString(),
      pedidos: pedidos.map((p) => p.codigo),
    });
    return { ok: true };
  }

  async listar(usuario: UsuarioAutenticado) {
    const roles = usuario.roles?.length ? usuario.roles : [usuario.rol];
    const veTodos = roles.some((r) => ROLES_VEN_TODOS.includes(r));
    const esRepartidor = roles.some((r) => r === 'REPARTIDOR' || r === 'APOYO_DELIVERY');
    if (!veTodos && !esRepartidor) {
      this.logger.warn(`Acceso denegado a ubicaciones de repartidores: party ${usuario.partyId} rol ${usuario.rol}`);
      throw new ForbiddenException({ codigo: 'SIN_PERMISO', mensaje: 'No puedes ver la ubicación de los repartidores' });
    }
    await this.limpiarVencidas();
    const filas = await this.prisma.ubicacionRepartidor.findMany({
      where: {
        actualizado_en: { gte: new Date(Date.now() - VIGENCIA_MS) },
        ...(veTodos ? {} : { repartidor_party_id: usuario.partyId }),
      },
    });
    if (filas.length === 0) return [];
    const ids = filas.map((f) => f.repartidor_party_id);
    const [personas, telefonos, pedidos] = await Promise.all([
      this.prisma.person.findMany({ where: { party_id: { in: ids } } }),
      this.prisma.contactMechanism.findMany({
        where: { party_id: { in: ids }, tipo: { in: ['TELEFONO', 'WHATSAPP'] }, activo: true },
        orderBy: { principal: 'desc' },
      }),
      this.prisma.pedido.findMany({
        where: { repartidor_party_id: { in: ids }, estado: 'EN_CAMINO' },
        select: { repartidor_party_id: true, codigo: true, llego_en: true, entrega_lat: true, entrega_lng: true, entrega_direccion: true },
        orderBy: { id: 'asc' },
      }),
    ]);
    return filas.map((f) => {
      const p = personas.find((x) => x.party_id === f.repartidor_party_id);
      const edadMs = Date.now() - f.actualizado_en.getTime();
      return {
        repartidorId: String(f.repartidor_party_id),
        nombre: p ? `${p.nombres} ${p.apellidos ?? ''}`.trim() : `Repartidor #${f.repartidor_party_id}`,
        telefono: telefonos.find((t) => t.party_id === f.repartidor_party_id)?.valor ?? null,
        lat: f.lat,
        lng: f.lng,
        precision: f.precision,
        rumbo: f.rumbo,
        velocidad: f.velocidad,
        en: f.actualizado_en.toISOString(),
        estado: edadMs <= EN_VIVO_MS ? 'EN_VIVO' : 'HACE_MINUTOS',
        pedidos: pedidos
          .filter((x) => x.repartidor_party_id === f.repartidor_party_id)
          .map((x) => ({
            codigo: x.codigo,
            etapa: x.llego_en ? 'LLEGADO' : 'EN_CAMINO',
            direccion: x.entrega_direccion,
            lat: x.entrega_lat == null ? null : Number(x.entrega_lat),
            lng: x.entrega_lng == null ? null : Number(x.entrega_lng),
          })),
      };
    });
  }

  private async limpiarVencidas() {
    await this.prisma.ubicacionRepartidor.deleteMany({
      where: { actualizado_en: { lt: new Date(Date.now() - VIGENCIA_MS) } },
    });
  }
}
