/** Plantillas de respuesta rápida del chat de WhatsApp: categorías, variables y reemplazo (la usan la API y la web). */

export const CATEGORIAS_PLANTILLA = ['PAGOS', 'HORARIOS', 'UBICACION', 'DELIVERY', 'PEDIDOS', 'SALUDO', 'CIERRE', 'OTROS'] as const;
export type CategoriaPlantilla = (typeof CATEGORIAS_PLANTILLA)[number];

export const ETIQUETA_CATEGORIA_PLANTILLA: Record<CategoriaPlantilla, string> = {
  PAGOS: 'Pagos',
  HORARIOS: 'Horarios',
  UBICACION: 'Ubicación',
  DELIVERY: 'Delivery',
  PEDIDOS: 'Pedidos',
  SALUDO: 'Saludo',
  CIERRE: 'Cierre',
  OTROS: 'Otros',
};

/** Variables que se reemplazan al insertar (con qué dato). */
export const VARIABLES_PLANTILLA = [
  { clave: 'nombre', ayuda: 'Nombre del cliente del chat' },
  { clave: 'mi_nombre', ayuda: 'Tu nombre' },
  { clave: 'local', ayuda: 'Nombre del local' },
  { clave: 'direccion', ayuda: 'Dirección del local' },
  { clave: 'horario', ayuda: 'Horario de atención' },
  { clave: 'medios_pago', ayuda: 'Todos los medios de pago activos' },
  { clave: 'yape', ayuda: 'Número y titular de Yape' },
  { clave: 'plin', ayuda: 'Número y titular de Plin' },
  { clave: 'transferencia', ayuda: 'Cuenta de transferencia' },
] as const;

/** Marcadores pendientes: {{algo}} (letras, números y guion bajo). */
const MARCADOR = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * Reemplaza {{variable}} con su valor. Si una variable no tiene dato (vacía o desconocida) el marcador queda visible
 * y se lista en `faltantes` para que quien escribe lo complete: nunca se envía «{{nombre}}» en silencio.
 */
export function resolverPlantilla(texto: string, valores: Record<string, string | null | undefined>): { texto: string; faltantes: string[] } {
  const faltantes: string[] = [];
  const resuelto = String(texto ?? '').replace(MARCADOR, (_marcador, clave: string) => {
    const k = clave.toLowerCase();
    const v = valores[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (!faltantes.includes(k)) faltantes.push(k);
    return `{{${k}}}`;
  });
  return { texto: resuelto, faltantes };
}

/** Marcadores {{...}} que aún quedan en un texto (para avisar antes de enviar). */
export function marcadoresPendientes(texto: string): string[] {
  const claves: string[] = [];
  for (const m of String(texto ?? '').matchAll(MARCADOR)) {
    const k = m[1].toLowerCase();
    if (!claves.includes(k)) claves.push(k);
  }
  return claves;
}
