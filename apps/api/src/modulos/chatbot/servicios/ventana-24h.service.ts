import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import {
  BotonAccion,
  FilaLista,
  OpcionesEnvio,
  ResultadoEnvioWhatsApp,
  WHATSAPP_MENSAJERIA_PUERTO,
  WhatsAppMensajeriaPuerto,
} from '../puerto/whatsapp-mensajeria.puerto';
import { botonCodigoDe, CATALOGO_PLANTILLAS } from '../catalogo/plantillas.catalogo';
import { CODIGOS_PLANTILLA_PERMANENTES } from '../utilidades/meta-errores.util';
import { enmascararTelefono, hashTelefono } from '../utilidades/enmascarar.util';

const esFalloDePlantilla = (codigo?: string | null): boolean =>
  !!codigo && (codigo === 'PLANTILLA_NO_CONFIGURADA' || CODIGOS_PLANTILLA_PERMANENTES.includes(codigo));

/**
 * Mensaje que no se puede entregar y se descarta en silencio (sin burbuja de error, sin campana): la ventana de
 * 24 h está cerrada y no hay plantilla aprobada (no configurada, o Meta la rechazó por plantilla / por ventana).
 */
export const esDescarteSilencioso = (codigo?: string | null): boolean => esFalloDePlantilla(codigo) || codigo === 'FUERA_DE_VENTANA_24H';

export const DURACION_VENTANA_24H_MS = 24 * 60 * 60 * 1000;

export interface PayloadMensajeNegocio {
  textoLibre: string;
  plantillaClave?: keyof typeof CATALOGO_PLANTILLAS;
  variablesPlantilla?: Record<string, string> | string[];
  botones?: BotonAccion[];
  /** Con la ventana abierta se manda esta lista en vez de los botones (la plantilla de Meta solo admite 3 botones). */
  lista?: { boton: string; filas: FilaLista[] };
  /** Plantilla a probar una sola vez si Meta rechaza la principal (p. ej. aún no aprobada). */
  plantillaRespaldo?: { plantillaClave: keyof typeof CATALOGO_PLANTILLAS; variablesPlantilla: string[] };
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
          rol_destino: 'CAJERO',
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
   * - Si falta la plantilla o Meta la rechaza por plantilla: descarte silencioso (sin chat de error ni campana).
   */
  async enviarMensajeNegocio(
    telefono: string,
    payload: PayloadMensajeNegocio,
    opciones?: OpcionesEnvio,
  ): Promise<ResultadoEnvioWhatsApp> {
    const telMask = enmascararTelefono(telefono);

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

      if (payload.lista?.filas.length) {
        return this.mensajeria.enviarLista(telefono, payload.textoLibre, payload.lista.boton, payload.lista.filas, opciones);
      }
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

    const definicion = payload.plantillaClave ? CATALOGO_PLANTILLAS[payload.plantillaClave] : undefined;
    if (!definicion) {
      // Sin plantilla para ese mensaje: se descarta en silencio (el outbox lo deja DESCARTADO con su motivo)
      this.logger.warn(`Sin plantilla '${String(payload.plantillaClave)}' y ventana cerrada para ${telMask}: descartado`);
      return {
        exito: false,
        estado: 'OMITIDO',
        errorCodigo: 'PLANTILLA_NO_CONFIGURADA',
        errorDetalle: `Ventana de 24 h cerrada y no hay plantilla aprobada para '${String(payload.plantillaClave)}'`,
      };
    }

    const botonCodigo = botonCodigoDe(definicion, payload.variablesPlantilla);
    // Plantilla con botones de respuesta rápida (encuesta): el payload de cada botón viaja con el envío
    const botonesRespuesta = definicion.botones?.length && payload.botones?.length ? payload.botones.map((b) => b.id) : undefined;
    let opcionesPlantilla = botonCodigo ? { ...opciones, botonCodigo } : opciones;
    if (botonesRespuesta) opcionesPlantilla = { ...opcionesPlantilla, botonesRespuesta };
    let resultadoPlantilla = await this.mensajeria.enviarPlantilla(
      telefono,
      definicion.nombre,
      definicion.idioma,
      payload.variablesPlantilla,
      opcionesPlantilla,
    );

    if (!resultadoPlantilla.exito && payload.plantillaRespaldo && esFalloDePlantilla(resultadoPlantilla.errorCodigo)) {
      // Nada salió (Meta rechazó la plantilla): una sola vez con la vigente, sin duplicar mensajes
      this.logger.warn(`Plantilla '${definicion.nombre}' rechazada para ${telMask} (${resultadoPlantilla.errorCodigo}); se usa la de respaldo`);
      const respaldo = CATALOGO_PLANTILLAS[payload.plantillaRespaldo.plantillaClave];
      if (respaldo) {
        resultadoPlantilla = await this.mensajeria.enviarPlantilla(
          telefono,
          respaldo.nombre,
          respaldo.idioma,
          payload.plantillaRespaldo.variablesPlantilla,
          opciones,
        );
      }
    }

    if (!resultadoPlantilla.exito && esDescarteSilencioso(resultadoPlantilla.errorCodigo)) {
      // Meta rechazó la plantilla (no aprobada, pausada, etc.): sin aviso a Caja ni reintentos
      this.logger.warn(`Plantilla '${definicion.nombre}' rechazada para ${telMask} (${resultadoPlantilla.errorCodigo}): descartado en silencio`);
    } else if (!resultadoPlantilla.exito && resultadoPlantilla.estado !== 'OMITIDO') {
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
