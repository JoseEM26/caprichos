import { useId, useState } from 'react';
import { FiltroCombo, type OpcionFiltro } from '../../comun/FiltroCombo';
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

  // Un solo combo en lugar de una fila de botones; «Elegir día / rango» abre el panel de fechas
  const valorCombo = panelAbierto ? 'rango' : rango.modo;
  const opciones: OpcionFiltro[] = [
    { valor: 'hoy', etiqueta: 'Hoy' },
    { valor: 'ayer', etiqueta: 'Ayer' },
    { valor: 'semana', etiqueta: 'Últimos 7 días' },
    { valor: 'rango', etiqueta: 'Elegir día / rango' },
    ...(pendientesAnteriores > 0 || rango.modo === 'pendientes'
      ? [{ valor: 'pendientes', etiqueta: 'Pendientes de días anteriores', cantidad: pendientesAnteriores }]
      : []),
  ];

  const elegirOpcion = (v: string) => {
    if (v === 'rango') {
      setPanelAbierto(true);
      return;
    }
    setPanelAbierto(false);
    if (v === 'hoy') alCambiar(rangoHoy(hoy));
    else if (v === 'pendientes') alCambiar({ modo: 'pendientes', desde: '', hasta: '' });
    else alCambiar(rangoPara(v as 'ayer' | 'semana', hoy));
  };

  return (
    <div className="fd" aria-label="Filtro de días">
      <div className="fd-chips">
        <FiltroCombo etiqueta="Mostrar" valor={valorCombo} valorPorDefecto="hoy" opciones={opciones} alCambiar={elegirOpcion} />
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
