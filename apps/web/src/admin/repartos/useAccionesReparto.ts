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
      '¿Ya salió con el pedido?',
      `Se registra la hora de salida del pedido ${pedido.codigo} y se avisa al cliente por WhatsApp con el tiempo estimado.`,
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
      '¿Ya llegó?',
      `Se avisa al cliente que su repartidor llegó (pedido ${pedido.codigo}) y se abre el cobro y la entrega.`,
      async () => {
        try {
          setCargandoAccion(true);
          await repartosApi.llegue(pedido.id);
          cerrarConfirmacion();
          alActualizar();
          // «Ya llegó» abre directo el cobro y la entrega: no hay un botón aparte de «Entregado»
          entregar(pedido);
        } catch (err: any) {
          cerrarConfirmacion();
          setErrorAccion(err instanceof ErrorApi ? err.message : 'Error al marcar llegada');
        } finally {
          setCargandoAccion(false);
        }
      },
    );
  };

  function entregar(pedido: PedidoReparto) {
    const esEfectivoPendiente =
      pedido.cobro_pendiente_efectivo ||
      pedido.cobroPendienteEfectivo ||
      (pedido.pago_estado !== 'PAGADO' && pedido.pago_metodo === 'EFECTIVO');

    const total = Number(pedido.total).toFixed(2);
    const pagaCon = Number(pedido.paga_con ?? 0);
    const vuelto = pagaCon > Number(pedido.total) ? ` Paga con S/ ${pagaCon.toFixed(2)}: lleva vuelto S/ ${(pagaCon - Number(pedido.total)).toFixed(2)}.` : '';
    const pagoDigital = pedido.pago_estado !== 'PAGADO' && ['YAPE', 'PLIN', 'TRANSFERENCIA'].includes(String(pedido.pago_metodo).toUpperCase());
    const textoCobro = esEfectivoPendiente
      ? ` Cobra S/ ${total} en efectivo.${vuelto} Se rinde en caja al cerrar turno.`
      : pagoDigital
        ? ` Pago por ${String(pedido.pago_metodo)} de S/ ${total}: confirma que el cliente ya pagó.`
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
  }

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
  };
}
