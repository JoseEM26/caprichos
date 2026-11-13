import { useEffect, useState } from 'react';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { Insignia } from '../../comun/Insignia';
import { cierreApi, type AnalisisCierre } from './cierreApi';

const soles = (n: number) => `S/ ${Math.abs(n).toFixed(2)}`;
const conSigno = (n: number) => `${n > 0.004 ? '+' : n < -0.004 ? '−' : ''}${soles(n)}`;

/** Pestaña «¿Por qué no cuadra?» del detalle del cierre (solo administrador, solo lectura). */
export function PorQueNoCuadra({ cajaId }: { cajaId: number }) {
  const [datos, setDatos] = useState<AnalisisCierre | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    cierreApi
      .obtenerAnalisis(cajaId)
      .then((d) => vivo && setDatos(d))
      .catch((e: any) => vivo && setError(e?.message || 'No se pudo cargar el análisis'));
    return () => {
      vivo = false;
    };
  }, [cajaId]);

  if (error) return <EstadoError mensaje={error} />;
  if (!datos) return <Cargando mensaje="Analizando el cierre..." />;

  return (
    <div className="dc-bloque" data-testid="seccion-porque">
      <table className="dc-tabla" data-testid="porque-medios">
        <thead><tr><th>Medio</th><th>Sistema</th><th>Visto</th><th>Dif.</th></tr></thead>
        <tbody>
          {datos.medios.map((m) => (
            <tr key={m.medio}>
              <td>{m.medio}</td>
              <td>{soles(m.sistema)}</td>
              <td>{m.visto === null ? '—' : soles(m.visto)}</td>
              <td className={m.diferencia === null || Math.abs(m.diferencia) < 0.005 ? 'dc-ok' : 'dc-mal'}>
                {m.diferencia === null ? '—' : Math.abs(m.diferencia) < 0.005 ? 'Cuadra' : conSigno(m.diferencia)}
              </td>
            </tr>
          ))}
          <tr>
            <td><b>Total</b></td><td /><td />
            <td className={Math.abs(datos.totalDiferencia) < 0.005 ? 'dc-ok' : 'dc-mal'}><b>{conSigno(datos.totalDiferencia)}</b></td>
          </tr>
        </tbody>
      </table>

      {datos.patrones.length === 0 && <p className="dc-aviso">No encontramos una causa clara en los datos. Revisa la ayuda general de abajo.</p>}
      {datos.patrones.map((p) => (
        <section key={p.codigo} className="dc-card" data-testid={`patron-${p.codigo}`}>
          <h4>
            {p.titulo}{' '}
            <Insignia variante="aviso">Posible causa</Insignia>
          </h4>
          <p>{p.explicacion}</p>
          {p.montoRelacionado !== undefined && <p className="dc-peq">Monto relacionado: {soles(p.montoRelacionado)}</p>}
          {p.pedidos && p.pedidos.length > 0 && (
            <ul className="dc-items">
              {p.pedidos.map((x, i) => (
                <li key={`${x.codigo}-${i}`}><b>{x.codigo}</b> · {soles(x.monto)} · {x.detalle}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {datos.sugerencias.length > 0 && (
        <section className="dc-card" data-testid="sugerencias">
          <h4>Montos que coinciden</h4>
          <ul className="dc-items">
            {datos.sugerencias.map((s, i) => <li key={i}>{s.texto}</li>)}
          </ul>
        </section>
      )}

      <details className="dc-intento" data-testid="ayuda-general">
        <summary>Ayuda general: causas comunes</summary>
        {datos.ayudaGeneral.map((a) => (
          <div key={a.medio}>
            <h4>{a.medio}</h4>
            <p className="dc-peq"><b>Si sobra:</b></p>
            <ul className="dc-items">{a.sobrante.map((t) => <li key={t}>{t}</li>)}</ul>
            <p className="dc-peq"><b>Si falta:</b></p>
            <ul className="dc-items">{a.faltante.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        ))}
      </details>
    </div>
  );
}
