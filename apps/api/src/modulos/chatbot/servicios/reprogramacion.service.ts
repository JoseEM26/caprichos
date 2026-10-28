import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { AvisosPedidoService } from './avisos-pedido.service';
import { EtapaAvisoReparto } from '../conversacion/textos-reparto';

/**
 * Reprogramación tras el retiro de la movilidad por espera agotada.
 * Estado en mensaje_reparto (numero 5 = pregunta RETIRO) y en el pedido, sin columnas nuevas:
 *  - ENVIADO          pregunta enviada, esperando respuesta
 *  - REPROGRAMAR      el cliente dijo SI: el admin debe reenviar a reparto ("Por reprogramar")
 *  - REPROGRAMADO     el admin reenvió a reparto (aparece en "Para elegir" con marca)
 *  - NO_REPROGRAMAR   el cliente dijo NO: pedido ANULADO
 *  - SIN_RESPUESTA    venció reprog_respuesta_min sin respuesta: pedido ANULADO
 *  - TOPE_ALCANZADO   ya se reprogramó el máximo de veces: no se pregunta, pedido ANULADO
 */
export const NUMERO_PREGUNTA_REPROG = 5;
export const MOTIVO_RETIRO = 'NO_CONTESTA';
export const ESTADO_REPROG = {
  ENVIADO: 'ENVIADO',
  REPROGRAMAR: 'REPROGRAMAR',
  REPROGRAMADO: 'REPROGRAMADO',
  NO_REPROGRAMAR: 'NO_REPROGRAMAR',
  SIN_RESPUESTA: 'SIN_RESPUESTA',
  TOPE_ALCANZADO: 'TOPE_ALCANZADO',
} as const;

type MotivoCancelacion = 'NO' | 'SIN_RESPUESTA' | 'TOPE';

const CANCELACION: Record<
  MotivoCancelacion,
  { estado: string; motivo: string; cajaTitulo: string; aviso: EtapaAvisoReparto }
> = {
  NO: {
    estado: ESTADO_REPROG.NO_REPROGRAMAR,
    motivo: 'Cliente no quiso reprogramar la entrega tras la espera agotada',
    cajaTitulo: 'Pedido cancelado: el cliente no quiso reprogramar',
    aviso: 'REPROG_CANCELADA',
  },
  SIN_RESPUESTA: {
    estado: ESTADO_REPROG.SIN_RESPUESTA,
    motivo: 'Sin respuesta del cliente sobre reprogramar (tiempo agotado)',
    cajaTitulo: 'Pedido cancelado: sin respuesta del cliente',
    aviso: 'REPROG_SIN_RESPUESTA',
  },
  TOPE: {
    estado: ESTADO_REPROG.TOPE_ALCANZADO,
    motivo: 'Se alcanzó el límite de reprogramaciones del pedido',
    cajaTitulo: 'Pedido cancelado: límite de reprogramaciones alcanzado',
    aviso: 'REPROG_CANCELADA',
  },
};

// Respuestas aceptadas en texto (sin tildes ni signos) o por id de botón.
const RESPUESTAS_SI = ['si', 'si reprogramar', 'reprogramar_si'];
const RESPUESTAS_NO = ['no', 'no cancelar', 'no gracias', 'reprogramar_no'];

const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.!?¡¿,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

