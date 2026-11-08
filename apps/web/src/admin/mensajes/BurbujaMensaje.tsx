import { FotoAmpliable } from '../vouchers/FotoAmpliable';
import { fechaCompletaChat } from './fechasChat';
import { MensajeItem } from './mensajesTipos';
import { TarjetaUbicacion } from './TarjetaUbicacion';

export interface BurbujaMensajeProps {
  mensaje: MensajeItem;
  onReintentar: (mensajeId: string) => void;
}

/** Un mensaje del flujo: cliente, bot o equipo, con su estado de envío. La foto sale en miniatura. */
export function BurbujaMensaje({ mensaje: m, onReintentar }: BurbujaMensajeProps) {
  const esCliente = m.autor === 'CLIENTE';
  const esBot = m.autor === 'BOT';
  const quien = esCliente ? 'Cliente' : esBot ? 'Capri (bot)' : 'Equipo';
  return (
    <article className="msg-burbuja" data-autor={m.autor}>
      {!esCliente && (
        <div className="msg-quien" style={{ color: esBot ? '#105A6B' : '#00594A' }}>
          {quien}
        </div>
      )}
      {m.imagen && (
        <div className="msg-foto">
          <FotoAmpliable archivoId={m.imagenId} alt={esCliente ? 'Foto enviada por el cliente' : 'Foto enviada al cliente'} alturaMaxima={160} />
        </div>
      )}
      {m.ubicacion ? <TarjetaUbicacion ubicacion={m.ubicacion} /> : m.texto && <div className="msg-texto">{m.texto}</div>}
      <div className="msg-pie">
        <span
          data-testid="hora-mensaje"
          title={m.fecha ? fechaCompletaChat(m.fecha) : undefined}
          aria-label={m.fecha ? fechaCompletaChat(m.fecha) : undefined}
        >
          {m.hora}
        </span>
        {!esCliente && (
          <>
            {m.estado === 'FALLIDO' ? (
              <span style={{ color: '#A3261A', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span>{m.motivoFallo ? `No se pudo enviar: ${m.motivoFallo}` : 'No se pudo enviar'}</span>
                {m.puedeReintentar !== false && <button
                  type="button"
                  className="msg-btn"
                  onClick={() => onReintentar(m.id)}
                  style={{ minHeight: 32, padding: '0 8px', borderColor: '#A3261A', color: '#A3261A', fontSize: 12 }}
                >
                  Reintentar
                </button>}
                {m.errorDetalle && (
                  <details style={{ flexBasis: '100%', fontWeight: 400, fontSize: 12, color: '#54656F' }}>
                    <summary>Detalle técnico</summary>
                    <div>
                      Código de Meta: {m.metaCodigo ?? 'sin código'} · {m.errorDetalle}
                    </div>
                  </details>
                )}
              </span>
            ) : m.estado === 'SIMULADO' ? (
              <span>Modo simulado: no se envia a WhatsApp</span>
            ) : m.estado === 'LEIDO' ? (
              <span style={{ color: '#005A8C', fontWeight: 600 }}>Leido</span>
            ) : m.estado === 'ENTREGADO' ? (
              <span>Entregado</span>
            ) : (
              <span>Enviado</span>
            )}
          </>
        )}
      </div>
    </article>
  );
}
