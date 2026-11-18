import type { ReactNode } from 'react';

export interface DatosResumenCombo {
  nombre: string;
  tamano?: string;
  /** Bebidas elegidas, en orden de bebida. */
  bebidas: string[];
  /** Secciones con elecciones (cremas, etc.): título y lo elegido. */
  secciones: { titulo: string; elegidos: string[] }[];
  /** Complemento y otras partes que no son bebidas. */
  otros: string[];
  /** Extras de partes opcionales: «1 extra de papas (+ S/ 6.00)». */
  extras: string[];
  /** Nombres de los vasos (vacío si el combo no los pide). */
  vasos: string[];
  nota: string;
}

/** Resumen en texto de lo elegido («tarjeta de pedido»): datos clave en negrita. */
export function TextoResumenCombo({ d }: { d: DatosResumenCombo }) {
  const parrafos: ReactNode[] = [];
  const bebidas = d.bebidas.length;
  parrafos.push(
    <p key="base">
      Tu <strong>{d.nombre}</strong>
      {d.tamano ? (
        <>
          {' '}en tamaño <strong>{d.tamano}</strong>
        </>
      ) : null}
      {bebidas > 0 ? (
        <>
          {' '}incluye <strong>{`${bebidas} ${bebidas === 1 ? 'bebida' : 'bebidas'}`}</strong>: {d.bebidas.join(', ')}.
        </>
      ) : null}
    </p>,
  );
  for (const s of d.secciones) {
    if (s.elegidos.length > 0) parrafos.push(<p key={`s-${s.titulo}`}><strong>{s.titulo}</strong>: {s.elegidos.join(', ')}.</p>);
  }
  if (d.otros.length > 0) parrafos.push(<p key="otros">{d.otros.join('. ')}.</p>);
  if (d.extras.length > 0) parrafos.push(<p key="extras">Extras: <strong>{d.extras.join(', ')}</strong>.</p>);
  if (d.vasos.length > 0) parrafos.push(<p key="vasos">Vasos a nombre de: {d.vasos.map((n, i) => <span key={`${n}-${i}`}><strong>{n}</strong>{i < d.vasos.length - 1 ? ', ' : ''}</span>)}.</p>);
  if (d.nota.trim()) parrafos.push(<p key="nota">Nota para cocina: <em>{d.nota.trim()}</em>.</p>);
  return <>{parrafos}</>;
}
