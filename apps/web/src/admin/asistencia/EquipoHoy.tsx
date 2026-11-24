import { useEffect, useState } from 'react';
import { equipoHoy, type EquipoHoy as EquipoHoyDatos } from './turnosApi';

/**
 * Quién trabaja y quién descansa el día que la persona quiere cambiar (solo dentro del pedido de cambio de turno).
 * Solo lectura: nombres, áreas y horarios.
 */
export function EquipoHoy({ fecha }: { fecha: string }) {
  const [datos, setDatos] = useState<EquipoHoyDatos | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setDatos(null);
    setError(null);
    equipoHoy(fecha)
      .then((r) => {
        if (!r || !Array.isArray(r.trabajan) || !Array.isArray(r.descansan)) throw new Error('Respuesta inesperada');
        if (vigente) setDatos(r);
      })
      .catch((e) => vigente && setError((e as any)?.mensaje ?? 'No pudimos cargar quién trabaja ese día.'));
    return () => { vigente = false; };
  }, [fecha]);

  const sinTurnos = datos !== null && datos.trabajan.length === 0 && datos.descansan.length === 0;
  return (
    <details className="ma-card" aria-label="Equipo de ese día" data-testid="equipo-hoy" open>
      <summary><b>Quién trabaja el {fecha}</b></summary>
      {error && <p className="tu-vacio">{error}</p>}
      {!datos && !error && <p className="tu-vacio">Cargando…</p>}
      {sinTurnos && <p className="tu-vacio">Ese día no hay turnos cargados.</p>}

      {datos && datos.trabajan.length > 0 && (
        <div aria-label="Trabajan ese día">
          <h4 className="as-sub">Trabajan</h4>
          <ul className="ma-lista">
            {datos.trabajan.map((p) => (
              <li key={p.partyId}>
                <b>
                  {p.cubreA.length > 0 ? `${p.nombre} cubre a ${p.cubreA.join(' y ')}, ` : `${p.nombre}, `}
                  {p.desde}–{p.hasta}
                </b>
                <small>
                  {p.area}
                  {p.cubiertoParcialmentePor.length > 0 ? ` · parte cubierta por ${p.cubiertoParcialmentePor.join(' y ')}` : ''}
                </small>
              </li>
            ))}
          </ul>
        </div>
      )}

      {datos && (datos.cambios ?? []).length > 0 && (
        <div aria-label="Cambios de turno de ese día">
          <h4 className="as-sub">Cambios de turno</h4>
          <ul className="ma-lista">
            {datos.cambios.map((c) => <li key={c.texto}>{c.texto}</li>)}
          </ul>
        </div>
      )}

      {datos && datos.descansan.length > 0 && (
        <div aria-label="Descansan ese día">
          <h4 className="as-sub">Descansan</h4>
          <ul className="ma-lista">
            {datos.descansan.map((p) => (
              <li key={p.partyId}>
                <b>{p.nombre}</b>
                <small>{p.motivo}{p.area ? ` · ${p.area}` : ''}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </details>
  );
}
