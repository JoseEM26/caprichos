import { useState, type ReactNode } from 'react';
import './analisis.css';

export interface SeccionAnalisis {
  id: string;
  nombre: string;
  contenido: ReactNode;
}

/** Secciones de una pestaña como chips: se ve una a la vez (la página no se alarga). Ignora las `null`/`false`. */
export function Secciones({ etiqueta, secciones }: { etiqueta: string; secciones: ReadonlyArray<SeccionAnalisis | null | false> }) {
  const lista = secciones.filter((s): s is SeccionAnalisis => !!s);
  const [id, setId] = useState(lista[0]?.id ?? '');
  const activa = lista.find((s) => s.id === id) ?? lista[0];
  if (!activa) return null;
  return (
    <div className="an-secciones">
      {lista.length > 1 && (
        <div className="an-chips" role="group" aria-label={etiqueta}>
          {lista.map((s) => (
            <button key={s.id} type="button" className="an-chip" aria-pressed={activa.id === s.id} onClick={() => setId(s.id)}>
              {s.nombre}
            </button>
          ))}
        </div>
      )}
      {activa.contenido}
    </div>
  );
}
