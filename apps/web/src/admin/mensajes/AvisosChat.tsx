import { DetalleConversacion } from './mensajesTipos';
import { BANNERS_TEXTO } from './utilidadesChat';

export interface AvisosChatProps {
  detalle: DetalleConversacion;
  onReabrirPlantilla: () => void;
  onTogglePausaBot: () => void;
  onTomarChat: () => void;
  onSoltarChat: () => void;
}

/** Avisos del chat (modo simulado, ventana de 24 h, derivación, estado del bot) y control de dueño. */
export function AvisosChat({
  detalle,
  onReabrirPlantilla,
  onTogglePausaBot,
  onTomarChat,
  onSoltarChat,
}: AvisosChatProps) {
  const bannerInfo = BANNERS_TEXTO[detalle.estado] || BANNERS_TEXTO.bot;

  return (
    <>
      {/* Modo Simulado Banner */}
      {detalle.simulado && (
        <div
          role="status"
          className="cv-banner"
          style={{ background: '#FFF7ED', color: '#9A3412', borderBottom: '1px solid #FED7AA' }}
        >
          <span>Modo simulado: no se envia a WhatsApp</span>
        </div>
      )}

      {/* Ventana de 24 horas cerrada Banner */}
      {detalle.ventanaAbierta === false && (
        <div
          role="status"
          className="cv-banner"
          style={{ background: '#FEF3C7', color: '#92400E', borderBottom: '1px solid #FDE68A' }}
        >
          <span>
            Pasaron mas de 24 horas desde el ultimo mensaje del cliente. Solo se puede escribir con una plantilla aprobada.
          </span>
          <button
            type="button"
            className="cv-bbtn"
            style={{ borderColor: '#B45309', color: '#B45309' }}
            onClick={onReabrirPlantilla}
          >
            Reabrir con plantilla
          </button>
        </div>
      )}

      {/* Motivo de derivación si existe */}
      {detalle.motivoDerivacion && (
        <div
          role="status"
          className="cv-banner"
          style={{ background: '#FFF1C9', color: '#8A5800', borderBottom: '1px solid #FFE29A', fontWeight: 600 }}
          data-testid="banner-motivo-derivacion"
        >
          <span>⚠️ Derivado a asesor: {detalle.motivoDerivacion}</span>
        </div>
      )}

      {/* Banner Informativo */}
      <div className="cv-banner" style={{ background: bannerInfo[1] }}>
        <span>{bannerInfo[0]}</span>
        <button className="cv-bbtn" onClick={onTogglePausaBot}>
          {detalle.estado === 'pausado' ? 'Reanudar el bot' : 'Pausar el bot'}
        </button>
      </div>

      {/* Control de Dueño / Tomar Chat */}
      <div className="cv-owner">
        <span>
          {detalle.dueno
            ? detalle.esMio
              ? 'Lo atiendes tú: el bot no responde en este chat.'
              : `Lo atiende ${detalle.dueno}: el bot no responde y tú no puedes escribir.`
            : 'Chat libre: el bot atiende automáticamente.'}
        </span>
        <button onClick={() => (detalle.esMio ? onSoltarChat() : onTomarChat())}>
          {detalle.esMio ? 'Soltar el chat' : 'Tomar el chat'}
        </button>
      </div>
    </>
  );
}
