import { rolDeTrabajo } from '../tipos/etiquetas.js';
import type { PayloadEtiqueta, TipoEtiqueta } from '../tipos/etiquetas.js';
import { generarBytesTrabajo } from './generadorTspl.js';
import { generarTicketEscPos, generarComandaSalonEscPos, generarCierreEscPos } from './generadorTicket.js';
import { generarPruebaEtiqueta, generarPruebaTicket } from './prueba.js';
import { bytesABase64 } from './bytes.js';
import type { FormatoEtiqueta } from './formato.js';

/**
 * UNA sola fuente de verdad del impreso: dado un trabajo y cómo está montada la impresora de ESA PC, produce los bytes
 * exactos que reciben la etiquetera (TSPL) o la ticketera (ESC/POS). El servidor lo usa para mandar `comandos` al programa
 * de impresión (que solo los envía) y el programa lo usa como respaldo si no llegan.
 */
export type FormatoComandos = 'TSPL' | 'ESCPOS';

/** Tope de lo que el programa acepta como `comandos` (un ticket normal pesa unos pocos KB). */
export const LIMITE_COMANDOS_BYTES = 2 * 1024 * 1024;
export const FORMATOS_COMANDOS: readonly FormatoComandos[] = ['TSPL', 'ESCPOS'];

/** Lo que el programa declara de sí y de su impresora al pedir trabajos (aditivo: uno viejo no lo manda). */
export interface CapacidadesAgente {
  /** Sabe enviar `comandos` ya armados por el servidor. */
  comandosServidor?: boolean;
  /** 32 = papel de 58 mm; 48 = 80 mm. */
  ticketColumnas?: number;
  /** Rollo, gap, dirección y orientación de la etiquetera de esa PC. */
  etiqueta?: Partial<FormatoEtiqueta>;
}

/** Los comandos de un trabajo tal como viajan: base64 de los bytes + qué lenguaje son. */
export interface ComandosTrabajo {
  formato: FormatoComandos;
  base64: string;
}

export interface OpcionesComandos {
  /** Fecha y hora ya escritas («16/11/2026 10:30») para la hoja de prueba; sin ella, la del equipo que genera. */
  fechaTexto?: string;
}

function columnasValidas(c: unknown): number {
  return typeof c === 'number' && Number.isInteger(c) && c >= 20 && c <= 80 ? c : 48;
}

/** Bytes del trabajo para la impresora de su rol, con el diseño vigente. Lanza si el payload no se puede armar. */
export function generarComandosTrabajo(
  tipo: string,
  payload: unknown,
  copia: boolean,
  cap: CapacidadesAgente = {},
  opciones: OpcionesComandos = {},
): { formato: FormatoComandos; bytes: Uint8Array } {
  const rol = rolDeTrabajo(tipo);
  const columnas = columnasValidas(cap.ticketColumnas);
  const p: any = payload ?? {};
  const formato: FormatoComandos = rol === 'TICKETERA' ? 'ESCPOS' : 'TSPL';
  const fecha = opciones.fechaTexto ?? new Date();
  let bytes: Uint8Array;
  if (p.prueba?.impresoraId) {
    // Hoja de prueba dirigida a una impresora concreta: nombre y marca vienen en el trabajo
    const nombre = String(p.prueba.nombre ?? p.prueba.impresoraId);
    bytes =
      rol === 'TICKETERA'
        ? generarPruebaTicket(nombre, rol, columnas, fecha, p.prueba.marca)
        : generarPruebaEtiqueta(nombre, rol, cap.etiqueta ?? {}, fecha, p.prueba.marca);
  } else if (tipo === 'TICKET_PAGO') bytes = generarTicketEscPos(p, columnas);
  else if (tipo === 'TICKET_CIERRE') bytes = generarCierreEscPos(p, columnas);
  else if (tipo === 'TICKET_COMANDA_SALON' || tipo === 'TICKET_COMANDA_AREA') bytes = generarComandaSalonEscPos(p, columnas);
  else bytes = generarBytesTrabajo(tipo as TipoEtiqueta, p as PayloadEtiqueta, copia, cap.etiqueta);
  return { formato, bytes };
}

/** Igual, listo para viajar en el trabajo (base64). */
export function comandosDeTrabajo(tipo: string, payload: unknown, copia: boolean, cap: CapacidadesAgente = {}, opciones: OpcionesComandos = {}): ComandosTrabajo {
  const { formato, bytes } = generarComandosTrabajo(tipo, payload, copia, cap, opciones);
  return { formato, base64: bytesABase64(bytes) };
}

/**
 * Valida unos `comandos` recibidos (formato conocido, base64, tamaño razonable) y los devuelve como bytes;
 * null si no sirven (el programa usa entonces su diseño de respaldo). Nunca escribe nada de su contenido en logs.
 */
export function validarComandos(c: unknown): { formato: FormatoComandos; bytes: Uint8Array } | null {
  if (!c || typeof c !== 'object') return null;
  const { formato, base64 } = c as Partial<ComandosTrabajo>;
  if (!FORMATOS_COMANDOS.includes(formato as FormatoComandos) || typeof base64 !== 'string' || base64.length === 0) return null;
  if (base64.length > Math.ceil((LIMITE_COMANDOS_BYTES * 4) / 3) + 4) return null;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 !== 0) return null;
  const bin = atob(base64);
  if (bin.length === 0 || bin.length > LIMITE_COMANDOS_BYTES) return null;
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { formato: formato as FormatoComandos, bytes };
}
