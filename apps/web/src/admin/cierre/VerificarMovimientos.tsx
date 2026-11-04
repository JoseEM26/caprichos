import './verificar-movimientos.css';
import type { ReactNode } from 'react';
import type { MovimientoCaja, CobroTurno } from '../pedidos/pedidosApi';
import type { DevolucionTurno } from './cierreApi';


export const soles = (n: unknown) => `S/ ${Number(n || 0).toFixed(2)}`;

export interface ResumenAdmin {
  apertura: number;
  ventasEfectivo: number;
  yape: number;
  plin: number;
  transferencia: number;
  tarjeta: number;
  efectivoEsperado: number;
}

interface Props {
  /** Fecha AAAA-MM-DD de la caja abierta que se cierra (no necesariamente la de hoy) */
  fecha: string;
  /** La caja abierta es de un día anterior al de hoy: se avisa y no se mezcla con la de hoy */
  diaAnterior?: boolean;
  cajero: string;
  /** Solo la supervisora ve lo esperado (cierre ciego): para el cajero va null */
  resumen: ResumenAdmin | null;
  totalCobrado: number;
  ingresos: number;
  egresos: number;
  pedidosCobrados: CobroTurno[];
  movimientos: MovimientoCaja[];
  pendientesCount: number;
  /** Devoluciones de pedidos de la caja abierta (solo informativo) */
  devoluciones?: DevolucionTurno[];
  /** Panel de pendientes ya existente */
  pendientes: ReactNode;
  onContinuar: () => void;
  onVolver: () => void;
}

/** AAAA-MM-DD → dd/mm/aaaa */
const fechaDmy = (f: string) => f.split('-').reverse().join('/');

const Tarjeta = ({ t, v, ayuda, fuerte }: { t: string; v: number; ayuda?: string; fuerte?: boolean }) => (
  <div className={`vm-tarjeta${fuerte ? ' vm-tarjeta-fuerte' : ''}`} data-testid="vm-tarjeta">
    <span className="vm-tarjeta-t">{t}</span>
    <b className="vm-tarjeta-v">{soles(v)}</b>
    {ayuda && <span className="vm-ayuda">{ayuda}</span>}
  </div>
);

const MEDIO_DEVOLUCION: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  YAPE: 'Yape',
  PLIN: 'Plin',
  TRANSFERENCIA: 'Transferencia',
  TARJETA: 'Tarjeta',
};

