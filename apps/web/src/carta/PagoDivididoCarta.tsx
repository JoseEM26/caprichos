import { estadoDiv, filasVisibles, MAX_MEDIOS_CARTA, type FilaDiv } from './pagoDividido';
import { nombreMedio } from './MediosPago';
import type { MetodoPago } from './tipos';

interface Props {
  filas: FilaDiv[];
  aCobrar: number;
  /** Medios que ofrece el canal (los mismos de las tarjetas). */
  medios: MetodoPago[];
  alCambiar: (filas: FilaDiv[]) => void;
}

const campo = { minHeight: '44px', borderRadius: '10px', border: '1.5px solid var(--cp-line)', backgroundColor: 'var(--cp-cream)', color: 'var(--cp-navy)', padding: '0 10px', fontSize: '14px' } as const;

/** Armado del pago con 2 o 3 medios: medio y monto por renglón; el último se autocompleta; resumen en vivo. */
export function PagoDivididoCarta({ filas, aCobrar, medios, alCambiar }: Props) {
  const vista = filasVisibles(filas, aCobrar);
  const estado = estadoDiv(filas, aCobrar);
  const cambiar = (i: number, cambios: Partial<FilaDiv>) => alCambiar(filas.map((f, j) => (j === i ? { ...f, ...cambios } : f)));
  const agregar = () => {
    const libre = medios.find((m) => !filas.some((f) => f.medio === m));
    if (libre) alCambiar([...filas, { medio: libre, monto: '' }]);
  };
  const quitar = (i: number) => alCambiar(filas.filter((_, j) => j !== i));
  const hayLibres = medios.some((m) => !filas.some((f) => f.medio === m));

  return (
    <div data-testid="pago-dividido" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {vista.map((f, i) => {
        const ultimo = i === vista.length - 1;
        return (
          <div key={i} role="group" aria-label={`Medio ${i + 1} del pago`} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              aria-label={`Medio ${i + 1}`}
              value={f.medio}
              onChange={(e) => cambiar(i, { medio: e.target.value as MetodoPago })}
              style={{ ...campo, flex: 1, minWidth: 0 }}
            >
              {medios.map((m) => (
                <option key={m} value={m} disabled={filas.some((o, j) => j !== i && o.medio === m)}>
                  {nombreMedio(m)}
                </option>
              ))}
            </select>
            {ultimo ? (
              <div aria-label={`Monto de ${nombreMedio(f.medio)}`} style={{ ...campo, width: '112px', display: 'flex', alignItems: 'center', fontWeight: 700 }}>
                S/ {Number(f.monto) > 0 ? f.monto : '0.00'}
              </div>
            ) : (
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                aria-label={`Monto de ${nombreMedio(f.medio)}`}
                value={filas[i].monto}
                onChange={(e) => cambiar(i, { monto: e.target.value })}
                placeholder="S/ 0.00"
                style={{ ...campo, width: '112px' }}
              />
            )}
            {filas.length > 2 && (
              <button type="button" onClick={() => quitar(i)} aria-label={`Quitar ${nombreMedio(f.medio)}`} style={{ ...campo, cursor: 'pointer', fontWeight: 700, backgroundColor: 'var(--cp-white)' }}>
                Quitar
              </button>
            )}
          </div>
        );
      })}
      <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>El último medio lleva lo que falta del total (S/ {aCobrar.toFixed(2)}).</div>
      {filas.length < MAX_MEDIOS_CARTA && hayLibres && (
        <button type="button" onClick={agregar} style={{ ...campo, border: '1.5px dashed var(--cp-navy)', background: 'transparent', fontWeight: 700, cursor: 'pointer' }}>
          Agregar otro medio
        </button>
      )}
      <div role="status" data-testid="resumen-dividido" style={{ fontSize: '13px', fontWeight: 700, color: estado.tipo === 'sobra' ? 'var(--cp-rust)' : 'var(--cp-navy)' }}>
        {estado.tipo === 'sobra'
          ? `Sobra S/ ${estado.monto.toFixed(2)}`
          : estado.tipo === 'falta'
            ? `Falta S/ ${estado.monto.toFixed(2)}`
            : 'El pago cubre el total'}
      </div>
    </div>
  );
}
