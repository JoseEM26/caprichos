import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getTokenAcceso } from './api';

let socketInstancia: Socket | null = null;
let tokenConectado = '';

/**
 * Obtiene o inicializa la conexión persistente con Socket.IO utilizando
 * el token de acceso de la sesión en el handshake (auth: { token }).
 */
export function conectarSocket(): Socket {
  const token = getTokenAcceso() || '';

  if (socketInstancia) {
    // Si el token cambió (inicio de sesión o renovación), reconectar con el vigente
    if (tokenConectado !== token) {
      tokenConectado = token;
      if (socketInstancia.connected) {
        socketInstancia.disconnect().connect();
      } else {
        socketInstancia.connect();
      }
    }
    return socketInstancia;
  }

  tokenConectado = token;
  socketInstancia = io({
    // solo websocket: con varios servidores detrás, el sondeo HTTP podría caer en otro servidor y cortarse
    transports: ['websocket'],
    // función: en cada (re)conexión toma el token vigente, no el del primer intento
    auth: (cb) => cb({ token: getTokenAcceso() || '' }),
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  // Si el servidor corta (token vencido tras un reinicio o despliegue), socket.io no reintenta solo:
  // se reintenta con el token vigente hasta que entre.
  socketInstancia.on('disconnect', (motivo) => {
    if (motivo !== 'io server disconnect') return;
    const reintentar = () => {
      if (!socketInstancia || socketInstancia.connected) return;
      socketInstancia.connect();
      setTimeout(reintentar, 5000);
    };
    setTimeout(reintentar, 2000);
  });

  return socketInstancia;
}

/**
 * Desconecta y limpia la instancia de socket (por ejemplo al cerrar sesión).
 */
export function desconectarSocket(): void {
  if (socketInstancia) {
    socketInstancia.disconnect();
    socketInstancia = null;
  }
}

/**
 * Retorna la instancia actual de Socket si existe.
 */
export function obtenerSocket(): Socket | null {
  return socketInstancia;
}

/**
 * Hook reactivo para suscribirse a un evento de Socket.IO con limpieza automática al desmontar.
 *
 * @param evento Nombre del evento (ej: 'pedido:estado', 'pedido:nuevo', 'pedido:pago', 'caja:*')
 * @param callback Función receptora de los datos emitidos
 */
export function useEventos<T = any>(
  evento: string,
  callback: (datos: T) => void,
): void {
  useEffect(() => {
    const socket = conectarSocket();
    socket.on(evento, callback);

    return () => {
      socket.off(evento, callback);
    };
  }, [evento, callback]);
}

/** Espera (ms) que junta una ráfaga de eventos en una sola recarga. */
export const ESPERA_RECARGA_MS = 300;
/** Sondeo de respaldo (ms): solo corre mientras el socket está desconectado. */
export const SONDEO_SIN_SOCKET_MS = 60_000;

/** true mientras el socket está conectado; false = «Reconectando…». */
export function useSocketConectado(): boolean {
  const [conectado, setConectado] = useState<boolean>(() => conectarSocket().connected);
  useEffect(() => {
    const socket = conectarSocket();
    const alta = () => setConectado(true);
    const baja = () => setConectado(false);
    socket.on('connect', alta);
    socket.on('disconnect', baja);
    setConectado(socket.connected);
    return () => {
      socket.off('connect', alta);
      socket.off('disconnect', baja);
    };
  }, []);
  return conectado;
}

/**
 * Recarga (con antirrebote) al llegar cualquiera de `eventos`,
 * al reconectar el socket y al volver la pestaña al frente; y sondea cada 60 s solo con el socket caído.
 */
export function useTiempoReal(
  eventos: readonly string[],
  recargar: () => void,
  esperaMs: number = ESPERA_RECARGA_MS,
): void {
  const ultima = useRef(recargar);
  ultima.current = recargar;
  const clave = eventos.join('|');

  useEffect(() => {
    const socket = conectarSocket();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const disparar = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        ultima.current();
      }, esperaMs);
    };
    const lista = clave ? clave.split('|') : [];
    lista.forEach((e) => socket.on(e, disparar));

    // Reconexión: solo si antes hubo una caída (la primera conexión ya cargó la pantalla)
    let cayo = !socket.connected;
    const alBajar = () => { cayo = true; };
    const alConectar = () => {
      if (!cayo) return;
      cayo = false;
      disparar();
    };
    socket.on('disconnect', alBajar);
    socket.on('connect', alConectar);

    const alVolver = () => {
      if (document.visibilityState === 'visible') disparar();
    };
    document.addEventListener('visibilitychange', alVolver);

    const sondeo = setInterval(() => {
      if (!socket.connected) ultima.current();
    }, SONDEO_SIN_SOCKET_MS);

    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(sondeo);
      lista.forEach((e) => socket.off(e, disparar));
      socket.off('disconnect', alBajar);
      socket.off('connect', alConectar);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [clave, esperaMs]);
}
