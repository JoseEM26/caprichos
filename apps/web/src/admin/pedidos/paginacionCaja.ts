import { useEffect, useState } from 'react';

export interface Cuadricula { columnas: number; porPagina: number }

/**
 * Columnas por ancho de ventana (tarjeta mínima ~300 px) y filas visibles: el tamaño de página es columnas × filas,
 * así nunca queda una fila incompleta. Celular 1×6, tablet 2×4, PC 4×3 desde 1280, 5×3 desde 1600, 6×3 desde 2200, 7×3 desde 2500.
 */
export function cuadriculaPorAncho(w: number): Cuadricula {
  const columnas = w >= 2500 ? 7 : w >= 2200 ? 6 : w >= 1600 ? 5 : w >= 1280 ? 4 : w >= 700 ? 2 : 1;
  const filas = w >= 1280 ? 3 : w >= 700 ? 4 : 6;
  return { columnas, porPagina: columnas * filas };
}

const anchoActual = () => (typeof window === 'undefined' ? 1024 : window.innerWidth);

export function useCuadricula(): Cuadricula {
  const [c, setC] = useState(() => cuadriculaPorAncho(anchoActual()));
  useEffect(() => {
    const f = () => setC((a) => {
      const n = cuadriculaPorAncho(anchoActual());
      return n.columnas === a.columnas ? a : n;
    });
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return c;
}
