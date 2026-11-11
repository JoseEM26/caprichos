/** Origen de un trabajo de impresión: de dónde nació. Se guarda en print_job.origen; en lo viejo (NULL) se deduce al leer. */
export type OrigenImpresion = 'AUTOMATICA' | 'REIMPRESION' | 'PRUEBA' | 'REINTENTO';
export const ORIGENES_IMPRESION: OrigenImpresion[] = ['AUTOMATICA', 'REIMPRESION', 'PRUEBA', 'REINTENTO'];

/** Campos de origen para un `printJob.create`. Sin usuario = lo hizo el sistema (o no se registró quién). */
export function datosOrigen(
  origen: OrigenImpresion,
  usuario?: { partyId?: bigint | string | number | null } | null,
  motivo?: string,
): { origen: OrigenImpresion; solicitado_por_party_id: bigint | null; motivo_origen: string | null } {
  let quien: bigint | null = null;
  try {
    quien = usuario?.partyId !== undefined && usuario?.partyId !== null ? BigInt(usuario.partyId) : null;
  } catch {
    quien = null;
  }
  return { origen, solicitado_por_party_id: quien, motivo_origen: motivo ?? null };
}

/** Origen de una fila: el guardado, o el deducido si es anterior a la columna (copia → reimpresión; prueba sin pedido → prueba). */
export function deducirOrigen(t: { origen?: string | null; copia: boolean; pedido_id: bigint | null; tipo?: string; payload?: any }): OrigenImpresion {
  if (t.origen && (ORIGENES_IMPRESION as string[]).includes(t.origen)) return t.origen as OrigenImpresion;
  if (t.copia || t.tipo === 'TICKET_CIERRE') return 'REIMPRESION'; // el cierre solo se encola desde «Imprimir cierre» (admin)
  if (t.pedido_id === null) return 'PRUEBA'; // sin pedido y sin ser cierre: hoja de prueba o simulación (payload.prueba / .simulacion)
  return 'AUTOMATICA';
}

const ETIQUETAS_TIPO: Record<string, string> = {
  ETIQUETA_GENERAL: 'Sticker · General',
  ETIQUETA_AREA: 'Sticker · Por área',
  ETIQUETA_BEBIDA: 'Sticker · Bebida',
  TICKET_PAGO: 'Ticket · Pago',
  TICKET_COMANDA_SALON: 'Ticket · Comanda salón',
  TICKET_COMANDA_AREA: 'Ticket · Comanda por área',
  TICKET_CIERRE: 'Ticket · Cierre de caja',
};
export const etiquetaTipoImpresion = (tipo: string): string => ETIQUETAS_TIPO[tipo] ?? tipo;
