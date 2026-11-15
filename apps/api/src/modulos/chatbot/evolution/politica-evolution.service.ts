import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { ORIGEN_NO_COMPATIBLE } from '../utilidades/no-compatibles.util';
import { hashTelefono } from '../utilidades/enmascarar.util';
import { LocalService } from '../../local/local.service';
import { horarioDelLocal } from './horario-local';
import { EvolutionConfigService } from './evolution-config.service';

/** Orígenes del outbox que son respuesta a algo que el cliente acaba de escribir: siempre se permiten. */
export const ORIGENES_RESPUESTA = new Set(['VOUCHER', 'BOT_ERROR', 'TOPE_SIN_PAGAR', 'AUTORESPUESTA', ORIGEN_NO_COMPATIBLE]);

/** Los pidió el propio cliente (código, reserva, cuenta creada): no exigen que haya escrito antes por WhatsApp. */
export const ORIGENES_PEDIDOS_POR_EL_CLIENTE = new Set(['CODIGO_CUENTA', 'RESERVA', 'AVISO_CUENTA']);
/** Avisos al equipo (administradores): sus números no escriben antes al negocio; igual que con Meta, salen. */
export const ORIGENES_DEL_EQUIPO = new Set(['ALERTA_ADMIN', 'EQUIPO_NUEVO_PEDIDO', 'EQUIPO_ALERTA_ALMACEN']);
const HORAS_PEDIDO_RECIENTE = 24;

export type DecisionEnvio =
  | { accion: 'ENVIAR' }
  | { accion: 'DESCARTAR'; codigo: string; motivo: string }
  | { accion: 'DIFERIR'; esperaMs: number; motivo: string };

const MIN = 60_000;

/**
 * Política de envío con Evolution (WhatsApp no oficial). El outbox la consulta antes de cada envío:
 * con Meta no hace nada; con Evolution salen los mismos avisos que con Meta (rigen los mismos interruptores
 * whatsapp_aviso_*), exige contacto previo, solo envía dentro del horario de trabajo del local (lo de fuera de horario
 * se descarta, no se manda al día siguiente) y respeta desconexión/pausa y los topes por minuto, hora y día
 * (lo que excede un tope espera, no se pierde). Las respuestas a un mensaje del cliente siempre pasan.
 */
@Injectable()
export class PoliticaEvolutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: EvolutionConfigService,
    @Optional() private readonly local?: LocalService,
  ) {}

  async evaluar(fila: { telefono_destino: string; origen: string }, ahora = new Date()): Promise<DecisionEnvio> {
    const cfg = await this.config.obtener();
    if (cfg.whatsapp_proveedor !== 'EVOLUTION') return { accion: 'ENVIAR' };
    if (ORIGENES_RESPUESTA.has(fila.origen)) return { accion: 'ENVIAR' };

    const permitidos = String(cfg.evolution_origenes_permitidos).split(',').map((o) => o.trim()).filter(Boolean);
    // Vacío (lo normal) = los mismos avisos que con Meta; con valores, una lista blanca opcional del ADMIN
    if (permitidos.length > 0 && !permitidos.includes(fila.origen)) {
      return {
        accion: 'DESCARTAR',
        codigo: 'PROACTIVO_BLOQUEADO',
        motivo: 'Bloqueado: con WhatsApp no oficial solo se envían avisos del pedido y la encuesta. Este mensaje no se manda por ese número.',
      };
    }

    if (String(cfg.evolution_exigir_contacto_previo).toLowerCase() === 'si' && !ORIGENES_PEDIDOS_POR_EL_CLIENTE.has(fila.origen) && !ORIGENES_DEL_EQUIPO.has(fila.origen)) {
      const previo = await this.prisma.whatsappMensaje.count({ where: { telefono_hash: hashTelefono(fila.telefono_destino), direccion: 'ENTRANTE' } });
      // Un aviso del pedido también vale si ese celular hizo un pedido en las últimas 24 h (p. ej. por la carta web)
      const pidioHace = previo === 0 && fila.origen === 'AVISO_PEDIDO' ? await this.pidioRecientemente(fila.telefono_destino, ahora) : false;
      if (previo === 0 && !pidioHace) {
        return {
          accion: 'DESCARTAR',
          codigo: 'SIN_CONTACTO_PREVIO',
          motivo: 'Bloqueado: este número nunca escribió al negocio ni tiene un pedido reciente; no se le escribe primero por WhatsApp no oficial.',
        };
      }
    }

    if ((await this.config.estaPausado()) || (await this.config.estadoConexion()).estado === 'DESCONECTADO') {
      return { accion: 'DIFERIR', esperaMs: 5 * MIN, motivo: 'El número de WhatsApp está desconectado o en pausa; se reintenta luego' };
    }
    const horario = await horarioDelLocal(this.local, this.prisma, ahora, { desde: cfg.evolution_horario_desde, hasta: cfg.evolution_horario_hasta });
    if (!horario.abierto) {
      return {
        accion: 'DESCARTAR',
        codigo: 'FUERA_DE_HORARIO',
        motivo: 'Descartado: con WhatsApp no oficial no se escribe fuera del horario de trabajo del local, y este aviso no se manda al día siguiente.',
      };
    }

    const topes: Array<[number, number, number, string]> = [
      [cfg.evolution_limite_minuto, MIN, MIN, 'por minuto'],
      [cfg.evolution_limite_hora, 60 * MIN, 10 * MIN, 'por hora'],
      [cfg.evolution_limite_dia, 24 * 60 * MIN, 60 * MIN, 'por día'],
    ];
    for (const [tope, ventanaMs, esperaMs, nombre] of topes) {
      if (tope <= 0) continue; // 0 = sin tope
      const enviados = await this.prisma.salienteWhatsapp.count({
        where: { estado: 'ENVIADO', enviado_en: { gte: new Date(ahora.getTime() - ventanaMs) } },
      });
      if (enviados >= tope) return { accion: 'DIFERIR', esperaMs, motivo: `Tope de mensajes ${nombre} alcanzado (${tope}); se reintenta luego` };
    }
    return { accion: 'ENVIAR' };
  }

  private async pidioRecientemente(tel: string, ahora: Date): Promise<boolean> {
    const solo = tel.replace(/\D/g, '');
    const variantes = [solo, solo.replace(/^51/, ''), `+${solo}`];
    const n = await this.prisma.pedido.count({
      where: { cliente_telefono: { in: variantes }, creado_en: { gte: new Date(ahora.getTime() - HORAS_PEDIDO_RECIENTE * 3_600_000) } },
    });
    return n > 0;
  }
}
