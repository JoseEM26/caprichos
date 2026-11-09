/**
 * Escalado de la IA a una persona: detecta al cliente atascado (frustrado, repitiendo o con un tema de
 * pedido/pago/delivery que ya no avanza) y arma los textos y el resumen para el asesor. Sin efectos: todo puro.
 */

const sinTildes = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Frustración o pedido explícito de una persona (texto sin tildes). */
const PATRON_FRUSTRACION =
  /\b(no me entiende\w*|no entiend\w+|maquina|robot|bot inutil|asesor\w*|persona real|una persona|humano|hablar con alguien|reclamo|no me ayuda\w*|no sirve|pesimo|inutil|ya te dije|ya les dije|otra vez lo mismo)\b/;

/** Tema de pedido, pago o delivery: si ya van 2 mensajes del cliente sin resolverse, lo ve una persona. */
const TEMA_PEDIDO_PAGO = /\b(pag\w+|cancel\w+|yap\w+|plin|saldo|deliver\w*|delivery|envio|pedido|vuelto|efectivo|cobr\w+|voucher)\b/;

const palabras = (t: string) => new Set(sinTildes(t).split(/[^a-z0-9]+/).filter((w) => w.length > 3));

/** Mensaje casi igual a otro anterior (reformula): mitad o más de sus palabras largas se repiten. */
function parecido(a: string, b: string): boolean {
  const pa = palabras(a);
  const pb = palabras(b);
  if (pa.size === 0 || pb.size === 0) return false;
  let comunes = 0;
  for (const w of pa) if (pb.has(w)) comunes++;
  return comunes / Math.min(pa.size, pb.size) >= 0.5;
}

export interface CasoAtascado {
  atascado: boolean;
  motivo?: 'FRUSTRACION' | 'REPITE' | 'PEDIDO_PAGO_SIN_RESOLVER';
}

/** `historial` = mensajes recientes del chat (el actual puede ir o no al final; se ignora si es idéntico). */
export function detectarCasoAtascado(texto: string, historial: Array<{ autor: string; texto: string }>): CasoAtascado {
  const actual = sinTildes(texto || '');
  if (PATRON_FRUSTRACION.test(actual)) return { atascado: true, motivo: 'FRUSTRACION' };
  const previos = historial
    .filter((m) => m.autor === 'CLIENTE' && m.texto && sinTildes(m.texto) !== actual)
    .map((m) => m.texto)
    .slice(-4);
  if (previos.some((p) => parecido(texto, p))) return { atascado: true, motivo: 'REPITE' };
  if (TEMA_PEDIDO_PAGO.test(actual) && previos.filter((p) => TEMA_PEDIDO_PAGO.test(sinTildes(p))).length >= 2) {
    return { atascado: true, motivo: 'PEDIDO_PAGO_SIN_RESOLVER' };
  }
  return { atascado: false };
}

export const TEXTOS_ESCALADO = {
  /** Se añade a la respuesta de la IA cuando se deriva y la IA no lo dijo ya. */
  derivado: (abierta: boolean, abre?: string | null): string =>
    abierta
      ? 'Ya avisé a una persona del equipo para que te ayude con esto 🙏'
      : `Ya dejé tu caso anotado para una persona del equipo. Ahora estamos fuera de horario${abre ? ` (abrimos a las ${abre})` : ''}: te responderán apenas abramos 🙏`,
  /** Único mensaje de espera si nadie respondió a tiempo. */
  espera: (abierta: boolean, abre?: string | null): string =>
    abierta
      ? 'Ya avisé al equipo, te respondemos en unos minutos 🙏 Si prefieres, puedes dejarme tu duda aquí y la dejo anotada para que la vean.'
      : `Ya avisé al equipo 🙏 Ahora estamos fuera de horario${abre ? ` (abrimos a las ${abre})` : ''}; apenas abramos te respondemos. Puedes dejarme tu duda aquí y la dejo anotada.`,
};

export const MENCIONA_PERSONA = /persona|equipo|asesor/i;

/** Marca en `flujo.escalado_ia`: cuándo se derivó y si ya salió el mensaje de espera (una sola vez por caso). */
export interface MarcaEscalado {
  en: string;
  esperaEnviada: boolean;
}

/** Nota interna para el asesor (mensaje SISTEMA en el chat). */
export function notaResumenAsesor(d: {
  motivo: string;
  pedidoCliente: string;
  ultimaRespuestaBot?: string | null;
  pedido?: string | null;
}): string {
  return [
    `Necesita asesor (${d.motivo}).`,
    `El cliente dijo: "${d.pedidoCliente.slice(0, 200)}"`,
    d.pedido ? `Pedido relacionado: ${d.pedido}` : 'Sin pedido reciente asociado a este número.',
    d.ultimaRespuestaBot ? `La IA ya respondió: "${d.ultimaRespuestaBot.slice(0, 200)}"` : null,
    'Cualquier cambio de monto, delivery o forma de pago lo decide una persona.',
  ]
    .filter(Boolean)
    .join('\n');
}
