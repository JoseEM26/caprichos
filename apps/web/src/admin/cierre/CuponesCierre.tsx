import './ventas-turno.css';
import type { CuponesTurno } from './cierreApi';

const soles = (n: number) => `S/ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const hora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' }) : '—';
const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', timeZone: 'America/Lima' }) : 'sin fecha';

/**
 * «Cupones del turno», por persona: dados, canjeados (con el descuento) y pendientes de canje.
 * Es informativa: el descuento ya está dentro del total de cada pedido, no mueve el efectivo esperado ni el cuadre.
 */
export function CuponesCierre({ datos }: { datos?: CuponesTurno | null }) {
  if (!datos) return null;
  const { totales, otros, porPersona } = datos;
  const vacio = porPersona.length === 0 && otros.canjes === 0;
  return (
    <section className="vt" aria-labelledby="cc-titulo" data-testid="cupones-turno">
      <div className="vt-cab">
        <h3 id="cc-titulo" className="vt-titulo">Cupones del turno</h3>
        <span className="vt-sub">
          {totales.dados} dados · {totales.canjeados} canjeados · {totales.pendientes} pendientes · descuento por cupones del personal <b data-testid="cupones-descuento">{soles(totales.descuento)}</b>
        </span>
      </div>
      <p className="vt-sub" style={{ margin: 0 }}>Solo informa: el descuento ya está dentro del total de cada pedido y no cambia el efectivo esperado.</p>
      {vacio && <p className="vt-sub" style={{ margin: 0 }}>Ningún cupón dado ni canjeado en este turno.</p>}
      {porPersona.map((p) => (
        <div key={p.partyId ?? 'sin'} data-testid="cupones-persona" style={{ borderTop: '1px solid var(--cp-line, #E3D6C6)', paddingTop: 8 }}>
          <h4 style={{ margin: '0 0 4px', fontSize: 14 }}>
            {p.nombre} <span className="vt-sub">· {p.totales.dados} dados · {p.totales.canjeados} canjeados · {p.totales.pendientes} pendientes · {soles(p.totales.descuento)}</span>
          </h4>
          {p.dados.length > 0 && (
            <div className="cj2-tabla-scroll" tabIndex={0} role="region" aria-label={`Cupones dados por ${p.nombre}`}>
              <table className="cj2-tabla">
                <caption className="vt-sub" style={{ textAlign: 'left' }}>Dados</caption>
                <thead><tr><th scope="col">Código</th><th scope="col">Pedido</th><th scope="col">Cliente</th><th scope="col">Hora</th><th scope="col">Vence</th><th scope="col">Estado</th></tr></thead>
                <tbody>
                  {p.dados.map((d) => (
                    <tr key={d.codigo} data-testid="cupon-dado-fila">
                      <td>{d.codigo}</td><td>{d.pedido ?? '—'}</td><td>{d.cliente ?? 'Sin celular'}</td><td>{hora(d.en)}</td><td>{fecha(d.venceEn)}</td><td>{d.estado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {p.canjeados.length > 0 && (
            <div className="cj2-tabla-scroll" tabIndex={0} role="region" aria-label={`Cupones canjeados por ${p.nombre}`}>
              <table className="cj2-tabla">
                <caption className="vt-sub" style={{ textAlign: 'left' }}>Canjeados</caption>
                <thead><tr><th scope="col">Código</th><th scope="col">Pedido</th><th scope="col">Descuento</th><th scope="col">Lo dio</th><th scope="col">Canal</th><th scope="col">Hora</th></tr></thead>
                <tbody>
                  {p.canjeados.map((c) => (
                    <tr key={c.codigo} data-testid="cupon-canjeado-fila">
                      <td>{c.codigo}</td><td>{c.pedido ?? '—'}</td><td>{soles(c.descuento)}</td><td>{c.dioNombre ?? '—'}</td><td>{c.canal ?? '—'}</td><td>{hora(c.en)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {p.pendientes.length > 0 && (
            <p className="vt-sub" data-testid="cupones-pendientes" style={{ margin: '6px 0 0' }}>
              Pendientes de canje: {p.pendientes.map((x) => `${x.codigo} (vence ${fecha(x.venceEn)})`).join(' · ')}
            </p>
          )}
        </div>
      ))}
      {otros.canjes > 0 && (
        <p className="vt-sub" data-testid="cupones-otros" style={{ margin: 0, borderTop: '1px solid var(--cp-line, #E3D6C6)', paddingTop: 8 }}>
          Otros cupones (compartidos y de comprobante) canjeados en el turno: {otros.canjes} · descuento {soles(otros.descuento)}
        </p>
      )}
    </section>
  );
}
