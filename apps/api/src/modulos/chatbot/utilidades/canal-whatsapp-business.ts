/** Marca en mensaje_chat.contenido.canal de lo que el local escribió desde la app WhatsApp Business (celular o Web). */
export const CANAL_WHATSAPP_BUSINESS = 'WHATSAPP_BUSINESS';

/** Minutos (24 h; la reanudación diaria de las 00:01 manda) que el bot calla en un chat después del último mensaje que una persona escribió desde WhatsApp Business. Fijo. */
export const SILENCIO_WHATSAPP_BUSINESS_MIN = 24 * 60;

/** ¿Una persona escribió a este chat desde WhatsApp Business hace menos del silencio y el chat sigue en manos de una persona? */
export async function personaAtiendeDesdeWhatsapp(
  prisma: { mensajeChat: { findFirst: (a: any) => Promise<any> } },
  conversacion: { id: bigint; duenio: string },
): Promise<boolean> {
  if (conversacion.duenio === 'BOT' || typeof prisma.mensajeChat?.findFirst !== 'function') return false;
  const ultimo = await prisma.mensajeChat.findFirst({
    where: { conversacion_id: conversacion.id, direccion: 'SALE', autor: 'PERSONA' },
    orderBy: { en: 'desc' },
    select: { en: true, contenido: true },
  });
  return (
    (ultimo?.contenido as any)?.canal === CANAL_WHATSAPP_BUSINESS &&
    Date.now() - new Date(ultimo.en).getTime() < SILENCIO_WHATSAPP_BUSINESS_MIN * 60_000
  );
}
