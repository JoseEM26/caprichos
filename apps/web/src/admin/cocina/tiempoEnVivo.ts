import { useSyncExternalStore } from 'react';
import type { ColorComanda, UmbralesCocina } from './cocinaTipos';

/** Mismos valores por defecto que el servidor (cocina.util / comandas.service). */
export const UMBRALES_DEFECTO: UmbralesCocina = { naranjaMin: 35, rojoMin: 50 };

export function colorPorMinutos(minutos: number, umbrales: UmbralesCocina = UMBRALES_DEFECTO): ColorComanda {
  if (minutos >= umbrales.rojoMin) return 'ROJO';
  if (minutos >= umbrales.naranjaMin) return 'NARANJA';
  return 'VERDE';
}

/** Texto que acompaña al color: el color solo no basta (accesibilidad). */
export const ETIQUETA_COLOR: Record<ColorComanda, string> = {
  VERDE: 'En tiempo',
  NARANJA: 'Atención',
  ROJO: 'Urgente',
};

// Reloj del servidor: diferencia (ms) entre la hora del servidor y la del navegador.
// Se fija cada vez que llega un listado con `ahoraServidor`.
let desfaseMs = 0;

export function registrarHoraServidor(iso: string | null | undefined): void {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isNaN(t)) desfaseMs = t - Date.now();
}

export function ahoraServidorMs(): number {
  return Date.now() + desfaseMs;
}

// Un solo temporizador compartido por todas las tarjetas: avisa cada segundo y se detiene sin suscriptores.
const suscriptores = new Set<() => void>();
let intervalo: ReturnType<typeof setInterval> | null = null;

function suscribir(aviso: () => void): () => void {
  suscriptores.add(aviso);
  if (intervalo === null) {
    intervalo = setInterval(() => suscriptores.forEach((f) => f()), 1000);
  }
  return () => {
    suscriptores.delete(aviso);
    if (suscriptores.size === 0 && intervalo !== null) {
      clearInterval(intervalo);
      intervalo = null;
    }
  };
}

/** Segundo entero (hora del servidor). Cambia solo una vez por segundo: las tarjetas re-renderizan poco. */
function segundoActual(): number {
  return Math.floor(ahoraServidorMs() / 1000);
}

export function useSegundoServidor(): number {
  return useSyncExternalStore(suscribir, segundoActual, segundoActual);
}

/** mm:ss hasta la hora; h:mm:ss a partir de 1 hora. */
export function formatearTranscurrido(totalSeg: number): string {
  const s = Math.max(0, Math.floor(totalSeg));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export interface TiempoEnVivo {
  segundos: number;
  minutos: number;
  color: ColorComanda;
  texto: string;
  etiqueta: string;
}

/**
 * Tiempo desde `desde` (hora de llegada del pedido, ISO) contado con la hora del servidor.
 * Sin `desde` usa `minutosRespaldo` (la cifra que trajo el servidor).
 */
export function useTiempoEnVivo(
  desde: string | null | undefined,
  minutosRespaldo = 0,
  umbrales: UmbralesCocina = UMBRALES_DEFECTO,
): TiempoEnVivo {
  const ahora = useSegundoServidor() * 1000;
  const t = desde ? Date.parse(desde) : NaN;
  const segundos = Number.isNaN(t) ? Math.max(0, minutosRespaldo) * 60 : Math.max(0, Math.floor((ahora - t) / 1000));
  const minutos = Math.floor(segundos / 60);
  const color = colorPorMinutos(minutos, umbrales);
  return { segundos, minutos, color, texto: formatearTranscurrido(segundos), etiqueta: ETIQUETA_COLOR[color] };
}
