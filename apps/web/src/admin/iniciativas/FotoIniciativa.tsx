import { useEffect, useState } from 'react';
import { obtenerBlobAutenticado } from '../../comun/api';

export interface FotoIniciativaProps {
  src: string | null | undefined;
  alt: string;
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
  title?: string;
}

export function FotoIniciativa({
  src,
  alt,
  style,
  className,
  onClick,
  title,
}: FotoIniciativaProps) {
  const [urlResuelta, setUrlResuelta] = useState<string | null>(null);
  const [cargando, setCargando] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let activo = true;

    if (!src) {
      setUrlResuelta(null);
      setCargando(false);
      setError(false);
      return;
    }

    // Rutas públicas o directas (blob, data, http, /archivos/publico/)
    if (
      src.startsWith('blob:') ||
      src.startsWith('data:') ||
      src.startsWith('http://') ||
      src.startsWith('https://') ||
      src.startsWith('/archivos/publico/')
    ) {
      setUrlResuelta(src);
      setCargando(false);
      setError(false);
      return;
    }

    // Ruta privada autenticada (ej. /admin/archivos/:id)
    setCargando(true);
    setError(false);

    obtenerBlobAutenticado(src)
      .then((blobUrl) => {
        if (!activo) return;
        setUrlResuelta(blobUrl);
        setCargando(false);
      })
      .catch(() => {
        if (!activo) return;
        setError(true);
        setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [src]);

  if (!src) {
    return null;
  }

  if (cargando) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--cp-sand)',
          color: 'var(--cp-soft)',
          fontSize: '11px',
          fontWeight: 700,
          borderRadius: style?.borderRadius || '10px',
          border: style?.border || '1px solid var(--cp-line)',
          ...style,
        }}
        aria-label="Cargando captura"
      >
        <span>Cargando…</span>
      </div>
    );
  }

  if (error || !urlResuelta) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--cp-sand)',
          color: 'var(--cp-soft)',
          fontSize: '11px',
          fontWeight: 700,
          borderRadius: style?.borderRadius || '10px',
          border: style?.border || '1px solid var(--cp-line)',
          padding: '4px',
          textAlign: 'center',
          ...style,
        }}
        aria-label="No se pudo cargar la captura"
      >
        <span>Sin vista previa</span>
      </div>
    );
  }

  return (
    <img
      src={urlResuelta}
      alt={alt}
      className={className}
      style={style}
      onClick={onClick}
      title={title}
    />
  );
}
