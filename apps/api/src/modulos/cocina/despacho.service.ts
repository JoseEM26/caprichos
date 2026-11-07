import { ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { DELIVERY_SIN_UBICACION_WHERE } from '../pedidos/delivery-ubicacion.util';
import { ComandasService, lineasDeArea } from './comandas.service';
import { obtenerInicioDiaLima } from './cocina.util';

const FUERA = ['ANULADO', 'RECHAZADO'];

/**
 * Pantalla «Despacho» de Cocina: pedidos vigentes del día COMPLETOS (todas las áreas juntas)
 * para que el despachador junte lo de cada área y entregue el pedido entero.
 * «Atendido» es una marca propia (no cambia el estado del pedido): pedido.atendido_despacho_en/_por.
 */
@Injectable()
export class DespachoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly comandas: ComandasService,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  async listar(incluirAtendidos = false) {
    await this.comandas.sincronizarPendientes();
    const ahora = new Date();
    const umbrales = await this.comandas.obtenerUmbrales();
    const pedidos = await this.prisma.pedido.findMany({
      where: {
        creado_en: { gte: obtenerInicioDiaLima(ahora) },
        estado: { notIn: FUERA },
        comandas: { some: {} },
        NOT: { ...DELIVERY_SIN_UBICACION_WHERE, OR: [...DELIVERY_SIN_UBICACION_WHERE.OR] },
        ...(incluirAtendidos ? {} : { atendido_despacho_en: null }),
      },
      include: {
        comandas: { include: { area: true } },
        lineas: {
          include: {
            area: true,
            producto: { include: { categoria: { include: { area: true } } } },
            opcionesElegidas: true,
            sabores: true,
          },
        },
      },
      orderBy: [{ creado_en: 'asc' }, { id: 'asc' }],
    });

    const partyIds = [...new Set(pedidos.map((p) => p.atendido_despacho_por).filter((x): x is bigint => x != null))];
    const personas = partyIds.length
      ? await this.prisma.person.findMany({
          where: { party_id: { in: partyIds } },
          select: { party_id: true, nombres: true, apellidos: true },
        })
      : [];
    const nombreDe = new Map(personas.map((x) => [x.party_id.toString(), [x.nombres, x.apellidos].filter(Boolean).join(' ')]));

    const lista = pedidos.map((p) => {
      const areas = p.comandas
        .map((c) => ({
          areaId: c.area_id.toString(),
          areaNombre: c.area?.nombre ?? '',
          listo: c.estado === 'DESPEJADA',
          lineas: lineasDeArea(p.lineas, c.area_id),
        }))
        .filter((a) => a.lineas.length > 0)
        .sort((x, y) => Number(BigInt(x.areaId) - BigInt(y.areaId)));
      const mesa = (p as any).mesa ?? (p.modalidad === 'MESA' ? ((p as any).mesa_numero ?? p.entrega_referencia ?? null) : null);
      const delivery = p.modalidad === 'DELIVERY';
      return {
        pedidoId: p.id.toString(),
        codigo: p.codigo,
        modalidad: p.modalidad,
        cliente: p.cliente_nombre ?? null,
        mesa,
        nota: p.nota ?? null,
        creado_en: p.creado_en,
        minutos: Math.max(0, Math.floor((ahora.getTime() - new Date(p.creado_en).getTime()) / 60000)),
        // Solo delivery: lo que el despachador necesita para entregar al repartidor
        direccion: delivery ? (p.entrega_direccion ?? null) : null,
        referencia: delivery ? (p.entrega_referencia ?? null) : null,
        telefono: delivery ? (p.cliente_telefono ?? null) : null,
        areas,
        // Completo = todas sus áreas listas
        completo: areas.length > 0 && areas.every((a) => a.listo),
        atendido: p.atendido_despacho_en !== null,
        atendido_en: p.atendido_despacho_en,
        atendido_por: p.atendido_despacho_por ? (nombreDe.get(p.atendido_despacho_por.toString()) ?? null) : null,
      };
    });
    return { ahoraServidor: ahora.toISOString(), umbrales, pedidos: lista.filter((p) => p.areas.length > 0) };
  }

  /**
   * Marca (o desmarca) el pedido como atendido. Idempotente: marcar dos veces conserva quién y cuándo
   * de la primera; desmarcar uno que no está marcado no hace nada. Audita solo cuando hay cambio.
   */
  async marcarAtendido(pedidoId: string, atendido: boolean, usuario: UsuarioAutenticado, ip?: string) {
    let id: bigint;
    try {
      id = BigInt(pedidoId);
    } catch {
      throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    }
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      select: { id: true, codigo: true, estado: true, atendido_despacho_en: true },
    });
    if (!pedido) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    if (FUERA.includes(pedido.estado)) {
      throw new ConflictException({ codigo: 'ESTADO_INVALIDO', mensaje: `El pedido está ${pedido.estado}` });
    }
    const yaMarcado = pedido.atendido_despacho_en !== null;
    if (yaMarcado === atendido) {
      return { ok: true, pedidoId: id.toString(), atendido, cambio: false, atendido_en: pedido.atendido_despacho_en };
    }
    const en = atendido ? new Date() : null;
    await this.prisma.pedido.update({
      where: { id },
      data: { atendido_despacho_en: en, atendido_despacho_por: atendido ? usuario.partyId : null },
    });
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'cocina',
      accion: atendido ? 'DESPACHO_ATENDIDO' : 'DESPACHO_REABIERTO',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: id,
      antes: { atendido: yaMarcado },
      despues: { atendido },
      partyId: usuario.partyId,
      ip,
    });
    this.eventos?.emitirAdmin('cocina:comanda', { pedidoId: Number(id), areaId: null, completo: atendido });
    return { ok: true, pedidoId: id.toString(), atendido, cambio: true, atendido_en: en };
  }
}
