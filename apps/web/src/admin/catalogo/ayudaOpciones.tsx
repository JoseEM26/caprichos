import React, { useState } from 'react';

/** Botón «?» con la explicación como tooltip (title) y, al tocarlo, como nota plegable (role="note"). */
export function Tip({ etiqueta, texto, abierto, alAlternar }: {
  etiqueta: string; texto: string; abierto?: boolean; alAlternar?: () => void;
}) {
  const [interno, setInterno] = useState(false);
  const controlado = abierto !== undefined;
  const visible = controlado ? abierto : interno;
  return (
    <>
      <button type="button" className="eo-ayuda-boton" aria-expanded={visible} aria-label={`Ayuda: ${etiqueta}`}
        title={texto} onClick={controlado ? alAlternar : () => setInterno((v) => !v)}>?</button>
      {!controlado && visible && <span role="note" className="eo-nota">{texto}</span>}
    </>
  );
}

/** Campo con etiqueta y ayuda plegable (una sola línea de ayuda, no un párrafo fijo por campo). */
export function Ayuda({ id, etiqueta, ayuda, detalle, children }: {
  id: string; etiqueta: string; ayuda: string; detalle?: string; children: React.ReactElement;
}) {
  return (
    <div className="eo-campo">
      <div className="eo-etiqueta">
        <label htmlFor={id}>{etiqueta}</label>
        <Tip etiqueta={etiqueta} texto={detalle ? `${ayuda} ${detalle}` : ayuda} />
      </div>
      {React.cloneElement(children as React.ReactElement<any>, { id })}
    </div>
  );
}
