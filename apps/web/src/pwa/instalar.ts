// Instalación como app (PWA). Chrome/Edge/Android dan un evento diferido que se puede disparar
// con un botón; iPhone/iPad no lo dan y hay que mostrar la guía «Compartir > Añadir a pantalla de inicio».

type EventoInstalar = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const CLAVE_DESCARTE = 'caprichos.pwa.instalar.descartado';

let diferido: EventoInstalar | null = null;
let instalada = false;
let capturaIniciada = false;
const oyentes = new Set<() => void>();

const avisar = () => oyentes.forEach((fn) => fn());

/** Escucha beforeinstallprompt una sola vez; llamar al arrancar la app. */
export function iniciarCapturaInstalar(): void {
  if (capturaIniciada || typeof window === 'undefined') return;
  capturaIniciada = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    diferido = e as EventoInstalar;
    avisar();
  });
  window.addEventListener('appinstalled', () => {
    diferido = null;
    instalada = true;
    avisar();
  });
}

export function esIos(): boolean {
  return typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function estaInstalada(): boolean {
  if (instalada) return true;
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function estaDescartado(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_DESCARTE) === '1';
  } catch {
    return false; // sin almacenamiento (modo privado): el aviso reaparece, no rompe nada
  }
}

export function descartarInstalar(): void {
  try {
    window.localStorage.setItem(CLAVE_DESCARTE, '1');
  } catch {
    // sin almacenamiento: se queda solo en esta sesión
  }
  avisar();
}

/** Hay algo que ofrecer: el botón de instalar (Chrome/Android) o la guía (iOS), y no está ya instalada. */
export function puedeInstalar(): boolean {
  return !estaInstalada() && (diferido !== null || esIos());
}

/** true si el navegador da el aviso de instalar (no iOS); false si solo cabe la guía. */
export function tieneAvisoNativo(): boolean {
  return diferido !== null;
}

/** Lanza el aviso del navegador. Devuelve 'no-disponible' si no hay evento (iOS o navegador sin soporte). */
export async function instalar(): Promise<'aceptada' | 'descartada' | 'no-disponible'> {
  if (!diferido) return 'no-disponible';
  const evento = diferido;
  diferido = null;
  await evento.prompt();
  const { outcome } = await evento.userChoice;
  avisar();
  return outcome === 'accepted' ? 'aceptada' : 'descartada';
}

export function suscribirInstalar(cb: () => void): () => void {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}
