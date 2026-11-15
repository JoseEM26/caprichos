import { CATALOGO_PLANTILLAS, DefinicionPlantilla } from './plantillas.catalogo';

/**
 * Único lugar que convierte una plantilla de Meta en su texto plano: el mismo texto del catálogo con sus variables
 * puestas. Lo usa Evolution (no tiene plantillas) y cualquier vista previa. `plantilla` es la clave del catálogo
 * (p. ej. DELIVERY_SALIDA) o el nombre registrado en Meta (caprichos_delivery_en_camino).
 * Las variables van en orden (arreglo) o por nombre (objeto con las claves de `variables` del catálogo).
 */
export function textoDePlantilla(plantilla: string, variables?: Record<string, string> | string[]): string | null {
  const def: DefinicionPlantilla | undefined = CATALOGO_PLANTILLAS[plantilla] ?? Object.values(CATALOGO_PLANTILLAS).find((d) => d.nombre === plantilla);
  if (!def) return null;
  const valores = Array.isArray(variables) ? variables : def.variables.map((nombre, i) => variables?.[nombre] ?? Object.values(variables ?? {})[i]);
  return def.texto.replace(/\{\{(\d+)\}\}/g, (_m, i) => String(valores[Number(i) - 1] ?? ''));
}
