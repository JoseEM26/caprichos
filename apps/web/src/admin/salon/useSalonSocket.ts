import { useCallback, useRef, useState } from 'react';
import { useEventos } from '../../comun/socket';
import { AvisoPedidoListo } from './tipos';
import { reproducirAvisoListo } from './audioAlerta';
import { useSesion } from '../../comun/sesion';
import { debeAvisarMesaLista } from './avisoMesaLista';

interface UseSalonSocketOpciones {
  onMesaCambio?: (datos: { mesaId: string; estado: 'LIBRE' | 'OCUPADA' }) => void;
  onPlanoCambio?: (datos: any) => void;
  onReservaCambio?: (datos: any) => void;
  onPedidoListo?: (aviso: AvisoPedidoListo) => void;
}

export function useSalonSocket(opciones: UseSalonSocketOpciones = {}) {
  const [avisoListo, setAvisoListo] = useState<AvisoPedidoListo | null>(null);
  let sesion: ReturnType<typeof useSesion> | null = null;
  try {
    sesion = useSesion();
  } catch {
    sesion = null; // sin proveedor de sesión (pruebas): se avisa como siempre
  }
  const sesionRef = useRef(sesion);
  sesionRef.current = sesion;
  // las funciones de quien llama cambian en cada render: se leen desde una ref para no volver a suscribirse
  const refOpciones = useRef(opciones);
  refOpciones.current = opciones;

  const manejarListo = useCallback(
    (datos: any) => {
      if (!datos) return;
      if (!debeAvisarMesaLista(datos.mozoPartyId, sesionRef.current)) return;
      const aviso: AvisoPedidoListo = {
        pedidoId: String(datos.pedidoId || ''),
        codigo: String(datos.codigo || ''),
        mesas: Array.isArray(datos.mesas) ? datos.mesas.map(String) : [],
        mozoPartyId: datos.mozoPartyId ? String(datos.mozoPartyId) : undefined,
        recibidoEn: new Date().toLocaleTimeString('es-PE', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      reproducirAvisoListo();
      setAvisoListo(aviso);
      refOpciones.current.onPedidoListo?.(aviso);
    },
    [],
  );

  const manejarMesa = useCallback(
    (datos: any) => {
      if (datos && datos.mesaId && datos.estado) {
        refOpciones.current.onMesaCambio?.(datos);
      }
    },
    [],
  );

  const manejarPlano = useCallback(
    (datos: any) => {
      refOpciones.current.onPlanoCambio?.(datos);
    },
    [],
  );

  const manejarReserva = useCallback(
    (datos: any) => {
      refOpciones.current.onReservaCambio?.(datos);
    },
    [],
  );

  useEventos('salon:listo', manejarListo);
  useEventos('salon:mesa', manejarMesa);
  useEventos('plano:cambio', manejarPlano);
  useEventos('reserva:cambio', manejarReserva);

  const cerrarAvisoListo = useCallback(() => {
    setAvisoListo(null);
  }, []);

  return {
    avisoListo,
    cerrarAvisoListo,
  };
}
