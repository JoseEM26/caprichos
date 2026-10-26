import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import {
  BotonAccion,
  OpcionesEnvio,
  ResultadoEnvioWhatsApp,
  WHATSAPP_MENSAJERIA_PUERTO,
  WhatsAppMensajeriaPuerto,
} from '../puerto/whatsapp-mensajeria.puerto';
import { CATALOGO_PLANTILLAS } from '../catalogo/plantillas.catalogo';
import { enmascararTelefono, hashTelefono } from '../utilidades/enmascarar.util';

export const DURACION_VENTANA_24H_MS = 24 * 60 * 60 * 1000;

export interface PayloadMensajeNegocio {
  textoLibre: string;
  plantillaClave: keyof typeof CATALOGO_PLANTILLAS;
  variablesPlantilla?: Record<string, string> | string[];
  botones?: BotonAccion[];
}

@Injectable()
export class Ventana24hService {
  private readonly logger = new Logger(Ventana24hService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(WHATSAPP_MENSAJERIA_PUERTO)
    private readonly mensajeria: WhatsAppMensajeriaPuerto,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  /**
   * Determina si la ventana de 24 horas está abierta para el cliente.
   * La ventana está abierta si existe un mensaje ENTRANTE recibido en las últimas 24 horas.
   */
  async esVentanaAbierta(telefono: string, conversacionId?: bigint): Promise<boolean> {
    const telHash = hashTelefono(telefono);
    const hace24h = new Date(Date.now() - DURACION_VENTANA_24H_MS);

    const ultimoMensajeEntrante = await this.prisma.whatsappMensaje.findFirst({
      where: {
        OR: [
          { telefono_hash: telHash },
          ...(conversacionId ? [{ conversacion_id: conversacionId }] : []),
        ],
        direccion: 'ENTRANTE',
        creado_en: { gte: hace24h },
      },
      orderBy: { creado_en: 'desc' },
      select: { id: true, creado_en: true },
    });

    if (ultimoMensajeEntrante) return true;

    if (conversacionId) {
      const chatEntrante = await this.prisma.mensajeChat.findFirst({
        where: {
          conversacion_id: conversacionId,
          direccion: 'ENTRA',
          en: { gte: hace24h },
        },
        select: { id: true },
      });
      if (chatEntrante) return true;
    }

    return false;
  }

  /**
   * Verifica si el cliente ha solicitado la revocación de consentimiento (BAJA / STOP) conforme a Ley 29733.
   */
  async tieneConsentimiento(telefono: string): Promise<boolean> {
    const telHash = hashTelefono(telefono);
    const consentimiento = await this.prisma.clienteWhatsappConsentimiento.findUnique({
      where: { telefono_hash: telHash },
      select: { acepta: true },
    });

    // Por defecto tiene consentimiento salvo que explícitamente conste acepta = false
    return consentimiento ? consentimiento.acepta : true;
  }

  /**
   * Notifica a Caja mediante la campana interna del sistema (tabla notificacion + websocket).
   */
  async notificarFalloACaja(titulo: string, detalle: string, pedidoId?: bigint | string) {
    try {
      const notif = await this.prisma.notificacion.create({
        data: {
          tipo: 'WHATSAPP_ALERTA',
          rol_destino: 'CAJA',
          titulo,
          mensaje: detalle,
          enlace: '/admin/caja',
        },
      });

      this.eventos?.emitirAdmin('notificaciones:nueva', {
        id: notif.id.toString(),
        titulo,
      });
    } catch (err: any) {
      this.logger.error(`Error emitiendo notificación a caja: ${err.message}`);
    }
  }

  /**
   * Envía un mensaje iniciado por el negocio respetando la política estricta de 24 horas de Meta:
   * - Si la ventana está abierta: envía texto libre o interactivo con botones.
   * - Si la ventana está cerrada: OBLIGA al uso de plantilla aprobada.
   * - Si falta la plantilla o Meta la rechaza: registra el fallo y avisa a Caja por la campana.
   */
  async enviarMensajeNegocio(
    telefono: string,
    payload: PayloadMensajeNegocio,
    opciones?: OpcionesEnvio,
  ): Promise<ResultadoEnvioWhatsApp> {
    const telMask = enmascararTelefono(telefono);
    const telHash = hashTelefono(telefono);

    // 1. Verificar consentimiento (Ley 29733)
    const acepta = await this.tieneConsentimiento(telefono);
    if (!acepta) {
      this.logger.warn(`Envío bloqueado a ${telMask}: cliente en estado BAJA`);
      return {
        exito: false,
        estado: 'FALLIDO',
        errorCodigo: 'CLIENTE_BAJA',
        errorDetalle: 'El cliente ha solicitado no recibir más mensajes (BAJA)',
      };
    }

    // 2. Evaluar ventana de 24 horas
    const ventanaAbierta = await this.esVentanaAbierta(telefono);

    if (ventanaAbierta) {
      this.logger.log(`Ventana de 24h ABIERTA para ${telMask}. Enviando texto libre o interactivo.`);

      if (payload.botones && payload.botones.length > 0) {
        return this.mensajeria.enviarBotones(
          telefono,
          payload.textoLibre,
          payload.botones,
          opciones,
        );
      }

      return this.mensajeria.enviarTexto(telefono, payload.textoLibre, opciones);
    }

    // 3. Ventana CERRADA: Obligatorio uso de plantilla aprobada
    this.logger.log(`Ventana de 24h CERRADA para ${telMask}. Requiere plantilla aprobada.`);

    const definicion = CATALOGO_PLANTILLAS[payload.plantillaClave];
    if (!definicion) {
      const errorDetalle = `No existe plantilla configurada para la clave '${String(payload.plantillaClave)}'`;
      this.logger.error(`Fallo de plantilla: ${errorDetalle}`);

      await this.prisma.whatsappMensaje.create({
        data: {
          direccion: 'SALIENTE',
          telefono_enmascarado: telMask,
          telefono_hash: telHash,
          tipo: 'PLANTILLA',
          plantilla: String(payload.plantillaClave),
          estado: 'FALLIDO',
          error_codigo: 'PLANTILLA_NO_CONFIGURADA',
          error_detalle: errorDetalle,
          pedido_id: opciones?.pedidoId ? BigInt(opciones.pedidoId) : null,
          conversacion_id: opciones?.conversacionId ? BigInt(opciones.conversacionId) : null,
        },
      });

      await this.notificarFalloACaja(
        'WhatsApp: Aviso no enviado por falta de plantilla',
        `No se pudo enviar aviso al cliente ${telMask}. Ventana de 24h cerrada y plantilla no configurada.`,
        opciones?.pedidoId,
      );

      return {
        exito: false,
        estado: 'FALLIDO',
        errorCodigo: 'PLANTILLA_NO_CONFIGURADA',
        errorDetalle,
      };
    }

    const resultadoPlantilla = await this.mensajeria.enviarPlantilla(
      telefono,
      definicion.nombre,
      definicion.idioma,
      payload.variablesPlantilla,
      opciones,
    );

    if (!resultadoPlantilla.exito) {
      this.logger.warn(
        `Fallo al enviar plantilla '${definicion.nombre}' a ${telMask}: ${resultadoPlantilla.errorDetalle}`,
      );

      await this.notificarFalloACaja(
        'WhatsApp: Fallo al enviar plantilla a cliente',
        `Meta rechazó la plantilla '${definicion.nombre}' para ${telMask}: ${resultadoPlantilla.errorDetalle || 'Error desconocido'}`,
        opciones?.pedidoId,
      );
    }

    return resultadoPlantilla;
  }
}
