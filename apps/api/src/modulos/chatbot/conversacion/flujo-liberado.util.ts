/**
 * Cuando una persona suelta o libera un chat, el flujo del bot no puede quedarse en ATENCION_PERSONA:
 * en ese estado el motor calla y el cliente escribe "menú" sin respuesta. Devuelve el flujo listo
 * para que el bot retome (menú), conservando el resto de los datos de la conversación.
 */
export function flujoLiberadoParaBot(flujo: unknown): Record<string, unknown> {
  const actual = (flujo && typeof flujo === 'object' ? (flujo as Record<string, unknown>) : {}) as Record<string, unknown>;
  const { perdona_espera_ts: _p, derivado_en: _d, ...resto } = actual;
  if (actual.estado !== 'ATENCION_PERSONA') return resto;
  return { ...resto, estado: 'MENU', repreguntasFallidas: 0 };
}
