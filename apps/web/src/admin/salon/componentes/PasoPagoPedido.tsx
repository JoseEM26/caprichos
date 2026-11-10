import { useEffect, useRef, type ReactNode } from 'react';
import {
  MEDIOS_PLAN,
  aPlan,
  montoEfectivoPlan,
  nombreMedio,
  restantePlan,
  type FilaPlan,
  type MedioPlan,
} from '../../pedidos/planPago';
import { digitalesDelPlan } from '../../pedidos/mediosPago';
import '../paso-pago-pedido.css';

/** Máximo de métodos en un pago mixto. */
export const MAX_METODOS_PAGO = 3;

export type CuandoPaga = 'ahora' | 'final';

export interface PasoPagoPedidoProps {
  /** Total de la venta (sin propina). */
  total: number;
  /** Lo que paga el cliente: venta + propina. El plan de pago debe sumarlo. */
  aPagar: number;
  /** Resumen corto del pedido (mesa o cliente y cantidad de productos). */
  resumen: string;
  /** Solo en mesa de local: «Pagar ahora» o «Pagar al final». Sin valor, el pago es obligatorio. */
  cuandoPaga?: CuandoPaga;
  onCuandoPaga?: (v: CuandoPaga) => void;
  /** Mensaje bajo «Pagar ahora» según el canal (qué pasa al enviar). */
  avisoPagarAhora?: string;
  filas: FilaPlan[];
  onFilas: (filas: FilaPlan[]) => void;
  pagaCon: string;
  onPagaCon: (v: string) => void;
  pagaConObligatorio: boolean;
  /** Propina de monto libre: solo si el interruptor del canal está encendido. */
  propinaActiva: boolean;
  propina: string;
  onPropina: (v: string) => void;
  tope: number;
  errorPropina: string | null;
  /** Muestra en rojo lo que falta (después de tocar «Enviar»). */
  mostrarErrores: boolean;
  /** Pedido del personal: su propio bloque de pago reemplaza al de métodos. */
  bloquePersonal?: ReactNode;
  /** Selector de comprobante (simple, boleta o factura). */
  comprobante: ReactNode;
}

function dinero(n: number): string {
  return `S/ ${n.toFixed(2)}`;
}

/**
 * Paso 2 del Nuevo pedido: «Pago». Primero se elige el método y su monto; «Añadir otro método» (hasta 3) agrega
 * una fila con el saldo ya sugerido. Siempre se ve «Falta / Cubierto» y el total + propina. La propina es un monto
 * libre aparte de la venta: no suma al total, al comprobante ni a los puntos.
 */
