import { TEXTOS_BOT_DEFECTO } from '../configuracion/chatbot-configuracion.tipos';

const lista = (nombres: string[]): string =>
  nombres.length <= 1 ? nombres.join('') : `${nombres.slice(0, -1).join(', ')} o ${nombres[nombres.length - 1]}`;

/** Textos del armado de combos por WhatsApp. Intro y plan B son configurables (Configuración › Chatbot). */
export const TEXTOS_COMBO = {
  /** «Vamos a armar tu *Combo Dúo* 💛 / Incluye: Club Sándwich». */
  intro: (combo: string, incluye: string[], plantilla?: string): string =>
    (plantilla?.trim() || TEXTOS_BOT_DEFECTO.chatbot_texto_combo_intro)
      .replace(/\{combo\}/g, combo.trim())
      .replace(/\{incluye\}/g, incluye.length ? `Incluye: ${incluye.join(' + ')}` : '')
      .trim()
      .slice(0, 900),

  /** Una parte fija se agotó: «Hoy no hay Club Sándwich 😅 ¿Lo cambiamos por Empanada o Croissant?». */
  planB: (faltante: string, alternativas: string[], plantilla?: string): string =>
    (plantilla?.trim() || TEXTOS_BOT_DEFECTO.chatbot_texto_combo_plan_b)
      .replace(/\{faltante\}/g, faltante)
      .replace(/\{alternativas\}/g, lista(alternativas))
      .slice(0, 900),

  eligeOpcion: (etiqueta: string, n: number, total: number): string =>
    `${total > 1 ? `Elige tu opción ${n} de ${total}` : 'Elige tu opción'}${etiqueta ? ` de *${etiqueta}*` : ''} 👇\n(Escribe *atrás* si te equivocas)`,

  eligeSabor: (nombre: string): string => `¿De qué sabor quieres ${nombre}? 👇\n(Escribe *atrás* si te equivocas)`,

  noEncontre: (): string => 'No encontré esa opción 😅 Elige una de la lista:',

  nuevamente: (): string => 'Empecemos de nuevo con tu combo 💛',

  maximo: (combo: string, tope: number): string =>
    `Por WhatsApp armamos hasta ${tope} ${combo} a la vez 💛 Elige una cantidad menor y luego agregas otro:`,

  noDisponible: (combo: string): string => `Hoy no podemos armar ${combo} por falta de stock 😅 Elige otra cosa de la carta.`,

  /** Resumen antes de agregarlo al pedido. */
  resumen: (combo: string, tamano: string | undefined, detalles: string[], cantidad: number, subtotal: number): string =>
    `🎁 *Tu ${combo}*${tamano ? ` · ${tamano}` : ''}${cantidad > 1 ? ` × ${cantidad}` : ''}\n` +
    (detalles.length ? `${detalles.map((d) => `• ${d}`).join('\n')}\n` : '') +
    `*Total: S/ ${subtotal.toFixed(2)}*\n¿Lo agrego a tu pedido?`,

  /** El servidor rechazó el combo al confirmar (se agotó algo): se vuelve a elegir con lo que hay. */
  seAgoto: (mensaje: string): string => `${mensaje} 😅 Armemos de nuevo la parte que cambió:`,
};

export const BOTONES_COMBO_CONFIRMAR = [
  { id: 'ped_combo_ok', titulo: 'Sí, agregar' },
  { id: 'ped_combo_cambiar', titulo: 'Cambiar elección' },
  { id: 'ped_cancelar', titulo: 'Cancelar pedido' },
];
