import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { obtenerBlobAutenticado } from '../../comun/api';
import { useVisibleUnaVez } from '../../comun/useVisibleUnaVez';
import './selfie-marca.css';

type Estado = 'cargando' | 'ok' | 'borrada' | 'error' | 'prohibido';

/**
 * Miniatura de la selfie de una marca, con visor dentro del mismo modal. Se pide por blob autenticado SOLO cuando la
 * miniatura entra en pantalla. `obtenerBlobAutenticado` ya guarda el resultado por ruta durante la sesión y lo
 * revoca al cerrar sesión (limpiarCacheBlobs), así que aquí NO se revoca al desmontar (rompería ese caché).
 * 403 = sin permiso: no se muestra nada. 404/410 = la foto ya se borró por la retención.
 */
export function SelfieMarca({ marcaId, hora, tieneSelfie, retencionDias }: { marcaId: number; hora: string; tieneSelfie: boolean; retencionDias?: number }) {
  const { ref, visible } = useVisibleUnaVez<HTMLDivElement>();
  const [estado, setEstado] = useState<Estado>('cargando');
  const [url, setUrl] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [intento, setIntento] = useState(0);
  const miniRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!tieneSelfie || !visible) return;
    let vivo = true;
    setEstado('cargando');
    obtenerBlobAutenticado(`/admin/asistencia/marcas/${marcaId}/selfie`)
      .then((u) => { if (vivo) { setUrl(u); setEstado('ok'); } })
      .catch((e) => {
        if (!vivo) return;
        const s = (e as { statusCode?: number })?.statusCode;
        setEstado(s === 403 ? 'prohibido' : s === 404 || s === 410 ? 'borrada' : 'error');
      });
    return () => { vivo = false; };
  }, [marcaId, tieneSelfie, visible, intento]);

  if (!tieneSelfie) {
    return (
      <div className="sf-caja sf-vacia" ref={ref}>
        <span className="sf-icono" aria-hidden>◌</span>
        <small>Sin selfie</small>
      </div>
    );
  }
  if (estado === 'prohibido') return null;
  return (
    <div className="sf-caja" ref={ref} data-testid={`selfie-${marcaId}`}>
      {estado === 'cargando' && <span className="sf-esqueleto" role="status" aria-label="Cargando selfie" />}
      {estado === 'ok' && url && (
        <button type="button" ref={miniRef} className="sf-mini" aria-label={`Ver selfie de las ${hora}`} onClick={() => setAbierto(true)}>
          <img src={url} alt={`Selfie de la marca de las ${hora}`} loading="lazy" />
        </button>
      )}
      {estado === 'borrada' && (
        <small className="sf-aviso">La selfie ya se borró{retencionDias ? `: se guardan ${retencionDias} días` : ' (solo se guardan unos días)'}.</small>
      )}
      {estado === 'error' && (
        <button type="button" className="sf-reintentar" onClick={() => setIntento((n) => n + 1)}>No se pudo cargar. Reintentar</button>
      )}
      {abierto && url && <VisorSelfie url={url} hora={hora} alCerrar={() => { setAbierto(false); miniRef.current?.focus(); }} anclaRef={ref} />}
    </div>
  );
}

/** Capa simple DENTRO del modal que la contiene (no es otro modal): Esc o «Cerrar» cierran solo el visor. */
function VisorSelfie({ url, hora, alCerrar, anclaRef }: { url: string; hora: string; alCerrar: () => void; anclaRef: React.RefObject<HTMLElement | null> }) {
  const cerrarRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { cerrarRef.current?.focus(); }, []);
  const destino = anclaRef.current?.closest('.mcp-dialogo') ?? document.body;
  return createPortal(
    <div className="sf-visor" role="region" aria-label={`Selfie de las ${hora}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); alCerrar(); }
        else if (e.key === 'Tab') { e.preventDefault(); cerrarRef.current?.focus(); } // el único control es «Cerrar»
      }}
      onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) alCerrar(); }}>
      <div className="sf-visor-cuerpo">
        <h3 className="sf-visor-titulo">Selfie de las {hora}</h3>
        <img src={url} alt={`Selfie ampliada de la marca de las ${hora}`} />
        <button type="button" ref={cerrarRef} className="sf-cerrar" onClick={alCerrar}>Cerrar</button>
      </div>
    </div>,
    destino,
  );
}
