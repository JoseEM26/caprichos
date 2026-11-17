import { FiltroCombo } from '../../comun/FiltroCombo';
import {
  ESTADOS_FILTRO,
  FiltrosAvanzados,
  METODOS_FILTRO,
  MODALIDADES_FILTRO,
  PAGOS_FILTRO,
  errorMontos,
} from './misPedidosFiltros';

interface Props {
  id: string;
  valor: FiltrosAvanzados;
  /** Pedidos sin captura de voucher en lo cargado (se cuenta en la casilla) */
  cuantosFaltan: number;
  alCambiar: (cambio: Partial<FiltrosAvanzados>) => void;
  alLimpiar: () => void;
}

/** Panel «Filtros avanzados» de Mis pedidos: estado, modalidad, pago, método y monto. */
export function FiltrosAvanzadosMisPedidos({ id, valor, cuantosFaltan, alCambiar, alLimpiar }: Props) {
  const alternarEstado = (estado: string) =>
    alCambiar({ estados: valor.estados.includes(estado) ? valor.estados.filter((e) => e !== estado) : [...valor.estados, estado] });
  const errorDeMontos = errorMontos(valor.montoMin, valor.montoMax);

  return (
    <div className="mpf-panel" id={id} role="region" aria-label="Filtros avanzados">
      <fieldset className="mpf-grupo">
        <legend>Estado</legend>
        <div className="mpf-casillas">
          {ESTADOS_FILTRO.map((e) => (
            <label key={e.valor} className="mpf-casilla">
              <input type="checkbox" checked={valor.estados.includes(e.valor)} onChange={() => alternarEstado(e.valor)} />
              {e.etiqueta}
            </label>
          ))}
          <label className="mpf-casilla">
            <input type="checkbox" checked={valor.faltaVoucher} onChange={(ev) => alCambiar({ faltaVoucher: ev.target.checked })} />
            Falta captura ({cuantosFaltan})
          </label>
        </div>
      </fieldset>

      <div className="mpf-combos">
        <FiltroCombo
          etiqueta="Modalidad"
          valor={valor.modalidad}
          valorPorDefecto="todos"
          opciones={MODALIDADES_FILTRO}
          alCambiar={(v) => alCambiar({ modalidad: v })}
        />
        <FiltroCombo
          etiqueta="Pago"
          valor={valor.pago}
          valorPorDefecto="todos"
          opciones={PAGOS_FILTRO}
          alCambiar={(v) => alCambiar({ pago: v })}
        />
        <FiltroCombo
          etiqueta="Método"
          valor={valor.metodo}
          valorPorDefecto="todos"
          opciones={METODOS_FILTRO}
          alCambiar={(v) => alCambiar({ metodo: v })}
        />
      </div>

      <div className="mpf-montos">
        <label>
          Monto mínimo (S/)
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={valor.montoMin}
            onChange={(e) => alCambiar({ montoMin: e.target.value })}
          />
        </label>
        <label>
          Monto máximo (S/)
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={valor.montoMax}
            onChange={(e) => alCambiar({ montoMax: e.target.value })}
          />
        </label>
      </div>
      {errorDeMontos && <p className="mpf-error" role="alert">{errorDeMontos}</p>}

      <button type="button" className="mpv-boton" onClick={alLimpiar}>
        Limpiar filtros
      </button>
    </div>
  );
}
