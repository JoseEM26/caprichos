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
const HORAS_VENTANA_AVISO = 24;
/** Código con el que un aviso del pedido queda DESCARTADO por estar fuera de las 24 h: la persona lo envía desde el pedido. */
export const FUERA_DE_VENTANA_AVISO = 'FUERA_DE_VENTANA_24H';
export const MOTIVO_FUERA_DE_VENTANA = 'Fuera de las 24 h: el cliente no nos escribió en las últimas 24 h, así que no se envía solo (para cuidar el número). Envíalo tú desde el pedido con «Enviar confirmación por WhatsApp».';

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
 * (lo que excede un tope espera, no se pierde). Las respuestas a un mensaje del cliente siempre pasan, y el código de cuenta sale también fuera de horario.
 */
@Injectable()
export class PoliticaEvolutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: EvolutionConfigService,
    @Optional() private readonly local?: LocalService,
  ) {}

  /**
   * Excepción única al horario: el aviso «recibido» de un pedido PROGRAMADO que el cliente hizo desde la carta o el bot con el
   * local cerrado. Es la confirmación de lo que acaba de pedir; el resto de avisos fuera de horario se descarta como siempre.
   */
  private async esRecibidoDeProgramado(fila: { origen: string; pedido_id?: bigint | null; carga?: unknown }): Promise<boolean> {
    if (fila.origen !== 'AVISO_PEDIDO' || fila.pedido_id == null || (fila.carga as any)?.etapa !== 'RECIBIDO') return false;
    const p = await this.prisma.pedido.findUnique({ where: { id: fila.pedido_id }, select: { estado: true, canal: true } }).catch(() => null);
    return p?.estado === 'PROGRAMADO' && ['CARTA', 'WHATSAPP', 'BOT'].includes(String(p.canal));
  }

  async evaluar(fila: { telefono_destino: string; origen: string; pedido_id?: bigint | null; carga?: unknown }, ahora = new Date()): Promise<DecisionEnvio> {
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
      const hash = hashTelefono(fila.telefono_destino);
      if (fila.origen === 'AVISO_PEDIDO') {
        // Avisos del pedido (recibido, aceptado, listo, salió...): solo solos si el cliente escribió en las últimas 24 h
        const desde = new Date(ahora.getTime() - HORAS_VENTANA_AVISO * 3_600_000);
        const reciente = await this.prisma.whatsappMensaje.count({ where: { telefono_hash: hash, direccion: 'ENTRANTE', creado_en: { gte: desde } } });
        if (reciente === 0) return { accion: 'DESCARTAR', codigo: FUERA_DE_VENTANA_AVISO, motivo: MOTIVO_FUERA_DE_VENTANA };
      } else if ((await this.prisma.whatsappMensaje.count({ where: { telefono_hash: hash, direccion: 'ENTRANTE' } })) === 0) {
        return {
          accion: 'DESCARTAR',
          codigo: 'SIN_CONTACTO_PREVIO',
          motivo: 'Bloqueado: este número nunca escribió al negocio; no se le escribe primero por WhatsApp no oficial.',
        };
      }
    }

    if ((await this.config.estaPausado()) || (await this.config.estadoConexion()).estado === 'DESCONECTADO') {
      return { accion: 'DIFERIR', esperaMs: 5 * MIN, motivo: 'El número de WhatsApp está desconectado o en pausa; se reintenta luego' };
    }
    // El código de cuenta lo pide la propia persona para entrar a su cuenta: sale también fuera de horario
    if (fila.origen !== 'CODIGO_CUENTA' && !(await this.esRecibidoDeProgramado(fila))) {
      const horario = await horarioDelLocal(this.local, this.prisma, ahora, { desde: cfg.evolution_horario_desde, hasta: cfg.evolution_horario_hasta });
      if (!horario.abierto) {
        return {
          accion: 'DESCARTAR',
          codigo: 'FUERA_DE_HORARIO',
          motivo: 'Descartado: con WhatsApp no oficial no se escribe fuera del horario de trabajo del local, y este aviso no se manda al día siguiente.',
        };
      }
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
}
