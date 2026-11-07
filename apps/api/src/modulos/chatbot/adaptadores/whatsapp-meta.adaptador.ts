import { CargaCarrusel, carruselEnviable, payloadInteractivoCarrusel } from '../servicios/carrusel.util';
import { createHash } from 'crypto';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { CatalogoService } from '../../catalogo/catalogo.service';
import { jpegProductoWhatsApp } from '../../catalogo/imagen-whatsapp';
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
import {
  causaPlantillaMeta,
  detalleDeErrorMeta,
  sanearDetalleMeta,
  sanearVariablePlantilla,
} from '../utilidades/meta-errores.util';

export interface MetaErrorParsed {
  codigo: string;
  mensaje: string;
  reintentable: boolean;
  httpStatus?: number;
  /** Código numérico de Meta (p. ej. 132012), si Meta lo mandó. */
  metaCodigo?: number;
  /** Texto original de Meta (mensaje y detalles), saneado y máximo 500 caracteres. */
  detalleOriginal?: string;
}

export interface DestinatarioMeta {
  recipient_type: 'individual';
  recipient?: string;
  to?: string;
}

/**
 * Función pura que construye el par de campos de destinatario correcto para Meta WhatsApp Cloud API:
 * - BSUID (PE.xxxx o con prefijo wa-user:) -> {"recipient_type": "individual", "recipient": "<BSUID>"}
 * - Número E.164 (con o sin +) -> {"recipient_type": "individual", "to": "<numero sin +>"}
 * - Vacío -> {"recipient_type": "individual", "to": ""}
 */