export function VerificarMovimientos(p: Props) {
  const r = p.resumen;
  const devoluciones = p.devoluciones ?? [];
  const totalDigital = devoluciones.filter((d) => d.medio !== 'EFECTIVO').reduce((a, d) => a + d.montoDevuelto, 0);
  const medios = r
    ? [
        { n: 'Efectivo', m: r.ventasEfectivo, c: 'EFECTIVO' },
        { n: 'Yape', m: r.yape, c: 'YAPE' },
        { n: 'Plin', m: r.plin, c: 'PLIN' },
        { n: 'Transferencia', m: r.transferencia, c: 'TRANSFERENCIA' },
        ...(r.tarjeta > 0 ? [{ n: 'Tarjeta', m: r.tarjeta, c: 'TARJETA' }] : []),
      ]
    : [];
  const cuenta = (c: string) => p.pedidosCobrados.filter((x) => x.medios.map((m) => m.toUpperCase()).includes(c)).length;

  return (
    <>
      <div className="vm-cuerpo">
        {p.diaAnterior && (
          <div className="vm-aviso-dia" role="alert">
            Esta caja es del {fechaDmy(p.fecha)} y sigue abierta. Ciérrala antes de trabajar con la de hoy.
          </div>
        )}
        <div className="vm-meta">
          <span>Turno del <b>{p.fecha}</b></span>
          <span>Cajero: <b>{p.cajero}</b></span>
          <span className={p.diaAnterior ? 'vm-estado vm-estado-anterior' : 'vm-estado'}>
            {p.diaAnterior ? 'Caja abierta (día anterior)' : 'Caja abierta'}
          </span>
        </div>

        <div className="vm-resumen">
          <Tarjeta t="Total cobrado" v={p.totalCobrado} fuerte />
          {medios.map((m) => (
            <Tarjeta key={m.n} t={m.n} v={m.m} />
          ))}
          <Tarjeta t="Ingresos de caja" v={p.ingresos} />
          <Tarjeta t="Egresos de caja" v={p.egresos} />
          {r && (
            <Tarjeta
              t="Efectivo esperado"
              v={r.efectivoEsperado}
              ayuda="Efectivo esperado = apertura + cobros en efectivo + ingresos − egresos"
              fuerte
            />
          )}
        </div>

        {r && (
          <section className="vm-seccion" aria-labelledby="vm-h-medios">
            <h3 id="vm-h-medios">Cobros por medio de pago</h3>
            <div className="vm-tabla" role="table" aria-label="Cobros por medio de pago">
              <div className="vm-fila vm-cab" role="row">
                <span role="columnheader">Medio</span>
                <span role="columnheader" className="vm-der">Pedidos</span>
                <span role="columnheader" className="vm-der">Monto</span>
              </div>
              {medios.map((m) => (
                <div className="vm-fila" role="row" key={m.n}>
                  <span role="cell">{m.n}</span>
                  <span role="cell" className="vm-der">{cuenta(m.c)}</span>
                  <span role="cell" className="vm-der vm-monto">{soles(m.m)}</span>
                </div>
              ))}
              <div className="vm-fila vm-total" role="row">
                <span role="cell">Total cobrado</span>
                <span role="cell" />
                <span role="cell" className="vm-der vm-monto">{soles(p.totalCobrado)}</span>
              </div>
            </div>
          </section>
        )}

        <section className="vm-seccion" aria-labelledby="vm-h-pedidos">
          <h3 id="vm-h-pedidos">Pedidos cobrados en el turno</h3>
          {p.pedidosCobrados.length === 0 ? (
            <div className="vm-vacio">Sin pedidos cobrados aún.</div>
          ) : (
            <div className="vm-tabla vm-scroll" role="table" aria-label="Pedidos cobrados en el turno">
              <div className="vm-fila vm-cab vm-fila-4" role="row">
                <span role="columnheader">Pedido</span>
                <span role="columnheader">Cliente</span>
                <span role="columnheader">Medio</span>
                <span role="columnheader" className="vm-der">Monto</span>
              </div>
              {p.pedidosCobrados.map((x) => (
                <div className="vm-fila vm-fila-4" role="row" key={x.pedidoId}>
                  <span role="cell"><b>{x.codigo}</b></span>
                  <span role="cell">{x.cliente || 'Cliente'}</span>
                  <span role="cell">{x.medios.join(' + ') || 'Efectivo'}</span>
                  <span role="cell" className="vm-der vm-monto">{soles(x.total)}</span>
                </div>
              ))}
              <div className="vm-fila vm-fila-4 vm-total" role="row">
                <span role="cell">Total</span>
                <span role="cell" />
                <span role="cell" />
                <span role="cell" className="vm-der vm-monto">{soles(p.pedidosCobrados.reduce((a, x) => a + x.total, 0))}</span>
              </div>
            </div>
          )}
        </section>

        <section className="vm-seccion" aria-labelledby="vm-h-mov">
          <h3 id="vm-h-mov">Movimientos de caja</h3>
          {p.movimientos.length === 0 ? (
            <div className="vm-vacio">Sin movimientos de caja en este turno.</div>
          ) : (
            <div className="vm-tabla" role="table" aria-label="Movimientos de caja">
              <div className="vm-fila vm-cab vm-fila-3" role="row">
                <span role="columnheader">Tipo</span>
                <span role="columnheader">Motivo</span>
                <span role="columnheader" className="vm-der">Monto</span>
              </div>
              {p.movimientos.map((m) => (
                <div className="vm-fila vm-fila-3" role="row" key={m.id}>
                  <span role="cell"><b>{m.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'}</b></span>
                  <span role="cell">{m.motivo}</span>
                  <span role="cell" className={`vm-der vm-monto ${m.tipo === 'INGRESO' ? 'vm-ing' : 'vm-egr'}`}>
                    {m.tipo === 'INGRESO' ? '+ ' : '− '}{soles(m.monto)}
                  </span>
                </div>
              ))}
              <div className="vm-fila vm-fila-3 vm-total" role="row">
                <span role="cell">Neto</span>
                <span role="cell" />
                <span role="cell" className="vm-der vm-monto">{soles(p.ingresos - p.egresos)}</span>
              </div>
            </div>
          )}
          <div className="vm-ayuda">Los movimientos anulados no cuentan en el total de ingresos y egresos.</div>
        </section>

        <section className="vm-seccion" aria-labelledby="vm-h-dev">
          <h3 id="vm-h-dev">Devoluciones del turno</h3>
          {devoluciones.length === 0 ? (
            <div className="vm-vacio">Sin devoluciones en este turno.</div>
          ) : (
            <div className="vm-tabla vm-scroll" role="table" aria-label="Devoluciones del turno">
              <div className="vm-fila vm-cab vm-fila-4" role="row">
                <span role="columnheader">Pedido</span>
                <span role="columnheader">Medio</span>
                <span role="columnheader">Código</span>
                <span role="columnheader" className="vm-der">Monto</span>
              </div>
              {devoluciones.map((d) => (
                <div className="vm-fila vm-fila-4" role="row" key={d.id}>
                  <span role="cell"><b>{d.pedidoCodigo}</b></span>
                  <span role="cell">{MEDIO_DEVOLUCION[d.medio] ?? d.medio}</span>
                  <span role="cell">{d.codigoOperacion || '—'}</span>
                  <span role="cell" className="vm-der vm-monto">{soles(d.montoDevuelto)}</span>
                </div>
              ))}
              <div className="vm-fila vm-fila-4 vm-total" role="row">
                <span role="cell">Devuelto por Yape, Plin, transferencia y tarjeta</span>
                <span role="cell" />
                <span role="cell" />
                <span role="cell" className="vm-der vm-monto">{soles(totalDigital)}</span>
              </div>
            </div>
          )}
          <div className="vm-ayuda">
            Solo para revisar. Las devoluciones en efectivo ya salen como egreso en Movimientos de caja. Las digitales
            todavía no descuentan del cuadre: compáralas con lo que devolviste por Yape, Plin o transferencia.
          </div>
        </section>

        <section className="vm-seccion" aria-labelledby="vm-h-pend">
          <h3 id="vm-h-pend">
            Pendientes{p.pendientesCount > 0 ? ` (${p.pendientesCount})` : ''}
          </h3>
          {p.pendientes}
        </section>
      </div>

      <div className="vm-pie">
        <button type="button" className="vm-btn vm-btn-prim" onClick={p.onContinuar}>
          Ya revisé: continuar al conteo
        </button>
        <button type="button" className="vm-btn" onClick={p.onVolver}>
          Volver
        </button>
      </div>
    </>
  );
}
