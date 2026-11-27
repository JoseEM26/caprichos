import { useEffect, useState } from 'react';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { Insignia } from '../../comun/Insignia';
import { cierreApi, type AnalisisCierre, type CambioMedioCierre, type VentaCierre } from './cierreApi';
import { rotuloMedioCierre } from './cuadre.util';

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
            {p.informativo ? <Insignia variante="neutro">No afecta la caja</Insignia> : <Insignia variante="aviso">Posible causa</Insignia>}
          </h4>
          <p>{p.explicacion}</p>
          {p.montoRelacionado !== undefined && <p className="dc-peq">{p.informativo ? 'Total a cobrar después' : 'Monto relacionado'}: {soles(p.montoRelacionado)}</p>}
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

      <CambiosDeMedio cambios={datos.cambiosMedio ?? []} />
      <VentasDeLaCaja ventas={datos.ventas ?? []} cambiados={new Set((datos.cambiosMedio ?? []).map((c) => c.codigo))} />

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

/** Cambios de medio de pago de los pedidos de esta caja: quién, cuándo, de qué a qué y por qué. Solo informativo. */
function CambiosDeMedio({ cambios }: { cambios: CambioMedioCierre[] }) {
  return (
    <section className="dc-card" data-testid="cambios-medio">
      <h4>Cambios de medio de pago ({cambios.length}) <Insignia variante="neutro">Informativo</Insignia></h4>
      {cambios.length === 0 ? (
        <p className="dc-peq">Nadie cambió el medio de pago de los pedidos de esta caja.</p>
      ) : (
        <ul className="dc-items">
          {cambios.map((c, i) => (
            <li key={`${c.codigo}-${i}`}>
              <b>{c.codigo}</b> · {c.hora} · {c.antes || '—'} → <b>{c.despues || '—'}</b>
              <div className="dc-peq">
                Hecho por <b>{c.por ?? 'sin dato'}</b> · {c.origen}
                {c.motivo ? ` · Motivo: ${c.motivo}` : ''}
              </div>
              {c.despuesDelCierre && <div className="dc-peq dc-mal">Se cambió después de cerrar la caja: el cierre sigue con el medio anterior.</div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Ventas (cobros) de la caja con quién las cobró; filtro por medio para comparar con lo que falta o sobra. */
function VentasDeLaCaja({ ventas, cambiados }: { ventas: VentaCierre[]; cambiados: Set<string> }) {
  const [medio, setMedio] = useState('');
  const medios = [...new Set(ventas.flatMap((v) => v.pagos.map((p) => p.medio)))].sort();
  const lista = medio ? ventas.filter((v) => v.pagos.some((p) => p.medio === medio)) : ventas;
  const total = lista.filter((v) => !v.anulado).reduce((a, v) => a + v.pagos.filter((p) => !medio || p.medio === medio).reduce((b, p) => b + p.monto, 0), 0);
  return (
    <details className="dc-card" data-testid="ventas-caja">
      <summary><b>Ventas de esta caja ({ventas.length})</b> <Insignia variante="neutro">Informativo</Insignia></summary>
      <label className="dc-peq" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0' }}>
        Medio
        <select aria-label="Filtrar ventas por medio" value={medio} onChange={(e) => setMedio(e.target.value)} style={{ minHeight: 36 }}>
          <option value="">Todos</option>
          {medios.map((m) => <option key={m} value={m}>{rotuloMedioCierre(m)}</option>)}
        </select>
        <span>Total vigente: <b>{soles(total)}</b></span>
      </label>
      <ul className="dc-items" style={{ maxHeight: 360, overflowY: 'auto' }}>
        {lista.map((v, i) => (
          <li key={`${v.codigo}-${i}`} data-testid="venta-caja" style={v.anulado ? { opacity: 0.7 } : undefined}>
            <b>{v.codigo}</b> · {v.hora} · {v.pagos.map((p) => `${rotuloMedioCierre(p.medio)} ${soles(p.monto)}`).join(' + ') || 'sin medio'}
            {cambiados.has(v.codigo) && <> <Insignia variante="aviso">Cambió de medio</Insignia></>}
            <div className="dc-peq">
              Cobró <b>{v.cobradoPor ?? 'sin dato'}</b>
              {v.anulado && <> · <span className="dc-mal">cobro anulado a las {v.anulado.hora} por {v.anulado.por ?? 'sin dato'}{v.anulado.motivo ? ` (${v.anulado.motivo})` : ''}</span></>}
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}
