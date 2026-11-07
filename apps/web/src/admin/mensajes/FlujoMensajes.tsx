import React, { useEffect, useRef } from 'react';
import { diaLima, etiquetaDia } from './fechasChat';
import { BurbujaMensaje } from './BurbujaMensaje';
import { EventoChat, EventoSistema } from './EventoSistema';
import { MensajeItem } from './mensajesTipos';

export interface FlujoMensajesProps {
  /** Mensajes del más antiguo al más nuevo. */
  mensajes: MensajeItem[];
  eventos: EventoChat[];
  onReintentar: (mensajeId: string) => void;
}

/** Separador centrado con el día de los mensajes que siguen. */
function SeparadorDia({ fecha }: { fecha: string }) {
  const texto = etiquetaDia(fecha);
  return (
    <div className="msg-dia" role="separator" aria-label={`Mensajes del ${texto}`} data-testid="separador-dia">
      <span>{texto}</span>
    </div>
  );
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
      {mensajes.map((m, i) => {
        const dia = m.fecha ? diaLima(new Date(m.fecha)) : null;
        const previo = i > 0 ? mensajes[i - 1].fecha : undefined;
        const nuevoDia = dia !== null && (!previo || diaLima(new Date(previo)) !== dia);
        return (
          <React.Fragment key={m.id}>
            {nuevoDia && <SeparadorDia fecha={m.fecha as string} />}
            <BurbujaMensaje mensaje={m} onReintentar={onReintentar} />
          </React.Fragment>
        );
      })}
    </div>
  );
}
