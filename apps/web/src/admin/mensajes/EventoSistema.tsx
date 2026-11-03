import { DetalleConversacion } from './mensajesTipos';

export interface EventoChat {
  id: string;
  texto: string;
  /** «aviso» resalta algo que el asesor debe mirar; «normal» es solo informativo. */
  tono: 'aviso' | 'normal';
  testId?: string;
  /** Texto completo para el tooltip cuando la línea se recorta. */
  titulo?: string;
}

const ESTADO_TEXTO: Record<DetalleConversacion['estado'], EventoChat | null> = {
  atencion: { id: 'estado', texto: 'Pidió hablar con una persona. El bot no responde.', tono: 'aviso' },
  validar: { id: 'estado', texto: 'El bot espera tu decisión sobre el pago.', tono: 'aviso' },
  bot: { id: 'estado', texto: 'El bot atiende solo.', tono: 'normal' },
  pausado: { id: 'estado', texto: 'Bot en pausa: solo respondes tú.', tono: 'normal' },
  atendido: { id: 'estado', texto: 'Chat atendido.', tono: 'normal' },
};

/** Avisos del chat convertidos en eventos de una línea (no incluye lo que pide acción: eso va en la barra). */
export function eventosDelChat(detalle: DetalleConversacion): EventoChat[] {
  const eventos: EventoChat[] = [];
  if (detalle.simulado) {
    eventos.push({ id: 'simulado', texto: 'Modo simulado: no se envia a WhatsApp', tono: 'normal' });
  }
  if (detalle.motivoDerivacion) {
    eventos.push({
      id: 'derivacion',
      texto: `Derivado a asesor: ${detalle.motivoDerivacion}`,
      tono: 'aviso',
      testId: 'banner-motivo-derivacion',
      titulo: detalle.motivoDerivacion,
    });
  }
  const estado = ESTADO_TEXTO[detalle.estado];
  if (estado) eventos.push(estado);
  return eventos;
}

/** Evento de sistema: una sola línea, centrado y discreto. */
export function EventoSistema({ evento }: { evento: EventoChat }) {
  return (
    <div className="msg-evento" data-tono={evento.tono} data-testid={evento.testId} role="status">
      <span aria-hidden="true">{evento.tono === 'aviso' ? '!' : 'i'}</span>
      <span className="msg-evento-texto" title={evento.titulo ?? evento.texto}>
        {evento.texto}
      </span>
    </div>
  );
}
