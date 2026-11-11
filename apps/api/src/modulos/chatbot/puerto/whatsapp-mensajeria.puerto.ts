import type { CargaCarrusel } from '../servicios/carrusel.util';

export interface BotonAccion {
  id: string;
  titulo: string;
}

export interface FilaLista {
  id: string;
  titulo: string;
  descripcion?: string;
}

export interface OpcionesEnvio {
  /** Numero de WhatsApp Business desde el que se envia (el que recibio al cliente). Sin el, el WHATSAPP_PHONE_ID. */
  phoneNumberId?: string;
  pedidoId?: bigint | string;
  conversacionId?: bigint | string;
  replyToWaMessageId?: string;
  plantillaNombre?: string;
  tituloSeccion?: string;
  /** Código para el botón «copiar código» de una plantilla AUTHENTICATION. Solo lo usa Meta. */
  botonCodigo?: string;
  /** Payloads de los botones de respuesta rápida de la plantilla, en orden (index 0, 1, 2). Solo plantillas con botones. */
  botonesRespuesta?: string[];
}

export interface ResultadoEnvioWhatsApp {
  exito: boolean;
  id?: string;
  waMessageId?: string;
  /** OMITIDO: el guardia de salida no lo mandó (número propio del negocio o bloqueado); nunca se reintenta. */
  estado: 'ENVIADO' | 'SIMULADO' | 'FALLIDO' | 'OMITIDO';
  errorCodigo?: string;
  errorDetalle?: string;
  reintentos?: number;
}

export interface EstadoConexionWhatsApp {
  conectado: boolean;
  modo: 'meta' | 'simulado';
  razon?: string;
}

export interface WhatsAppMensajeriaPuerto {
  enviarTexto(
    telefono: string,
    texto: string,
    opciones?: OpcionesEnvio,
  ): Promise<ResultadoEnvioWhatsApp>;

  enviarPlantilla(
    telefono: string,
    nombre: string,
    idioma: string,
    variables?: Record<string, string> | string[],
    opciones?: OpcionesEnvio,
  ): Promise<ResultadoEnvioWhatsApp>;

  enviarBotones(
    telefono: string,
    texto: string,
    botones: BotonAccion[],
    opciones?: OpcionesEnvio,
  ): Promise<ResultadoEnvioWhatsApp>;

  enviarLista(
    telefono: string,
    texto: string,
    botonTexto: string,
    filas: FilaLista[],
    opciones?: OpcionesEnvio,
  ): Promise<ResultadoEnvioWhatsApp>;

  /** Carrusel interactivo (2 a 10 tarjetas con imagen). Solo dentro de la ventana de 24 h. */
  enviarCarrusel(telefono: string, carga: CargaCarrusel, opciones?: OpcionesEnvio): Promise<ResultadoEnvioWhatsApp>;

  enviarImagen(
    telefono: string,
    urlOArchivo: string,
    caption?: string,
    opciones?: OpcionesEnvio,
  ): Promise<ResultadoEnvioWhatsApp>;

  /** Envía un documento ya subido a la Media API (por media id, nunca por link: Meta lo rechaza con 131000). */
  enviarDocumento(
    telefono: string,
    mediaId: string,
    nombreArchivo: string,
    caption?: string,
    opciones?: OpcionesEnvio,
  ): Promise<ResultadoEnvioWhatsApp>;

  /** Sube un archivo (foto o documento) a la Media API de Meta y devuelve su media id (solo el adaptador real; null si falla). */
  subirMedia?(archivo: Buffer, mime?: string, phoneNumberId?: string, nombreArchivo?: string): Promise<string | null>;

  marcarLeido(waMessageId: string, phoneNumberId?: string): Promise<boolean>;

  estaConectado(): EstadoConexionWhatsApp;
}

export const WHATSAPP_MENSAJERIA_PUERTO = 'WHATSAPP_MENSAJERIA_PUERTO';
