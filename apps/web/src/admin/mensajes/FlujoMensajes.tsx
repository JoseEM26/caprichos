import { useEffect, useRef } from 'react';
import { BurbujaMensaje } from './BurbujaMensaje';
import { EventoChat, EventoSistema } from './EventoSistema';
import { MensajeItem } from './mensajesTipos';

export interface FlujoMensajesProps {
  /** Mensajes del más antiguo al más nuevo. */
  mensajes: MensajeItem[];
  eventos: EventoChat[];
  onReintentar: (mensajeId: string) => void;
}

/** Flujo de la conversación: eventos de una línea arriba y los mensajes debajo, con el más nuevo visible. */
export function FlujoMensajes({ mensajes, eventos, onReintentar }: FlujoMensajesProps) {
  const ref = useRef<HTMLDivElement>(null);
  const ultimo = mensajes[mensajes.length - 1]?.id;

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [ultimo, mensajes.length]);

  return (
    <div className="msg-flujo" role="log" aria-label="Mensajes de la conversación" aria-live="polite" ref={ref}>
      {eventos.map((ev) => (
        <EventoSistema key={ev.id} evento={ev} />
      ))}
      {mensajes.map((m) => (
        <BurbujaMensaje key={m.id} mensaje={m} onReintentar={onReintentar} />
      ))}
    </div>
  );
}
