import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { diaLima, etiquetaDia } from './fechasChat';
import { BurbujaMensaje } from './BurbujaMensaje';
import { EventoChat, EventoSistema } from './EventoSistema';
import { MensajeItem } from './mensajesTipos';

export interface FlujoMensajesProps {
  /** Mensajes del más antiguo al más nuevo. */
  mensajes: MensajeItem[];
  eventos: EventoChat[];
  onReintentar: (mensajeId: string) => void;
  /** El historial viene por páginas: con true se ofrece «Cargar mensajes anteriores». */
  hayMasAnteriores?: boolean;
  cargandoAnteriores?: boolean;
  onCargarAnteriores?: () => void;
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
export function FlujoMensajes({ mensajes, eventos, onReintentar, hayMasAnteriores, cargandoAnteriores, onCargarAnteriores }: FlujoMensajesProps) {
  const ref = useRef<HTMLDivElement>(null);
  const ultimo = mensajes[mensajes.length - 1]?.id;

  // Al cargar anteriores (cambia el primero, no el último) se mantiene lo que la persona está leyendo en su lugar
  const previo = useRef({ primero: mensajes[0]?.id, ultimo, alto: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const p = previo.current;
    if (p.alto && p.primero !== mensajes[0]?.id && p.ultimo === ultimo) el.scrollTop += el.scrollHeight - p.alto;
    previo.current = { primero: mensajes[0]?.id, ultimo, alto: el.scrollHeight };
  });

  // Baja al más nuevo cuando llega uno (o se cambia de chat); NO al cargar anteriores (cambia el largo, no el último)
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [ultimo]);

  return (
    <div className="msg-flujo" role="log" aria-label="Mensajes de la conversación" aria-live="polite" ref={ref}>
      {hayMasAnteriores && onCargarAnteriores && (
        <button type="button" className="msg-btn" data-testid="cargar-anteriores" disabled={cargandoAnteriores} onClick={onCargarAnteriores} style={{ alignSelf: 'center' }}>
          {cargandoAnteriores ? 'Cargando…' : 'Cargar mensajes anteriores'}
        </button>
      )}
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
