import type { ProgresoPiezas } from '../progresoMesa';
import './salon-mesas.css';

/**
 * Agua que sube de abajo hacia arriba dentro de la mesa (piezas listas ÷ piezas totales).
 * Va dentro de la celda de la mesa; el texto con el % no depende del color.
 */
export function RellenoMesa({ progreso, nombre }: { progreso: ProgresoPiezas; nombre: string }) {
  if (progreso.total <= 0) return null;
  const listo = progreso.porcentaje >= 100;
  return (
    <>
      <span
        className={`rm-agua${listo ? ' rm-agua--listo' : ''}`}
        role="progressbar"
        aria-label={`Avance de ${nombre}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progreso.porcentaje}
        aria-valuetext={listo ? 'Todo listo' : `${progreso.porcentaje}% listo`}
      >
        <span className="rm-nivel" style={{ height: `${progreso.porcentaje}%` }} />
      </span>
      <span className="rm-texto">{listo ? 'Todo listo' : `${progreso.porcentaje}%`}</span>
    </>
  );
}
