import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { etiquetaMotivo } from '../cortesias/cortesia.tipos';
import { nombresDePersonas } from './linea-tiempo.service';
import {
  enmascarar, EventoHistorialCaja, OMITIR_ACCION, soles, tituloAccion, tituloCobro,
} from './historial-caja-pedido.util';

/** Tope de filas por fuente (un pedido real tiene decenas; esto evita respuestas enormes). */
const TOPE = 300;
/** Ya contadas desde estado y cobro: no se repiten desde auditoría. */
const YA_CUBIERTAS = /^(CAMBIAR_ESTADO|ANULAR|REGISTRAR_PAGO|REGISTRAR_PAGO_SIN_VOUCHER|COBRAR|ANULAR_COBRO)$/;

@Injectable()
export class HistorialCajaPedidoService {
  constructor(private readonly prisma: PrismaService) {}

  async obtener(id: string) {
    let pedidoId: bigint;
    try {
      pedidoId = BigInt(id);
    } catch {
      throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    }
    const pedido = await this.prisma.pedido.findUnique({ where: { id: pedidoId }, select: { id: true } });
    if (!pedido) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });

    const [historial, cobros, comprobantes, vouchers, cortesias] = await Promise.all([
      this.prisma.pedidoEstadoHistorial.findMany({ where: { pedido_id: pedidoId }, orderBy: { en: 'asc' }, take: TOPE }),
      this.prisma.cobro.findMany({ where: { pedido_id: pedidoId }, orderBy: { en: 'asc' }, take: TOPE, include: { pagos: { select: { medio: true, monto: true } } } }),
      this.prisma.comprobante.findMany({ where: { pedido_id: pedidoId }, select: { id: true }, take: TOPE }),
      this.prisma.voucherPago.findMany({ where: { pedido_id: pedidoId }, select: { id: true }, take: TOPE }),
      this.prisma.cortesia.findMany({
        where: { pedido_id: pedidoId }, orderBy: { creado_en: 'asc' }, take: TOPE,
        include: { producto: { select: { nombre: true } }, pedidoLinea: { select: { nombre: true } } },
      }),
    ]);
    // Índice ix_auditoria_entidad (entidad, entidad_id): una condición por entidad enlazada al pedido
    const auditoria = await this.prisma.auditoria.findMany({
      where: {
        categoria: 'CAMBIO',
        OR: [
          { entidad: 'pedido', entidad_id: pedidoId },
          { entidad: 'comprobante', entidad_id: { in: comprobantes.map((c) => c.id) } },
          { entidad: 'voucher_pago', entidad_id: { in: vouchers.map((v) => v.id) } },
        ],
      },
      orderBy: { en: 'asc' },
      take: TOPE,
    });

    const personas = await nombresDePersonas(this.prisma, [
      ...historial.map((h) => h.por_party_id).filter((x): x is bigint => x != null),
      ...cobros.flatMap((c) => [c.cobrado_por, c.anulado_por].filter((x): x is bigint => x != null)),
      ...cortesias.map((c) => c.dada_por_party_id),
      ...auditoria.map((a) => a.party_id).filter((x): x is bigint => x != null),
    ]);
    const nombre = (p: bigint | null | undefined) => (p == null ? null : personas.get(String(p)) ?? 'Persona sin nombre');

    const eventos: Array<EventoHistorialCaja & { _t: number }> = [];
    const add = (e: EventoHistorialCaja, en: Date) => eventos.push({ ...e, en: en.toISOString(), _t: en.getTime() });

    for (const h of historial) {
      add({
        id: `h${h.id}`, fuente: 'estado', titulo: h.estado_nuevo === 'ANULADO' ? 'Anuló el pedido' : tituloAccion('CAMBIAR_ESTADO', { estado: h.estado_nuevo }),
        motivo: h.motivo, en: '', por: nombre(h.por_party_id), antes: { estado: h.estado_anterior }, despues: { estado: h.estado_nuevo },
      }, h.en);
    }
    for (const c of cobros) {
      add({
        id: `c${c.id}`, fuente: 'cobro', titulo: tituloCobro(c.total, c.pagos), motivo: null, en: '', por: nombre(c.cobrado_por),
        antes: null, despues: { total: String(c.total), pagos: c.pagos.map((p) => ({ medio: p.medio, monto: String(p.monto) })) },
      }, c.en);
      if (c.anulado_en) {
        add({
          id: `ca${c.id}`, fuente: 'cobro', titulo: `Anuló el cobro de ${soles(c.total)}`, motivo: c.motivo_anulacion ?? null,
          en: '', por: nombre(c.anulado_por), antes: { cobro: String(c.total) }, despues: null,
        }, c.anulado_en);
      }
    }
    for (const c of cortesias) {
      const prod = c.pedidoLinea?.nombre ?? c.producto?.nombre ?? 'producto';
      add({
        id: `k${c.id}`, fuente: 'auditoria', titulo: `Aplicó cortesía: ${c.cantidad} × ${prod}`, motivo: [etiquetaMotivo(c.motivo), c.nota].filter(Boolean).join(' · ') || null,
        en: '', por: nombre(c.dada_por_party_id), antes: null, despues: null,
      }, c.creado_en);
    }
    for (const a of auditoria) {
      if (OMITIR_ACCION.test(a.accion) || (a.entidad === 'pedido' && YA_CUBIERTAS.test(a.accion))) continue;
      add({
        id: `a${a.id}`, fuente: 'auditoria', titulo: tituloAccion(a.accion, a.despues), motivo: a.motivo ?? null, en: '',
        por: nombre(a.party_id), antes: enmascarar(a.antes), despues: enmascarar(a.despues),
      }, a.en);
    }
    eventos.sort((x, y) => x._t - y._t);
    return { pedidoId: String(pedidoId), eventos: eventos.map(({ _t, ...e }) => e), truncado: [historial, cobros, auditoria].some((l) => l.length >= TOPE) };
  }
}
