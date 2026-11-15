import './ventas-turno.css';
import type { ServiciosLibresTurno } from './cierreApi';
import { nombreMedio } from '../pedidos/planPago';

const soles = (n: number) => `S/ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const hora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' }) : '—';

/**
 * «Servicios y productos libres» del turno: cada cargo libre cobrado, con su pedido, medio de pago y quién lo agregó.
 * Solo detalla: el dinero ya está dentro del cobro de cada pedido y de los montos de arriba.
 */
export function ServiciosLibresCierre({ datos }: { datos?: ServiciosLibresTurno }) {
  if (!datos) return null;
  return (
    <section className="vt" aria-labelledby="sl-titulo" data-testid="servicios-libres">
      <div className="vt-cab">
        <h3 id="sl-titulo" className="vt-titulo">Servicios y productos libres</h3>
        <span className="vt-sub">
          {datos.lista.length} {datos.lista.length === 1 ? 'cargo' : 'cargos'} · <b data-testid="servicios-libres-total">{soles(datos.total)}</b>
        </span>
      </div>
      {datos.lista.length === 0 ? (
        <p className="vt-sub" style={{ margin: 0 }}>Ningún servicio ni producto libre en este turno.</p>
      ) : (
        <div className="cj2-tabla-scroll" tabIndex={0} role="region" aria-label="Servicios y productos libres del turno">
          <table className="cj2-tabla">
            <thead>
              <tr>
                <th scope="col">Pedido</th>
                <th scope="col">Descripción</th>
                <th scope="col">Monto</th>
                <th scope="col">Medio de pago</th>
                <th scope="col">Agregado por</th>
                <th scope="col">Hora</th>
              </tr>
            </thead>
            <tbody>
              {datos.lista.map((x, i) => (
                <tr key={`${x.pedidoId}-${i}`} data-testid="servicio-libre-fila">
                  <td>{x.pedidoCodigo ?? x.pedidoId}</td>
                  <td>{x.descripcion}</td>
                  <td>{soles(x.monto)}</td>
                  <td>{x.medios.map(nombreMedio).join(' + ') || '—'}</td>
                  <td>{x.agregadoPor ?? '—'}</td>
                  <td>{hora(x.agregadoEn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
