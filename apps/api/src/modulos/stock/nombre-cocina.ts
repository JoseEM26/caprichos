/**
 * Nombre único del lugar de Cocina (stock de insumos y de productos). Antes el lugar se llamaba «Salados»:
 * los dos nombres se reconocen para no duplicar el lugar en una base que aún lo tiene así, pero el nuevo es «Cocina».
 */
export const NOMBRE_COCINA = 'Cocina';
export const NOMBRE_COCINA_ANTIGUO = 'Salados';
export const NOMBRES_COCINA = [NOMBRE_COCINA, NOMBRE_COCINA_ANTIGUO];

export const esNombreCocina = (nombre: string | null | undefined): boolean =>
  nombre === NOMBRE_COCINA || nombre === NOMBRE_COCINA_ANTIGUO;
