import type { DetalleConversacion } from './mensajesTipos';
import { fechaCompletaChat, horaDeChat } from './fechasChat';

const ESTADO_ENTREGA: Record<string, string> = { ENVIADO: 'enviada', ENTREGADO: 'entregada', LEIDO: 'leída' };

/**
 * Por qué el chat está cerrado (más de 24 h) y qué pasó con la plantilla de reapertura:
 * `esperando` = ya se envió una plantilla después del último mensaje del cliente y aún no responde.
 */
export function estadoVentana(detalle: Pick<DetalleConversacion, 'mensajes'>) {
  const msgs = detalle.mensajes ?? [];
  const ultimoCliente = [...msgs].reverse().find((m) => !m.saliente && m.fecha)?.fecha ?? null;
  const plantilla = [...msgs].reverse().find((m) => m.saliente && m.plantilla && m.fecha && m.estado !== 'FALLIDO') ?? null;
  const esperando = !!plantilla && (!ultimoCliente || plantilla.fecha! > ultimoCliente);
  return {
    esperando,
    textoPorQue: ultimoCliente
      ? `El cliente no te escribió en las últimas 24 h (último mensaje suyo: ${fechaCompletaChat(ultimoCliente)}) — WhatsApp solo permite enviar una plantilla aprobada. Cuando responda, podrás escribirle libremente.`
      : 'Este cliente nunca te ha escrito por WhatsApp (su pedido salió de la carta) — WhatsApp solo permite enviar una plantilla aprobada. Cuando responda, podrás escribirle libremente.',
    textoEnviada: plantilla
      ? `Plantilla enviada ${horaDeChat(plantilla.fecha!)}${plantilla.estado && ESTADO_ENTREGA[plantilla.estado] ? ` (${ESTADO_ENTREGA[plantilla.estado]})` : ''} · esperando respuesta del cliente`
      : '',
  };
}
