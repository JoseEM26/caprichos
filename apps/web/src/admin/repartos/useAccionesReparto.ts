import { useState } from 'react';
import { repartosApi, PedidoReparto } from './repartosApi';
import { ErrorApi } from '../../comun/api';

export function useAccionesReparto({ alActualizar }: { alActualizar: () => void }) {
  const [cargandoAccion, setCargandoAccion] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  const [confirmarAccion, setConfirmarAccion] = useState<{
    abierto: boolean;
    titulo: string;
    mensaje: string;
    ejecutar: () => Promise<void>;
  }>({
    abierto: false,
    titulo: '',
    mensaje: '',
    ejecutar: async () => {},
  });

  const pedirConfirmacion = (
    titulo: string,
    mensaje: string,
    ejecutar: () => Promise<void>,
  ) => {
    setErrorAccion(null);
    setConfirmarAccion({
      abierto: true,
      titulo,
      mensaje,
      ejecutar,
    });
  };

  const cerrarConfirmacion = () => {
    setConfirmarAccion((prev) => ({ ...prev, abierto: false }));
  };

  const tomar = (pedido: PedidoReparto) => {
    if (pedido.lat == null || pedido.lng == null) {
      setErrorAccion(
        'El pedido no tiene ubicación: caja debe ubicarlo antes de que se pueda tomar',
      );
      return;
    }

    pedirConfirmacion(
      '¿Seguro que quieres tomar este pedido?',
      `Quedará asignado a ti (pedido ${pedido.codigo}) y desaparecerá de disponibles para otros repartidores.`,
      async () => {
        try {
          setCargandoAccion(true);
          await repartosApi.tomarPedido(pedido.id);
          cerrarConfirmacion();
          alActualizar();
        } catch (err: any) {
          cerrarConfirmacion();
          if (err instanceof ErrorApi) {
            if (err.codigo === 'LIMITE_PEDIDOS') {
              setErrorAccion(
                err.message || 'Ya llevas 3 pedidos: entrega alguno antes de tomar otro',
              );
            } else if (err.codigo === 'YA_TOMADO') {
              setErrorAccion(err.message || 'Otro repartidor ya tomó este pedido');
            } else if (err.codigo === 'FALTA_UBICAR') {
              setErrorAccion(
                err.message ||
                  'El pedido no tiene ubicación: caja debe ubicarlo antes de que se pueda tomar',
              );
            } else {
              setErrorAccion(err.message || 'Error al tomar el pedido');
            }
          } else {
            setErrorAccion('Error al tomar el pedido');
          }
        } finally {
          setCargandoAccion(false);
        }
      },
    );
  };

  const salir = (pedido: PedidoReparto) => {
    pedirConfirmacion(
      '¿Marcar salida con el pedido?',
      `El pedido ${pedido.codigo} pasará a estado EN CAMINO. Se registrará la hora de salida.`,
      async () => {
        try {
          setCargandoAccion(true);
          await repartosApi.salir(pedido.id);
          cerrarConfirmacion();
          alActualizar();
        } catch (err: any) {
          cerrarConfirmacion();
          setErrorAccion(err instanceof ErrorApi ? err.message : 'Error al marcar salida');
        } finally {
          setCargandoAccion(false);
        }
      },
    );
  };

  const llegue = (pedido: PedidoReparto) => {
    pedirConfirmacion(
      '¿Marcar que has llegado?',
      `Se registrará que has llegado al destino del pedido ${pedido.codigo}.`,
      async () => {
        try {
          setCargandoAccion(true);
          await repartosApi.llegue(pedido.id);
          cerrarConfirmacion();
          alActualizar();
        } catch (err: any) {
          cerrarConfirmacion();
          setErrorAccion(err instanceof ErrorApi ? err.message : 'Error al marcar llegada');
        } finally {
          setCargandoAccion(false);
        }
      },
    );
  };

  const entregar = (pedido: PedidoReparto) => {
    const esEfectivoPendiente =
      pedido.cobro_pendiente_efectivo ||
      pedido.cobroPendienteEfectivo ||
      (pedido.pago_estado !== 'PAGADO' && pedido.pago_metodo === 'EFECTIVO');

    const textoCobro = esEfectivoPendiente
      ? ` Efectivo a rendir en caja: S/ ${Number(pedido.total).toFixed(2)} (no se cobra aquí, se liquida al cerrar turno).`
      : ' Pedido ya pagado previamente.';

    pedirConfirmacion(
      '¿Confirmar entrega al cliente?',
      `El pedido ${pedido.codigo} pasará a ENTREGADO.${textoCobro}`,
      async () => {
        try {
          setCargandoAccion(true);
          await repartosApi.entregar(pedido.id);
          cerrarConfirmacion();
          alActualizar();
        } catch (err: any) {
          cerrarConfirmacion();
          setErrorAccion(err instanceof ErrorApi ? err.message : 'Error al entregar pedido');
        } finally {
          setCargandoAccion(false);
        }
      },
    );
  };

  const liberar = (pedido: PedidoReparto, motivo = 'Liberado desde panel') => {
    pedirConfirmacion(
      '¿Liberar este pedido?',
      `El pedido ${pedido.codigo} volverá a la lista de pedidos disponibles sin repartidor asignado.`,
      async () => {
        try {
          setCargandoAccion(true);
          await repartosApi.liberarPedido(pedido.id, motivo);
          cerrarConfirmacion();
          alActualizar();
        } catch (err: any) {
          cerrarConfirmacion();
          setErrorAccion(err instanceof ErrorApi ? err.message : 'Error al liberar pedido');
        } finally {
          setCargandoAccion(false);
        }
      },
    );
  };

  const reasignar = (pedido: PedidoReparto, nuevoRepartidorPartyId: string, motivo = 'Reasignado desde panel') => {
    pedirConfirmacion(
      '¿Reasignar este pedido?',
      `El pedido ${pedido.codigo} se asignará al nuevo repartidor seleccionado.`,
      async () => {
        try {
          setCargandoAccion(true);
          await repartosApi.reasignarPedido(pedido.id, nuevoRepartidorPartyId, motivo);
          cerrarConfirmacion();
          alActualizar();
        } catch (err: any) {
          cerrarConfirmacion();
          setErrorAccion(err instanceof ErrorApi ? err.message : 'Error al reasignar pedido');
        } finally {
          setCargandoAccion(false);
        }
      },
    );
  };

  return {
    cargandoAccion,
    errorAccion,
    setErrorAccion,
    confirmarAccion,
    cerrarConfirmacion,
    tomar,
    salir,
    llegue,
    entregar,
    liberar,
    reasignar,
  };
}
