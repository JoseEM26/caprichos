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
  pedidoId?: bigint | string;
  conversacionId?: bigint | string;
  replyToWaMessageId?: string;
  plantillaNombre?: string;
  tituloSeccion?: string;
}

export interface ResultadoEnvioWhatsApp {
  exito: boolean;
  id?: string;
  waMessageId?: string;
  estado: 'ENVIADO' | 'SIMULADO' | 'FALLIDO';
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

  marcarLeido(waMessageId: string): Promise<boolean>;

  estaConectado(): EstadoConexionWhatsApp;
}

export const WHATSAPP_MENSAJERIA_PUERTO = 'WHATSAPP_MENSAJERIA_PUERTO';
