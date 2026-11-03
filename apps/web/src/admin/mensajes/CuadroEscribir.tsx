import { DetalleConversacion, RespuestaRapida } from './mensajesTipos';

export interface CuadroEscribirProps {
  detalle: DetalleConversacion;
  respuestasRapidas: RespuestaRapida[];
  textoMensaje: string;
  onCambiarTexto: (texto: string) => void;
  textoPulido: string | null;
  pulirError: string | null;
  enviando: boolean;
  onElegirRapida: (texto: string) => void;
  onPulir: () => void;
  onUsarPulido: (texto: string) => void;
  onDejarPulido: () => void;
  onEnviar: () => void;
}

/** Respuestas rápidas, vista previa de «Pulir», y el cuadro para escribir al cliente. */
export function CuadroEscribir({
  detalle,
  respuestasRapidas,
  textoMensaje,
  onCambiarTexto,
  textoPulido,
  pulirError,
  enviando,
  onElegirRapida,
  onPulir,
  onUsarPulido,
  onDejarPulido,
  onEnviar,
}: CuadroEscribirProps) {
  return (
    <>
      {/* Respuestas rápidas */}
      <div className="cv-quick">
        {respuestasRapidas.map((q) => (
          <button key={q.id} className="cv-qb" onClick={() => onElegirRapida(q.texto)}>
            {q.titulo}
          </button>
        ))}
      </div>

      {/* Vista previa de Pulir Mensaje */}
      {textoPulido && (
        <div className="cv-pol" role="status">
          <div className="cv-pollbl">Así quedaría tu mensaje, más amable y bien escrito:</div>
          <div className="cv-polx">{textoPulido}</div>
          <div className="cv-polb">
            <button className="cv-ok" style={{ minHeight: '44px' }} onClick={() => onUsarPulido(textoPulido)}>
              Usar este texto
            </button>
            <button
              className="cv-no"
              style={{ minHeight: '44px', borderColor: '#54656F', color: '#54656F' }}
              onClick={onDejarPulido}
            >
              Dejar el mío
            </button>
          </div>
        </div>
      )}

      {pulirError && (
        <div role="status" style={{ padding: '0 14px 4px', fontSize: '12px', fontWeight: 700, color: '#C0392B' }}>
          {pulirError}
        </div>
      )}

      {/* Compositor de mensaje */}
      {!detalle.telefono || !detalle.telefono.trim() ? (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            margin: '8px 14px',
            borderRadius: '10px',
            background: 'var(--cp-sand, #F8FAFC)',
            color: 'var(--cp-navy, #0B2C3E)',
            fontSize: '13px',
            fontWeight: 600,
            border: '1px solid var(--cp-line, #CBD5E1)',
          }}
        >
          Este contacto no tiene ningun identificador: no se puede responder
        </div>
      ) : (
        <div className="cv-comp">
          <input
            type="text"
            placeholder="Escribe un mensaje"
            aria-label="Escribe un mensaje"
            value={textoMensaje}
            disabled={detalle.ocupado}
            onChange={(e) => onCambiarTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onEnviar();
            }}
          />
          <button
            className="cv-polbtn"
            aria-label="Pulir el mensaje para que sea más amable"
            disabled={detalle.ocupado}
            onClick={onPulir}
          >
            Pulir
          </button>
          <button
            className="cv-send"
            aria-label="Enviar mensaje"
            disabled={detalle.ocupado || enviando}
            onClick={() => onEnviar()}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M3 20l18-8L3 4v6l11 2-11 2z" fill="#fff" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
