import { useId, useState } from 'react';
import {
  MAX_DIAS_RANGO,
  RangoPedidos,
  errorRangoPersonalizado,
  hoyLima,
  rangoHoy,
  rangoPara,
  textoRango,
} from './filtroDias';
import './filtro-dias.css';

interface Props {
  rango: RangoPedidos;
  /** Pedidos de días anteriores aún en curso o con pago pendiente */
  pendientesAnteriores: number;
  alCambiar: (rango: RangoPedidos) => void;
}

/** Cabecera de la lista de Pedidos y caja: elige el día (o rango) que se muestra. */
export function FiltroDiasPedidos({ rango, pendientesAnteriores, alCambiar }: Props) {
  const idBase = useId();
  const hoy = hoyLima();
  const [panelAbierto, setPanelAbierto] = useState<boolean>(rango.modo === 'rango');
  const [desdeBorrador, setDesdeBorrador] = useState<string>(rango.desde);
  const [hastaBorrador, setHastaBorrador] = useState<string>(rango.hasta);
  const errorBorrador = panelAbierto ? errorRangoPersonalizado(desdeBorrador, hastaBorrador, hoy) : null;

  const chip = (activo: boolean) => ({
    'aria-pressed': activo,
    className: `fd-chip${activo ? ' fd-chip--activo' : ''}`,
  });

  return (
    <div className="fd" aria-label="Filtro de días">
      <div className="fd-chips" role="group" aria-label="Mostrar pedidos de">
        <button type="button" {...chip(rango.modo === 'hoy')} onClick={() => { setPanelAbierto(false); alCambiar(rangoHoy(hoy)); }}>
          Hoy
        </button>
        <button type="button" {...chip(rango.modo === 'ayer')} onClick={() => { setPanelAbierto(false); alCambiar(rangoPara('ayer', hoy)); }}>
          Ayer
        </button>
        <button type="button" {...chip(rango.modo === 'semana')} onClick={() => { setPanelAbierto(false); alCambiar(rangoPara('semana', hoy)); }}>
          Últimos 7 días
        </button>
        <button type="button" {...chip(panelAbierto || rango.modo === 'rango')} onClick={() => setPanelAbierto((v) => !v)}>
          Elegir día / rango
        </button>
        {(pendientesAnteriores > 0 || rango.modo === 'pendientes') && (
          <button
            type="button"
            aria-pressed={rango.modo === 'pendientes'}
            className={`fd-chip fd-chip--pendientes${rango.modo === 'pendientes' ? ' fd-chip--activo' : ''}`}
            onClick={() => { setPanelAbierto(false); alCambiar({ modo: 'pendientes', desde: '', hasta: '' }); }}
          >
            {rango.modo === 'pendientes'
              ? `Pendientes anteriores · ${pendientesAnteriores}`
              : `${pendientesAnteriores} pendientes de días anteriores`}
          </button>
        )}
      </div>

      {panelAbierto && (
        <div className="fd-panel">
          <div className="fd-campos">
            <label className="fd-campo" htmlFor={`${idBase}-desde`}>
              <span>Desde</span>
              <input
                id={`${idBase}-desde`}
                type="date"
                max={hoy}
                value={desdeBorrador}
                onChange={(e) => setDesdeBorrador(e.target.value)}
              />
            </label>
            <label className="fd-campo" htmlFor={`${idBase}-hasta`}>
              <span>Hasta</span>
              <input
                id={`${idBase}-hasta`}
                type="date"
                max={hoy}
                value={hastaBorrador}
                onChange={(e) => setHastaBorrador(e.target.value)}
              />
            </label>
          </div>
          <p className="fd-ayuda">Máximo {MAX_DIAS_RANGO} días y hasta hoy.</p>
          {errorBorrador && <p className="fd-error" role="alert">{errorBorrador}</p>}
          <button
            type="button"
            className="fd-aplicar"
            disabled={errorBorrador !== null}
            onClick={() => alCambiar({ modo: 'rango', desde: desdeBorrador, hasta: hastaBorrador })}
          >
            Ver estos días
          </button>
        </div>
      )}

      <div className="fd-estado">
        <span>
          Mostrando: <b>{textoRango(rango, hoy)}</b>
        </span>
        {rango.modo !== 'hoy' && (
          <button
            type="button"
            className="fd-volver"
            onClick={() => { setPanelAbierto(false); alCambiar(rangoHoy(hoy)); }}
          >
            Volver a hoy
          </button>
        )}
      </div>
    </div>
  );
}
