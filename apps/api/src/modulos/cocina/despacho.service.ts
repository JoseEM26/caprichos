import { ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { DELIVERY_SIN_UBICACION_WHERE } from '../pedidos/delivery-ubicacion.util';
import { ComandasService, lineasDeArea } from './comandas.service';
import { estadoAreasDePedido } from './areas-pedido';
import { obtenerInicioDiaLima } from './cocina.util';
import { resaltadoDeLineas } from './opcion-menos-pedida';
import { resumenPagoDespacho } from './resumen-pago-despacho';
import { mesaDePedido } from './mesa-comanda.util';

const FUERA = ['ANULADO', 'RECHAZADO'];
/** Pedidos que esperan a Despacho: cocina ya los tiene en curso y aún no pasan a LISTO. */
const EN_DESPACHO = ['COLA', 'PREPARANDO'];

/**
 * Pantalla «Despacho» de Cocina: el LISTO final. Lista los pedidos del día que esperan a Despacho
 * (estado COLA/PREPARANDO, cada área con su semáforo); `despachados=true` suma los que ya pasaron a LISTO
 * o salieron. «Despachado» = el pedido ya no está en COLA/PREPARANDO (lo confirma comandasService.despacharCompleto).
 * La marca vieja «atendido» (atendido_despacho_*) sigue en el API por compatibilidad y ya no la usa la pantalla.
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
        estado: incluirAtendidos ? { notIn: FUERA } : { in: EN_DESPACHO },
        comandas: { some: {} },
        NOT: { ...DELIVERY_SIN_UBICACION_WHERE, OR: [...DELIVERY_SIN_UBICACION_WHERE.OR] },
      },
      include: {
        comandas: { include: { area: true } },
        pedidoOrigen: { select: { codigo: true } },
        planPago: true,
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

    const resaltado = await resaltadoDeLineas(this.prisma, pedidos.flatMap((p) => p.lineas));
    const lista = pedidos.map((p) => {
      const estado = estadoAreasDePedido(p.comandas, p.lineas);
      const areas = estado.areas.map(({ nLineas: _n, ...a }) => ({
        ...a,
        lineas: lineasDeArea(p.lineas, BigInt(a.areaId), resaltado),
      }));
      const mesa = mesaDePedido(p);
      const delivery = p.modalidad === 'DELIVERY';
      return {
        pedidoId: p.id.toString(),
        codigo: p.codigo,
        modalidad: p.modalidad,
        cliente: p.cliente_nombre ?? null,
        mesa,
        enEsperaMesa: Boolean((p as any).espera_mesa_desde),
        // Pedido extra: id (raíz) y código del original; la pantalla junta original y extras en una tarjeta
        pedidoOrigenId: p.pedido_origen_id != null ? p.pedido_origen_id.toString() : null,
        extraDe: (p as any).pedidoOrigen?.codigo ?? null,
        nota: p.nota ?? null,
        creado_en: p.creado_en,
        minutos: Math.max(0, Math.floor((ahora.getTime() - new Date(p.creado_en).getTime()) / 60000)),
        // Solo delivery: lo que el despachador necesita para entregar al repartidor
        direccion: delivery ? (p.entrega_direccion ?? null) : null,
        referencia: delivery ? (p.entrega_referencia ?? null) : null,
        telefono: delivery ? (p.cliente_telefono ?? null) : null,
        canal: p.canal,
        esPersonal: Boolean((p as any).es_personal),
        pago: resumenPagoDespacho(p),
        areas,
        // Completo = todas sus áreas listas
        completo: estado.completo,
        estado: p.estado,
        despachado: !EN_DESPACHO.includes(p.estado),
        despachado_en: EN_DESPACHO.includes(p.estado) ? null : (p.listo_en ?? null),
        // compat con la pantalla anterior: «atendido» = ya despachado
        atendido: !EN_DESPACHO.includes(p.estado),
        atendido_en: EN_DESPACHO.includes(p.estado) ? null : (p.listo_en ?? null),
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
