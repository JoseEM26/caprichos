import './ventas-turno.css';
import type { ProgramadosTurno } from './cierreApi';
import { nombreMedio } from '../pedidos/planPago';

const soles = (n: number) => `S/ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const diaMes = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', timeZone: 'America/Lima' }) : '—';

/**
 * «Pedidos programados» del turno: cada adelanto o pago completo recibido hoy de un pedido para otro día, identificado como
 * «de pedido programado para 17/11». Solo detalla: el dinero ya está en los cobros y en los montos de arriba. Sin datos no se dibuja.
 */
export function ProgramadosCierre({ datos }: { datos?: ProgramadosTurno }) {
  if (!datos || datos.lista.length === 0) return null;
  return (
    <section className="vt" aria-labelledby="pg-cierre-titulo" data-testid="programados-cierre">
      <div className="vt-cab">
        <h3 id="pg-cierre-titulo" className="vt-titulo">Pedidos programados</h3>
        <span className="vt-sub">
          {datos.lista.length} {datos.lista.length === 1 ? 'cobro' : 'cobros'} · <b>{soles(datos.total)}</b>
        </span>
      </div>
      <div className="cj2-tabla-scroll" tabIndex={0} role="region" aria-label="Dinero de pedidos programados del turno">
        <table className="cj2-tabla">
          <thead>
            <tr>
              <th scope="col">Pedido</th>
              <th scope="col">Qué es</th>
              <th scope="col">Monto</th>
              <th scope="col">Medio de pago</th>
            </tr>
          </thead>
          <tbody>
            {datos.lista.map((x, i) => (
              <tr key={`${x.pedidoId}-${x.tipo}-${i}`} data-testid="programado-cierre-fila">
                <td>{x.pedidoCodigo ?? x.pedidoId}</td>
                <td>{x.tipo === 'ADELANTO' ? 'Adelanto' : 'Pago completo'} de pedido programado para {diaMes(x.programadoPara)}</td>
                <td>{soles(x.monto)}</td>
                <td>{x.medios.map(nombreMedio).join(' + ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
