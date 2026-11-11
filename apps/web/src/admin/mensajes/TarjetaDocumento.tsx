import { useState } from 'react';
import { obtenerBlobAutenticado } from '../../comun/api';
import { DocumentoChat } from './mensajesTipos';

export function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/**
 * Documento del chat (recibido o enviado): ícono, nombre, tamaño y «Descargar». Se baja con la sesión del equipo y
 * siempre como archivo (nunca se abre dentro de la página): puede venir de un desconocido.
 */
export function TarjetaDocumento({ documento }: { documento: DocumentoChat }) {
  const [bajando, setBajando] = useState(false);
  const [error, setError] = useState(false);

  const descargar = async () => {
    setBajando(true);
    setError(false);
    try {
      const url = await obtenerBlobAutenticado(documento.url);
      const a = document.createElement('a');
      a.href = url;
      a.download = documento.nombre;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      setError(true);
    } finally {
      setBajando(false);
    }
  };

  return (
    <div className="msg-doc" data-testid="tarjeta-documento">
      <span className="msg-doc-icono" aria-hidden="true">📄</span>
      <div className="msg-doc-datos">
        <div className="msg-doc-nombre" title={documento.nombre}>{documento.nombre}</div>
        <div className="msg-doc-tam">{formatearTamano(documento.bytes)}</div>
      </div>
      <button type="button" className="msg-btn msg-doc-btn" disabled={bajando} onClick={descargar} aria-label={`Descargar ${documento.nombre}`}>
        {bajando ? 'Bajando…' : 'Descargar'}
      </button>
      {error && <div role="status" className="msg-error" style={{ flexBasis: '100%' }}>No se pudo descargar el documento. Intenta de nuevo.</div>}
    </div>
  );
}
