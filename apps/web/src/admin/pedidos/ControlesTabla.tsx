import { useEffect, useRef, useState } from 'react';
import { COLUMNAS_CAJA, COLUMNAS_POR_DEFECTO, ordenSelector } from './columnasCaja';
import { MEDIOS_FILTRO } from './mediosFila';

export type VistaCaja = 'tarjetas' | 'tabla';
export const normalizarVista = (v: unknown): VistaCaja => (v === 'tabla' ? 'tabla' : 'tarjetas');

/** Conmutador «Tarjetas | Tabla». */
export function ConmutadorVista({ vista, alCambiar }: { vista: VistaCaja; alCambiar: (v: VistaCaja) => void }) {
  return (
    <div className="cj2-vista" role="group" aria-label="Vista de la lista">
      {(['tarjetas', 'tabla'] as const).map((v) => (
        <button key={v} type="button" className="cj2-vista-op" aria-pressed={vista === v} onClick={() => alCambiar(v)}>
          {v === 'tarjetas' ? 'Tarjetas' : 'Tabla'}
        </button>
      ))}
    </div>
  );
}

/** Cierra un menú con clic fuera o Escape. */
function useCerrarFuera(abierto: boolean, cerrar: () => void) {
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) cerrar();
    };
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && cerrar();
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto, cerrar]);
  return raiz;
}

/** Botón «Columnas»: casillas para mostrar u ocultar y flechas para el orden. Siempre queda al menos una. */
export function SelectorColumnas({ columnas, alCambiar }: { columnas: string[]; alCambiar: (c: string[]) => void }) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useCerrarFuera(abierto, () => setAbierto(false));
  const lista = ordenSelector(columnas);
  const titulo = (id: string) => COLUMNAS_CAJA.find((c) => c.id === id)!.titulo;
  const alternar = (id: string) => {
    if (columnas.includes(id)) {
      if (columnas.length > 1) alCambiar(columnas.filter((x) => x !== id));
    } else {
      alCambiar([...columnas, id]);
    }
  };
  const mover = (id: string, d: -1 | 1) => {
    const i = columnas.indexOf(id);
    const j = i + d;
    if (i < 0 || j < 0 || j >= columnas.length) return;
    const n = [...columnas];
    [n[i], n[j]] = [n[j], n[i]];
    alCambiar(n);
  };
  return (
    <div className="cj2-menu-rel" ref={raiz}>
      <button type="button" className="cj2-btn" aria-expanded={abierto} aria-haspopup="true" onClick={() => setAbierto((a) => !a)}>
        Columnas
      </button>
      {abierto && (
        <div className="cj2-col-panel" role="group" aria-label="Columnas de la tabla">
          {lista.map((id) => {
            const visible = columnas.includes(id);
            return (
              <div key={id} className="cj2-col-fila">
                <label>
                  <input type="checkbox" checked={visible} onChange={() => alternar(id)} />
                  <span>{titulo(id)}</span>
                </label>
                {visible && (
                  <span className="cj2-col-mover">
                    <button type="button" aria-label={`Subir ${titulo(id)}`} disabled={columnas[0] === id} onClick={() => mover(id, -1)}>↑</button>
                    <button type="button" aria-label={`Bajar ${titulo(id)}`} disabled={columnas[columnas.length - 1] === id} onClick={() => mover(id, 1)}>↓</button>
                  </span>
                )}
              </div>
            );
          })}
          <button type="button" className="cj2-limpiar" onClick={() => alCambiar(COLUMNAS_POR_DEFECTO)}>Restablecer</button>
        </div>
      )}
    </div>
  );
}

/** Filtro de varios medios de pago, con la misma apariencia que FiltroCombo. Vacío = todos. */
export function FiltroMedios({ medios, alCambiar }: { medios: string[]; alCambiar: (m: string[]) => void }) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useCerrarFuera(abierto, () => setAbierto(false));
  const resumen = medios.length === 0 ? 'Todos' : MEDIOS_FILTRO.filter((m) => medios.includes(m.id)).map((m) => m.n).join(', ');
  const filtrado = medios.length > 0;
  return (
    <div ref={raiz} style={{ position: 'relative', flex: '1 1 160px', minWidth: 160 }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={`Medio de pago: ${resumen}`}
        onClick={() => setAbierto((a) => !a)}
        style={{
          width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 12px',
          borderRadius: 12, border: `1.5px solid ${filtrado ? 'var(--cp-orange, #E67929)' : 'var(--cp-line, #E3D6C6)'}`,
          background: filtrado ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-white, #FFFFFF)', color: 'var(--cp-navy, #0B2C3E)', fontSize: 13, cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '15px', minWidth: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--cp-soft, #2C4C5D)', fontWeight: 700 }}>Medio de pago</span>
          <span style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resumen}</span>
        </span>
        <span aria-hidden="true">▾</span>
      </button>
      {abierto && (
        <div
          role="listbox"
          aria-label="Medio de pago"
          aria-multiselectable="true"
          style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: '100%', zIndex: 60, background: 'var(--cp-white, #FFFFFF)', border: '1.5px solid var(--cp-line, #E3D6C6)', borderRadius: 12, boxShadow: '0 8px 24px rgba(11,44,62,0.15)' }}
        >
          {MEDIOS_FILTRO.map((m) => {
            const activo = medios.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={activo}
                onClick={() => alCambiar(activo ? medios.filter((x) => x !== m.id) : [...medios, m.id])}
                style={{ width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', border: 0, borderBottom: '1px solid var(--cp-line, #E3D6C6)', background: activo ? 'var(--cp-sand, #F1E6D6)' : 'transparent', color: 'var(--cp-navy, #0B2C3E)', fontSize: 13, fontWeight: activo ? 800 : 600, textAlign: 'left', cursor: 'pointer' }}
              >
                <span aria-hidden="true">{activo ? '☑' : '☐'}</span>
                {m.n}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
