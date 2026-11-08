import { useEffect, useState } from 'react';
import { obtenerBlobAutenticado } from '../../comun/api';

const PASOS = [0.5, 0.75, 1, 1.5, 2, 3];

/** Imagen privada a pantalla completa con zoom − / + y cerrar (Escape o tocar el fondo). */
export function VisorCaptura({ archivoId, alt = 'Captura del pago', alCerrar }: { archivoId: string | number; alt?: string; alCerrar: () => void }) {
  const [url, setUrl] = useState('');
  const [fallo, setFallo] = useState(false);
  const [paso, setPaso] = useState(2);
  const zoom = PASOS[paso];

  useEffect(() => {
    let vigente = true;
    obtenerBlobAutenticado(`/admin/archivos/${archivoId}`)
      .then((u) => vigente && setUrl(u))
      .catch(() => vigente && setFallo(true));
    return () => {
      vigente = false;
    };
  }, [archivoId]);

  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar();
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [alCerrar]);

  const boton = { minWidth: 44, minHeight: 44, borderRadius: 22, border: 0, background: 'var(--cp-cream, #FBF4EC)', color: 'var(--cp-navy, #0B2C3E)', fontSize: 22, fontWeight: 800, cursor: 'pointer' } as const;

  return (
    <div role="dialog" aria-modal="true" aria-label={alt} data-testid="visor-captura" style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(11, 44, 62, 0.94)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 10, flex: 'none' }}>
        <button type="button" aria-label="Alejar" disabled={paso === 0} onClick={() => setPaso((p) => Math.max(0, p - 1))} style={boton}>−</button>
        <span data-testid="visor-zoom" style={{ minWidth: 52, textAlign: 'center', color: 'var(--cp-cream, #FBF4EC)', fontWeight: 800 }}>{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Acercar" disabled={paso === PASOS.length - 1} onClick={() => setPaso((p) => Math.min(PASOS.length - 1, p + 1))} style={boton}>+</button>
        <button type="button" aria-label="Cerrar la captura" onClick={alCerrar} style={{ ...boton, marginLeft: 'auto' }}>×</button>
      </div>
      <div onClick={alCerrar} style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', padding: 12 }}>
        {url ? (
          <img
            src={url}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            style={{ margin: 'auto', width: `${zoom * 100}%`, maxWidth: zoom <= 1 ? '100%' : 'none', maxHeight: zoom <= 1 ? '100%' : 'none', objectFit: 'contain', flex: 'none', borderRadius: 8 }}
          />
        ) : (
          <span style={{ margin: 'auto', color: 'var(--cp-cream, #FBF4EC)', fontWeight: 700 }}>{fallo ? 'No se pudo cargar la captura' : 'Cargando captura…'}</span>
        )}
      </div>
    </div>
  );
}
