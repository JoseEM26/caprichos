import { useEffect, useState } from 'react';

export interface MenuFilaChatProps {
  nombre: string;
  /** El chat está sin ver (mensajes nuevos o marca manual): la acción pasa a «Marcar como visto». */
  sinVer: boolean;
  onMarcarNoVisto: () => void;
  onMarcarVisto: () => void;
}

/** Botón «⋯» de cada fila de la lista: marcar el chat como no visto o como visto, sin abrirlo. */
export function MenuFilaChat({ nombre, sinVer, onMarcarNoVisto, onMarcarVisto }: MenuFilaChatProps) {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const alTecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [abierto]);

  return (
    <div className="msg-opciones">
      <button
        type="button"
        className="msg-btn msg-btn-icono msg-opciones-btn"
        aria-label="Opciones de este chat en la lista"
        title={`Más opciones del chat de ${nombre}`}
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        ⋯
      </button>
      {abierto && (
        <>
          <button type="button" className="msg-menu-fondo" aria-label="Cerrar el menú" onClick={() => setAbierto(false)} />
          <div className="msg-menu" role="menu" aria-label={`Acciones del chat de ${nombre}`}>
            <button
              type="button"
              role="menuitem"
              className="msg-menu-item"
              onClick={() => {
                setAbierto(false);
                (sinVer ? onMarcarVisto : onMarcarNoVisto)();
              }}
            >
              {sinVer ? 'Marcar como visto' : 'Marcar como no visto'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
