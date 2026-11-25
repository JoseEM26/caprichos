import { useEffect, useState } from 'react';
import { api } from '../../comun/api';

/** Solo para ver: la propina de cada día del mes, cuánto le tocó a cada persona y si ya se pagó en planilla. */
interface PersonaDia {
  partyId: number;
  nombre: string;
  horas: number;
  porcentaje: number;
  monto: number;
  pagadoPlanilla: number;
  periodo: { desde: string; hasta: string } | null;
  pagadoReparto: boolean;
}

interface VistaDias {
  anio: number;
  mes: number;
  sinRepartir: number;
  dias: Array<{ fecha: string; total: number; sinRepartir: boolean; personas: PersonaDia[] }>;
}

const soles = (n: number) => `S/ ${n.toFixed(2)}`;
const corta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

/** Estado de pago de una parte: pagado en planilla (con su período), por el reparto mensual antiguo, o pendiente. */
export function estadoPago(p: PersonaDia): string {
  if (p.pagadoReparto) return 'Pagado (reparto mensual)';
  if (p.periodo && p.pagadoPlanilla !== 0) return `Pagado en planilla ${corta(p.periodo.desde)} al ${corta(p.periodo.hasta)}`;
  return 'Pendiente de planilla';
}

export function PropinasPorDia({ anio, mes }: { anio: number; mes: number }) {
  const [vista, setVista] = useState<VistaDias | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vigente = true;
    setVista(null);
    setError(false);
    (async () => {
      try {
        const v = await api.get<VistaDias>(`/admin/propinas/dias/${anio}/${mes}`);
        if (vigente) setVista(v ?? null);
      } catch {
        if (vigente) setError(true);
      }
    })();
    return () => { vigente = false; };
  }, [anio, mes]);

  if (error) return <p role="alert" style={{ fontSize: 13 }}>No pudimos cargar las propinas por día.</p>;
  if (!vista || !Array.isArray(vista.dias)) return null;

  return (
    <section aria-label="Propinas por día" style={{ display: 'grid', gap: 8, fontSize: 13 }}>
      <div style={{ fontWeight: 700 }}>Propinas por día (solo para ver)</div>
      <p style={{ margin: 0, color: 'var(--cp-soft)' }}>El pago se hace en la planilla de cada persona, no aquí.</p>
      {vista.sinRepartir !== 0 && (
        <div role="status" data-testid="sin-repartir">
          Sin repartir: {soles(vista.sinRepartir)} (días con propina y nadie con horas trabajadas).
        </div>
      )}
      {vista.dias.length === 0 && <div style={{ color: 'var(--cp-soft)' }}>No hubo propinas en este mes.</div>}
      {vista.dias.map((d) => (
        <details key={d.fecha} open={d.sinRepartir}>
          <summary>
            <strong>{corta(d.fecha)}</strong> · propina del local {soles(d.total)}{d.sinRepartir ? ' · sin repartir' : ''}
          </summary>
          {d.personas.length > 0 && (
            <table aria-label={`Reparto del ${corta(d.fecha)}`} style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'right' }}>
                  <th style={{ textAlign: 'left' }}>Persona</th>
                  <th>Horas</th>
                  <th>%</th>
                  <th>Le tocó</th>
                  <th style={{ textAlign: 'left' }}>Pago</th>
                </tr>
              </thead>
              <tbody>
                {d.personas.map((p) => (
                  <tr key={p.partyId} style={{ textAlign: 'right' }}>
                    <td style={{ textAlign: 'left' }}>{p.nombre}</td>
                    <td>{p.horas.toFixed(2)}</td>
                    <td>{p.porcentaje.toFixed(2)}</td>
                    <td>{p.monto.toFixed(2)}</td>
                    <td style={{ textAlign: 'left' }}>{estadoPago(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </details>
      ))}
    </section>
  );
}
