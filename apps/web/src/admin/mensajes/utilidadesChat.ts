import type { ChatResumen, EstadoChat, MensajeItem } from './mensajesTipos';

export function esUsuarioWhatsApp(c?: { identificador_tipo?: string; telefono?: string } | null): boolean {
  if (!c) return false;
  return c.identificador_tipo === 'USUARIO_WA' || (Boolean(c.telefono) && c.telefono!.startsWith('wa-user:'));
}

export const ESTADOS_BG: Record<EstadoChat, string> = {
  atencion: '#FBE9DF',
  validar: '#FFF1C9',
  bot: 'var(--cp-line)',
  pausado: '#F0F2F5',
  atendido: 'var(--cp-greenbg)',
};

/** Texto del estado del chat; lo mismo en la lista, la cabecera y el panel. */
export const ESTADOS_LABEL: Record<EstadoChat, string> = {
  atencion: 'Derivado a asesor',
  validar: 'Voucher por revisar',
  bot: 'El bot atiende',
  pausado: 'Pausado',
  atendido: 'Atendido',
};

const COLORES_AVATAR = ['#B5651D', '#6B4E9B', '#2E7D32', '#AD4A4A', '#1F7A8C', '#D97706'];

export const obtenerColorAvatar = (id: string) => {
  let num = 0;
  for (let i = 0; i < id.length; i++) num += id.charCodeAt(i);
  return COLORES_AVATAR[num % COLORES_AVATAR.length];
};

