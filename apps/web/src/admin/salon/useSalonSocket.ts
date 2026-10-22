import { useCallback, useState } from 'react';
import { useEventos } from '../../comun/socket';
import { AvisoPedidoListo } from './tipos';
import { reproducirAvisoListo } from './audioAlerta';

interface UseSalonSocketOpciones {
  onMesaCambio?: (datos: { mesaId: string; estado: 'LIBRE' | 'OCUPADA' }) => void;
  onPlanoCambio?: (datos: any) => void;
  onReservaCambio?: (datos: any) => void;
  onPedidoListo?: (aviso: AvisoPedidoListo) => void;
}

export function useSalonSocket(opciones: UseSalonSocketOpciones = {}) {
  const [avisoListo, setAvisoListo] = useState<AvisoPedidoListo | null>(null);

  const manejarListo = useCallback(
    (datos: any) => {
      if (!datos) return;
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
      opciones.onPedidoListo?.(aviso);
    },
    [opciones],
  );

  const manejarMesa = useCallback(
    (datos: any) => {
      if (datos && datos.mesaId && datos.estado) {
        opciones.onMesaCambio?.(datos);
      }
    },
    [opciones],
  );

  const manejarPlano = useCallback(
    (datos: any) => {
      opciones.onPlanoCambio?.(datos);
    },
    [opciones],
  );

  const manejarReserva = useCallback(
    (datos: any) => {
      opciones.onReservaCambio?.(datos);
    },
    [opciones],
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
