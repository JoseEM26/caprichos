/** Tipos de marca que elige la persona al marcar («¿qué estás haciendo?») y la sugerencia del siguiente paso. */
export type TipoMarcaElegido = 'ENTRADA' | 'SALIDA' | 'ALMUERZO_SALIDA' | 'ALMUERZO_VUELTA';

export const ORDEN_TIPOS: TipoMarcaElegido[] = ['ENTRADA', 'ALMUERZO_SALIDA', 'ALMUERZO_VUELTA', 'SALIDA'];

export const ETIQUETA_ACCION: Record<TipoMarcaElegido, string> = {
  ENTRADA: 'Entrada',
  ALMUERZO_SALIDA: 'Salir a almorzar',
  ALMUERZO_VUELTA: 'Volver del almuerzo',
  SALIDA: 'Salida',
};

export const AYUDA_ACCION: Record<TipoMarcaElegido, string> = {
  ENTRADA: 'Empiezo mi turno',
  ALMUERZO_SALIDA: 'Opcional: el almuerzo se paga igual',
  ALMUERZO_VUELTA: 'Regreso a trabajar',
  SALIDA: 'Termino mi turno',
};

/** Texto de la línea de tiempo. */
export const ETIQUETA_LINEA: Record<TipoMarcaElegido, string> = {
  ENTRADA: 'Entrada',
  ALMUERZO_SALIDA: 'Salió a almorzar',
  ALMUERZO_VUELTA: 'Volvió',
  SALIDA: 'Salida',
};

/** Acepta los nombres nuevos y los viejos del servidor; null o desconocido = marca antigua sin tipo. */
export function normalizarTipo(t: string | null | undefined): TipoMarcaElegido | null {
  if (t === 'SALIDA_ALMUERZO') return 'ALMUERZO_SALIDA';
  if (t === 'ENTRADA_ALMUERZO') return 'ALMUERZO_VUELTA';
  return t && (ORDEN_TIPOS as string[]).includes(t) ? (t as TipoMarcaElegido) : null;
}

/** Respaldo en el cliente cuando el API aún no manda `siguienteSugerido`: usa la última marca con tipo conocido. */
export function sugerirSiguiente(tipos: (string | null | undefined)[]): TipoMarcaElegido | null {
  const ultimo = [...tipos].reverse().map(normalizarTipo).find((t) => t !== null) ?? null;
  if (tipos.length > 0 && ultimo === null) return 'SALIDA'; // solo marcas viejas sin tipo: ya entró
  switch (ultimo) {
    case null: return 'ENTRADA';
    case 'ENTRADA': return 'ALMUERZO_SALIDA';
    case 'ALMUERZO_SALIDA': return 'ALMUERZO_VUELTA';
    case 'ALMUERZO_VUELTA': return 'SALIDA';
    case 'SALIDA': return null;
  }
}

export const horasMin = (min: number | null | undefined) =>
  min == null ? 'sin dato' : `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min`;
