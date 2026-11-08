/**
 * Reglas de los mensajes del bot que el dueño edita en Configuración › Chatbot.
 * Espejo de apps/api/.../chatbot-configuracion.tipos.ts (VARIABLES_TEXTO_BOT) y de bienvenida.util.ts:
 * el servidor valida y arma el mensaje real; esto solo avisa antes de guardar y dibuja la vista previa.
 */
export const LIMITE_MENSAJE_BOT = 1024;

export const VARIABLES_MENSAJE: Record<string, string[]> = {
  chatbot_texto_bienvenida: ['nombre', 'local', 'link_carta', 'promociones'],
  chatbot_texto_promos_encabezado: ['local'],
  chatbot_texto_mas_descuento: ['link_carta', 'local'],
  chatbot_promos_mostrar: [],
  chatbot_promos_max: [],
  chatbot_texto_despedida: ['local'],
  chatbot_texto_pase_persona: ['local'],
  chatbot_texto_fuera_horario: ['horario', 'hora_apertura', 'apertura', 'local', 'link_carta'],
  chatbot_texto_no_entiendo: ['local'],
  chatbot_texto_no_entiendo_derivacion: ['local'],
  chatbot_texto_indicacion_pago: [],
  chatbot_texto_envio_gratis: ['promo'],
  chatbot_texto_aviso_stock: ['aviso'],
  chatbot_texto_combo_intro: ['combo', 'incluye'],
  chatbot_texto_combo_plan_b: ['faltante', 'alternativas'],
};

const EJEMPLO: Record<string, string> = {
  nombre: 'Ana',
  local: 'Caprichos',
  link_carta: 'https://caprichos.pe',
  horario: 'Lunes a Domingo',
  hora_apertura: '14:00',
  apertura: 'Abrimos hoy a las 14:00.',
  promo: 'Dúo Irresistible',
  aviso: '¡Quedan solo 3, ya se acaban!',
  combo: 'Dúo Irresistible',
  incluye: 'Incluye: 1 frappe y 1 dona',
  faltante: 'la dona de chocolate',
  alternativas: 'la dona de fresa',
};

/** Promociones de muestra cuando el local no tiene ninguna vigente en este momento. */
export const PROMOS_MUESTRA = ['• Dúo Irresistible — S/ 37', '• Galletas — 10 % de descuento'];

/** Mensaje de error si el texto no se puede guardar; null si está bien. (El límite de 1024 se avisa aparte.) */
export function validarMensaje(clave: string, valor: string): string | null {
  const v = valor.trim();
  if (!v) return 'El mensaje no puede quedar vacío. Usa «Restaurar texto original» si quieres volver al de fábrica.';
  if (clave === 'chatbot_promos_mostrar') return ['si', 'no'].includes(v) ? null : 'Elige Sí o No.';
  if (clave === 'chatbot_promos_max') return /^[1-5]$/.test(v) ? null : 'El tope va de 1 a 5 promociones.';
  const permitidas = VARIABLES_MENSAJE[clave] ?? [];
  const malas = [...new Set([...v.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]).filter((n) => !permitidas.includes(n)))];
  if (malas.length) {
    return `Variable no válida: ${malas.map((n) => `{${n}}`).join(', ')}. Permitidas aquí: ${permitidas.map((n) => `{${n}}`).join(', ') || 'ninguna'}.`;
  }
  return null;
}

const interpolar = (t: string, vars: Record<string, string>) =>
  t
    .replace(/\{([^{}]*)\}/g, (m, k) => (k in vars ? vars[k] : m))
    .replace(/[ \t]+([!,.¡?:])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ');

/** Lo que vería el cliente, con datos de ejemplo y las promociones vigentes reales (o de muestra). */
export function vistaPreviaMensaje(clave: string, textos: Record<string, string>, promosReales: string[]): string {
  const t = (k: string) => (textos[k] ?? '').trim();
  if (clave === 'chatbot_promos_mostrar' || clave === 'chatbot_promos_max') {
    return vistaPreviaMensaje('chatbot_texto_bienvenida', textos, promosReales);
  }
  if (clave !== 'chatbot_texto_bienvenida' && clave !== 'chatbot_texto_promos_encabezado' && clave !== 'chatbot_texto_mas_descuento') {
    return interpolar(t(clave), EJEMPLO);
  }
  const max = Math.min(5, Math.max(1, parseInt(t('chatbot_promos_max'), 10) || 3));
  const lineas = (promosReales.length ? promosReales : PROMOS_MUESTRA).slice(0, max);
  const bloque = t('chatbot_promos_mostrar') === 'no' ? '' : `${interpolar(t('chatbot_texto_promos_encabezado'), EJEMPLO)}\n${lineas.join('\n')}`;
  const plantilla = t('chatbot_texto_bienvenida');
  const lleva = plantilla.includes('{promociones}');
  const saludo = interpolar(plantilla, { ...EJEMPLO, promociones: bloque }).trim();
  return [saludo, lleva ? '' : bloque, interpolar(t('chatbot_texto_mas_descuento'), EJEMPLO)].filter(Boolean).join('\n\n');
}
