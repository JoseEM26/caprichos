import { ContextoConversacion, EntradaNormalizada, FlujoConversacion, ResultadoTransicion } from '../../tipos-conversacion';

/** «cancelar», «anular mi pedido», «ya no lo quiero»: pide cancelar un pedido (no una reserva). */
export const RE_PIDE_CANCELAR_PEDIDO = /(cancel|anul|ya no (lo )?(quiero|necesito))/;
const RE_RESERVA = /reserv|mesa/;

export const ID_CANCELAR_SI = 'cx_si:';
export const ID_CANCELAR_NO = 'cx_no';

export const pideCancelarPedido = (entrada: EntradaNormalizada): boolean =>
  (entrada.id ?? '').startsWith(ID_CANCELAR_SI) ||
  entrada.id === ID_CANCELAR_NO ||
  (RE_PIDE_CANCELAR_PEDIDO.test(entrada.texto) && !RE_RESERVA.test(entrada.texto));

const volver = { id: 'menu', titulo: 'Volver al menú' };

/**
 * El cliente cancela un pedido SIN pagar desde el chat (de cualquier canal).
 * Sin estado propio: el botón lleva el código del pedido y el ejecutor vuelve a validar celular y regla.
 * Devuelve null si no aplica (sin pedidos recientes): sigue el camino de siempre (solicitud a Caja).
 */
export function atenderCancelarCliente(flujo: FlujoConversacion, entrada: EntradaNormalizada, contexto: ContextoConversacion): ResultadoTransicion | null {
  const lista = contexto.cancelablesCliente;
  if (!lista?.length || !pideCancelarPedido(entrada)) return null;
  const responder = (acciones: ResultadoTransicion['acciones']): ResultadoTransicion => ({
    nuevoEstado: 'MENU',
    acciones,
    nuevoFlujo: { ...flujo, estado: 'MENU', pedido: null, repreguntasFallidas: 0 },
  });

  if (entrada.id === ID_CANCELAR_NO) {
    return responder([{ tipo: 'enviarBotones', texto: 'Listo, tu pedido sigue en pie. 💛', botones: [volver] }]);
  }

  if (entrada.id?.startsWith(ID_CANCELAR_SI)) {
    const codigo = entrada.id.slice(ID_CANCELAR_SI.length);
    const p = lista.find((x) => x.codigo === codigo);
    if (p?.cancelable) return responder([{ tipo: 'cancelarPedidoCliente', pedidoCodigo: p.codigo }]);
    return responder([{ tipo: 'enviarBotones', texto: p?.mensaje ?? 'No encontré ese pedido entre tus pedidos recientes.', botones: [{ id: 'persona', titulo: 'Hablar con una persona' }, volver] }]);
  }

  const cancelable = lista.find((x) => x.cancelable);
  if (cancelable) {
    return responder([
      {
        tipo: 'enviarBotones',
        texto: `¿Quieres cancelar tu pedido ${cancelable.codigo}? Aún no está pagado, así que se cancela sin costo.`,
        botones: [{ id: `${ID_CANCELAR_SI}${cancelable.codigo}`, titulo: `Cancelar ${cancelable.codigo}`.slice(0, 20) }, { id: ID_CANCELAR_NO, titulo: 'No, mantenerlo' }],
      },
    ]);
  }
  const ultimo = lista[0];
  return responder([{ tipo: 'enviarBotones', texto: `Pedido ${ultimo.codigo}: ${ultimo.mensaje ?? 'ya no se puede cancelar.'}`, botones: [{ id: 'persona', titulo: 'Hablar con una persona' }, volver] }]);
}
