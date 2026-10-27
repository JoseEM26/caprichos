import { useState, useEffect, useCallback, useRef } from 'react';
import type { EstadoCapri } from '../../mascota';
import {
  obtenerContextoAyuda,
  enviarPreguntaAyuda,
  type EnlaceAyuda,
  type EstadoRespuestaAyuda,
  type MensajeHistorial,
} from './ayudaApi';

export interface MensajeChat {
  id: string;
  emisor: 'usuario' | 'capri';
  texto: string;
  enlaces?: EnlaceAyuda[];
  aviso?: string;
  estado?: EstadoRespuestaAyuda;
  creadoEn?: Date;
}

const MENSAJE_BIENVENIDA_INICIAL: MensajeChat = {
  id: 'bienvenida',
  emisor: 'capri',
  texto: 'Hola, soy Capri. Te explico paso a paso cómo se hace cada cosa en el sistema. ¿Qué necesitas?',
};

export function useAyuda(rutaActual: string) {
  const [abierto, setAbierto] = useState<boolean>(false);
  const [estadoCapri, setEstadoCapri] = useState<EstadoCapri>('reposo');
  const [mensajes, setMensajes] = useState<MensajeChat[]>([MENSAJE_BIENVENIDA_INICIAL]);
  const [sugerencias, setSugerencias] = useState<string[]>([]);
  const [enlacesContexto, setEnlacesContexto] = useState<EnlaceAyuda[]>([]);
  const [cargando, setCargando] = useState<boolean>(false);

  // Mantener referencia al historial para no perder el contexto al enviar
  const mensajesRef = useRef<MensajeChat[]>(mensajes);
  mensajesRef.current = mensajes;

  // Cargar contexto según la ruta
  const cargarContexto = useCallback(async (ruta: string) => {
    try {
      const contexto = await obtenerContextoAyuda(ruta);
      if (contexto.sugerencias && contexto.sugerencias.length > 0) {
        setSugerencias(contexto.sugerencias);
      }
      if (contexto.enlaces) {
        setEnlacesContexto(contexto.enlaces);
      }
    } catch {
      // No arroja errores a la UI, mantiene sugerencias por defecto
    }
  }, []);

  // Cargar o refrescar contexto al cambiar la ruta
  useEffect(() => {
    cargarContexto(rutaActual);
  }, [rutaActual, cargarContexto]);

  const abrir = useCallback(() => {
    setAbierto(true);
    setEstadoCapri('saludando');
    cargarContexto(rutaActual);
  }, [rutaActual, cargarContexto]);

  const cerrar = useCallback(() => {
    setAbierto(false);
    setEstadoCapri('reposo');
  }, []);

  const alternar = useCallback(() => {
    if (abierto) {
      cerrar();
    } else {
      abrir();
    }
  }, [abierto, abrir, cerrar]);

  const reiniciar = useCallback(() => {
    setMensajes([MENSAJE_BIENVENIDA_INICIAL]);
    setEstadoCapri('saludando');
  }, []);

  const enviar = useCallback(
    async (preguntaTexto: string) => {
      const limpia = (preguntaTexto || '').trim();
      if (!limpia || cargando) {
        return;
      }

      const mensajeUsuario: MensajeChat = {
        id: `usuario-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        emisor: 'usuario',
        texto: limpia,
        creadoEn: new Date(),
      };

      // Agregar mensaje de usuario en memoria
      setMensajes((prev) => [...prev, mensajeUsuario]);
      setCargando(true);
      setEstadoCapri('pensando');

      // Preparar historial de hasta 6 mensajes
      const historial: MensajeHistorial[] = mensajesRef.current
        .slice(-6)
        .map((m) => ({
          rol: m.emisor === 'usuario' ? 'usuario' : 'capri',
          texto: m.texto,
        }));

      try {
        const respuesta = await enviarPreguntaAyuda({
          pregunta: limpia,
          ruta: rutaActual,
          historial,
        });

        const mensajeCapri: MensajeChat = {
          id: `capri-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          emisor: 'capri',
          texto: respuesta.respuesta,
          enlaces: respuesta.enlaces,
          estado: respuesta.estado,
          creadoEn: new Date(),
        };

        setMensajes((prev) => [...prev, mensajeCapri]);

        if (respuesta.estado === 'ok') {
          setEstadoCapri('hablando');
        } else {
          // rechazada, sin_ia, tope, limite -> confundido
          setEstadoCapri('confundido');
        }
      } catch (err) {
        const mensajeError: MensajeChat = {
          id: `capri-error-${Date.now()}`,
          emisor: 'capri',
          texto:
            'Ocurrió un problema al procesar tu consulta. Puedes intentarlo nuevamente o pedir asistencia al administrador.',
          enlaces: [],
          estado: 'sin_ia',
          creadoEn: new Date(),
        };
        setMensajes((prev) => [...prev, mensajeError]);
        setEstadoCapri('confundido');
      } finally {
        setCargando(false);
      }
    },
    [cargando, rutaActual]
  );

  return {
    abierto,
    estadoCapri,
    mensajes,
    sugerencias,
    enlacesContexto,
    cargando,
    abrir,
    cerrar,
    alternar,
    reiniciar,
    enviar,
    setEstadoCapri,
  };
}
