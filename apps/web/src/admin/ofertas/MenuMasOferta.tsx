import { KeyboardEvent, useEffect, useId, useRef, useState } from 'react';

export interface AccionMenuOferta {
  id: string;
  etiqueta: string;
  alElegir: () => void;
}

/**
 * Menú «⋯» de una tarjeta de oferta: acciones secundarias (ocultar/mostrar, ver en la carta…).
 * Botón con aria-haspopup, lista con flechas/Inicio/Fin, Esc cierra y devuelve el foco, clic fuera cierra.
 * Sin acciones queda como botón apagado para que todas las tarjetas tengan la misma fila de botones.
 */
export function MenuMasOferta({ nombre, acciones }: { nombre: string; acciones: AccionMenuOferta[] }) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const items = useRef<Array<HTMLButtonElement | null>>([]);
  const idMenu = useId();

  useEffect(() => {
    if (!abierto) return;
    items.current[0]?.focus();
    const fuera = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  const cerrar = () => {
    setAbierto(false);
    boton.current?.focus();
  };

  const alTeclear = (e: KeyboardEvent) => {
    const n = acciones.length;
    const i = items.current.findIndex((el) => el === document.activeElement);
    const mover = (j: number) => { e.preventDefault(); items.current[j]?.focus(); };
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(); }
    else if (e.key === 'ArrowDown') mover((i + 1) % n);
    else if (e.key === 'ArrowUp') mover((i - 1 + n) % n);
    else if (e.key === 'Home') mover(0);
    else if (e.key === 'End') mover(n - 1);
    else if (e.key === 'Tab') setAbierto(false);
  };

  const sinAcciones = acciones.length === 0;
  return (
    <div className="oferta-mas" ref={raiz}>
      <button
        type="button"
        ref={boton}
        className="oferta-mas-boton"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? idMenu : undefined}
        aria-label={`Más acciones de ${nombre}`}
        disabled={sinAcciones}
        title={sinAcciones ? 'Esta oferta no tiene más acciones' : 'Más acciones'}
        onClick={() => setAbierto((a) => !a)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' && !abierto && !sinAcciones) { e.preventDefault(); setAbierto(true); } }}
      >
        ⋯
      </button>
      {abierto && (
        <div id={idMenu} role="menu" aria-label={`Acciones de ${nombre}`} className="oferta-mas-lista" onKeyDown={alTeclear}>
          {acciones.map((a, i) => (
            <button
              key={a.id}
              type="button"
              role="menuitem"
              className="oferta-mas-item"
              ref={(el) => { items.current[i] = el; }}
              tabIndex={-1}
              onClick={() => { setAbierto(false); a.alElegir(); }}
            >
              {a.etiqueta}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
