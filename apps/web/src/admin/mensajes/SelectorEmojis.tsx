import { useEffect, useState } from 'react';
import { CATEGORIAS_EMOJI, buscarEmojis } from './emojis';

export interface SelectorEmojisProps {
  onElegir: (emoji: string) => void;
  onCerrar: () => void;
}

/** Panel simple de emojis: categorías y búsqueda. Se cierra con Esc o al tocar el fondo. */
export function SelectorEmojis({ onElegir, onCerrar }: SelectorEmojisProps) {
  const [categoria, setCategoria] = useState(CATEGORIAS_EMOJI[0].id);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [onCerrar]);

  const encontrados = buscarEmojis(busqueda);
  const items = busqueda.trim() ? encontrados : (CATEGORIAS_EMOJI.find((c) => c.id === categoria)?.items ?? []);

  return (
    <>
      <button type="button" className="msg-menu-fondo" aria-label="Cerrar los emojis" onClick={onCerrar} />
      <div className="msg-emojis" role="dialog" aria-label="Elegir un emoji">
        <input
          type="search"
          className="msg-emojis-buscar"
          placeholder="Buscar un emoji (ej. dona, gracias)"
          aria-label="Buscar un emoji"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {!busqueda.trim() && (
          <div className="msg-emojis-cats" role="tablist" aria-label="Categorías de emojis">
            {CATEGORIAS_EMOJI.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={categoria === c.id}
                aria-label={c.titulo}
                title={c.titulo}
                className="msg-emojis-cat"
                onClick={() => setCategoria(c.id)}
              >
                {c.icono}
              </button>
            ))}
          </div>
        )}
        <div className="msg-emojis-grilla">
          {items.length === 0 ? (
            <span className="msg-emojis-vacio">No hay emojis con esa palabra</span>
          ) : (
            items.map(([emoji, palabras]) => (
              <button key={emoji} type="button" className="msg-emoji" title={palabras} aria-label={palabras} onClick={() => onElegir(emoji)}>
                {emoji}
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
