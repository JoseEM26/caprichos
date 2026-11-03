import { DetalleConversacion, RespuestaRapida } from './mensajesTipos';

export interface CuadroEscribirProps {
  detalle: DetalleConversacion;
  respuestasRapidas: RespuestaRapida[];
  textoMensaje: string;
  onCambiarTexto: (texto: string) => void;
  textoPulido: string | null;
  pulirError: string | null;
  mensajeCopiado: string | null;
  enviando: boolean;
  onElegirRapida: (texto: string) => void;
  onPulir: () => void;
  onUsarPulido: (texto: string) => void;
  onDejarPulido: () => void;
  onEnviar: () => void;
}

/** Cuadro para escribir, siempre abajo: respuestas rápidas, «Pulir» y enviar. */
export function CuadroEscribir({
  detalle,
  respuestasRapidas,
  textoMensaje,
  onCambiarTexto,
  textoPulido,
  pulirError,
  mensajeCopiado,
  enviando,
  onElegirRapida,
  onPulir,
  onUsarPulido,
  onDejarPulido,
  onEnviar,
}: CuadroEscribirProps) {
  const sinIdentificador = !detalle.telefono || !detalle.telefono.trim();
  return (
    <div className="msg-componer">
      {mensajeCopiado && (
        <div className="msg-copiado" role="status">
          {mensajeCopiado}
        </div>
      )}

      {respuestasRapidas.length > 0 && (
        <div className="msg-rapidas" aria-label="Respuestas rápidas">
          {respuestasRapidas.map((q) => (
            <button key={q.id} type="button" className="msg-rapida" onClick={() => onElegirRapida(q.texto)}>
              {q.titulo}
            </button>
          ))}
        </div>
      )}

      {textoPulido && (
        <div className="msg-pulir" role="status">
          <div className="msg-pulir-etiqueta">Así quedaría tu mensaje, más amable y bien escrito:</div>
          <div className="msg-pulir-texto">{textoPulido}</div>
          <div className="msg-pulir-botones">
            <button type="button" className="msg-ok" onClick={() => onUsarPulido(textoPulido)}>
              Usar este texto
            </button>
            <button type="button" className="msg-no" onClick={onDejarPulido}>
              Dejar el mío
            </button>
          </div>
        </div>
      )}

      {pulirError && (
        <div role="status" className="msg-error">
          {pulirError}
        </div>
      )}

      {sinIdentificador ? (
        <div role="alert" className="msg-panel-nota" style={{ padding: '12px 14px', margin: 12, borderRadius: 10, background: '#F1F4F6', color: '#1B2A33', fontWeight: 600 }}>
          Este contacto no tiene ningun identificador: no se puede responder
        </div>
      ) : (
        <div className="msg-escribir">
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
            type="button"
            className="msg-pulir-btn"
            aria-label="Pulir el mensaje para que sea más amable"
            disabled={detalle.ocupado}
            onClick={onPulir}
          >
            Pulir
          </button>
          <button
            type="button"
            className="msg-enviar"
            aria-label="Enviar mensaje"
            disabled={detalle.ocupado || enviando}
            onClick={() => onEnviar()}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
              <path d="M3 20l18-8L3 4v6l11 2-11 2z" fill="#FFFFFF" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
