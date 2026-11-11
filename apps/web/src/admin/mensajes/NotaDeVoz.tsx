import { useEffect, useRef, useState } from 'react';
import { obtenerBlobAutenticado } from '../../comun/api';
import { useVisibleUnaVez } from '../../comun/useVisibleUnaVez';

const VELOCIDADES = [1, 1.5, 2];

export interface NotaDeVozProps {
  audioId: string;
}

/**
 * Nota de voz del cliente: reproductor compacto (se carga con la sesión del equipo, nunca por enlace público),
 * velocidad 1x/1.5x/2x y descarga. Si el navegador no puede reproducirla
 * (p. ej. Safari sin soporte de ogg/opus) queda el enlace «Descargar audio».
 */
export function NotaDeVoz({ audioId }: NotaDeVozProps) {
  const [url, setUrl] = useState('');
  const [fallo, setFallo] = useState(false);
  const [velocidad, setVelocidad] = useState(1);
  const audio = useRef<HTMLAudioElement>(null);
  // el audio se descarga cuando la nota se ve, no al abrir el chat
  const { ref: refVisible, visible } = useVisibleUnaVez<HTMLDivElement>();

  useEffect(() => {
    if (!visible) return;
    let vigente = true;
    setFallo(false);
    obtenerBlobAutenticado(`/admin/archivos/${audioId}`)
      .then((u) => vigente && setUrl(u))
      .catch(() => vigente && setFallo(true));
    return () => {
      vigente = false;
    };
  }, [audioId, visible]);

  const cambiarVelocidad = () => {
    const siguiente = VELOCIDADES[(VELOCIDADES.indexOf(velocidad) + 1) % VELOCIDADES.length];
    setVelocidad(siguiente);
    if (audio.current) audio.current.playbackRate = siguiente;
  };

  return (
    <div className="msg-audio" data-testid="nota-de-voz" ref={refVisible}>
      {!url && !fallo && <span className="msg-audio-estado">Cargando audio…</span>}
      {fallo && <span className="msg-audio-estado">No se pudo reproducir el audio en este navegador</span>}
      {url && !fallo && (
        <div className="msg-audio-fila">
          <audio
            ref={audio}
            src={url}
            controls
            preload="metadata"
            aria-label="Nota de voz del cliente"
            onLoadedMetadata={() => audio.current && (audio.current.playbackRate = velocidad)}
            onError={() => setFallo(true)}
          />
          <button
            type="button"
            className="msg-btn msg-audio-vel"
            onClick={cambiarVelocidad}
            aria-label={`Velocidad de reproducción ${velocidad}x, cambiar`}
          >
            {velocidad}x
          </button>
        </div>
      )}
      {url && (
        <a className="msg-audio-descarga" href={url} download={`nota-de-voz-${audioId}`}>
          Descargar audio
        </a>
      )}
    </div>
  );
}
