// Instalación como app (PWA). Chrome/Edge/Android dan un evento diferido que se puede disparar
// con un botón; iPhone/iPad no lo dan y hay que mostrar la guía «Compartir > Añadir a pantalla de inicio».

type EventoInstalar = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

import { APPS_PWA, appDeRuta, appPedidaValida, type AppPwa } from './manifestPorRuta';

const CLAVE_DESCARTE = 'caprichos.pwa.instalar.descartado';

let diferido: EventoInstalar | null = null;
// App a la que pertenece el aviso guardado: Chrome lo arma con el manifest que había al cargar, y solo instala esa app
let appDelAviso: AppPwa | null = null;
// App pedida con ?instalar=... al abrir esta pestaña (el router puede quitar luego el parámetro, por eso se lee al arrancar)
let appPedida: AppPwa | null = null;
let instalada = false;
let capturaIniciada = false;
const oyentes = new Set<() => void>();

const avisar = () => oyentes.forEach((fn) => fn());

/** Escucha beforeinstallprompt una sola vez; llamar al arrancar la app. */
export function iniciarCapturaInstalar(): void {
  if (capturaIniciada || typeof window === 'undefined') return;
  capturaIniciada = true;
  appPedida = appPedidaValida(window.location.search);
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    diferido = e as EventoInstalar;
    appDelAviso = appDeRuta();
    avisar();
    // Chrome solo deja abrir el aviso tras un toque; si esta pestaña no lo tiene, instalar() falla sin ruido y queda el botón
    if (appPedida) void instalar();
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

/** Descarte solo para esta sesión de navegación: en la siguiente visita el aviso vuelve. */
export function estaDescartado(): boolean {
  try {
    return window.sessionStorage.getItem(CLAVE_DESCARTE) === '1';
  } catch {
    return false; // sin almacenamiento (modo privado): el aviso reaparece, no rompe nada
  }
}

export function descartarInstalar(): void {
  try {
    window.sessionStorage.setItem(CLAVE_DESCARTE, '1');
  } catch {
    // sin almacenamiento: se queda solo en esta sesión
  }
  avisar();
}

/**
 * Siempre hay algo que ofrecer mientras no esté instalada EN ESTE equipo: el aviso del navegador, la guía de iOS o los pasos
 * manuales. Chrome da el aviso una sola vez por carga y no lo da si ya se instaló o se descartó antes, así que depender del
 * evento hacía desaparecer la opción en otros equipos o tras cerrar el aviso.
 */
export function puedeInstalar(): boolean {
  return !estaInstalada();
}

/** true si el navegador da el aviso de instalar (no iOS); false si solo cabe la guía. */
export function tieneAvisoNativo(): boolean {
  return appDelAvisoNativo() !== null;
}

/** Lanza el aviso del navegador. Devuelve 'no-disponible' si no hay evento (iOS o navegador sin soporte). */
export async function instalar(): Promise<'aceptada' | 'descartada' | 'no-disponible'> {
  // El aviso lo armó el manifest de otra área (p. ej. se cargó en el panel y se navegó a la carta): se descarta, no se usa
  if (diferido && appDelAviso !== appDeRuta()) diferido = null;
  if (!diferido) return 'no-disponible';
  const evento = diferido;
  diferido = null;
  try {
    await evento.prompt();
  } catch {
    diferido = evento; // sin toque del usuario el navegador lo rechaza: se conserva para el botón
    return 'no-disponible';
  }
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

/** App que el navegador instalaría con el aviso guardado (null si no hay aviso). */
export function appDelAvisoNativo(): AppPwa | null {
  return diferido && appDelAviso === appDeRuta() ? appDelAviso : null;
}

/** App pedida con ?instalar= al abrir esta pestaña. */
export function appSolicitada(): AppPwa | null {
  return appPedida;
}

/** Apps ya instaladas en este equipo: la que corre en modo app y las que el navegador reporte (getInstalledRelatedApps). */
export async function appsInstaladas(): Promise<AppPwa[]> {
  const encontradas = new Set<AppPwa>();
  if (estaInstalada()) encontradas.add(appDeRuta());
  try {
    const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<{ url?: string }[]> };
    const lista = (await nav.getInstalledRelatedApps?.()) ?? [];
    for (const app of Object.keys(APPS_PWA) as AppPwa[]) {
      if (lista.some((r) => r.url?.endsWith(APPS_PWA[app].manifest))) encontradas.add(app);
    }
  } catch {
    // navegador sin soporte: solo cuenta la detección por modo app
  }
  return [...encontradas];
}

/**
 * Busca una versión nueva de la app y la aplica. 'actualizando' = hay cambios y la página se recarga sola;
 * 'al-dia' = ya tiene lo último; 'no-disponible' = el navegador no tiene service worker.
 */
export async function buscarActualizacion(): Promise<'actualizando' | 'al-dia' | 'no-disponible'> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return 'no-disponible';
  const registro = await navigator.serviceWorker.getRegistration();
  if (!registro) return 'no-disponible';
  await registro.update();
  const nuevo = registro.waiting ?? registro.installing;
  if (!nuevo) return 'al-dia';
  nuevo.postMessage({ type: 'SKIP_WAITING' });
  window.setTimeout(() => window.location.reload(), 1500); // el sw nuevo toma el control y recarga; esto cubre si no lo hace
  return 'actualizando';
}

/** Ruta a abrir en una pestaña nueva para instalar esa app con su propio manifest. */
export function urlInstalarApp(app: AppPwa): string {
  return `${APPS_PWA[app].inicio}${APPS_PWA[app].inicio.includes('?') ? '&' : '?'}instalar=${app}`;
}
