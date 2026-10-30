import { useState } from 'react';
import { useSesion } from '../../comun/sesion';
import { impresionApi } from './impresionApi';
import './cola-impresion.css';

export const URL_DESCARGA_WINDOWS = '/api/agente-impresion/descargar/windows';

/** Instalar el programa del local (Windows): descarga, código de un solo uso y elegir las dos máquinas. */
export function PanelInstalarPrograma({ alCerrar }: { alCerrar: () => void }) {
  const { usuario } = useSesion();
  const esAdmin = (usuario?.rol || '').toUpperCase() === 'ADMIN';
  const [codigo, setCodigo] = useState<string | null>(null);
  const [error, setError] = useState('');

  const generar = async () => {
    setError('');
    try {
      setCodigo((await impresionApi.generarCodigoVinculo()).codigo);
    } catch (e: any) {
      setError(e?.message || 'No se pudo generar el código');
    }
  };

  return (
    <div className="cola-fondo" style={{ zIndex: 6000 }} onClick={alCerrar}>
      <div className="cola-panel" role="dialog" aria-modal="true" aria-label="Instalar programa de impresión" onClick={(e) => e.stopPropagation()}>
        <div className="cola-cab">
          <h2>Instalar programa de impresión</h2>
          <button type="button" className="cola-btn" onClick={alCerrar}>Cerrar</button>
        </div>
        <p className="cola-ayuda">
          Se instala una vez en la PC donde están conectadas la etiquetera y la ticketera. El navegador no puede ver impresoras USB; este programa sí.
        </p>
        <ol style={{ lineHeight: '24px', fontSize: 14, paddingLeft: 20 }}>
          <li>
            Descarga e instala:{' '}
            <a href={URL_DESCARGA_WINDOWS} download style={{ fontWeight: 800 }}>
              Descargar el programa de impresión para Windows
            </a>
          </li>
          <li>
            Ábrelo y pega este código de vinculación (vale 15 minutos y se usa una sola vez):
            <div style={{ margin: '8px 0' }}>
              {codigo ? (
                <code data-testid="codigo-vinculo" style={{ fontSize: 18, fontWeight: 800, userSelect: 'all' }}>{codigo}</code>
              ) : esAdmin ? (
                <button type="button" className="cola-btn" onClick={generar}>Generar código de vinculación</button>
              ) : (
                <em>Pídele al administrador que genere el código.</em>
              )}
            </div>
          </li>
          <li>Elige cuál es la etiquetera y cuál la ticketera.</li>
        </ol>
        {error && <p role="alert" style={{ color: 'var(--cp-rust, #B2500F)' }}>{error}</p>}
      </div>
    </div>
  );
}
