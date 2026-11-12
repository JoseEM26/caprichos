import { useEffect } from 'react';
import { useCuentaOpcional } from './cuenta/CuentaContext';
import { useEsMovil } from './useEsMovil';

/**
 * Embudo de la carta (Análisis › Clientes): eventos ANÓNIMOS. Solo viaja un código al azar de la sesión del navegador,
 * el evento, el tipo de dispositivo y si había sesión: nunca celular, nombre ni modelo del aparato.
 * La carta no tiene banner de cookies (solo usa la cookie de la cuenta, necesaria para entrar): se respeta «no rastrear»
 * (DNT / GPC) del navegador y, si está activo, no se envía nada ni se crea el código.
 */
export type EventoCartaTipo = 'VISITA' | 'CARRITO' | 'CHECKOUT' | 'PAGO';

const CLAVE_SESION = 'cp_carta_sid';
const CLAVE_ENVIADOS = 'cp_carta_ev';

const estado = { activo: true, movil: false, conSesion: false };
const enviadosMemoria = new Set<string>();
let sesionMemoria: string | null = null;

/** Verdadero si el navegador pide no ser rastreado. */
export function noRastrear(): boolean {
  try {
    const n = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
    const w = window as Window & { doNotTrack?: string };
    return n.doNotTrack === '1' || n.doNotTrack === 'yes' || w.doNotTrack === '1' || n.msDoNotTrack === '1' || n.globalPrivacyControl === true;
  } catch {
    return false;
  }
}

function codigoAleatorio(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID().replace(/-/g, '');
  } catch {
    /* sin crypto: se usa el respaldo */
  }
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
}

/** Código al azar de esta sesión del navegador (sessionStorage; si no se puede, dura lo que dure la página). Null con «no rastrear». */
export function idSesionCarta(): string | null {
  if (noRastrear()) return null;
  try {
    const guardado = sessionStorage.getItem(CLAVE_SESION);
    if (guardado) return guardado;
    const nuevo = codigoAleatorio();
    sessionStorage.setItem(CLAVE_SESION, nuevo);
    return nuevo;
  } catch {
    sesionMemoria ??= codigoAleatorio();
    return sesionMemoria;
  }
}

function yaEnviado(evento: string): boolean {
  if (enviadosMemoria.has(evento)) return true;
  try {
    return (sessionStorage.getItem(CLAVE_ENVIADOS) ?? '').split(',').includes(evento);
  } catch {
    return false;
  }
}

function marcarEnviado(evento: string) {
  enviadosMemoria.add(evento);
  try {
    const previos = (sessionStorage.getItem(CLAVE_ENVIADOS) ?? '').split(',').filter(Boolean);
    sessionStorage.setItem(CLAVE_ENVIADOS, [...previos, evento].join(','));
  } catch {
    /* storage bloqueado: queda solo en memoria */
  }
}

/** Envía un evento una vez por sesión. Fire-and-forget: nunca lanza, nunca espera y nunca bloquea la carta. */
export function emitirEventoCarta(evento: EventoCartaTipo): void {
  try {
    if (!estado.activo || yaEnviado(evento)) return;
    const sesion = idSesionCarta();
    if (!sesion) return;
    marcarEnviado(evento);
    const cuerpo = JSON.stringify({ sesion, evento, dispositivo: estado.movil ? 'MOVIL' : 'ESCRITORIO', conSesion: estado.conSesion });
    const enviado = typeof navigator.sendBeacon === 'function' && navigator.sendBeacon('/carta/eventos', new Blob([cuerpo], { type: 'application/json' }));
    if (!enviado && typeof fetch === 'function') {
      void Promise.resolve(fetch('/carta/eventos', { method: 'POST', body: cuerpo, headers: { 'Content-Type': 'application/json' }, keepalive: true })).catch(() => undefined);
    }
  } catch {
    /* un evento perdido no importa */
  }
}

/** Cabecera que liga el pedido con la sesión anónima (la pone el servidor en el embudo). Vacía si no se rastrea o es vista previa. */
export function cabeceraSesionCarta(): Record<string, string> {
  if (!estado.activo) return {};
  const id = idSesionCarta();
  return id ? { 'X-Carta-Sesion': id } : {};
}

/**
 * Hook de la carta: mantiene al día dispositivo y «con sesión» y, con `activo`, emite la visita (una por sesión).
 * `activo: false` (vista previa del diseñador, edición en sitio) apaga todos los eventos.
 */
export function useEventoCarta(opciones: { activo?: boolean; visita?: boolean } = {}) {
  const movil = useEsMovil();
  const cuenta = useCuentaOpcional();
  const conSesion = !!cuenta?.cliente;
  estado.movil = movil;
  estado.conSesion = conSesion;
  if (opciones.activo !== undefined) estado.activo = opciones.activo;
  useEffect(() => {
    if (opciones.visita && estado.activo) emitirEventoCarta('VISITA');
  }, [opciones.visita, opciones.activo]);
  return { emitir: emitirEventoCarta };
}

/** Solo para pruebas: vuelve al estado de una pestaña nueva. */
export function reiniciarEventosCarta() {
  enviadosMemoria.clear();
  sesionMemoria = null;
  estado.activo = true;
  try {
    sessionStorage.removeItem(CLAVE_SESION);
    sessionStorage.removeItem(CLAVE_ENVIADOS);
  } catch {
    /* sin storage */
  }
}
