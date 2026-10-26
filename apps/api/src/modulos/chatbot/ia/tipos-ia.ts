/**
/**
 * Tipos e interfaces del subsistema de Inteligencia Artificial (Ola 3, Agente G).
 * Diseñado bajo principio de solo lectura (read-only), privacidad (Ley 29733) y tope de costo.
 */

export interface ModeloPrecioConfig {
  nombre: string;
  costoPorMillonTokensEntradaUsd: number;
  costoPorMillonTokensSalidaUsd: number;
  esEstimado: boolean;
  nota: string;
}

export interface HerramientaIaDefinicion {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface LlamadaHerramientaOpenAI {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface MensajeOpenAI {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: LlamadaHerramientaOpenAI[];
}

export interface ParametrosConsultaIa {
  textoUsuario: string;
  conversacionId?: string | bigint;
  telefonoCliente?: string | null;
  primerNombre?: string;
  historialReciente?: Array<{ autor: string; texto: string }>;
  waMessageId?: string;
}

export interface ResultadoConsultaIa {
  exito: boolean;
  respuestaTexto: string;
  confianza: number;
  necesitaDerivar: boolean;
  quierePedir: boolean;
  herramientasUsadas: string[];
  tokensEntrada: number;
  tokensSalida: number;
  costoUsdEstimado: number;
  resultadoRegistro: 'EXITO' | 'TOPE_EXCEDIDO' | 'ERROR' | 'DERIVADO_PERSONA' | 'INYECCION_BLOQUEADA';
  motivoDerivacion?: string;
}

export interface ResumenConsumoIaMes {
  periodo: string; // YYYY-MM
  llamadasTotal: number;
  tokensEntrada: number;
  tokensSalida: number;
  tokensTotal: number;
  costoUsdEstimado: number;
  topeMensualUsd: number;
  porcentajeConsumido: number;
  topeAlcanzado: boolean;
  iaActiva: boolean;
}