export const obtenerIniciales = (nombre: string) => {
  const partes = (nombre || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'WA';
  // Array.from: un emoji al inicio del nombre no se parte en media letra (�)
  const car = (t: string) => Array.from(t);
  if (partes.length === 1) return car(partes[0]).slice(0, 2).join('').toUpperCase();
  return (car(partes[0])[0] + car(partes[1])[0]).toUpperCase();
};

/** Desde cuántos minutos sin respuesta se destaca el chat en la lista. */
export const SIN_RESPUESTA_MIN_VISIBLE = 3;

export function obtenerEstiloEspera(minutos: number) {
  if (minutos > 15) {
    return {
      fondo: '#FBEDE9',
      borde: '1px solid var(--cp-rust, #B2500F)',
      color: 'var(--cp-rust, #B2500F)',
      label: `${minutos} min`,
    };
  }
  if (minutos > 5) {
    return {
      fondo: '#FEF9EE',
      borde: '1px solid var(--cp-gold, #D99E39)',
      color: 'var(--cp-gold, #D99E39)',
      label: `${minutos} min`,
    };
  }
  return {
    fondo: '#F0F2F5',
    borde: '1px solid var(--cp-line, #E3D6C6)',
    color: 'var(--cp-soft, #2C4C5D)',
    label: `${minutos} min`,
  };
}

/** Teléfono de la URL (?telefono=...) reducido a sus últimos 9 dígitos; vacío si no viene. */
export function telefonoDeUrl(): string {
  try {
    const digitos = (new URLSearchParams(window.location.search).get('telefono') || '').replace(/\D/g, '');
    return digitos.length >= 9 ? digitos.slice(-9) : '';
  } catch {
    return '';
  }
}

/** 51914244077 pasa a «+51 914 244 077»; otro formato se muestra con «+» delante. */
export function formatearNumeroReceptor(n: string): string {
  const d = n.replace(/\D/g, "");
  const m = /^(51)(\d{3})(\d{3})(\d{3})$/.exec(d);
  return m ? `+${m[1]} ${m[2]} ${m[3]} ${m[4]}` : `+${d}`;
}

// --- Envío optimista y páginas del historial ---

const PREFIJO_LOCAL = 'tmp-';

/** true = mensaje que solo existe en esta pantalla (todavía no lo devolvió el servidor). */
export const esMensajeLocal = (m: Pick<MensajeItem, 'id'>): boolean => m.id.startsWith(PREFIJO_LOCAL);

/** Id nuevo para un envío; viaja al servidor como `idCliente` (idempotencia) y nombra el mensaje local. */
export const nuevoIdCliente = (): string =>
  `${PREFIJO_LOCAL}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** El mensaje que aparece al instante, con «Enviando…», mientras el servidor habla con WhatsApp. */
export function mensajeOptimista(idCliente: string, texto: string, ahora = new Date()): MensajeItem {
  return {
    id: idCliente,
    idCliente,
    autor: 'PERSONA',
    saliente: true,
    imagen: false,
    texto,
    hora: new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' }).format(ahora),
    fecha: ahora.toISOString(),
    estado: 'ENVIANDO',
  };
}

const esMasViejo = (a: string, b: string): boolean => {
  try {
    return BigInt(a) < BigInt(b);
  } catch {
    return false;
  }
};

/**
 * Une lo que la pantalla ya tiene con una página recién leída (la más reciente) del servidor:
 * conserva el historial anterior ya pedido con «Cargar anteriores», no repite mensajes y deja al final los mensajes
 * locales que el servidor todavía no devolvió. Un local se descarta cuando llega el real con su mismo `idCliente`.
 */
export function fusionarMensajes(previos: MensajeItem[], nuevos: MensajeItem[]): MensajeItem[] {
  const primero = nuevos[0]?.id;
  const anteriores = primero ? previos.filter((m) => !esMensajeLocal(m) && esMasViejo(m.id, primero)) : [];
  const confirmados = new Set(nuevos.map((m) => m.idCliente).filter(Boolean));
  const pendientes = previos.filter((m) => esMensajeLocal(m) && !confirmados.has(m.idCliente ?? m.id));
  return [...anteriores, ...nuevos, ...pendientes];
}

// --- Lista de chats por páginas y actualización en vivo ---

const porClave = (a: ChatResumen, b: ChatResumen): number => {
  const x = a.clave ?? '';
  const y = b.clave ?? '';
  return x < y ? -1 : x > y ? 1 : 0;
};

/** Añade una página nueva al final sin repetir chats que ya estaban (si algo cambió de sitio entre páginas, gana la fila nueva). */
export function agregarPagina(actuales: ChatResumen[], pagina: ChatResumen[]): ChatResumen[] {
  const nuevos = new Set(pagina.map((c) => c.id));
  return [...actuales.filter((c) => !nuevos.has(c.id)), ...pagina].sort(porClave);
}

/**
 * Aplica la fila que devolvió el servidor para UN chat tras un evento en vivo:
 *  - cargado y sigue cumpliendo los filtros: se actualiza su fila y se reordena;
 *  - cargado y ya no cumple: sale de la lista;
 *  - sin cargar: solo entra si por su orden cae entre los ya cargados (`dentro`); si no, aparecerá al pedir más páginas.
 * Devuelve la MISMA lista (sin cambios) cuando no hay nada que hacer, para no repintar.
 */
export function aplicarFilaEnVivo(chats: ChatResumen[], id: string, res: { chat: ChatResumen | null; dentro: boolean }): ChatResumen[] {
  const cargado = chats.some((c) => c.id === id);
  if (!res.chat) return cargado ? chats.filter((c) => c.id !== id) : chats;
  if (!cargado && !res.dentro) return chats;
  return [...chats.filter((c) => c.id !== id), res.chat].sort(porClave);
}

/** Pasa un mensaje al estado que avisó el servidor (por id real o por idCliente); `encontrado` = si el mensaje estaba en pantalla. */
export function aplicarEstadoEnvio(
  mensajes: MensajeItem[],
  ev: { mensajeId: string; idCliente?: string; estado: string; motivoFallo?: string | null; puedeReintentar?: boolean },
): { mensajes: MensajeItem[]; encontrado: boolean } {
  let encontrado = false;
  const nuevos = mensajes.map((m) => {
    if (m.id !== ev.mensajeId && !(ev.idCliente && m.idCliente === ev.idCliente)) return m;
    encontrado = true;
    return { ...m, id: ev.mensajeId, estado: ev.estado, motivoFallo: ev.motivoFallo ?? null, puedeReintentar: ev.puedeReintentar };
  });
  return { mensajes: nuevos, encontrado };
}
