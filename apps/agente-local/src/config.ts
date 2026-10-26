export interface ConfiguracionAgente {
  apiUrl: string;
  agenteKey: string;
  impresoraRuta: string;
  intervaloConsultaMs: number;
  intervaloLatidoMs: number;
  maxTrabajosPorLote: number;
  version: string;
}

export const VERSION_AGENTE = '0.1.0';

export function obtenerConfiguracion(
  env: NodeJS.ProcessEnv = process.env
): ConfiguracionAgente {
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
      : 3000;

  const intervaloLatidoMs = env.INTERVALO_LATIDO_MS
    ? parseInt(env.INTERVALO_LATIDO_MS, 10)
    : env.HEARTBEAT_INTERVAL_MS
      ? parseInt(env.HEARTBEAT_INTERVAL_MS, 10)
      : 20000;

  const maxTrabajosPorLote = env.MAX_TRABAJOS_LOTE
    ? Math.min(10, Math.max(1, parseInt(env.MAX_TRABAJOS_LOTE, 10)))
    : 10;

  return {
    apiUrl,
    agenteKey,
    impresoraRuta,
    intervaloConsultaMs: isNaN(intervaloConsultaMs) ? 3000 : intervaloConsultaMs,
    intervaloLatidoMs: isNaN(intervaloLatidoMs) ? 20000 : intervaloLatidoMs,
    maxTrabajosPorLote: isNaN(maxTrabajosPorLote) ? 10 : maxTrabajosPorLote,
    version: VERSION_AGENTE,
  };
}
