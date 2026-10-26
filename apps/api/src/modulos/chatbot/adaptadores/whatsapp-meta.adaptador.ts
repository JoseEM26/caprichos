import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

export interface MetaErrorParsed {
  codigo: string;
  mensaje: string;
  reintentable: boolean;
  httpStatus?: number;
}

@Injectable()
export class WhatsAppMetaAdaptador implements WhatsAppMensajeriaPuerto {
  private readonly logger = new Logger(WhatsAppMetaAdaptador.name);
  private readonly token: string;
  private readonly phoneId: string;
  private readonly apiVersion: string;
  private readonly timeoutMs: number;
  private readonly maxReintentos: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.token = this.configService.get<string>('WHATSAPP_TOKEN', '').trim();
    this.phoneId = this.configService.get<string>('WHATSAPP_PHONE_ID', '').trim();
    this.apiVersion = this.configService.get<string>('WHATSAPP_API_VERSION', 'v20.0').trim();
    this.timeoutMs = Number(this.configService.get<number>('WHATSAPP_TIMEOUT_MS', 10000));
    this.maxReintentos = 3;
  }

  estaConectado(): EstadoConexionWhatsApp {
    const conectado = Boolean(this.token && this.phoneId);
    return {
      conectado,
      modo: 'meta',
      razon: conectado
        ? 'Conectado con Meta WhatsApp Cloud API'
        : 'Faltan credenciales WHATSAPP_TOKEN o WHATSAPP_PHONE_ID',
    };
  }

  private parsearId(id?: bigint | string): bigint | undefined {
    if (!id) return undefined;
    try {
      return typeof id === 'bigint' ? id : BigInt(id);
    } catch {
      return undefined;
    }
  }

  /**
   * Clasifica los errores devueltos por Meta WhatsApp Cloud API.
   * Identifica si el error es reintentable (429, 5xx) o definitivo (24h, número inválido, plantilla rechazada).
   */
  public clasificarErrorMeta(status: number, bodyText: string): MetaErrorParsed {
    let parsed: any = null;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      // No es JSON
    }

    const errorObj = parsed?.error || {};
    const code = errorObj.code;
    const msg = errorObj.message || bodyText;
    const details = errorObj.error_data?.details || '';
    const fullLower = `${msg} ${details}`.toLowerCase();

    // 1. Destinatario no verificado en el número de prueba de Meta (código 131030 o allowed list)
    if (
      code === 131030 ||
      fullLower.includes('allowed list') ||
      fullLower.includes('not in allowed list') ||
      fullLower.includes('recipient is not in')
    ) {
      return {
        codigo: 'DESTINATARIO_NO_VERIFICADO',
        mensaje: 'Este numero no esta autorizado en el numero de prueba de Meta',
        reintentable: false,
        httpStatus: status,
      };
    }

    // 2. Token vencido o credenciales inválidas (código 190, 401)
    if (
      code === 190 ||
      fullLower.includes('session has expired') ||
      fullLower.includes('token expired') ||
      fullLower.includes('invalid oauth') ||
      (status === 401 && fullLower.includes('token'))
    ) {
      return {
        codigo: 'TOKEN_VENCIDO',
        mensaje: 'El acceso a WhatsApp vencio: avisa a quien administra la cuenta',
        reintentable: false,
        httpStatus: status,
      };
    }

    // 3. Fuera de ventana de 24 horas (código 131047)
    if (
      code === 131047 ||
      fullLower.includes('24 hours') ||
      fullLower.includes('24-hour') ||
      fullLower.includes('re-engagement')
    ) {
      return {
        codigo: 'FUERA_DE_VENTANA_24H',
        mensaje:
          'No se puede enviar texto libre: Han transcurrido más de 24 horas desde el último mensaje del cliente. Requiere plantilla aprobada.',
        reintentable: false,
        httpStatus: status,
      };
    }

    // 4. Número inválido o no registrado (código 131026, 131009, 100)
    if (
      code === 131026 ||
      code === 131009 ||
      code === 100 ||
      fullLower.includes('undeliverable') ||
      fullLower.includes('not a valid whatsapp')
    ) {
      return {
        codigo: 'NUMERO_INVALIDO',
        mensaje: 'El número de teléfono no está activo en WhatsApp o tiene formato inválido.',
        reintentable: false,
        httpStatus: status,
      };
    }

    // 3. Plantilla no aprobada o inexistente (132000..132015)
    if (
      (code >= 132000 && code <= 132015) ||
      fullLower.includes('template') ||
      fullLower.includes('does not exist')
    ) {
      return {
        codigo: 'PLANTILLA_NO_APROBADA',
        mensaje: `La plantilla de WhatsApp no existe o no ha sido aprobada por Meta: ${msg}`,
        reintentable: false,
        httpStatus: status,
      };
    }

    // 4. Rate limit / 429
    if (status === 429 || code === 131048 || code === 130429) {
      return {
        codigo: 'LIMITE_TASA_EXCEDIDO',
        mensaje: 'Límite de tasa de mensajes excedido en Meta. Reintento programado.',
        reintentable: true,
        httpStatus: status,
      };
    }

    // 5. Errores de servidor 5xx
    if (status >= 500) {
      return {
        codigo: 'ERROR_SERVIDOR_META',
        mensaje: `Error interno de Meta (${status}): ${msg}`,
        reintentable: true,
        httpStatus: status,
      };
    }

    // Error general no reintentable
    return {
      codigo: 'ERROR_META',
      mensaje: `Error de WhatsApp Cloud API (${code || status}): ${msg}`,
      reintentable: false,
      httpStatus: status,
    };
  }

  /**
   * Ejecuta una petición HTTP a Meta con timeout y reintentos con espera exponencial
   * ÚNICAMENTE en errores reintentables (5xx, 429, timeout de red).
   */
  public async ejecutarConReintentos(
    url: string,
    payload: any,
    telefonoEnmascarado: string,
  ): Promise<{ exito: boolean; data?: any; error?: MetaErrorParsed; intentos: number }> {
    let intento = 0;
    let esperaMs = 200;

    while (intento < this.maxReintentos) {
      intento++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const respuesta = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const texto = await respuesta.text();

        if (respuesta.ok) {
          let data: any = {};
          try {
            data = JSON.parse(texto);
          } catch {
            data = { raw: texto };
          }
          return { exito: true, data, intentos: intento };
        }

        const errorParsed = this.clasificarErrorMeta(respuesta.status, texto);

        // Si NO es reintentable, fallar de inmediato
        if (!errorParsed.reintentable || intento >= this.maxReintentos) {
          this.logger.warn(
            `Fallo en envío Meta a ${telefonoEnmascarado} (intento ${intento}/${this.maxReintentos}): [${errorParsed.codigo}] ${errorParsed.mensaje}`,
          );
          return { exito: false, error: errorParsed, intentos: intento };
        }

        // Si es reintentable (429, 5xx), esperar y reintentar
        this.logger.warn(
          `Error reintentable (${respuesta.status}) a ${telefonoEnmascarado}. Reintento ${intento} en ${esperaMs}ms...`,
        );
        await new Promise((r) => setTimeout(r, esperaMs));
        esperaMs *= 2;
      } catch (err: any) {
        clearTimeout(timeoutId);
        const esTimeout = err.name === 'AbortError';
        const msgError = esTimeout ? 'Timeout al contactar con Meta Graph API' : err.message;

        if (intento >= this.maxReintentos) {
          const errorParsed: MetaErrorParsed = {
            codigo: esTimeout ? 'TIMEOUT_META' : 'ERROR_RED_META',
            mensaje: msgError,
            reintentable: false,
          };
          this.logger.error(
            `Fallo definitivo de conexión a Meta para ${telefonoEnmascarado}: ${msgError}`,
          );
          return { exito: false, error: errorParsed, intentos: intento };
        }

        this.logger.warn(
          `Error de red al contactar Meta (${msgError}). Reintento ${intento} en ${esperaMs}ms...`,
        );
        await new Promise((r) => setTimeout(r, esperaMs));
        esperaMs *= 2;
      }
    }

    return {
      exito: false,
      error: { codigo: 'REINTENTOS_AGOTADOS', mensaje: 'Se agotaron los reintentos', reintentable: false },
      intentos: intento,
    };
  }

  async enviarTexto(
    telefono: string,
    texto: string,
    opciones?: OpcionesEnvio,
  ): Promise<ResultadoEnvioWhatsApp> {
    const telNorm = normalizarTelefono(telefono);
    const telHash = hashTelefono(telefono);
    const telMask = enmascararTelefono(telefono);

    if (!this.token || !this.phoneId) {
      return {
        exito: false,
        estado: 'FALLIDO',
        errorCodigo: 'SIN_CREDENCIALES_META',
        errorDetalle: 'Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_ID en la configuración',
      };
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneId}/messages`;
    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telNorm,
      type: 'text',
      text: { preview_url: false, body: texto },
    };

    if (opciones?.replyToWaMessageId) {
      payload.context = { message_id: opciones.replyToWaMessageId };
    }

    const resultado = await this.ejecutarConReintentos(url, payload, telMask);

    const waMessageId = resultado.data?.messages?.[0]?.id;
    const estado = resultado.exito ? 'ENVIADO' : 'FALLIDO';

    const registro = await this.prisma.whatsappMensaje.create({
      data: {
        direccion: 'SALIENTE',
        wa_message_id: waMessageId || null,
        telefono_enmascarado: telMask,
        telefono_hash: telHash,
        tipo: 'TEXTO',
        plantilla: null,
        estado,
        error_codigo: resultado.error?.codigo || null,
        error_detalle: resultado.error?.mensaje || null,
        pedido_id: this.parsearId(opciones?.pedidoId),
        conversacion_id: this.parsearId(opciones?.conversacionId),
      },
    });

    return {
      exito: resultado.exito,
      id: registro.id.toString(),
      waMessageId,
      estado,
      errorCodigo: resultado.error?.codigo,
      errorDetalle: resultado.error?.mensaje,
      reintentos: resultado.intentos,
    };
  }

  async enviarPlantilla(
    telefono: string,
    nombre: string,
    idioma: string,
    variables?: Record<string, string> | string[],
    opciones?: OpcionesEnvio,
  ): Promise<ResultadoEnvioWhatsApp> {
    const telNorm = normalizarTelefono(telefono);
    const telHash = hashTelefono(telefono);
    const telMask = enmascararTelefono(telefono);

    if (!this.token || !this.phoneId) {
      return {
        exito: false,
        estado: 'FALLIDO',
        errorCodigo: 'SIN_CREDENCIALES_META',
        errorDetalle: 'Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_ID en la configuración',
      };
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneId}/messages`;

    // Armar componentes de la plantilla según variables
    const components: any[] = [];
    if (variables) {
      let params: Array<{ type: 'text'; text: string }> = [];
      if (Array.isArray(variables)) {
        params = variables.map((v) => ({ type: 'text', text: String(v) }));
      } else {
        params = Object.values(variables).map((v) => ({ type: 'text', text: String(v) }));
      }
      if (params.length > 0) {
        components.push({
          type: 'body',
          parameters: params,
        });
      }
    }

    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telNorm,
      type: 'template',
      template: {
        name: nombre,
        language: { code: idioma || 'es' },
        components: components.length > 0 ? components : undefined,
      },
    };

    const resultado = await this.ejecutarConReintentos(url, payload, telMask);
    const waMessageId = resultado.data?.messages?.[0]?.id;
    const estado = resultado.exito ? 'ENVIADO' : 'FALLIDO';

    const registro = await this.prisma.whatsappMensaje.create({
      data: {
        direccion: 'SALIENTE',
        wa_message_id: waMessageId || null,
        telefono_enmascarado: telMask,
        telefono_hash: telHash,
        tipo: 'PLANTILLA',
        plantilla: nombre,
        estado,
        error_codigo: resultado.error?.codigo || null,
        error_detalle: resultado.error?.mensaje || null,
        pedido_id: this.parsearId(opciones?.pedidoId),
        conversacion_id: this.parsearId(opciones?.conversacionId),
      },
    });

    return {
      exito: resultado.exito,
      id: registro.id.toString(),
      waMessageId,
      estado,
      errorCodigo: resultado.error?.codigo,
      errorDetalle: resultado.error?.mensaje,
      reintentos: resultado.intentos,
    };
  }

  async enviarBotones(
    telefono: string,
    texto: string,
    botones: BotonAccion[],
    opciones?: OpcionesEnvio,
  ): Promise<ResultadoEnvioWhatsApp> {
    const telNorm = normalizarTelefono(telefono);
    const telHash = hashTelefono(telefono);
    const telMask = enmascararTelefono(telefono);

    if (!this.token || !this.phoneId) {
      return {
        exito: false,
        estado: 'FALLIDO',
        errorCodigo: 'SIN_CREDENCIALES_META',
        errorDetalle: 'Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_ID en la configuración',
      };
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneId}/messages`;

    // Meta permite máximo 3 botones en reply buttons
    const botonesFormateados = botones.slice(0, 3).map((btn) => ({
      type: 'reply',
      reply: {
        id: btn.id.slice(0, 256),
        title: btn.titulo.slice(0, 20),
      },
    }));

    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telNorm,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: texto.slice(0, 1024) },
        action: { buttons: botonesFormateados },
      },
    };

    if (opciones?.replyToWaMessageId) {
      payload.context = { message_id: opciones.replyToWaMessageId };
    }

    const resultado = await this.ejecutarConReintentos(url, payload, telMask);
    const waMessageId = resultado.data?.messages?.[0]?.id;
    const estado = resultado.exito ? 'ENVIADO' : 'FALLIDO';

    const registro = await this.prisma.whatsappMensaje.create({
      data: {
        direccion: 'SALIENTE',
        wa_message_id: waMessageId || null,
        telefono_enmascarado: telMask,
        telefono_hash: telHash,
        tipo: 'BOTON',
        plantilla: null,
        estado,
        error_codigo: resultado.error?.codigo || null,
        error_detalle: resultado.error?.mensaje || null,
        pedido_id: this.parsearId(opciones?.pedidoId),
        conversacion_id: this.parsearId(opciones?.conversacionId),
      },
    });

    return {
      exito: resultado.exito,
      id: registro.id.toString(),
      waMessageId,
      estado,
      errorCodigo: resultado.error?.codigo,
      errorDetalle: resultado.error?.mensaje,
      reintentos: resultado.intentos,
    };
  }

  async enviarLista(
    telefono: string,
    texto: string,
    botonTexto: string,
    filas: FilaLista[],
    opciones?: OpcionesEnvio,
  ): Promise<ResultadoEnvioWhatsApp> {
    const telNorm = normalizarTelefono(telefono);
    const telHash = hashTelefono(telefono);
    const telMask = enmascararTelefono(telefono);

    if (!this.token || !this.phoneId) {
      return {
        exito: false,
        estado: 'FALLIDO',
        errorCodigo: 'SIN_CREDENCIALES_META',
        errorDetalle: 'Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_ID en la configuración',
      };
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneId}/messages`;

    // Meta permite máximo 10 filas en listas interactivas
    const filasFormateadas = filas.slice(0, 10).map((fila) => ({
      id: fila.id.slice(0, 200),
      title: fila.titulo.slice(0, 24),
      ...(fila.descripcion ? { description: fila.descripcion.slice(0, 72) } : {}),
    }));

    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telNorm,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: texto.slice(0, 1024) },
        action: {
          button: (botonTexto || 'Ver opciones').slice(0, 20),
          sections: [
            {
              title: (opciones?.tituloSeccion || 'Opciones').slice(0, 24),
              rows: filasFormateadas,
            },
          ],
        },
      },
    };

    if (opciones?.replyToWaMessageId) {
      payload.context = { message_id: opciones.replyToWaMessageId };
    }

    const resultado = await this.ejecutarConReintentos(url, payload, telMask);
    const waMessageId = resultado.data?.messages?.[0]?.id;
    const estado = resultado.exito ? 'ENVIADO' : 'FALLIDO';

    const registro = await this.prisma.whatsappMensaje.create({
      data: {
        direccion: 'SALIENTE',
        wa_message_id: waMessageId || null,
        telefono_enmascarado: telMask,
        telefono_hash: telHash,
        tipo: 'LISTA',
        plantilla: null,
        estado,
        error_codigo: resultado.error?.codigo || null,
        error_detalle: resultado.error?.mensaje || null,
        pedido_id: this.parsearId(opciones?.pedidoId),
        conversacion_id: this.parsearId(opciones?.conversacionId),
      },
    });

    return {
      exito: resultado.exito,
      id: registro.id.toString(),
      waMessageId,
      estado,
      errorCodigo: resultado.error?.codigo,
      errorDetalle: resultado.error?.mensaje,
      reintentos: resultado.intentos,
    };
  }

  async marcarLeido(waMessageId: string): Promise<boolean> {
    if (!this.token || !this.phoneId) return false;

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: waMessageId,
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await this.prisma.whatsappMensaje.updateMany({
          where: { wa_message_id: waMessageId },
          data: { estado: 'LEIDO' },
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