export function construirDestinatario(identificador?: string | null): DestinatarioMeta {
  const raw = String(identificador ?? '').trim();
  const sinPrefijo = raw.replace(/^wa-user:/i, '').trim();
  const rawDest = sinPrefijo.replace(/^\+/, '').trim();

  // Si contiene punto o empieza con dos letras y punto (ej. PE.1048174911395155, PE.123)
  if (rawDest.includes('.') || /^[A-Za-z]{2}\./i.test(rawDest)) {
    return {
      recipient_type: 'individual',
      recipient: rawDest,
    };
  }

  // Número E.164 o vacío
  const cleanNumber = normalizarTelefono(rawDest) || rawDest.replace(/\D/g, '');
  return {
    recipient_type: 'individual',
    to: cleanNumber,
  };
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
    @Optional() private readonly catalogo?: CatalogoService,
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

  /** Numero emisor: el de la conversacion si es valido (solo cifras); si no, el WHATSAPP_PHONE_ID de siempre. */
  private phoneDe(opciones?: { phoneNumberId?: string }): string {
    const p = (opciones?.phoneNumberId ?? '').trim();
    return /^[0-9]{5,25}$/.test(p) ? p : this.phoneId;
  }

  /**
   * Fija el numero emisor de este envio. Orden: el que pidio quien llama; el de la conversacion
   * (por conversacionId o por telefono: cubre bot, Mensajes, outbox, reintentos y avisos); si no hay, el de siempre.
   * Un solo punto para todos los emisores. Un fallo de lectura nunca rompe el envio.
   */
  private async conNumero(opciones?: OpcionesEnvio, telefono?: string): Promise<OpcionesEnvio | undefined> {
    if (opciones?.phoneNumberId) return opciones;
    try {
      const convId = this.parsearId(opciones?.conversacionId);
      const tel = telefono ? [telefono, normalizarTelefono(telefono)].filter(Boolean) : [];
      if (!convId && !tel.length) return opciones;
      const c = await this.prisma.conversacion.findFirst({
        where: convId ? { id: convId } : { telefono: { in: tel as string[] } },
        select: { phone_number_id: true },
      });
      return c?.phone_number_id ? { ...opciones, phoneNumberId: c.phone_number_id } : opciones;
    } catch (e: any) {
      this.logger.warn(`No se pudo leer el numero de la conversacion: ${e?.message}`);
      return opciones;
    }
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
   * Identifica si el error es reintentable (429, 5xx) o definitivo (24h, número inválido, plantilla rechazada, BSUID no permitido).
   */
  public clasificarErrorMeta(
    status: number,
    bodyText: string,
    esBsuid?: boolean,
  ): MetaErrorParsed {
    let parsed: any = null;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      // No es JSON
    }

    const errorObj = parsed?.error || {};
    const code = errorObj.code;
    const msg = String(errorObj.message || bodyText);
    const details = String(errorObj.error_data?.details || '');
    const original = [msg, details].filter(Boolean).join(' | ');
    const metaCodigo = typeof code === 'number' ? code : undefined;

    const resultado = this.clasificarCausa(status, code, msg, details, esBsuid);
    return { ...resultado, metaCodigo, detalleOriginal: sanearDetalleMeta(original) };
  }

  private clasificarCausa(
    status: number,
    code: any,
    msg: string,
    details: string,
    esBsuid?: boolean,
  ): Omit<MetaErrorParsed, 'metaCodigo' | 'detalleOriginal'> {
    const fullLower = `${msg} ${details}`.toLowerCase();

    // 00. Plantillas (132000-132016): antes que la regla de BSUID, para que un error de formato de variable
    // no se confunda con un identificador rechazado
    const causaPlantilla = typeof code === 'number' ? causaPlantillaMeta(code, fullLower) : null;
    if (causaPlantilla) {
      return { codigo: causaPlantilla.codigo, mensaje: causaPlantilla.mensaje, reintentable: false, httpStatus: status };
    }

    // 1. Destinatario no verificado en el número de prueba de Meta (131030 o allowed list). Va antes que la
    // regla de BSUID: su texto dice «Recipient phone number not in allowed list» y se confundía con un BSUID.
    if (
      code === 131030 ||
      fullLower.includes('allowed list') ||
      fullLower.includes('recipient is not in')
    ) {
      return {
        codigo: 'DESTINATARIO_NO_VERIFICADO',
        mensaje: 'Este numero no esta autorizado en el numero de prueba de Meta',
        reintentable: false,
        httpStatus: status,
      };
    }

    // 1.b Parámetro inválido (código 100) con destinatario normal: es un error del contenido (botón o lista fuera de
    // límite, media, etc.), no del identificador. Solo con BSUID real se pide el número de celular.
    if (code === 100 && !esBsuid) {
      return {
        codigo: 'PARAMETRO_INVALIDO',
        mensaje: `Meta rechazó un dato del mensaje (parámetro inválido): ${msg}`,
        reintentable: false,
        httpStatus: status,
      };
    }

    // 0. BSUID no permitido o rechazado por Meta (código 100, 131009 o detalles de recipient/formato)
    if (
      esBsuid ||
      fullLower.includes('recipient') ||
      fullLower.includes('bsuid') ||
      code === 100
    ) {
      if (
        code === 100 ||
        code === 131009 ||
        code === 131026 ||
        fullLower.includes('recipient') ||
        fullLower.includes('bsuid') ||
        fullLower.includes('parameter') ||
        fullLower.includes('format')
      ) {
        return {
          codigo: 'BSUID_NO_PERMITIDO',
          mensaje:
            'Meta no permite escribir a este contacto por su identificador. Pidele su numero de celular.',
          reintentable: false,
          httpStatus: status,
        };
      }
    }

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

    // 4. Rate limit / 429 (131056 demasiados mensajes al mismo número, 80007 límite de la cuenta): se reintenta
    if (status === 429 || [131048, 130429, 131056, 80007].includes(code)) {
      return {
        codigo: 'LIMITE_TASA_EXCEDIDO',
        mensaje: 'Límite de tasa de mensajes excedido en Meta. Reintento programado.',
        reintentable: true,
        httpStatus: status,
      };
    }

    // 5. Errores de servidor 5xx y fallos pasajeros de Meta con 4xx (131000 error genérico, 131016 servicio no disponible)
    if (status >= 500 || code === 131000 || code === 131016) {
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

        const esBsuid = Boolean(payload && 'recipient' in payload);
        const errorParsed = this.clasificarErrorMeta(respuesta.status, texto, esBsuid);

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
    opciones = await this.conNumero(opciones, telefono);
    const destinatario = construirDestinatario(telefono);
    const telHash = hashTelefono(telefono);
    const telMask = enmascararTelefono(telefono);

    if (!this.token || !this.phoneDe(opciones)) {
      return {
        exito: false,
        estado: 'FALLIDO',
        errorCodigo: 'SIN_CREDENCIALES_META',
        errorDetalle: 'Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_ID en la configuración',
      };
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneDe(opciones)}/messages`;
    const payload: any = {
      messaging_product: 'whatsapp',
      ...destinatario,
      type: 'text',
      text: { preview_url: false, body: texto.slice(0, 4096) }, // tope de Meta: más largo da error 100
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
        error_detalle: detalleDeErrorMeta(resultado.error) || null,
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
      errorDetalle: detalleDeErrorMeta(resultado.error),
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
    opciones = await this.conNumero(opciones, telefono);
    const destinatario = construirDestinatario(telefono);
    const telHash = hashTelefono(telefono);
    const telMask = enmascararTelefono(telefono);

    if (!this.token || !this.phoneDe(opciones)) {
      return {
        exito: false,
        estado: 'FALLIDO',
        errorCodigo: 'SIN_CREDENCIALES_META',
        errorDetalle: 'Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_ID en la configuración',
      };
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneDe(opciones)}/messages`;

    // Armar componentes de la plantilla según variables
    const components: any[] = [];
    if (variables) {
      let params: Array<{ type: 'text'; text: string }> = [];
      if (Array.isArray(variables)) {
        params = variables.map((v) => ({ type: 'text', text: sanearVariablePlantilla(v) }));
      } else {
        params = Object.values(variables).map((v) => ({ type: 'text', text: sanearVariablePlantilla(v) }));
      }
      if (params.length > 0) {
        components.push({
          type: 'body',
          parameters: params,
        });
      }
    }
    // Plantillas AUTHENTICATION con botón «copiar código»: Meta exige el código también en el botón.
    if (opciones?.botonCodigo) {
      components.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: sanearVariablePlantilla(opciones.botonCodigo) }],
      });
    }
    // Botones de respuesta rápida (encuesta): Meta devuelve el payload al tocarlos; index es la posición del botón en la plantilla
    (opciones?.botonesRespuesta ?? []).forEach((payloadBoton, indice) => {
      components.push({
        type: 'button',
        sub_type: 'quick_reply',
        index: String(indice),
        parameters: [{ type: 'payload', payload: payloadBoton }],
      });
    });

    const payload: any = {
      messaging_product: 'whatsapp',
      ...destinatario,
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
        error_detalle: detalleDeErrorMeta(resultado.error) || null,
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
      errorDetalle: detalleDeErrorMeta(resultado.error),
      reintentos: resultado.intentos,
    };
  }

  async enviarBotones(
    telefono: string,
    texto: string,
    botones: BotonAccion[],
    opciones?: OpcionesEnvio,
  ): Promise<ResultadoEnvioWhatsApp> {
    opciones = await this.conNumero(opciones, telefono);
    const destinatario = construirDestinatario(telefono);
    const telHash = hashTelefono(telefono);
    const telMask = enmascararTelefono(telefono);

    if (!this.token || !this.phoneDe(opciones)) {
      return {
        exito: false,
        estado: 'FALLIDO',
        errorCodigo: 'SIN_CREDENCIALES_META',
        errorDetalle: 'Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_ID en la configuración',
      };
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneDe(opciones)}/messages`;

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
      ...destinatario,
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
        error_detalle: detalleDeErrorMeta(resultado.error) || null,
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
      errorDetalle: detalleDeErrorMeta(resultado.error),
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
    opciones = await this.conNumero(opciones, telefono);
    const destinatario = construirDestinatario(telefono);
    const telHash = hashTelefono(telefono);
    const telMask = enmascararTelefono(telefono);

    if (!this.token || !this.phoneDe(opciones)) {
      return {
        exito: false,
        estado: 'FALLIDO',
        errorCodigo: 'SIN_CREDENCIALES_META',
        errorDetalle: 'Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_ID en la configuración',
      };
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneDe(opciones)}/messages`;

    // Meta permite máximo 10 filas en listas interactivas
    const filasFormateadas = filas.slice(0, 10).map((fila) => ({
      id: fila.id.slice(0, 200),
      title: fila.titulo.slice(0, 24),
      ...(fila.descripcion ? { description: fila.descripcion.slice(0, 72) } : {}),
    }));

    const payload: any = {
      messaging_product: 'whatsapp',
      ...destinatario,
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
        error_detalle: detalleDeErrorMeta(resultado.error) || null,
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
      errorDetalle: detalleDeErrorMeta(resultado.error),
      reintentos: resultado.intentos,
    };
  }

  /** Media Meta conserva 30 días; se renueva a los 25. */
  private static readonly VIDA_MEDIA_MS = 25 * 24 * 3600 * 1000;

  /** Sube un JPEG a la Media API de Meta y devuelve el media id (null si falla). */
  async subirMedia(jpg: Buffer, phoneNumberId?: string): Promise<string | null> {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', 'image/jpeg');
    form.append('file', new Blob([new Uint8Array(jpg)], { type: 'image/jpeg' }), 'imagen.jpg');
    try {
      const r = await fetch(`https://graph.facebook.com/${this.apiVersion}/${this.phoneDe({ phoneNumberId })}/media`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}` },
        body: form,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const data: any = await r.json().catch(() => ({}));
      if (r.ok && data?.id) return String(data.id);
      this.logger.warn(`Subida de media rechazada (${r.status}): ${JSON.stringify(data?.error ?? data).slice(0, 200)}`);
    } catch (e: any) {
      this.logger.warn(`Subida de media falló: ${e?.message}`);
    }
    return null;
  }

  /** Media id de la imagen de una tarjeta, con caché en `parametro` por (producto + sha1 del JPEG). Null = usar link. */
  private async mediaIdTarjeta(imagenUrl: string | null, phoneNumberId?: string): Promise<string | null> {
    const productoId = /\/carta\/productos\/(\d+)\/imagen-wa\.jpg/.exec(imagenUrl ?? '')?.[1];
    if (!productoId || !this.catalogo) return null;
    try {
      const foto = await this.catalogo.fotoProductoVisible(productoId);
      if (!foto) return null;
      const jpg = await jpegProductoWhatsApp(productoId, foto.nombre, foto.ruta, this.configService.get<string>('UPLOADS_DIR') || './data/uploads');
      // Los media id van ligados al numero que sube: otro numero usa su propia cache y subida.
      const phone = this.phoneDe({ phoneNumberId });
      const sufijo = phone === this.phoneId ? '' : `:${phone}`;
      const clave = `wa_media:${productoId}:${createHash('sha1').update(jpg).digest('hex')}${sufijo}`;
      const previo: any = (await this.prisma.parametro.findUnique({ where: { clave } }))?.valor;
      if (previo?.mediaId && Date.now() - Number(previo.en) < WhatsAppMetaAdaptador.VIDA_MEDIA_MS) return previo.mediaId;
      const mediaId = await this.subirMedia(jpg, phoneNumberId);
      if (mediaId) {
        const valor = { mediaId, en: Date.now() };
        await this.prisma.parametro.upsert({ where: { clave }, create: { clave, valor }, update: { valor } });
      }
      return mediaId;
    } catch (e: any) {
      this.logger.warn(`Media de la tarjeta no disponible: ${e?.message}`);
      return null;
    }
  }

  /** Media ids de todas las tarjetas, 4 subidas a la vez. */
  private async mediaIdsCarrusel(carga: CargaCarrusel, phoneNumberId?: string): Promise<Array<string | null>> {
    const ids: Array<string | null> = new Array(carga.tarjetas.length).fill(null);
    let sig = 0;
    const worker = async () => {
      while (sig < ids.length) {
        const i = sig++;
        ids[i] = await this.mediaIdTarjeta(carga.tarjetas[i].imagenUrl, phoneNumberId);
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, ids.length) }, worker));
    return ids;
  }

  /** Borra del caché los media ids usados (Meta pudo haberlos descartado). */
  private async olvidarMedia(carga: CargaCarrusel): Promise<void> {
    const prefijos = carga.tarjetas
      .map((t) => /\/carta\/productos\/(\d+)\//.exec(t.imagenUrl ?? '')?.[1])
      .filter(Boolean)
      .map((id) => `wa_media:${id}:`);
    await Promise.all(
      prefijos.map((p) => this.prisma.parametro.deleteMany({ where: { clave: { startsWith: p } } }).catch(() => undefined)),
    );
  }

  async enviarCarrusel(telefono: string, carga: CargaCarrusel, opciones?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp> {
    opciones = await this.conNumero(opciones, telefono);
    const destinatario = construirDestinatario(telefono);
    const telMask = enmascararTelefono(telefono);

    if (!this.token || !this.phoneDe(opciones)) {
      return {
        exito: false,
        estado: 'FALLIDO',
        errorCodigo: 'SIN_CREDENCIALES_META',
        errorDetalle: 'Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_ID en la configuración',
      };
    }
    // Meta baja las imágenes desde su servidor: sin URL HTTPS pública no hay carrusel (el llamador cae a la lista)
    if (!carruselEnviable(carga)) {
      return { exito: false, estado: 'FALLIDO', errorCodigo: 'CARRUSEL_SIN_URL_PUBLICA', errorDetalle: 'Las tarjetas necesitan imagen HTTPS pública' };
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneDe(opciones)}/messages`;
    const armar = (ids: Array<string | null>) => {
      const payload: any = {
        messaging_product: 'whatsapp',
        ...destinatario,
        type: 'interactive',
        interactive: payloadInteractivoCarrusel(carga, ids),
      };
      if (opciones?.replyToWaMessageId) payload.context = { message_id: opciones.replyToWaMessageId };
      return payload;
    };
    const marcar = (ids: Array<string | null>) => carga.tarjetas.forEach((t, i) => (t.via = ids[i] ? 'id' : 'link'));

    // Imagen por media id subido (no depende de que Meta descargue el link); sin subida, link
    let ids = await this.mediaIdsCarrusel(carga, opciones?.phoneNumberId);
    marcar(ids);
    let resultado = await this.ejecutarConReintentos(url, armar(ids), telMask);
    if (!resultado.exito && ids.some(Boolean)) {
      // ponytail: un id vencido o rechazado se descarta y se reintenta una vez con links
      this.logger.warn(`Carrusel con media ids rechazado (${resultado.error?.codigo}); se reintenta con links`);
      await this.olvidarMedia(carga);
      ids = ids.map(() => null);
      marcar(ids);
      resultado = await this.ejecutarConReintentos(url, armar(ids), telMask);
    }
    const waMessageId = resultado.data?.messages?.[0]?.id;
    const estado = resultado.exito ? 'ENVIADO' : 'FALLIDO';

    const registro = await this.prisma.whatsappMensaje.create({
      data: {
        direccion: 'SALIENTE',
        wa_message_id: waMessageId || null,
        telefono_enmascarado: telMask,
        telefono_hash: hashTelefono(telefono),
        tipo: 'BOTON',
        plantilla: null,
        estado,
        error_codigo: resultado.error?.codigo || null,
        error_detalle: detalleDeErrorMeta(resultado.error) || null,
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
      errorDetalle: detalleDeErrorMeta(resultado.error),
      reintentos: resultado.intentos,
    };
  }

  async enviarImagen(
    telefono: string,
    urlOArchivo: string,
    caption?: string,
    opciones?: OpcionesEnvio,
  ): Promise<ResultadoEnvioWhatsApp> {
    opciones = await this.conNumero(opciones, telefono);
    const destinatario = construirDestinatario(telefono);
    const telHash = hashTelefono(telefono);
    const telMask = enmascararTelefono(telefono);

    if (!this.token || !this.phoneDe(opciones)) {
      return {
        exito: false,
        estado: 'FALLIDO',
        errorCodigo: 'SIN_CREDENCIALES_META',
        errorDetalle: 'Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_ID en la configuración',
      };
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneDe(opciones)}/messages`;
    const esUrl = urlOArchivo.startsWith('http://') || urlOArchivo.startsWith('https://');

    const payload: any = {
      messaging_product: 'whatsapp',
      ...destinatario,
      type: 'image',
      image: {
        ...(esUrl ? { link: urlOArchivo } : { id: urlOArchivo }),
        ...(caption ? { caption: caption.slice(0, 1024) } : {}),
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
        tipo: 'IMAGEN',
        plantilla: null,
        estado,
        error_codigo: resultado.error?.codigo || null,
        error_detalle: detalleDeErrorMeta(resultado.error) || null,
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
      errorDetalle: detalleDeErrorMeta(resultado.error),
      reintentos: resultado.intentos,
    };
  }

  async marcarLeido(waMessageId: string, phoneNumberId?: string): Promise<boolean> {
    const opciones = { phoneNumberId };
    if (!this.token || !this.phoneDe(opciones)) return false;

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneDe(opciones)}/messages`;
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
