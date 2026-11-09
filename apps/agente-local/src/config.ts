import { join } from 'path';
import { formatoDesdeConfig } from './tspl/formato';
import type { FormatoEtiqueta } from './tspl/formato';

export interface DestinoImpresora {
  /** Nombre de la impresora en Windows o ruta del dispositivo en Linux (empieza con /). */
  destino: string;
}

/** Archivo de configuración que deja el asistente de vinculación (sin secretos en el repo). */
export interface ArchivoConfiguracion {
  apiUrl?: string;
  agenteKey?: string;
  /** Última llave tomada del config.json que viene junto al .exe (para no pisar un vínculo más nuevo). */
  llaveDeExe?: string;
  /** UUID de esta PC (solo si el sistema no da un id de máquina): se genera una vez y se conserva. */
  equipoUid?: string;
  etiquetera?: string;
  ticketera?: string;
  /** Identidad (MFG MDL|serie) de la impresora de cada rol: sobrevive a que /dev/usb/lpN cambie de número. */
  etiqueteraId?: string;
  ticketeraId?: string;
  ticketColumnas?: number;
  /** Tamaño del rollo y orientación del sticker (ver FormatoEtiqueta). */
  etiqueta?: Partial<FormatoEtiqueta>;
}

export interface ConfiguracionAgente {
  etiquetera?: string;
  ticketera?: string;
  /** 32 columnas = papel de 58 mm; 48 = 80 mm. */
  ticketColumnas: number;
  /** Formato del sticker: apaisado 101.6 x 63.5 mm por defecto. */
  etiqueta: FormatoEtiqueta;
  apiUrl: string;
  agenteKey: string;
  impresoraRuta: string;
  intervaloConsultaMs: number;
  intervaloLatidoMs: number;
  maxTrabajosPorLote: number;
  version: string;
}

// Inyectadas por esbuild --define al empaquetar (scripts empaquetar:*); sin eso (tests, tsc) valen el valor de desarrollo.
declare const __AGENTE_VERSION__: string | undefined;
declare const __AGENTE_COMMIT__: string | undefined;
export const VERSION_NUMERO = typeof __AGENTE_VERSION__ === 'string' ? __AGENTE_VERSION__ : '0.1.0-dev';
export const COMMIT_AGENTE = typeof __AGENTE_COMMIT__ === 'string' ? __AGENTE_COMMIT__ : 'dev';
/** Lo que viaja en el latido y se ve en la web: «0.1.57 (ab12cd3)». */
export const VERSION_AGENTE = COMMIT_AGENTE === 'dev' ? VERSION_NUMERO : `${VERSION_NUMERO} (${COMMIT_AGENTE})`;
/** Línea de presentación del programa. */
export const LINEA_VERSION = `Programa de impresión Caprichos v${VERSION_NUMERO} (${COMMIT_AGENTE})`;

export function rutaArchivoConfiguracion(env: NodeJS.ProcessEnv = process.env): string {
  if (env.AGENTE_CONFIG) return env.AGENTE_CONFIG;
  if (env.APPDATA) return join(env.APPDATA, 'CaprichosAgente', 'config.json');
  // Linux: ~/.config/CaprichosAgente/config.json (respeta XDG_CONFIG_HOME)
  const base = env.XDG_CONFIG_HOME || join(env.HOME || env.USERPROFILE || '.', '.config');
  return join(base, 'CaprichosAgente', 'config.json');
}

export function obtenerConfiguracion(
  env: NodeJS.ProcessEnv = process.env,
  archivo: ArchivoConfiguracion = {}
): ConfiguracionAgente {
  // El archivo del asistente completa lo que no venga por entorno
  env = {
    ...env,
    API_URL: env.API_URL || env.CAPRICHOS_API_URL || archivo.apiUrl,
    AGENTE_KEY: env.AGENTE_KEY || env.CAPRICHOS_AGENTE_KEY || archivo.agenteKey,
  } as NodeJS.ProcessEnv;

  const urlBruta =
    env.API_URL ||
    env.CAPRICHOS_API_URL ||
    env.VITE_API_URL ||
    'http://localhost:3000';

  const apiUrl = urlBruta.replace(/\/+$/, '');

  const agenteKey =
    env.AGENTE_KEY ||
    env.CAPRICHOS_AGENTE_KEY ||
    env.DEVICE_KEY ||
    '';

  const impresoraRuta =
    env.IMPRESORA_RUTA ||
    env.PRINTER_PATH ||
    '/dev/usb/lp0';

  const intervaloConsultaMs = env.INTERVALO_CONSULTA_MS
    ? parseInt(env.INTERVALO_CONSULTA_MS, 10)
    : env.POLL_INTERVAL_MS
      ? parseInt(env.POLL_INTERVAL_MS, 10)
      : 2000;

  const intervaloLatidoMs = env.INTERVALO_LATIDO_MS
    ? parseInt(env.INTERVALO_LATIDO_MS, 10)
    : env.HEARTBEAT_INTERVAL_MS
      ? parseInt(env.HEARTBEAT_INTERVAL_MS, 10)
      : 20000;

  const maxTrabajosPorLote = env.MAX_TRABAJOS_LOTE
    ? Math.min(10, Math.max(1, parseInt(env.MAX_TRABAJOS_LOTE, 10)))
    : 4; // lotes cortos: un ticket de pago nuevo no espera a que salgan 10 stickers

  return {
    apiUrl,
    agenteKey,
    impresoraRuta,
    etiquetera: env.ETIQUETERA || archivo.etiquetera || undefined,
    ticketera: env.TICKETERA || archivo.ticketera || undefined,
    etiqueta: formatoDesdeConfig(env, archivo.etiqueta),
    ticketColumnas: Number(env.TICKET_COLUMNAS || archivo.ticketColumnas) === 32 ? 32 : 48,
    intervaloConsultaMs: isNaN(intervaloConsultaMs) ? 2000 : intervaloConsultaMs,
    intervaloLatidoMs: isNaN(intervaloLatidoMs) ? 20000 : intervaloLatidoMs,
    maxTrabajosPorLote: isNaN(maxTrabajosPorLote) ? 4 : maxTrabajosPorLote,
    version: VERSION_AGENTE,
  };
}
