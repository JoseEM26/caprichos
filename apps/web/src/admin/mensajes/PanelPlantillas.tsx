import { RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CATEGORIAS_PLANTILLA, ETIQUETA_CATEGORIA_PLANTILLA, resolverPlantilla } from '@caprichos/compartido';
import { normalizarBusqueda } from '../../comun/normalizarBusqueda';
import { ContextoPlantillas, RespuestaRapida } from './mensajesTipos';

/** Valores de las variables: datos del local + nombre de pila del cliente del chat (si es un nombre y no un número). */
export function valoresPlantilla(contexto: ContextoPlantillas, nombreCliente?: string | null): Record<string, string> {
  const n = String(nombreCliente ?? '').trim();
  const pila = /\p{L}/u.test(n) && !/^\+?\d[\d\s-]*$/.test(n) ? n.split(/\s+/)[0] : '';
  return { ...contexto, nombre: pila };
}

export const categoriaDe = (p: RespuestaRapida) => (CATEGORIAS_PLANTILLA as readonly string[]).includes(p.categoria ?? '') ? p.categoria! : 'OTROS';

export function filtrarPlantillas(lista: RespuestaRapida[], busqueda: string, categoria: string | null): RespuestaRapida[] {
  const q = normalizarBusqueda(busqueda);
  return lista.filter((p) => (!categoria || categoriaDe(p) === categoria) && (!q || normalizarBusqueda(`${p.titulo} ${p.texto}`).includes(q)));
}

export interface PanelPlantillasProps {
  plantillas: RespuestaRapida[];
  valores: Record<string, string>;
  ancla: RefObject<HTMLElement>;
  puedeAdministrar: boolean;
  /** Inserta el texto ya resuelto; `faltantes` son las variables sin dato (el marcador queda en el texto). */
  alElegir: (texto: string, faltantes: string[]) => void;
  alAdministrar: () => void;
  alCerrar: () => void;
}

/** Panel flotante (portal) para elegir una plantilla: buscador, chips por categoría y vista previa del texto resuelto. */
export function PanelPlantillas({ plantillas, valores, ancla, puedeAdministrar, alElegir, alAdministrar, alCerrar }: PanelPlantillasProps) {
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [pos, setPos] = useState<{ bottom: number; left: number; width: number }>({ bottom: 80, left: 8, width: 360 });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const r = ancla.current?.getBoundingClientRect();
    const ancho = Math.min(420, window.innerWidth - 16);
    if (!r) return setPos({ bottom: 80, left: 8, width: ancho });
    setPos({
      bottom: Math.max(8, window.innerHeight - r.top + 8),
      left: Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - ancho - 8)),
      width: ancho,
    });
  }, [ancla]);

  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar();
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [alCerrar]);

  const activas = useMemo(() => plantillas.filter((p) => p.activo !== false), [plantillas]);
  const categorias = useMemo(() => CATEGORIAS_PLANTILLA.filter((c) => activas.some((p) => categoriaDe(p) === c)), [activas]);
  const visibles = filtrarPlantillas(activas, busqueda, categoria);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      <button type="button" className="msg-menu-fondo" aria-label="Cerrar las plantillas" onClick={alCerrar} />
      <div
        ref={panelRef}
        className="msg-pl-panel"
        role="dialog"
        aria-label="Plantillas de respuesta"
        style={{ bottom: pos.bottom, left: pos.left, width: pos.width }}
      >
        <input
          type="search"
          className="msg-pl-buscar"
          placeholder="Buscar una plantilla (ej. yape, horario)"
          aria-label="Buscar una plantilla"
          autoFocus
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <div className="msg-pl-chips" role="group" aria-label="Categorías">
          <button type="button" className="msg-pl-chip" aria-pressed={categoria === null} onClick={() => setCategoria(null)}>
            Todas
          </button>
          {categorias.map((c) => (
            <button key={c} type="button" className="msg-pl-chip" aria-pressed={categoria === c} onClick={() => setCategoria(categoria === c ? null : c)}>
              {ETIQUETA_CATEGORIA_PLANTILLA[c]}
            </button>
          ))}
        </div>
        <ul className="msg-pl-lista" aria-label="Plantillas">
          {visibles.length === 0 && (
            <li className="msg-pl-vacio" role="status">
              {activas.length === 0 ? 'Aún no hay plantillas.' : 'Ninguna plantilla coincide con tu búsqueda.'}
            </li>
          )}
          {visibles.map((p) => {
            const r = resolverPlantilla(p.texto, valores);
            return (
              <li key={p.id}>
                <button type="button" className="msg-pl-item" onClick={() => alElegir(r.texto, r.faltantes)}>
                  <span className="msg-pl-item-titulo">{p.titulo}</span>
                  <span className="msg-pl-item-texto">{r.texto}</span>
                  {r.faltantes.length > 0 && (
                    <span className="msg-pl-item-falta">Falta completar: {r.faltantes.map((f) => `{{${f}}}`).join(', ')}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="msg-pl-nota">Se escribe en el cuadro: revísalo y envíalo tú.</p>
        {puedeAdministrar && (
          <button type="button" className="msg-pl-admin" onClick={alAdministrar}>
            Administrar plantillas
          </button>
        )}
      </div>
    </>,
    document.body,
  );
}
