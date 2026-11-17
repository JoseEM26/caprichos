import { useCallback, useEffect, useState } from 'react';
import { equipoHoy, type EquipoHoy as EquipoHoyDatos } from './turnosApi';

/** Se refresca al abrir y cada pocos minutos; no es tiempo real. */
const REFRESCO_MS = 3 * 60_000;

/** Tarjeta «Equipo de hoy» en Mi asistencia: quién trabaja hoy, cambios y quién descansa. Solo lectura. */
export function EquipoHoy() {
  const [datos, setDatos] = useState<EquipoHoyDatos | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await equipoHoy();
      if (!r || !Array.isArray(r.trabajan) || !Array.isArray(r.descansan)) throw new Error('Respuesta inesperada');
      setDatos(r);
      setError(null);
    } catch (e) {
      setError((e as any)?.mensaje ?? 'No pudimos cargar el equipo de hoy.');
    }
  }, []);

  useEffect(() => {
    void cargar();
    const id = window.setInterval(() => void cargar(), REFRESCO_MS);
    return () => window.clearInterval(id);
  }, [cargar]);

  const sinTurnos = datos !== null && datos.trabajan.length === 0 && datos.descansan.length === 0;
  return (
    <section className="ma-card" aria-label="Equipo de hoy" data-testid="equipo-hoy">
      <h3>Equipo de hoy</h3>
      {error && <p className="tu-vacio">{error}</p>}
      {!datos && !error && <p className="tu-vacio">Cargando el equipo de hoy…</p>}
      {sinTurnos && <p className="tu-vacio">Hoy no hay turnos cargados.</p>}

      {datos && datos.trabajan.length > 0 && (
        <div aria-label="Trabajan hoy">
          <h4 className="as-sub">Trabajan hoy</h4>
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
        <div aria-label="Cambios de turno de hoy">
          <h4 className="as-sub">Cambios de turno de hoy</h4>
          <ul className="ma-lista">
            {datos.cambios.map((c) => <li key={c.texto}>{c.texto}</li>)}
          </ul>
        </div>
      )}

      {datos && datos.descansan.length > 0 && (
        <div aria-label="Hoy descansan">
          <h4 className="as-sub">Hoy descansan</h4>
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
    </section>
  );
}
