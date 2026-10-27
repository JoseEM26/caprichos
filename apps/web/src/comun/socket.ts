import { useEffect } from 'react';
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