@Injectable()
export class ReprogramacionService {
  private readonly logger = new Logger(ReprogramacionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly avisos: AvisosPedidoService,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  /** Pregunta de reprogramar enviada al cliente que sigue sin respuesta, para su último pedido retirado. */
  async preguntaPendiente(telefono: string) {
    return this.prisma.mensajeReparto.findFirst({
      where: {
        numero: NUMERO_PREGUNTA_REPROG,
        estado: ESTADO_REPROG.ENVIADO,
        pedido: {
          estado: 'LISTO',
          motivo_falla: MOTIVO_RETIRO,
          repartidor_party_id: null,
          cliente_telefono: { contains: telefono.slice(-8) },
        },
      },
      include: { pedido: { select: { id: true, codigo: true } } },
      orderBy: { enviado_en: 'desc' },
    });
  }

  /**
   * Atiende la respuesta del cliente SOLO si hay una pregunta de reprogramar pendiente.
   * Sin pregunta pendiente no hace nada (un "no gracias" suelto no cancela nada).
   * Devuelve true si la respuesta fue atendida aquí y no debe seguir al bot general.
   */
  async procesarRespuesta(telefono: string, texto: string, buttonPayload: string | null): Promise<boolean> {
    const pendiente = await this.preguntaPendiente(telefono);
    if (!pendiente) return false;

    const candidato = normalizar(buttonPayload || texto);
    if (RESPUESTAS_SI.includes(candidato)) {
      await this.registrarSi(pendiente.pedido.id, pendiente.pedido.codigo);
      return true;
    }
    if (RESPUESTAS_NO.includes(candidato)) {
      await this.cancelar(pendiente.pedido.id, 'NO');
      return true;
    }
    return false;
  }

  /** SI del cliente: queda "Por reprogramar" para que el admin lo reenvíe a reparto. Idempotente. */
  private async registrarSi(pedidoId: bigint, codigo: string) {
    // El cambio de estado y el aviso al cliente van en la misma transacción (outbox)
    const nuevo = await this.prisma.$transaction(async (tx) => {
      const r = await tx.mensajeReparto.updateMany({
        where: { pedido_id: pedidoId, numero: NUMERO_PREGUNTA_REPROG, estado: ESTADO_REPROG.ENVIADO },
        data: { estado: ESTADO_REPROG.REPROGRAMAR, respondido_en: new Date() },
      });
      if (r.count === 0) return false;
      await this.avisos.avisar(pedidoId, 'REPROG_RECIBIDA', {}, tx);
      return true;
    });
    if (!nuevo) return;

    this.avisos.despertar();
    await this.notificarCaja(
      'Cliente pide reprogramar entrega',
      `El cliente del pedido ${codigo} confirmó reprogramar. Reenvíalo a reparto desde Repartos (Por reprogramar).`,
      'REPROGRAMACION_DELIVERY',
      '/admin/repartos',
    );
  }

  /**
   * Cancela un pedido retirado: NO del cliente, falta de respuesta o tope alcanzado.
   * Estado final ANULADO con motivo distinto por caso; el incidente queda con cierre DEVUELTO.
   * Idempotente: si el pedido ya no está retirado en LISTO, no hace nada y devuelve false.
   */
  async cancelar(pedidoId: bigint, motivo: MotivoCancelacion): Promise<boolean> {
    const cfg = CANCELACION[motivo];
    const ahora = new Date();

    const ok = await this.prisma.$transaction(async (tx) => {
      const r = await tx.pedido.updateMany({
        where: { id: pedidoId, estado: 'LISTO', repartidor_party_id: null, motivo_falla: MOTIVO_RETIRO },
        data: { estado: 'ANULADO', anulado_en: ahora, motivo_anulacion: cfg.motivo },
      });
      if (r.count === 0) return false;

      const ultimo = await tx.incidenteEntrega.findFirst({
        where: { pedido_id: pedidoId },
        orderBy: { en: 'desc' },
      });
      if (ultimo) {
        await tx.incidenteEntrega.update({ where: { id: ultimo.id }, data: { cierre: 'DEVUELTO' } });
      }

      await tx.pedidoEstadoHistorial.create({
        data: { pedido_id: pedidoId, estado_anterior: 'LISTO', estado_nuevo: 'ANULADO', motivo: cfg.motivo, en: ahora },
      });

      await tx.mensajeReparto.updateMany({
        where: { pedido_id: pedidoId, numero: NUMERO_PREGUNTA_REPROG },
        data: { estado: cfg.estado, respondido_en: ahora },
      });
      // Aviso de cancelación dentro de la misma transacción: si el pedido no se anula, no hay aviso
      await this.avisos.avisar(pedidoId, cfg.aviso, {}, tx);
      return true;
    });
    if (!ok) return false;
    this.avisos.despertar();

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: { codigo: true, pago_estado: true },
    });
    const codigo = pedido?.codigo ?? String(pedidoId);
    this.eventos?.emitirAdmin('pedido:estado', { id: Number(pedidoId), codigo, estado: 'ANULADO' });

    await this.notificarCaja(cfg.cajaTitulo, `Pedido ${codigo}: ${cfg.motivo}.`, 'REPROGRAMACION_CANCELADA', '/admin/caja');
    if (pedido?.pago_estado === 'PAGADO' || pedido?.pago_estado === 'COORDINADO') {
      await this.notificarCaja(
        'Revisar devolución',
        `El pedido ${codigo} se canceló y ya tenía pago registrado. Revisar la devolución al cliente; el sistema no devuelve dinero solo.`,
        'REVISAR_DEVOLUCION',
        '/admin/caja',
      );
    }

    return true;
  }

  /** Cuántas veces ya se reenvió el pedido tras reprogramar; al llegar al tope no se vuelve a preguntar. */
  async topeAlcanzado(pedidoId: bigint, tope: number): Promise<boolean> {
    const reprogramados = await this.prisma.incidenteEntrega.count({
      where: { pedido_id: pedidoId, cierre: 'REPROGRAMADO' },
    });
    return reprogramados >= tope;
  }

  /** Planificador: pregunta sin respuesta después de `minutos` pasa a cancelado por falta de respuesta. */
  async vencerSinRespuesta(minutos: number, ahora: Date): Promise<number> {
    const limite = new Date(ahora.getTime() - minutos * 60000);
    const filas = await this.prisma.mensajeReparto.findMany({
      where: {
        numero: NUMERO_PREGUNTA_REPROG,
        estado: ESTADO_REPROG.ENVIADO,
        enviado_en: { lte: limite },
        pedido: { estado: 'LISTO', motivo_falla: MOTIVO_RETIRO, repartidor_party_id: null },
      },
      select: { pedido_id: true },
    });
    let cancelados = 0;
    for (const f of filas) {
      try {
        if (await this.cancelar(f.pedido_id, 'SIN_RESPUESTA')) cancelados++;
      } catch (err: any) {
        this.logger.error(`No se pudo vencer la reprogramación del pedido ${f.pedido_id}: ${err?.message}`, err?.stack);
      }
    }
    return cancelados;
  }

  private async notificarCaja(titulo: string, mensaje: string, tipo: string, enlace: string) {
    const notif = await this.prisma.notificacion.create({
      data: { tipo, rol_destino: 'CAJERO', titulo, mensaje, enlace },
    });
    this.eventos?.emitirAdmin('notificaciones:nueva', { id: notif.id.toString(), titulo });
  }
}
