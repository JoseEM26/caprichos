import { ModalConPestanas } from '../../comun/ModalConPestanas';
import { Boton } from '../../comun/Boton';
import type { DetallePlanilla, MovimientoPlanilla } from './planillaApi';
import { soles } from './planillaApi';

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** «Lun 17 nov» desde AAAA-MM-DD. */
export const fechaLegible = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MESES[m - 1]}`;
};
const conSigno = (m: MovimientoPlanilla) => (m.tipo === 'INFO' ? '—' : `${m.monto > 0 ? '+' : '−'} ${soles(Math.abs(m.monto))}`);
const subtotal = (ms: MovimientoPlanilla[]) => Math.round(ms.reduce((a, m) => a + m.monto, 0) * 100) / 100;

function Linea({ m }: { m: MovimientoPlanilla }) {
  return (
    <li className={`dn-linea dn-${m.tipo.toLowerCase()}`}>
      <span className="dn-texto">{m.concepto}{m.detalle && <small>{m.detalle}</small>}</span>
      <span className="dn-monto as-num">{conSigno(m)}</span>
    </li>
  );
}

function Bloque({ titulo, ms }: { titulo: string; ms: MovimientoPlanilla[] }) {
  const sub = subtotal(ms);
  return (
    <section className="dn-bloque" aria-label={titulo}>
      <h3>{titulo}</h3>
      <ul>{ms.map((m, i) => <Linea key={i} m={m} />)}</ul>
      <p className="dn-sub">Subtotal <strong className="as-num">{sub < 0 ? '−' : sub > 0 ? '+' : ''} {soles(Math.abs(sub))}</strong></p>
    </section>
  );
}

/** Lista día por día de cómo sale el neto. Todo viene del servidor (`movimientos`); aquí solo se agrupa y se muestra. */
export function DetalleNeto({ d, alCerrar }: { d: DetallePlanilla; alCerrar: () => void }) {
  const ms = d.movimientos;
  const fechas = ms ? [...new Set(ms.filter((m) => m.fecha).map((m) => m.fecha as string))].sort() : [];
  const periodo = ms?.filter((m) => !m.fecha) ?? [];
  const contenido = !ms
    ? <p className="as-nota" role="status">No disponible para este pago antiguo.</p>
    : ms.length === 0
      ? <p className="as-nota">Este período no tiene movimientos.</p>
      : (
        <div className="dn-lista">
          {fechas.map((f) => <Bloque key={f} titulo={fechaLegible(f)} ms={ms.filter((m) => m.fecha === f)} />)}
          {periodo.length > 0 && <Bloque titulo="Del período" ms={periodo} />}
          <p className="dn-total">Neto a pagar <strong className="as-num" data-testid="dn-total">{soles(d.resultado.neto)}</strong></p>
        </div>
      );
  return (
    <ModalConPestanas
      titulo="Detalle del neto a pagar"
      subtitulo={`${d.nombre} · ${fechaLegible(d.periodo.desde)} al ${fechaLegible(d.periodo.hasta)}`}
      pestanas={[{ id: 'dias', etiqueta: 'Día por día', contenido }]}
      alCerrar={alCerrar}
      ancho={640}
      pie={<Boton type="button" variante="secundario" onClick={alCerrar}>Cerrar</Boton>}
    />
  );
}
