import { useId } from 'react';
import { PRESETS_FECHA, type PresetFecha } from './fechas';
import { OPCIONES_EXTRA, type FiltroExtra, type FiltrosActivos } from './useFiltrosAnalisis';
import './analisis.css';

/** Barra común de filtros: fechas (Hoy, Ayer, 7 días, 30 días, rango) y los filtros extra que la pestaña pida. */
export function FiltrosAnalisis({
  filtros,
  extras,
  errorFechas,
  hoy,
  alCambiar,
}: {
  filtros: FiltrosActivos;
  extras: readonly FiltroExtra[];
  errorFechas: string;
  hoy: string;
  alCambiar: (cambios: Record<string, string>) => void;
}) {
  const id = useId();
  const elegir = (p: PresetFecha) =>
    alCambiar(p === 'rango' ? { periodo: p, desde: filtros.desde, hasta: filtros.hasta } : { periodo: p, desde: '', hasta: '' });
  return (
    <div className="an-filtros" role="group" aria-label="Filtros de Análisis">
      <div className="an-filtros__grupo">
        <span className="an-filtros__etiqueta" id={`${id}-per`}>
          Período
        </span>
        <div className="an-chips" role="group" aria-labelledby={`${id}-per`}>
          {PRESETS_FECHA.map((p) => (
            <button key={p.id} type="button" className="an-chip" aria-pressed={filtros.preset === p.id} onClick={() => elegir(p.id)}>
              {p.nombre}
            </button>
          ))}
        </div>
      </div>
      {filtros.preset === 'rango' && (
        <>
          <div className="an-filtros__grupo">
            <label className="an-filtros__etiqueta" htmlFor={`${id}-d`}>
              Desde
            </label>
            <input id={`${id}-d`} className="an-campo" type="date" max={hoy} value={filtros.desde} onChange={(e) => alCambiar({ desde: e.target.value })} />
          </div>
          <div className="an-filtros__grupo">
            <label className="an-filtros__etiqueta" htmlFor={`${id}-h`}>
              Hasta
            </label>
            <input id={`${id}-h`} className="an-campo" type="date" max={hoy} value={filtros.hasta} onChange={(e) => alCambiar({ hasta: e.target.value })} />
          </div>
        </>
      )}
      {extras.map((e) => (
        <div className="an-filtros__grupo" key={e}>
          <label className="an-filtros__etiqueta" htmlFor={`${id}-${e}`}>
            {OPCIONES_EXTRA[e].etiqueta}
          </label>
          <select id={`${id}-${e}`} className="an-campo" value={filtros[e]} onChange={(ev) => alCambiar({ [e]: ev.target.value })}>
            {OPCIONES_EXTRA[e].opciones.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </select>
        </div>
      ))}
      {errorFechas && (
        <p className="an-error-fechas" role="alert">
          {errorFechas}
        </p>
      )}
    </div>
  );
}
