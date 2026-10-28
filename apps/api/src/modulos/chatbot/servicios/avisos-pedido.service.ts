import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { normalizarTelefono, enmascararTelefono } from '../utilidades/enmascarar.util';
import { Ventana24hService } from './ventana-24h.service';
import { EtapaAvisoReparto, TEXTOS_REPARTO, PayloadAvisoReparto } from '../conversacion/textos-reparto';
import { marcarPagoParaPersona } from './pago-para-persona.util';

/**
 * Número de etapa en `mensaje_reparto` (PK pedido_id + numero = idempotencia por pedido y etapa)
 * y el parámetro de activación que la habilita.
 */
export const ETAPAS_AVISO: Record<
  EtapaAvisoReparto,
  { numero: number; parametro: string; cualquierModalidad?: boolean }
> = {
  SALIDA: { numero: 1, parametro: 'whatsapp_aviso_salida_activo' },
  LLEGADA: { numero: 2, parametro: 'whatsapp_aviso_llegada_activo' },
  INSISTENCIA: { numero: 3, parametro: 'whatsapp_aviso_llegada_activo' },
  ESPERA_AGOTADA: { numero: 4, parametro: 'whatsapp_aviso_espera_activo' },
  RETIRO: { numero: 5, parametro: 'whatsapp_aviso_espera_activo' },
  ACEPTADO: { numero: 6, parametro: 'whatsapp_aviso_pago_confirmado_activo' },
  LISTO: { numero: 7, parametro: 'whatsapp_aviso_listo_activo' },
  ENTREGADO: { numero: 8, parametro: 'whatsapp_aviso_entregado_activo' },
  // Pedido de la carta virtual recién creado: vale para cualquier modalidad
  RECIBIDO: { numero: 9, parametro: 'whatsapp_aviso_recibido_activo', cualquierModalidad: true },
  // Reprogramación tras el retiro: el reenvío y los cierres comparten la activación de espera/retiro
  REENVIADO: { numero: 10, parametro: 'whatsapp_aviso_espera_activo' },
  REPROG_RECIBIDA: { numero: 11, parametro: 'whatsapp_aviso_espera_activo' },
  REPROG_CANCELADA: { numero: 12, parametro: 'whatsapp_aviso_espera_activo' },
  REPROG_SIN_RESPUESTA: { numero: 13, parametro: 'whatsapp_aviso_espera_activo' },
};

/** Medios digitales que llevan voucher y pasan la conversación a una persona. Nombre que se lee al cliente. */
const MEDIOS_DIGITALES: Record<string, string> = {
  YAPE: 'Yape',
  PLIN: 'Plin',
  TRANSFERENCIA: 'transferencia',
};

/**
 * Etapas del intento de entrega: al retirar la movilidad se borran para que el nuevo intento avise otra vez.
 * La 5 (pregunta RETIRO) guarda la respuesta del cliente; la 10 (REENVIADO) es el aviso de reenvío.
 */
export const NUMEROS_INTENTO = [1, 2, 3, 4, 5, 10];

export const esParametroActivo = (valor: unknown) =>
  valor === true || String(valor).toLowerCase() === 'si';

export interface ResultadoAviso {
  estado: 'ENVIADO' | 'SIMULADO' | 'FALLIDO' | 'OMITIDO' | 'YA_ENVIADO';
  motivo?: string;
}

export interface DatosAviso {
  /** INSISTENCIA: minutos esperando en la puerta. */
  minutos?: number;
  /** RETIRO: recargo de reprogramación en soles (el mismo que se cobra al reenviar). */
  recargo?: number;
  /** RETIRO: modo del recargo, solo para explicar al cliente que es el costo del delivery. */
  recargoModo?: 'IGUAL_ENVIO' | 'FIJO' | 'SIN_COSTO';
}

/**
 * Único punto que envía avisos al cliente en cada etapa de un pedido delivery.
 * Idempotente: el registro en mensaje_reparto (pedido_id, numero) se inserta antes de enviar;
 * si ya existe, no se vuelve a enviar. Nunca lanza error: un aviso fallido no debe frenar el reparto.
 */
@Injectable()
export class AvisosPedidoService {
  private readonly logger = new Logger(AvisosPedidoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ventana24h: Ventana24hService,
  ) {}

