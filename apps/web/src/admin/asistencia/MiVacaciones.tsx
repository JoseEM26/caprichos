import { useEffect, useState } from 'react';
import { MiVacaciones as MiVacacionesApi, miVacaciones } from './vinculoApi';

const ETIQUETA: Record<string, string> = { TOMADAS: 'Tomadas', PAGADAS: 'Pagadas en dinero', AJUSTE: 'Ajuste' };

/** Mi saldo de vacaciones (solo lectura, sin dinero). No se muestra si la persona no está en planilla. */
export function MiVacaciones() {
  const [v, setV] = useState<MiVacacionesApi | null>(null);
  useEffect(() => {
    let vivo = true;
    miVacaciones().then((r) => vivo && setV(r)).catch(() => undefined);
    return () => { vivo = false; };
  }, []);
  if (!v || !v.aplica) return null;
  const movs = v.movimientos.filter((m) => !m.anulado).slice(0, 5);
  return (
    <section aria-labelledby="mi-vacaciones-titulo" className="ma-lista">
      <h3 id="mi-vacaciones-titulo" className="as-sub">Mis vacaciones</h3>
      <div className="ma-card">
      <div>Saldo: <strong>{v.saldo} día(s)</strong></div>
      <div>Ganados: <strong>{v.ganados}</strong> · Tomadas: <strong>{v.tomadas}</strong> · Pagadas: <strong>{v.pagadas}</strong>{v.ajustes !== 0 && <> · Ajustes: <strong>{v.ajustes}</strong></>}</div>
      <small className="as-nota">Ganas {v.regimen / 12} días por mes cumplido ({v.regimen} al año), desde tu ingreso el {v.ingreso}.</small>
      {movs.length > 0 && (
        <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
          {movs.map((m) => <li key={m.id}>{ETIQUETA[m.tipo]}: {m.desde === m.hasta ? m.desde : `${m.desde} a ${m.hasta}`} ({m.dias} día(s))</li>)}
        </ul>
      )}
      </div>
    </section>
  );
}
