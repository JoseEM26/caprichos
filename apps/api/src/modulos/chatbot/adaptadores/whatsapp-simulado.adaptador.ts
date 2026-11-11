import { CargaCarrusel, resumenCarrusel } from '../servicios/carrusel.util';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import {
  BotonAccion,
  EstadoConexionWhatsApp,
  FilaLista,
  OpcionesEnvio,
  ResultadoEnvioWhatsApp,
  WhatsAppMensajeriaPuerto,
} from '../puerto/whatsapp-mensajeria.puerto';
import {
  enmascararTelefono,
  hashTelefono,
  normalizarTelefono,
} from '../utilidades/enmascarar.util';

@Injectable()
export class WhatsAppSimuladoAdaptador implements WhatsAppMensajeriaPuerto {
  private readonly logger = new Logger(WhatsAppSimuladoAdaptador.name);

  constructor(private readonly prisma: PrismaService) {}

  estaConectado(): EstadoConexionWhatsApp {
    return {
      conectado: false,
      modo: 'simulado',
      razon: 'Modo simulado activo (no se envían mensajes a la red de Meta)',
    };
  }

  private generarWaMessageId(): string {
    const ts = Date.now();
    const rand = Math.random().toString(36).substring(2, 9);
    return `wamid.simulado.${ts}.${rand}`;
  }

  private parsearId(id?: bigint | string): bigint | undefined {
    if (!id) return undefined;
    try {
      return typeof id === 'bigint' ? id : BigInt(id);
    } catch {
      return undefined;
    }
  }

  async enviarTexto(
    telefono: string,
    texto: string,
    opciones?: OpcionesEnvio,
  ): Promise<ResultadoEnvioWhatsApp> {
    const waMessageId = this.generarWaMessageId();
    const telNorm = normalizarTelefono(telefono);
    const telHash = hashTelefono(telefono);
    const telMask = enmascararTelefono(telefono);

    this.logger.log(
      `[SIMULADO] Enviar texto a ${telMask}: "${texto.slice(0, 60)}${texto.length > 60 ? '...' : ''}"`,
    );

    try {
      const registro = await this.prisma.whatsappMensaje.create({
        data: {
          direccion: 'SALIENTE',
          wa_message_id: waMessageId,
          telefono_enmascarado: telMask,
          telefono_hash: telHash,
          tipo: 'TEXTO',
          plantilla: null,
          estado: 'SIMULADO',
          pedido_id: this.parsearId(opciones?.pedidoId),
          conversacion_id: this.parsearId(opciones?.conversacionId),
        },
      });

      return {
        exito: true,
        id: registro.id.toString(),
        waMessageId,
        estado: 'SIMULADO',
      };
    } catch (error: any) {
      this.logger.error(`[SIMULADO] Error guardando mensaje simulado: ${error.message}`);
      return {
        exito: false,
        estado: 'FALLIDO',
        errorCodigo: 'ERROR_BD_SIMULADO',
        errorDetalle: error.message,
      };
    }
  }

  async enviarPlantilla(
    telefono: string,
    nombre: string,
    idioma: string,
    variables?: Record<string, string> | string[],
    opciones?: OpcionesEnvio,
  ): Promise<ResultadoEnvioWhatsApp> {
    const waMessageId = this.generarWaMessageId();
    const telHash = hashTelefono(telefono);
    const telMask = enmascararTelefono(telefono);

    this.logger.log(`[SIMULADO] Enviar plantilla '${nombre}' (${idioma}) a ${telMask}`);

    try {
      const registro = await this.prisma.whatsappMensaje.create({
        data: {
          direccion: 'SALIENTE',
          wa_message_id: waMessageId,
          telefono_enmascarado: telMask,
          telefono_hash: telHash,
          tipo: 'PLANTILLA',
          plantilla: nombre,
          estado: 'SIMULADO',
          pedido_id: this.parsearId(opciones?.pedidoId),
          conversacion_id: this.parsearId(opciones?.conversacionId),
        },
      });

      return {
        exito: true,
        id: registro.id.toString(),
        waMessageId,
        estado: 'SIMULADO',
      };
    } catch (error: any) {
      this.logger.error(`[SIMULADO] Error guardando plantilla simulada: ${error.message}`);
      return {
        exito: false,
        estado: 'FALLIDO',
        errorCodigo: 'ERROR_BD_SIMULADO',
        errorDetalle: error.message,
      };
    }
  }

  async enviarBotones(
    telefono: string,
    texto: string,
    botones: BotonAccion[],
    opciones?: OpcionesEnvio,
  ): Promise<ResultadoEnvioWhatsApp> {
    const waMessageId = this.generarWaMessageId();
    const telHash = hashTelefono(telefono);
    const telMask = enmascararTelefono(telefono);
    const nombresBotones = botones.slice(0, 3).map((b) => b.titulo).join(', ');

    this.logger.log(`[SIMULADO] Enviar botones [${nombresBotones}] a ${telMask}`);

    try {
      const registro = await this.prisma.whatsappMensaje.create({
        data: {
          direccion: 'SALIENTE',
          wa_message_id: waMessageId,
          telefono_enmascarado: telMask,
          telefono_hash: telHash,
          tipo: 'BOTON',
          plantilla: null,
          estado: 'SIMULADO',
          pedido_id: this.parsearId(opciones?.pedidoId),
          conversacion_id: this.parsearId(opciones?.conversacionId),
        },
      });

      return {
        exito: true,
        id: registro.id.toString(),
        waMessageId,
        estado: 'SIMULADO',
      };
    } catch (error: any) {
      this.logger.error(`[SIMULADO] Error guardando botones simulados: ${error.message}`);
      return {
        exito: false,
        estado: 'FALLIDO',
        errorCodigo: 'ERROR_BD_SIMULADO',
        errorDetalle: error.message,
      };
    }
  }

