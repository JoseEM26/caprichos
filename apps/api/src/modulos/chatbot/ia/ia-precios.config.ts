import { ModeloPrecioConfig } from './tipos-ia';

/**
 * Tabla de tarifas de modelos de OpenAI.
 * NOTA DE SEGURIDAD Y OPERACIÓN:
 * Los precios indicados aquí son ESTIMADOS y deben ser confirmados/actualizados
 * según el tarifario oficial vigente publicado por OpenAI en https://openai.com/pricing.
 * Cualquier modificación se puede realizar editando este archivo de configuración.
 */
export const TABLA_PRECIOS_OPENAI: Record<string, ModeloPrecioConfig> = {
  'gpt-4o-mini': {
    nombre: 'gpt-4o-mini',
    costoPorMillonTokensEntradaUsd: 0.15, // $0.15 por 1M tokens de entrada (estimado)
    costoPorMillonTokensSalidaUsd: 0.60,  // $0.60 por 1M tokens de salida (estimado)
    esEstimado: true,
    nota: 'Tarifa estimada estándar para gpt-4o-mini; verificar en openai.com/pricing',
  },
  'gpt-4o': {
    nombre: 'gpt-4o',
    costoPorMillonTokensEntradaUsd: 2.50, // $2.50 por 1M tokens de entrada (estimado)
    costoPorMillonTokensSalidaUsd: 10.00, // $10.00 por 1M tokens de salida (estimado)
    esEstimado: true,
    nota: 'Tarifa estimada estándar para gpt-4o; verificar en openai.com/pricing',
  },
  // Transcripción de audio: se mide en «tokens de audio» (~10 por segundo; si la API no los informa, se estiman por duración).
  // 0.003 USD/min = 5 USD por millón a 10 tokens/s; whisper-1 cuesta 0.006 USD/min = 10 USD por millón.
  'gpt-4o-mini-transcribe': {
    nombre: 'gpt-4o-mini-transcribe',
    costoPorMillonTokensEntradaUsd: 5.0,
    costoPorMillonTokensSalidaUsd: 5.0,
    esEstimado: true,
    nota: 'Tarifa estimada (~0.003 USD por minuto de audio); verificar en openai.com/pricing',
  },
  'gpt-4o-transcribe': {
    nombre: 'gpt-4o-transcribe',
    costoPorMillonTokensEntradaUsd: 10.0,
    costoPorMillonTokensSalidaUsd: 10.0,
    esEstimado: true,
    nota: 'Tarifa estimada (~0.006 USD por minuto de audio); verificar en openai.com/pricing',
  },
  'whisper-1': {
    nombre: 'whisper-1',
    costoPorMillonTokensEntradaUsd: 10.0,
    costoPorMillonTokensSalidaUsd: 0,
    esEstimado: true,
    nota: 'Tarifa estimada (0.006 USD por minuto de audio); verificar en openai.com/pricing',
  },
  'gpt-3.5-turbo': {
    nombre: 'gpt-3.5-turbo',
    costoPorMillonTokensEntradaUsd: 0.50, // $0.50 por 1M tokens de entrada (estimado)
    costoPorMillonTokensSalidaUsd: 1.50,  // $1.50 por 1M tokens de salida (estimado)
    esEstimado: true,
    nota: 'Tarifa estimada de legado; verificar en openai.com/pricing',
  },
};

/**
 * Tarifa por defecto en caso de especificarse un modelo desconocido.
 */
export const TARIFA_DEFECTO_ESTIMADA: ModeloPrecioConfig = {
  nombre: 'desconocido',
  costoPorMillonTokensEntradaUsd: 0.50,
  costoPorMillonTokensSalidaUsd: 2.00,
  esEstimado: true,
  nota: 'Tarifa genérica de respaldo estimada para cálculo prudencial de costos.',
};

/**
 * Calcula el costo estimado en dólares (USD) a partir de los tokens de entrada y salida.
 */
export function calcularCostoEstimadoUsd(
  modelo: string,
  tokensEntrada: number,
  tokensSalida: number,
): number {
  const clave = modelo.toLowerCase().trim();
  const config = TABLA_PRECIOS_OPENAI[clave] || TARIFA_DEFECTO_ESTIMADA;

  const costoEntrada = (tokensEntrada / 1_000_000) * config.costoPorMillonTokensEntradaUsd;
  const costoSalida = (tokensSalida / 1_000_000) * config.costoPorMillonTokensSalidaUsd;

  const total = costoEntrada + costoSalida;
  // Redondear a 6 decimales para precisión contable
  return Math.round(total * 1_000_000) / 1_000_000;
}