  async avisar(
    pedidoId: bigint | string | number,
    etapa: EtapaAvisoReparto,
    datos: DatosAviso = {},
  ): Promise<ResultadoAviso> {
    try {
      return await this.avisarSinProteger(BigInt(pedidoId), etapa, datos);
    } catch (err: any) {
      this.logger.error(`Aviso ${etapa} del pedido ${pedidoId} falló: ${err?.message}`, err?.stack);
      return { estado: 'FALLIDO', motivo: err?.message };
    }
  }

  private async avisarSinProteger(
    pedidoId: bigint,
    etapa: EtapaAvisoReparto,
    datos: DatosAviso,
  ): Promise<ResultadoAviso> {
    const cfg = ETAPAS_AVISO[etapa];

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: {
        id: true,
        codigo: true,
        cliente_nombre: true,
        cliente_telefono: true,
        modalidad: true,
        total: true,
        pago_metodo: true,
        pago_preferido: true,
      },
    });
    if (!pedido) return { estado: 'OMITIDO', motivo: 'PEDIDO_NO_ENCONTRADO' };
    if (pedido.modalidad !== 'DELIVERY' && !cfg.cualquierModalidad) return { estado: 'OMITIDO', motivo: 'NO_ES_DELIVERY' };

    const telefono = normalizarTelefono(pedido.cliente_telefono || '');
    if (!telefono) return { estado: 'OMITIDO', motivo: 'SIN_TELEFONO' };

    const flag = await this.prisma.parametro.findUnique({ where: { clave: cfg.parametro } });
    if (!esParametroActivo(flag?.valor)) return { estado: 'OMITIDO', motivo: 'DESACTIVADO' };

    // Idempotencia: la fila (pedido, etapa) se crea una sola vez; si ya existe, el aviso ya salió
    try {
      await this.prisma.mensajeReparto.create({
        data: { pedido_id: pedidoId, numero: cfg.numero, enviado_en: new Date(), estado: 'PENDIENTE' },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') return { estado: 'YA_ENVIADO' };
      throw err;
    }

    const nombre = pedido.cliente_nombre || 'Cliente';
    const medio = etapa === 'RECIBIDO' ? MEDIOS_DIGITALES[String(pedido.pago_preferido || pedido.pago_metodo || '').toUpperCase()] ?? null : null;
    if (etapa === 'RECIBIDO' && medio) {
      // Pago digital: la conversación pasa a una persona de Caja (aunque el envío falle)
      await this.marcarParaPersona(telefono, pedido, nombre);
    }

    const payload = await this.construirPayload(etapa, nombre, pedido.codigo, datos, medio);
    const resultado = await this.ventana24h.enviarMensajeNegocio(telefono, payload, { pedidoId });

    await this.prisma.mensajeReparto.update({
      where: { pedido_id_numero: { pedido_id: pedidoId, numero: cfg.numero } },
      data: { estado: resultado.exito ? 'ENVIADO' : 'FALLIDO' },
    });

    await this.registrarEnChat(telefono, pedido.cliente_nombre, etapa, pedido.codigo, payload, resultado);

    this.logger.log(`Aviso ${etapa} del pedido ${pedido.codigo} a ${enmascararTelefono(telefono)}: ${resultado.estado}`);

    if (!resultado.exito) {
      return { estado: 'FALLIDO', motivo: resultado.errorCodigo };
    }
    return { estado: resultado.estado === 'SIMULADO' ? 'SIMULADO' : 'ENVIADO' };
  }

  /** Mismo efecto que un voucher recibido por WhatsApp: la conversación queda para una persona (VALIDAR_PAGO, urgente). */
  private async marcarParaPersona(
    telefono: string,
    pedido: { id: bigint; codigo: string; total: unknown; pago_metodo: string | null; pago_preferido: string | null },
    nombre: string,
  ) {
    try {
      const conversacion = await this.prisma.conversacion.upsert({
        where: { telefono },
        update: { ultima_actividad: new Date() },
        create: { telefono, nombre_contacto: nombre },
        select: { id: true, flujo: true },
      });
      await marcarPagoParaPersona(this.prisma, conversacion, pedido);
    } catch (err: any) {
      this.logger.error(`No se pudo dejar el pedido ${pedido.codigo} para revisión de pago: ${err?.message}`, err?.stack);
    }
  }

  private async construirPayload(
    etapa: EtapaAvisoReparto,
    nombre: string,
    codigo: string,
    datos: DatosAviso,
    medioDigital: string | null,
  ): Promise<PayloadAvisoReparto> {
    switch (etapa) {
      case 'RECIBIDO':
        return medioDigital
          ? TEXTOS_REPARTO.recibidoDigital(nombre, codigo, medioDigital)
          : TEXTOS_REPARTO.recibidoEfectivo(nombre, codigo);
      case 'ACEPTADO':
        return TEXTOS_REPARTO.aceptado(nombre, codigo);
      case 'LISTO':
        return TEXTOS_REPARTO.listo(nombre, codigo);
      case 'SALIDA': {
        const p = await this.prisma.parametro.findUnique({ where: { clave: 'tiempo_prometido_min' } });
        return TEXTOS_REPARTO.salida(nombre, codigo, String(Number(p?.valor ?? 30)));
      }
      case 'LLEGADA':
        return TEXTOS_REPARTO.llegada(nombre, codigo);
      case 'INSISTENCIA':
        return TEXTOS_REPARTO.insistencia(nombre, codigo, String(Math.floor(datos.minutos ?? 0)));
      case 'ESPERA_AGOTADA':
        return TEXTOS_REPARTO.esperaAgotada(nombre, codigo);
      case 'RETIRO':
        return TEXTOS_REPARTO.retiro(nombre, codigo, this.costoReprogramacion(datos.recargo, datos.recargoModo));
      case 'REENVIADO':
        return TEXTOS_REPARTO.reenviado(nombre, codigo);
      case 'REPROG_RECIBIDA':
        return TEXTOS_REPARTO.reprogramacionRecibida(nombre, codigo);
      case 'REPROG_CANCELADA':
        return TEXTOS_REPARTO.reprogramacionCancelada(nombre, codigo);
      case 'REPROG_SIN_RESPUESTA':
        return TEXTOS_REPARTO.reprogramacionSinRespuesta(nombre, codigo);
      case 'ENTREGADO':
        return TEXTOS_REPARTO.entregado(nombre, codigo);
    }
  }

  private montoSoles(monto?: number): string {
    return `S/ ${(monto ?? 0).toFixed(2)}`;
  }

  /** Frase exacta del costo que se le dice al cliente antes de su SÍ/NO (el mismo monto que se cobra). */
  private costoReprogramacion(recargo?: number, modo?: DatosAviso['recargoModo']): string {
    if ((recargo ?? 0) <= 0) return 'Volver a enviarlo no tiene costo adicional.';
    const detalle = modo === 'IGUAL_ENVIO' ? ' (el mismo del delivery)' : '';
    return `Volver a enviarlo tiene un costo de ${this.montoSoles(recargo)}${detalle}, que pagarías en la puerta o a Caja.`;
  }

  /** Copia el aviso en el hilo de chat del cliente (mensaje_chat), para que Caja lo vea junto a la conversación. */
  /** Copia un aviso al chat del cliente (mensaje_chat). Público: lo usa ReprogramacionService. */
  async registrarEnChat(
    telefono: string,
    nombre: string | null,
    etapa: EtapaAvisoReparto,
    codigo: string,
    payload: PayloadAvisoReparto,
    resultado: { exito: boolean; id?: string; estado: string; errorCodigo?: string },
  ) {
    const conversacion = await this.prisma.conversacion.upsert({
      where: { telefono },
      update: { ultima_actividad: new Date() },
      create: { telefono, nombre_contacto: nombre },
      select: { id: true },
    });

    let whatsappMensajeId: bigint | null = null;
    if (resultado.id && /^\d+$/.test(resultado.id)) whatsappMensajeId = BigInt(resultado.id);

    await this.prisma.mensajeChat.create({
      data: {
        conversacion_id: conversacion.id,
        direccion: 'SALE',
        autor: 'BOT',
        tipo: resultado.exito ? 'TEXTO' : 'SISTEMA',
        contenido: {
          etapa,
          pedido: codigo,
          texto: payload.textoLibre,
          plantilla: payload.plantillaClave,
          estado: resultado.estado,
          errorCodigo: resultado.errorCodigo ?? null,
        },
        whatsapp_mensaje_id: whatsappMensajeId,
      },
    });
  }
}
