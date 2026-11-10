import { ReactNode, useState } from 'react';
import './planilla.css';

/** Sección plegable nativa (<details>). El contenido pesado se monta recién al abrir (`perezoso`, o una función hija que recibe si ya se abrió). */
export function Plegable({ id, titulo, resumen, abierta = false, perezoso = false, children }: {
  id?: string; titulo: string; resumen?: ReactNode; abierta?: boolean; perezoso?: boolean; children: ReactNode | ((abierta: boolean) => ReactNode);
}) {
  const [vista, setVista] = useState(abierta);
  return (
    <details id={id} className="pl-seccion" open={abierta || undefined} onToggle={(e) => e.currentTarget.open && setVista(true)}>
      <summary className="pl-seccion-cab">
        <span className="pl-seccion-titulo">{titulo}</span>
        {resumen !== undefined && resumen !== null && <span className="pl-seccion-resumen">{resumen}</span>}
      </summary>
      <div className="pl-seccion-cuerpo">{typeof children === 'function' ? children(vista) : perezoso && !vista ? null : children}</div>
    </details>
  );
}
