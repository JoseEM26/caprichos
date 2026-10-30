/**
 * Cuando una persona suelta o libera un chat, el flujo del bot no puede quedarse en ATENCION_PERSONA:
 * en ese estado el motor calla y el cliente escribe "menú" sin respuesta. Devuelve el flujo listo
 * para que el bot retome (menú), conservando el resto de los datos de la conversación.
 */
export function flujoLiberadoParaBot(flujo: unknown): Record<string, unknown> {
  const actual = (flujo && typeof flujo === 'object' ? (flujo as Record<string, unknown>) : {}) as Record<string, unknown>;
  if (actual.estado !== 'ATENCION_PERSONA') return actual;
  return { ...actual, estado: 'MENU', repreguntasFallidas: 0 };
}
