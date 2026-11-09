import type { EstadoChat } from './mensajesTipos';

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
