import { Children, type ReactNode } from 'react';

/**
 * Empaquetado tipo "masonry" con columnas CSS: cada comanda mide solo lo que su
 * contenido pide (sin alto fijo ni filas iguales) y las columnas se llenan sin huecos.
 * Orden FIFO: las columnas se llenan de arriba a abajo y de izquierda a derecha, así que
 * la comanda más antigua (primera del arreglo) queda arriba a la izquierda.
 */
export function RejillaComandas({ children, anchoColumna = 290 }: { children: ReactNode; anchoColumna?: number }) {
  return (
    <div
      data-testid="rejilla-comandas"
      style={{
        columnWidth: `${anchoColumna}px`,
        columnGap: '10px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {Children.map(children, (hijo) => (
        <div style={{ breakInside: 'avoid', marginBottom: '10px', display: 'block' }}>{hijo}</div>
      ))}
    </div>
  );
}
