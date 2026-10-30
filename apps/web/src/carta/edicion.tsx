import { createContext, useContext, useLayoutEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';

/**
 * Modo edición en sitio. Los componentes de la carta consultan este contexto: sin él (carta pública)
 * pintan exactamente lo de siempre; con él (administrativo) envuelven bloques y vuelven editables los textos.
 */
export interface OpcionesBloque {
  /** Lugar que ocupa el bloque en su contenedor (p. ej. las columnas del mosaico de novedades). */
  estilo?: CSSProperties;
  /** Barra bajo el bloque en vez de dentro (círculos pequeños de Momentos). */
  debajo?: boolean;
}

export interface ModoEdicion {
  /** Guarda un texto editado en el lugar. La clave dice qué texto es (p. ej. `banner.title`). */
  cambiarTexto(clave: string, valor: string): void;
  /** Envuelve una sección o un elemento con su contorno y su barra flotante. */
  bloque(clave: string, hijo: ReactNode, opciones?: OpcionesBloque): ReactNode;
  /** Tarjeta fantasma «+ Agregar» en el lugar donde aparecerá lo nuevo. */
  agregar(clave: string, etiqueta: string, estilo?: CSSProperties): ReactNode;
  /** Un clic sobre algo que no es texto (p. ej. la foto del banner) abre su ventana pequeña anclada. */
  accion(clave: string): void;
}

const Contexto = createContext<ModoEdicion | null>(null);
export const ProveedorEdicion = Contexto.Provider;
export const useEdicion = () => useContext(Contexto);

/** Texto de la carta. En modo edición se escribe encima, con la misma tipografía; Enter o clic fuera confirma y Escape cancela. */
export function TextoEd({ clave, valor, ayuda }: { clave: string; valor: string; ayuda?: string }) {
  const ed = useEdicion();
  if (!ed) return <>{valor}</>;
  return <TextoEditable clave={clave} valor={valor} ayuda={ayuda} onGuardar={(v) => ed.cambiarTexto(clave, v)} />;
}

function TextoEditable({ clave, valor, ayuda, onGuardar }: { clave: string; valor: string; ayuda?: string; onGuardar: (v: string) => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  const cancelado = useRef(false);
  const ultimo = useRef(valor);
  ultimo.current = valor;
  // El texto lo pone el efecto (no React) para no pelear con lo que escribe la persona
  useLayoutEffect(() => {
    if (ref.current && ref.current.textContent !== valor) ref.current.textContent = valor;
  }, [valor]);
  return (
    <span
      ref={ref}
      role="textbox"
      aria-label={ayuda || `Texto ${clave}`}
      data-edicion="texto"
      data-ph={ayuda || 'Escribe aquí'}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          ref.current?.blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          if (ref.current) ref.current.textContent = valor;
          if (document.activeElement === ref.current) {
            cancelado.current = true;
            ref.current?.blur();
          }
        }
      }}
      onPaste={(e) => {
        e.preventDefault();
        const t = e.clipboardData?.getData('text/plain') ?? '';
        if (typeof document.execCommand === 'function') document.execCommand('insertText', false, t.replace(/\s*\n\s*/g, ' '));
      }}
      onBlur={() => {
        if (cancelado.current) {
          cancelado.current = false;
          return;
        }
        const nuevo = (ref.current?.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (nuevo !== valor) onGuardar(nuevo);
        // si el padre no aceptó el cambio (p. ej. texto vacío), vuelve a mostrar lo vigente
        setTimeout(() => {
          if (ref.current && ref.current.textContent !== ultimo.current) ref.current.textContent = ultimo.current;
        }, 0);
      }}
    />
  );
}