  async enviarLista(
    telefono: string,
    texto: string,
    botonTexto: string,
    filas: FilaLista[],
    opciones?: OpcionesEnvio,
  ): Promise<ResultadoEnvioWhatsApp> {
    const waMessageId = this.generarWaMessageId();
    const telHash = hashTelefono(telefono);
    const telMask = enmascararTelefono(telefono);
    const titulosFilas = filas.slice(0, 10).map((f) => f.titulo).join(', ');

    this.logger.log(`[SIMULADO] Enviar lista [${titulosFilas}] con botón '${botonTexto}' a ${telMask}`);

    try {
      const registro = await this.prisma.whatsappMensaje.create({
        data: {
          direccion: 'SALIENTE',
          wa_message_id: waMessageId,
          telefono_enmascarado: telMask,
          telefono_hash: telHash,
          tipo: 'LISTA',
          plantilla: null,
          estado: 'SIMULADO',
          pedido_id: this.parsearId(opciones?.pedidoId),
          conversacion_id: this.parsearId(opciones?.conversacionId),
        },
      });

      return {
        exito: true,
        id: registro.id.toString(),
        waMessageId,
        estado: 'SIMULADO',
      };
    } catch (error: any) {
      this.logger.error(`[SIMULADO] Error guardando lista simulada: ${error.message}`);
      return {
        exito: false,
        estado: 'FALLIDO',
        errorCodigo: 'ERROR_BD_SIMULADO',
        errorDetalle: error.message,
      };
    }
  }

  async enviarCarrusel(telefono: string, carga: CargaCarrusel, opciones?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    const waMessageId = this.generarWaMessageId();
    const telMask = enmascararTelefono(telefono);
    this.logger.log(`[SIMULADO] Enviar ${resumenCarrusel(carga)} a ${telMask}`);
    try {
      const registro = await this.prisma.whatsappMensaje.create({
        data: {
          direccion: 'SALIENTE',
          wa_message_id: waMessageId,
          telefono_enmascarado: telMask,
          telefono_hash: hashTelefono(telefono),
          tipo: 'BOTON',
          plantilla: null,
          estado: 'SIMULADO',
          pedido_id: this.parsearId(opciones?.pedidoId),
          conversacion_id: this.parsearId(opciones?.conversacionId),
        },
      });
      return { exito: true, id: registro.id.toString(), waMessageId, estado: 'SIMULADO' };
    } catch (error: any) {
      return { exito: false, estado: 'FALLIDO', errorCodigo: 'ERROR_BD_SIMULADO', errorDetalle: error.message };
    }
  }

  async enviarDocumento(
    telefono: string,
    _mediaId: string,
    nombreArchivo: string,
    _caption?: string,
    opciones?: OpcionesEnvio,
  ): Promise<ResultadoEnvioWhatsApp> {
    const waMessageId = this.generarWaMessageId();
    const telMask = enmascararTelefono(telefono);
    this.logger.log(`[SIMULADO] Enviar documento a ${telMask} (${nombreArchivo.length} caracteres de nombre)`);
    try {
      const registro = await this.prisma.whatsappMensaje.create({
        data: {
          direccion: 'SALIENTE',
          wa_message_id: waMessageId,
          telefono_enmascarado: telMask,
          telefono_hash: hashTelefono(telefono),
          tipo: 'DOCUMENTO',
          plantilla: null,
          estado: 'SIMULADO',
          pedido_id: this.parsearId(opciones?.pedidoId),
          conversacion_id: this.parsearId(opciones?.conversacionId),
        },
      });
      return { exito: true, id: registro.id.toString(), waMessageId, estado: 'SIMULADO' };
    } catch (error: any) {
      return { exito: false, estado: 'FALLIDO', errorCodigo: 'ERROR_BD_SIMULADO', errorDetalle: error.message };
    }
  }

  async enviarImagen(
    telefono: string,
    urlOArchivo: string,
    caption?: string,
    opciones?: OpcionesEnvio,
  ): Promise<ResultadoEnvioWhatsApp> {
    const waMessageId = this.generarWaMessageId();
    const telHash = hashTelefono(telefono);
    const telMask = enmascararTelefono(telefono);

    this.logger.log(
      `[SIMULADO] Enviar imagen (${urlOArchivo}) a ${telMask}${caption ? ` con caption: '${caption.slice(0, 30)}...'` : ''}`,
    );

    try {
      const registro = await this.prisma.whatsappMensaje.create({
        data: {
          direccion: 'SALIENTE',
          wa_message_id: waMessageId,
          telefono_enmascarado: telMask,
          telefono_hash: telHash,
          tipo: 'IMAGEN',
          plantilla: null,
          estado: 'SIMULADO',
          pedido_id: this.parsearId(opciones?.pedidoId),
          conversacion_id: this.parsearId(opciones?.conversacionId),
        },
      });

      return {
        exito: true,
        id: registro.id.toString(),
        waMessageId,
        estado: 'SIMULADO',
      };
    } catch (error: any) {
      this.logger.error(`[SIMULADO] Error guardando imagen simulada: ${error.message}`);
      return {
        exito: false,
        estado: 'FALLIDO',
        errorCodigo: 'ERROR_BD_SIMULADO',
        errorDetalle: error.message,
      };
    }
  }

  async marcarLeido(waMessageId: string, _phoneNumberId?: string): Promise<boolean> {
    this.logger.log(`[SIMULADO] Marcar como leído mensaje ${waMessageId}`);
    try {
      await this.prisma.whatsappMensaje.updateMany({
        where: { wa_message_id: waMessageId },
        data: { estado: 'LEIDO' },
      });
      return true;
    } catch {
      return false;
    }
  }
}
