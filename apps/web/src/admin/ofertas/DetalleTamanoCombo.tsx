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
 * Detalle opcional de un tamaño del combo: su descripción, su foto y cuántos elige el cliente en cada parte.
 * Lo que se deje vacío usa lo del combo o la cantidad de la parte (como siempre).
 */
export function DetalleTamanoCombo({ tamano, partes, productos, categorias, alCambiar, alCambiarCantidad }: Props) {
  const nombre = tamano.tamanoNombre || 'este tamaño';
  const valorId = tamano.tamanoValorId;
  const aElegir = partes.map((p, i) => ({ p, i })).filter(({ p }) => tipoDe(p) !== 'FIJO' && !p.paqueteGrupo);
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
        {valorId && aElegir.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontWeight: 700 }}>Cuántos elige el cliente en {nombre}</span>
            {aElegir.map(({ p, i }) => {
              const propia = p.cantidadPorTamano?.[valorId];
              return (
                <label key={p.uid ?? i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ flex: 1 }}>{tituloPieza(p, categorias, productos) || p.nombre || `Parte ${i + 1}`}</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={propia ?? ''}
                    placeholder={String(p.cantidad || 1)}
                    aria-label={`Cantidad de ${tituloPieza(p, categorias, productos) || `parte ${i + 1}`} en ${nombre}`}
                    onChange={(e) => alCambiarCantidad(i, e.target.value === '' ? null : Math.max(1, Math.min(99, Math.floor(Number(e.target.value)) || 1)))}
                    style={{ width: 70, minHeight: 36, borderRadius: 8, border: '1.5px solid var(--cp-line)', padding: '0 8px' }}
                  />
                </label>
              );
            })}
            <div style={{ color: 'var(--cp-soft)' }}>Vacío = la cantidad de la parte.</div>
          </div>
        )}
      </div>
    </details>
  );
}
