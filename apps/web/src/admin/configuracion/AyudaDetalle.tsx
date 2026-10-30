import { useState } from 'react';

export interface AyudaDetalleProps {
  /** Base de los ids del texto y del detalle (único en la pantalla). */
  id: string;
  /** Qué cambia, siempre visible. */
  ayuda?: string;
  ejemplo?: string;
  /** Qué pasa si se cambia (se despliega con «?»). */
  efecto?: string;
  porDefecto?: string;
  unidad?: string;
  rango?: string;
  /** Nombre del ajuste, para el nombre accesible del botón «?». */
  etiqueta: string;
  /** Nombre accesible alterno del «?» (si el nombre del ajuste chocaría con la etiqueta del input). */
  nombreBoton?: string;
  /** Aviso de integridad (p. ej. «no se usa»). */
  nota?: string;
}

/** Bloque de ayuda sin input propio (filas de lista, tarjetas): texto visible + meta + «?» con «Qué pasa si lo cambias». */
export function AyudaDetalle({ id, ayuda, ejemplo, efecto, porDefecto, unidad, rango, etiqueta, nota, nombreBoton }: AyudaDetalleProps) {
  const [abierto, setAbierto] = useState(false);
  const meta = [unidad && `Unidad: ${unidad}`, rango && `Rango: ${rango}`, porDefecto && `Por defecto: ${porDefecto}`].filter(Boolean).join(' · ');
  const tieneDetalle = !!(efecto || ejemplo);
  return (
    <div className="cfg-ayuda-campo">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', justifyContent: 'space-between' }}>
        <div id={`${id}-ayuda`} className="cfg-ayuda-texto">
          {ayuda}
          {meta && <span className="cfg-ayuda-meta">{meta}</span>}
          {nota && <span className="cfg-ayuda-meta" style={{ color: 'var(--cp-rust)' }}>{nota}</span>}
        </div>
        {tieneDetalle && (
          <button
            type="button"
            className="cfg-ayuda-boton"
            aria-expanded={abierto}
            aria-controls={`${id}-efecto`}
            aria-label={`Qué pasa si cambias: ${nombreBoton ?? etiqueta}`}
            onClick={() => setAbierto((v) => !v)}
          >
            ?
          </button>
        )}
      </div>
      {tieneDetalle && abierto && (
        <div id={`${id}-efecto`} role="note" className="cfg-ayuda-efecto">
          <strong>Qué pasa si lo cambias</strong>
          {efecto && <p>{efecto}</p>}
          {ejemplo && <p>Ejemplo: {ejemplo}</p>}
        </div>
      )}
    </div>
  );
}
