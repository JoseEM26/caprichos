import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { nombreUnaMesa } from './mesas-pedido.util';

const CINCO_HORAS = 5 * 3600 * 1000; // Lima es UTC-5 todo el año (sin horario de verano)

/** Inicio del día de hoy en Lima, como instante UTC. */
export function inicioDiaLima(ahora = new Date()): Date {
  const lima = new Date(ahora.getTime() - CINCO_HORAS);
  lima.setUTCHours(0, 0, 0, 0);
  return new Date(lima.getTime() + CINCO_HORAS);
}

/**
 * Borradores de pedido de mesa: uno por mesa y por persona, en el servidor, vencen al cierre del día.
 * No ocupan la mesa, no van a cocina ni descuentan stock.
 */
@Injectable()
export class BorradorMesaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Los de días anteriores se borran al consultar (lo más simple; no hace falta cron). */
  private async limpiarVencidos() {
    await this.prisma.pedidoBorradorMesa.deleteMany({ where: { actualizado_en: { lt: inicioDiaLima() } } });
  }

  /** Cada persona ve y toca solo su borrador. */
  private partyDe(usuario: any): bigint {
    if (!usuario?.partyId) throw new BadRequestException('No se pudo identificar al usuario.');
    return BigInt(usuario.partyId);
  }

  private async nombreMozo(partyId: bigint): Promise<string> {
    const p = await this.prisma.person.findUnique({ where: { party_id: partyId } });
    return p ? `${p.nombres} ${p.apellidos || ''}`.trim() : 'Personal';
  }

  private async dto(b: any) {
    return {
      mesaId: b.mesa_id.toString(),
      mesaNombre: nombreUnaMesa({ id: b.mesa.id, numero: b.mesa.numero, nombre: b.mesa.nombre }),
      partyId: b.party_id.toString(),
      mozo: await this.nombreMozo(b.party_id),
      productos: b.productos,
      contenido: b.contenido,
      creadoEn: b.creado_en.toISOString(),
      actualizadoEn: b.actualizado_en.toISOString(),
    };
  }

  async listar(usuario: any) {
    await this.limpiarVencidos();
    const filas = await this.prisma.pedidoBorradorMesa.findMany({ where: { party_id: this.partyDe(usuario) }, include: { mesa: true }, orderBy: { actualizado_en: 'desc' } });
    return Promise.all(filas.map((b) => this.dto(b)));
  }

  /** Devuelve el borrador de la mesa o null. */
  async obtenerPorMesa(mesaId: string, usuario: any) {
    await this.limpiarVencidos();
    const b = await this.prisma.pedidoBorradorMesa.findUnique({ where: { mesa_id_party_id: { mesa_id: BigInt(mesaId), party_id: this.partyDe(usuario) } }, include: { mesa: true } });
    return b ? this.dto(b) : null;
  }

  /** Crea o reemplaza el borrador de la mesa (el cliente ya preguntó si había otro). */
  async guardar(mesaId: string, contenido: Record<string, unknown>, productos: number, usuario: any) {
    if (!usuario?.partyId) throw new BadRequestException('No se pudo identificar al usuario.');
    const mesa = await this.prisma.elementoPlano.findUnique({ where: { id: BigInt(mesaId) } });
    if (!mesa || !mesa.activo) throw new NotFoundException('La mesa no existe.');
    const partyId = BigInt(usuario.partyId);
    const ahora = new Date();
    const b = await this.prisma.pedidoBorradorMesa.upsert({
      where: { mesa_id_party_id: { mesa_id: mesa.id, party_id: partyId } },
      create: { mesa_id: mesa.id, party_id: partyId, contenido: contenido as any, productos },
      update: { party_id: partyId, contenido: contenido as any, productos, creado_en: ahora, actualizado_en: ahora },
      include: { mesa: true },
    });
    await this.auditoria.registrar({
      categoria: 'CAMBIO', modulo: 'mesas', accion: 'GUARDAR_BORRADOR_PEDIDO', resultado: 'OK',
      entidad: 'elemento_plano', entidadId: mesa.id, partyId,
      despues: { mesa: nombreUnaMesa(mesa), productos },
    });
    return this.dto(b);
  }

  async eliminar(mesaId: string, usuario: any) {
    const clave = { mesa_id_party_id: { mesa_id: BigInt(mesaId), party_id: this.partyDe(usuario) } };
    const b = await this.prisma.pedidoBorradorMesa.findUnique({ where: clave });
    if (!b) return { ok: true };
    await this.prisma.pedidoBorradorMesa.delete({ where: clave });
    await this.auditoria.registrar({
      categoria: 'CAMBIO', modulo: 'mesas', accion: 'ELIMINAR_BORRADOR_PEDIDO', resultado: 'OK',
      entidad: 'elemento_plano', entidadId: b.mesa_id,
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      antes: { productos: b.productos, creadoPor: b.party_id.toString() },
    });
    return { ok: true };
  }
}
