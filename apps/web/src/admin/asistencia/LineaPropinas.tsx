import type { LineaPropinaApi } from './planillaApi';

const soles = (n: number) => `S/ ${Math.abs(n).toFixed(2)}`;
const corta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

/** Texto de una línea: «Propina pendiente del 03/11» para días de períodos anteriores, «Propina del 03/11» para los del período. */
export const nombrePropina = (l: LineaPropinaApi) => (l.pendiente ? `Propina pendiente del ${corta(l.fecha)}` : `Propina del ${corta(l.fecha)}`);

/**
 * Línea «Propinas» de la planilla: lo que suma al neto y, desplegable, el detalle por día
 * (fecha, propina del local ese día, mis horas / horas totales, % y monto). Sirve para la planilla y para Mi planilla.
 */
export function LineaPropinas({ total, lineas }: { total: number; lineas: LineaPropinaApi[] }) {
  if (!lineas.length) return null;
  return (
    <details className="mp-det" data-testid="linea-propinas">
      <summary>
        <span>Propinas</span>
        <b className="mp-monto">{total < 0 ? '- ' : '+ '}{soles(total)}</b>
      </summary>
      <table aria-label="Propinas por día" style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'right' }}>
            <th style={{ textAlign: 'left' }}>Día</th>
            <th>Propina del local</th>
            <th>Horas</th>
            <th>%</th>
            <th>Monto</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((l) => (
            <tr key={l.fecha} style={{ textAlign: 'right' }}>
              <td style={{ textAlign: 'left' }}>{nombrePropina(l)}</td>
              <td>{soles(l.totalLocal)}</td>
              <td>{l.horas} h / {l.horasTotales} h</td>
              <td>{l.porcentaje.toFixed(2)}%</td>
              <td>{l.monto < 0 ? '- ' : ''}{soles(l.monto)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
