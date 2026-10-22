import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { getTokenAcceso } from './api';

let socketInstancia: Socket | null = null;

/**
 * Obtiene o inicializa la conexión persistente con Socket.IO utilizando
 * el token de acceso de la sesión en el handshake (auth: { token }).
 */
export function conectarSocket(): Socket {
  const token = getTokenAcceso() || '';

  if (socketInstancia) {
    // Si el token cambió (por ejemplo tras renovación o inicio de sesión), actualizar auth
    if (socketInstancia.auth && (socketInstancia.auth as any).token !== token) {
      socketInstancia.auth = { token };
      if (socketInstancia.connected) {
        socketInstancia.disconnect().connect();
      }
    }
    return socketInstancia;
  }

  socketInstancia = io({
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
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
