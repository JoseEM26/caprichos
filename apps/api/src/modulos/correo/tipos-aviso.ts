/** Tipos de aviso por correo que el dueño puede asignar a cada correo extra (agrupados en español simple). */
export const TIPOS_AVISO = ['STOCK', 'IMPRESORA', 'PC_IMPRESION', 'CHAT_SIN_RESPONDER', 'COMPROBANTES', 'OTROS'] as const;
export type TipoAviso = (typeof TIPOS_AVISO)[number];

export const INFO_TIPOS_AVISO: Record<TipoAviso, { nombre: string; ayuda: string }> = {
  STOCK: { nombre: 'Stock bajo', ayuda: 'Insumos o productos que se agotan o hay que pedir.' },
  IMPRESORA: { nombre: 'Impresora sin conexión', ayuda: 'Etiquetas esperando porque la impresora de Caja no responde.' },
  PC_IMPRESION: { nombre: 'Computadoras de impresión sin conectar', ayuda: 'Pasados unos minutos de abrir la caja, avisa qué PC de impresión no dio señal.' },
  CHAT_SIN_RESPONDER: { nombre: 'Chat de WhatsApp sin responder', ayuda: 'Un cliente espera respuesta de una persona por más de unos minutos.' },
  COMPROBANTES: { nombre: 'Certificado y comprobantes', ayuda: 'Certificado digital por vencer y problemas con boletas o facturas.' },
  OTROS: { nombre: 'Otros avisos', ayuda: 'Pagos sin revisar, pedidos sin confirmar, calificaciones bajas y demás alertas.' },
};

export const esTipoAviso = (t: unknown): t is TipoAviso => typeof t === 'string' && (TIPOS_AVISO as readonly string[]).includes(t);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const correoValido = (c: string): boolean => c.length <= 160 && EMAIL.test(c);

/** «maria@ejemplo.com» -> «m***@ejemplo.com». Nunca devuelve el correo completo. */
export function enmascararCorreo(correo: string): string {
  const [local = '', dominio = ''] = String(correo).split('@');
  if (!dominio) return '***';
  return `${local.slice(0, 1)}***@${dominio}`;
}

/** Teléfono sin los primeros dígitos: «*** *** 321». */
export function enmascararTelefonoAviso(tel: string): string {
  const d = String(tel ?? '').replace(/\D/g, '');
  return d.length >= 3 ? `*** *** ${d.slice(-3)}` : '***';
}
