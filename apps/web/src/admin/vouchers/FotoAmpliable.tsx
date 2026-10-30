import { useEffect, useState } from 'react';
import { obtenerBlobAutenticado } from '../../comun/api';

export interface FotoAmpliableProps {
  archivoId?: string | number | null;
  alt?: string;
  alturaMaxima?: number;
}

/** Foto privada (voucher): miniatura que se abre en pantalla completa dentro de la misma página. */
export function FotoAmpliable({ archivoId, alt = 'Foto del comprobante', alturaMaxima = 280 }: FotoAmpliableProps) {
  const [url, setUrl] = useState('');
  const [fallo, setFallo] = useState(false);
  const [abierta, setAbierta] = useState(false);

  useEffect(() => {
    if (!archivoId) return;
    let vigente = true;
    setFallo(false);
    obtenerBlobAutenticado(`/admin/archivos/${archivoId}`)
      .then((u) => vigente && setUrl(u))
      .catch(() => vigente && setFallo(true));
    return () => {
      vigente = false;
    };
  }, [archivoId]);

  useEffect(() => {
    if (!abierta) return;
    const alTecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierta(false);
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [abierta]);

  if (!archivoId || fallo || !url) {
    return (
      <div className="cv-img">
        <span>{fallo ? 'No se pudo cargar la foto' : archivoId ? 'Cargando foto…' : 'Foto'}</span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        aria-label="Ver la foto en pantalla completa"
        style={{ display: 'block', padding: 0, border: 0, background: 'none', cursor: 'zoom-in', maxWidth: '100%' }}
      >
        <img
          src={url}
          alt={alt}
          style={{ display: 'block', maxWidth: '100%', maxHeight: alturaMaxima, borderRadius: 8, objectFit: 'contain' }}
        />
      </button>
      {abierta && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={() => setAbierta(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 5000,
            background: 'rgba(11, 44, 62, 0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            cursor: 'zoom-out',
          }}
        >
          <button
            type="button"
            onClick={() => setAbierta(false)}
            aria-label="Cerrar la foto"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              minWidth: 44,
              minHeight: 44,
              borderRadius: 22,
              border: 0,
              background: 'var(--cp-cream, #FBF4EC)',
              color: 'var(--cp-navy, #0B2C3E)',
              fontSize: 22,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
          <img
            src={url}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8, cursor: 'default' }}
          />
        </div>
      )}
    </>
  );
}
