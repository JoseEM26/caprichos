/** Roles de cocina por área: ven y operan solo su área en las pantallas de cocina (sin relación con impresión). */
export const ROLES_COCINA_AREA = {
  COCINA_BEBIDAS: 'Bebidas',
  COCINA_SALADOS: 'Salados',
  COCINA_POSTRES: 'Postres',
} as const;

/** Área de bebidas: recibe los stickers por vaso cuando tiene etiquetera asignada. */
export const AREA_BEBIDAS = 'Bebidas';

/** ¿Es el área de bebidas? Por nombre, sin distinguir mayúsculas. Bebidas no lleva sticker por área (ya tiene uno por vaso). */
export const esAreaBebidas = (nombre: string | null | undefined): boolean =>
  (nombre ?? '').trim().toLowerCase() === AREA_BEBIDAS.toLowerCase();
