import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { ORIGEN_NO_COMPATIBLE } from '../utilidades/no-compatibles.util';
import { hashTelefono } from '../utilidades/enmascarar.util';
import { dentroDeHorario } from './anti-bloqueo.util';
import { EvolutionConfigService } from './evolution-config.service';

/** Orígenes del outbox que son respuesta a algo que el cliente acaba de escribir: siempre se permiten. */
export const ORIGENES_RESPUESTA = new Set(['VOUCHER', 'BOT_ERROR', 'TOPE_SIN_PAGAR', ORIGEN_NO_COMPATIBLE]);

export type DecisionEnvio =
  | { accion: 'ENVIAR' }
  | { accion: 'DESCARTAR'; codigo: string; motivo: string }
  | { accion: 'DIFERIR'; esperaMs: number; motivo: string };

const MIN = 60_000;

/**
 * Política de envío proactivo con Evolution (WhatsApp no oficial). El outbox la consulta antes de cada envío:
 * con Meta no hace nada; con Evolution bloquea lo que no sea aviso del pedido o encuesta, exige contacto previo,
 * respeta horario, desconexión/pausa y los topes por minuto, hora y día (lo que excede espera, no se pierde).
 */
@Injectable()
export class PoliticaEvolutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: EvolutionConfigService,
  ) {}

  async evaluar(fila: { telefono_destino: string; origen: string }, ahora = new Date()): Promise<DecisionEnvio> {
    const cfg = await this.config.obtener();
    if (cfg.whatsapp_proveedor !== 'EVOLUTION') return { accion: 'ENVIAR' };
    if (ORIGENES_RESPUESTA.has(fila.origen)) return { accion: 'ENVIAR' };

    const permitidos = String(cfg.evolution_origenes_permitidos).split(',').map((o) => o.trim()).filter(Boolean);
    if (!permitidos.includes(fila.origen)) {
      return {
        accion: 'DESCARTAR',
        codigo: 'PROACTIVO_BLOQUEADO',
        motivo: 'Bloqueado: con WhatsApp no oficial solo se envían avisos del pedido y la encuesta. Este mensaje no se manda por ese número.',
      };
    }

    if (String(cfg.evolution_exigir_contacto_previo).toLowerCase() === 'si') {
      const previo = await this.prisma.whatsappMensaje.count({ where: { telefono_hash: hashTelefono(fila.telefono_destino), direccion: 'ENTRANTE' } });
      if (previo === 0) {
        return {
          accion: 'DESCARTAR',
          codigo: 'SIN_CONTACTO_PREVIO',
          motivo: 'Bloqueado: este número nunca escribió al negocio y no se le escribe primero por WhatsApp no oficial.',
        };
      }
    }

    if ((await this.config.estaPausado()) || (await this.config.estadoConexion()).estado === 'DESCONECTADO') {
      return { accion: 'DIFERIR', esperaMs: 5 * MIN, motivo: 'El número de WhatsApp está desconectado o en pausa; se reintenta luego' };
    }
    if (!dentroDeHorario(ahora, cfg.evolution_horario_desde, cfg.evolution_horario_hasta)) {
      return { accion: 'DIFERIR', esperaMs: 15 * MIN, motivo: `Fuera de horario (${cfg.evolution_horario_desde}:00 a ${cfg.evolution_horario_hasta}:00 de Lima); sale al abrir el horario` };
    }

    const topes: Array<[number, number, number, string]> = [
      [cfg.evolution_limite_minuto, MIN, MIN, 'por minuto'],
      [cfg.evolution_limite_hora, 60 * MIN, 10 * MIN, 'por hora'],
      [cfg.evolution_limite_dia, 24 * 60 * MIN, 60 * MIN, 'por día'],
    ];
    for (const [tope, ventanaMs, esperaMs, nombre] of topes) {
      if (tope <= 0) continue; // 0 = sin tope
      const enviados = await this.prisma.salienteWhatsapp.count({
        where: { estado: 'ENVIADO', origen: { in: permitidos }, enviado_en: { gte: new Date(ahora.getTime() - ventanaMs) } },
      });
      if (enviados >= tope) return { accion: 'DIFERIR', esperaMs, motivo: `Tope de mensajes ${nombre} alcanzado (${tope}); se reintenta luego` };
    }
    return { accion: 'ENVIAR' };
  }
}
