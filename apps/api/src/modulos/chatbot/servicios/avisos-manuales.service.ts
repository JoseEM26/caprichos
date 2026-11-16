import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
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
}
