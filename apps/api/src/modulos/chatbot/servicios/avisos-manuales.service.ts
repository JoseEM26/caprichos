import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { montoACobrar } from '../../../comun/monto-a-cobrar';
import { mediosPagoPublicos } from '../../local/local.service';
import { montoDigitalDePlan } from '../../pedidos/pago-plan.service';
import { textoDatosPagoPersona } from './datos-pago-persona.util';
import type { CargaSaliente } from './outbox-whatsapp.service';

export interface AvisoManualPedido {
  id: string;
  etapa: string;
  /** Últimos 9 dígitos del celular (lo que entiende /admin/mensajes?telefono=). */
  telefono: string;
  /** Mensaje ya escrito, tal como lo habría mandado el sistema. */
  texto: string;
  /** Por qué no salió solo, legible. */
  motivo: string;
}

const MAX_POR_PEDIDO = 3;
const MAX_PEDIDOS = 200;

/**
 * Avisos del pedido que el sistema NO mandó solo (fuera de las 24 h, fuera de horario, Evolution desconectado...)
 * y que una persona puede enviar a mano desde Mensajes con el texto ya escrito. Un aviso deja de aparecer cuando
 * alguien del equipo escribió al cliente después de que quedó pendiente, o si el cliente pidió no recibir mensajes (BAJA).
 */
@Injectable()
export class AvisosManualesService {
  constructor(private readonly prisma: PrismaService) {}

  async pendientes(pedidoIds: Array<string | bigint>): Promise<Record<string, AvisoManualPedido[]>> {
    const ids = [...new Set(pedidoIds.map((i) => String(i)).filter((i) => /^\d+$/.test(i)))].slice(0, MAX_PEDIDOS).map((i) => BigInt(i));
    if (ids.length === 0) return {};
    const vivos = await this.prisma.pedido.findMany({ where: { id: { in: ids }, estado: { not: 'ANULADO' } }, select: { id: true } });
    if (vivos.length === 0) return {};
    const filas = await this.prisma.salienteWhatsapp.findMany({
      where: {
        pedido_id: { in: vivos.map((p) => p.id) },
        origen: 'AVISO_PEDIDO',
        OR: [{ estado: 'FALLIDO' }, { estado: 'DESCARTADO', descartado_por: 'Sistema' }],
      },
      orderBy: { id: 'desc' },
      select: { id: true, pedido_id: true, telefono_destino: true, carga: true, ultimo_error: true, motivo_descarte: true, creado_en: true },
    });
    const salida: Record<string, AvisoManualPedido[]> = {};
    const vistos = new Set<string>();
    for (const f of filas) {
      const carga = (f.carga ?? {}) as unknown as CargaSaliente;
      const etapa = String(carga.etapa ?? '');
      const clave = `${f.pedido_id}:${etapa}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      const texto = String(carga.textoLibre ?? '').trim();
      const digitos = f.telefono_destino.replace(/\D/g, '');
      if (!texto || f.telefono_destino.includes('@') || digitos.length < 9 || String(f.ultimo_error ?? '').includes('CLIENTE_BAJA')) continue;
      const lista = (salida[String(f.pedido_id)] ??= []);
      if (lista.length >= MAX_POR_PEDIDO) continue;
      // Ya lo resolvió una persona: escribió al cliente después de que el aviso quedó pendiente
      const escribio = await this.prisma.mensajeChat.count({
        where: { direccion: 'SALE', autor: 'PERSONA', en: { gt: f.creado_en }, conversacion: { telefono: f.telefono_destino } },
      });
      if (escribio > 0) continue;
      lista.push({
        id: String(f.id),
        etapa,
        telefono: digitos.slice(-9),
        texto,
        motivo: (f.motivo_descarte ?? f.ultimo_error ?? 'No se pudo enviar').replace(/^\[[A-Z_]+\]\s*/, ''),
      });
    }
    for (const k of Object.keys(salida)) if (salida[k].length === 0) delete salida[k];
    return salida;
  }

  /** Celular del pedido y mensaje ya escrito con los datos para pagar (Yape, Plin o transferencia). telefono null = el pedido no tiene celular. */
  async datosPago(pedidoId: string, medioPedido?: string): Promise<{ telefono: string | null; texto: string; medio: string } | null> {
    if (!/^\d+$/.test(pedidoId)) return null;
    const pedido = await this.prisma.pedido.findUnique({ where: { id: BigInt(pedidoId) } });
    if (!pedido) return null;
    const medio = String(medioPedido || pedido.pago_preferido || pedido.pago_metodo || '').toUpperCase();
    if (!['YAPE', 'PLIN', 'TRANSFERENCIA'].includes(medio)) return null;
    const parametros = await this.prisma.parametro.findMany({
      where: { clave: { in: ['local_pagos', 'voucher_titular_nombre', 'voucher_yape_numero', 'voucher_plin_numero'] } },
    });
    const plan = (await this.prisma.pedidoPagoPlan.findMany({ where: { pedido_id: pedido.id }, select: { medio: true, monto: true } })).map((f) => ({ medio: f.medio, monto: Number(f.monto) }));
    const delMedio = plan.filter((f) => f.medio.toUpperCase() === medio).reduce((a, f) => a + f.monto, 0);
    const monto = delMedio > 0 ? delMedio : plan.length > 0 ? montoDigitalDePlan(plan) || montoACobrar(pedido) : montoACobrar(pedido);
    const digitos = String(pedido.cliente_telefono ?? '').replace(/\D/g, '').slice(-9);
    const telefono = /^9\d{8}$/.test(digitos) && digitos !== '999999999' ? digitos : null;
    return {
      telefono,
      medio,
      texto: textoDatosPagoPersona({ nombre: pedido.cliente_nombre, codigo: pedido.codigo, medio, monto, pagos: mediosPagoPublicos(parametros) }),
    };
  }
}
