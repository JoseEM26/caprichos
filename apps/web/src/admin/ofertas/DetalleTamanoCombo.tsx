import { FotoMini } from '../../comun/FotoMini';
import type { CategoriaEditor, Parte, ProductoEditor } from './partesComboModelo';
import { tipoDe, tituloPieza } from './partesComboModelo';
import type { TamanoCombo } from './tamanosCombo';

interface Props {
  tamano: TamanoCombo;
  partes: Parte[];
  productos: ProductoEditor[];
  categorias: CategoriaEditor[];
  alCambiar: (cambio: Partial<TamanoCombo>) => void;
  /** Cantidad propia de una parte para este tamaño; null = vuelve a la de la parte. */
  alCambiarCantidad: (indiceParte: number, cantidad: number | null) => void;
}

/**
 * Detalle opcional de un tamaño del combo: su descripción, su foto, qué partes lleva y cuántos elige el cliente en cada una.
 * Lo que se deje vacío usa lo del combo o la cantidad de la parte (como siempre).
 */
export function DetalleTamanoCombo({ tamano, partes, productos, categorias, alCambiar, alCambiarCantidad }: Props) {
  const nombre = tamano.tamanoNombre || 'este tamaño';
  const valorId = tamano.tamanoValorId;
  // Complementos a elegir (paquetes) quedan fuera: se eligen como grupo, no por tamaño
  const piezas = partes.map((p, i) => ({ p, i })).filter(({ p }) => !p.paqueteGrupo);
  return (
    <details className="detalle-tamano-combo" style={{ marginLeft: 28, fontSize: 13 }}>
      <summary style={{ cursor: 'pointer', color: 'var(--cp-soft)' }}>Detalle de {nombre} (opcional)</summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontWeight: 700 }}>Descripción de {nombre}</span>
          <input
            type="text"
            value={tamano.descripcion ?? ''}
            maxLength={200}
            placeholder="Si lo dejas vacío, se usa la descripción del combo"
            onChange={(e) => alCambiar({ descripcion: e.target.value })}
            style={{ minHeight: 38, borderRadius: 8, border: '1.5px solid var(--cp-line)', padding: '0 10px' }}
          />
        </label>
        <div>
          <FotoMini
            etiqueta={nombre}
            url={tamano.fotoUrl}
            alCambiar={(f) => alCambiar({ fotoArchivoId: f?.id ?? null, fotoUrl: f?.url ?? null })}
          />
          <div style={{ color: 'var(--cp-soft)' }}>Sin foto propia, se usa la del combo.</div>
        </div>
        {valorId && piezas.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontWeight: 700 }}>Qué lleva {nombre}</span>
            {piezas.map(({ p, i }) => {
              const propia = p.cantidadPorTamano?.[valorId];
              const va = propia !== 0;
              const titulo = tituloPieza(p, categorias, productos) || p.nombre || `Parte ${i + 1}`;
              const aElegir = tipoDe(p) !== 'FIJO';
              return (
                <div key={p.uid ?? i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center', minHeight: 36, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={va}
                      aria-label={`${titulo} va en ${nombre}`}
                      onChange={(e) => alCambiarCantidad(i, e.target.checked ? null : 0)}
                      style={{ width: 18, height: 18 }}
                    />
                    <span style={{ textDecoration: va ? 'none' : 'line-through', color: va ? 'inherit' : 'var(--cp-soft)' }}>{titulo}</span>
                  </label>
                  {aElegir && va && (
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={propia ?? ''}
                      placeholder={String(p.cantidad || 1)}
                      aria-label={`Cantidad de ${titulo} en ${nombre}`}
                      onChange={(e) => alCambiarCantidad(i, e.target.value === '' ? null : Math.max(1, Math.min(99, Math.floor(Number(e.target.value)) || 1)))}
                      style={{ width: 70, minHeight: 36, borderRadius: 8, border: '1.5px solid var(--cp-line)', padding: '0 8px' }}
                    />
                  )}
                </div>
              );
            })}
            <div style={{ color: 'var(--cp-soft)' }}>Desmarca lo que no va en {nombre}. Cantidad vacía = la de la parte.</div>
          </div>
        )}
      </div>
    </details>
  );
}