export function PasoPagoPedido({
  total,
  aPagar,
  resumen,
  cuandoPaga,
  onCuandoPaga,
  avisoPagarAhora,
  filas,
  onFilas,
  pagaCon,
  onPagaCon,
  pagaConObligatorio,
  propinaActiva,
  propina,
  onPropina,
  tope,
  errorPropina,
  mostrarErrores,
  bloquePersonal,
  comprobante,
}: PasoPagoPedidoProps) {
  const conDetalle = bloquePersonal ? false : cuandoPaga !== 'final';
  const propinaNum = Math.max(0, Math.round((aPagar - total) * 100) / 100);

  // Un solo método: paga todo lo que corresponde (venta + propina). Sigue al total mientras el monto no se haya
  // tocado a mano; si el mozo lo baja (para añadir otro método), se respeta lo que escribió.
  const anterior = useRef<number | null>(null);
  useEffect(() => {
    const previo = anterior.current;
    anterior.current = aPagar;
    if (!conDetalle || filas.length !== 1 || aPagar <= 0) return;
    const monto = aPagar.toFixed(2);
    const actual = filas[0].monto;
    const sigueAutomatico = actual === '' || (previo !== null && actual === previo.toFixed(2)) || previo === null;
    if (sigueAutomatico && actual !== monto) onFilas([{ ...filas[0], monto }]);
  }, [conDetalle, filas, aPagar, onFilas]);

  const saldo = restantePlan(aPagar, filas);
  const cubierto = aPagar > 0 && Math.abs(saldo) < 0.005 && filas.every((f) => Number(f.monto) > 0);
  const sobra = saldo < -0.005;
  const plan = aPlan(filas);
  const efectivo = montoEfectivoPlan(plan);
  const hayEfectivo = filas.some((f) => f.medio === 'EFECTIVO');
  const pagaConNum = Number(pagaCon);
  const vuelto = hayEfectivo && pagaCon !== '' && pagaConNum >= efectivo ? pagaConNum - efectivo : null;
  const digitales = digitalesDelPlan(filas.map((f) => ({ medio: f.medio })));

  const cambiarFila = (i: number, cambios: Partial<FilaPlan>) =>
    onFilas(filas.map((f, j) => (j === i ? { ...f, ...cambios } : f)));
  const anadir = () => {
    const usados = new Set(filas.map((f) => f.medio));
    const libre = MEDIOS_PLAN.find((m) => !usados.has(m.id))?.id ?? 'YAPE';
    onFilas([...filas, { medio: libre, monto: saldo > 0 ? saldo.toFixed(2) : '' }]);
  };
  const quitar = (i: number) => onFilas(filas.filter((_, j) => j !== i));
  const puedeAnadir = filas.length < MAX_METODOS_PAGO && saldo > 0.005;

  return (
    <section className="np2-pago" aria-label="Pago del pedido" data-testid="paso-pago">
      <div className="np2-resumen-linea">{resumen}</div>

      {onCuandoPaga && !bloquePersonal && (
        <fieldset className="np2-cuando">
          <legend>¿Cuándo paga el cliente?</legend>
          <div className="np2-cuando-botones">
            <button
              type="button"
              aria-pressed={cuandoPaga === 'ahora'}
              className={cuandoPaga === 'ahora' ? 'np2-opcion np2-opcion--on' : 'np2-opcion'}
              onClick={() => onCuandoPaga('ahora')}
            >
              <b>Pagar ahora</b>
              <span>Registra el pago aquí</span>
            </button>
            <button
              type="button"
              aria-pressed={cuandoPaga === 'final'}
              className={cuandoPaga === 'final' ? 'np2-opcion np2-opcion--on' : 'np2-opcion'}
              onClick={() => onCuandoPaga('final')}
            >
              <b>Pagar al final</b>
              <span>Se cobra al cerrar la cuenta</span>
            </button>
          </div>
          {cuandoPaga === 'ahora' && avisoPagarAhora && <p className="np2-ayuda">{avisoPagarAhora}</p>}
        </fieldset>
      )}

      {bloquePersonal}

      {conDetalle && (
        <div className="np2-metodos" data-testid="plan-pago-editor" id="np-plan-pago">
          <h3 className="np2-titulo">¿Cómo paga?</h3>

          {filas.map((fila, i) => (
            <div key={i} className="np2-fila" role="group" aria-label={i === 0 ? '¿Cómo paga?' : `Método de pago ${i + 1}`}>
              <div className="np2-fila-cabeza">
                <span className="np2-fila-numero">{i === 0 ? 'Método de pago' : `Método ${i + 1}`}</span>
                {filas.length > 1 && (
                  <button type="button" className="np2-quitar" onClick={() => quitar(i)} aria-label={`Quitar ${nombreMedio(fila.medio)}`}>
                    Quitar
                  </button>
                )}
              </div>
              <div className="np2-medios">
                {MEDIOS_PLAN.map((m) => {
                  const usado = filas.some((o, j) => j !== i && o.medio === m.id);
                  const activo = fila.medio === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={activo}
                      disabled={usado}
                      className={activo ? 'np2-medio np2-medio--on' : 'np2-medio'}
                      onClick={() => cambiarFila(i, { medio: m.id as MedioPlan })}
                    >
                      {m.nombre}
                    </button>
                  );
                })}
              </div>
              <label className="np2-monto">
                <span>Monto en {nombreMedio(fila.medio)}</span>
                <span className="np2-monto-campo">
                  <b>S/</b>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    aria-label={`Monto en ${nombreMedio(fila.medio)}`}
                    value={fila.monto}
                    onChange={(e) => cambiarFila(i, { monto: e.target.value })}
                  />
                </span>
              </label>
              {digitalesDelPlan([{ medio: fila.medio }]).length > 0 && (
                <p className="np2-ayuda" data-testid={`captura-aviso-${fila.medio.toLowerCase()}`}>
                  Al enviar se pide la captura de {nombreMedio(fila.medio)} (una por cada medio digital).
                </p>
              )}
            </div>
          ))}

          {filas.length < MAX_METODOS_PAGO && (
            <button type="button" className="np2-anadir" onClick={anadir} disabled={!puedeAnadir}>
              + Añadir otro método
              {puedeAnadir ? <small>Faltan {dinero(saldo)}</small> : <small>Baja el monto del primero para añadir otro</small>}
            </button>
          )}

          <div
            className={cubierto ? 'np2-estado np2-estado--ok' : 'np2-estado np2-estado--falta'}
            role={mostrarErrores && !cubierto ? 'alert' : 'status'}
            data-testid="estado-pago"
          >
            {cubierto
              ? 'Cubierto: el pago completa el total'
              : sobra
                ? `Sobra ${dinero(-saldo)}: baja un monto`
                : `Falta ${dinero(Math.max(0, saldo))}`}
          </div>

          {hayEfectivo && (
            <div className="np2-efectivo">
              <label htmlFor="plan-paga-con">
                ¿Con cuánto paga?{' '}
                <small>{pagaConObligatorio ? '(para calcular el vuelto)' : '(opcional)'}</small>
              </label>
              <div className="np2-efectivo-fila">
                <input
                  id="plan-paga-con"
                  type="number"
                  step="0.50"
                  min="0"
                  value={pagaCon}
                  onChange={(e) => onPagaCon(e.target.value)}
                  placeholder={efectivo > 0 ? `Mínimo ${dinero(efectivo)}` : 'Monto'}
                  aria-required={pagaConObligatorio}
                  aria-invalid={mostrarErrores && pagaConObligatorio && efectivo > 0 && !(vuelto !== null)}
                />
                {efectivo > 0 && (
                  <button type="button" className="np2-exacto" onClick={() => onPagaCon(efectivo.toFixed(2))}>
                    Pago exacto ({dinero(efectivo)})
                  </button>
                )}
              </div>
              {vuelto !== null && (
                <div className="np2-vuelto" data-testid="vuelto">
                  Vuelto {dinero(vuelto)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {propinaActiva && !bloquePersonal && conDetalle && (
        <div className="np2-propina" data-testid="propina-nuevo-pedido">
          <label htmlFor="np-propina">Propina para el equipo (opcional)</label>
          <div className="np2-monto-campo">
            <b>S/</b>
            <input
              id="np-propina"
              type="text"
              inputMode="decimal"
              value={propina}
              placeholder="0.00"
              onChange={(e) => onPropina(e.target.value)}
              aria-invalid={errorPropina !== null}
            />
          </div>
          <p className="np2-ayuda">
            Monto libre, aparte del pedido: no suma al total, al comprobante ni a los puntos. Máximo {dinero(tope)}.
          </p>
          {errorPropina && (
            <p role="alert" className="np2-error">
              {errorPropina}
            </p>
          )}
        </div>
      )}

      <div className="np2-comprobante" id="np-comprobante">
        {comprobante}
      </div>

      <dl className="np2-totales" aria-label="Resumen de pago">
        <div>
          <dt>Total del pedido</dt>
          <dd>{dinero(total)}</dd>
        </div>
        {propinaNum > 0 && (
          <div data-testid="propina-resumen">
            <dt>Propina</dt>
            <dd>{dinero(propinaNum)}</dd>
          </div>
        )}
        <div className="np2-totales-final">
          <dt>{propinaNum > 0 ? 'Total a pagar' : 'Total'}</dt>
          <dd>{dinero(aPagar)}</dd>
        </div>
        {conDetalle && plan.length > 0 && (
          <div className="np2-totales-detalle">
            <dt>Paga con</dt>
            <dd>{plan.map((f) => `${nombreMedio(f.medio)} ${dinero(f.monto)}`).join(' + ')}</dd>
          </div>
        )}
        {conDetalle && digitales.length > 0 && (
          <div className="np2-totales-detalle">
            <dt>Capturas</dt>
            <dd>{digitales.length === 1 ? '1 captura' : `${digitales.length} capturas`} al enviar</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
