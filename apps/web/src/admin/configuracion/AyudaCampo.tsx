import React, { useState } from 'react';
import { CampoConfig } from './CampoConfig';

export interface CampoAyudaProps {
  /** id del input en el DOM (también base de los ids de ayuda). */
  id: string;
  etiqueta: string;
  /** Qué cambia, en lenguaje de negocio. Siempre visible bajo el campo. */
  ayuda: string;
  ejemplo?: string;
  /** Qué pasa si se cambia (se despliega con «?»). */
  efecto?: string;
  porDefecto?: string;
  unidad?: string;
  rango?: string;
  /** Id del catálogo: si se pasa, el campo también es destino del buscador. */
  cfgId?: string;
  children: React.ReactElement;
}

/** Etiqueta + input + ayuda visible + «?» con «Qué pasa si lo cambias». Ver catalogo/LEEME.md. */
export function CampoAyuda({ id, etiqueta, ayuda, ejemplo, efecto, porDefecto, unidad, rango, cfgId, children }: CampoAyudaProps) {
  const [abierto, setAbierto] = useState(false);
  const idAyuda = `${id}-ayuda`;
  const idEfecto = `${id}-efecto`;
  const tieneDetalle = !!(efecto || ejemplo);
  const meta = [unidad && `Unidad: ${unidad}`, rango && `Rango: ${rango}`, porDefecto && `Por defecto: ${porDefecto}`].filter(Boolean).join(' · ');
  const hijo = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<any>, {
        id: (children.props as any).id ?? id,
        'aria-describedby': [(children.props as any)['aria-describedby'], idAyuda, abierto && tieneDetalle ? idEfecto : ''].filter(Boolean).join(' '),
      })
    : children;

  const cuerpo = (
    <div className="cfg-ayuda-campo">
      <div className="cfg-ayuda-fila">
        <label htmlFor={id} className="cfg-ayuda-etiqueta">{etiqueta}</label>
        {tieneDetalle && (
          <button
            type="button"
            className="cfg-ayuda-boton"
            aria-expanded={abierto}
            aria-controls={idEfecto}
            aria-label={`Qué pasa si cambias: ${etiqueta}`}
            onClick={() => setAbierto((v) => !v)}
          >
            ?
          </button>
        )}
      </div>
      {hijo}
      <div id={idAyuda} className="cfg-ayuda-texto">
        {ayuda}
        {meta && <span className="cfg-ayuda-meta"> {meta}</span>}
      </div>
      {tieneDetalle && abierto && (
        <div id={idEfecto} role="note" className="cfg-ayuda-efecto">
          <strong>Qué pasa si lo cambias</strong>
          {efecto && <p>{efecto}</p>}
          {ejemplo && <p>Ejemplo: {ejemplo}</p>}
        </div>
      )}
    </div>
  );
  return cfgId ? <CampoConfig id={cfgId}>{cuerpo}</CampoConfig> : cuerpo;
}
