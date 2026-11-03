/** Sin credenciales de Meta el envío es simulado (ver proveedor de mensajería): ahí los avisos nuevos vienen activados por defecto. */
export const whatsappSimulado = (): boolean =>
  !((process.env.WHATSAPP_TOKEN ?? '').trim() && (process.env.WHATSAPP_PHONE_ID ?? '').trim());

/** Parámetro de activación: si no existe, vale el defecto; «si» o true lo activan. */
export const parametroActivoConDefecto = (valor: unknown, defecto: boolean): boolean => {
  if (valor === undefined || valor === null) return defecto;
  return valor === true || String(valor).toLowerCase() === 'si';
};
