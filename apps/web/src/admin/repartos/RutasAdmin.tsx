import { useEffect, useMemo, useState } from 'react';
import { BarraFiltros, FiltroCombo } from '../../comun/FiltroCombo';
import { ListaRutas } from './ListaRutas';
import { OPCIONES_PERIODO, rangoPeriodo, type PeriodoRutas } from './MisRutas';
import { repartosApi, type RespuestaRutas } from './repartosApi';

/** Sección «Rutas» del admin de Repartos: rutas por repartidor y día, solo lectura. */
export function RutasAdmin() {
  const [periodo, setPeriodo] = useState<PeriodoRutas>('hoy');
  const [repartidor, setRepartidor] = useState('todos');
  const [datos, setDatos] = useState<RespuestaRutas | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setDatos(null);
    repartosApi
      .listarRutas(rangoPeriodo(periodo))
      .then((r) => vivo && (setDatos(r), setError(null)))
      .catch((e) => vivo && setError(e?.message || 'No se pudieron cargar las rutas'));
    return () => {
      vivo = false;
    };
  }, [periodo]);

  // Los repartidores del combo salen de las rutas del periodo
  const repartidores = useMemo(() => {
    const m = new Map<string, string>();
    datos?.rutas.forEach((r) => m.set(r.repartidorId, r.repartidorNombre));
    return [...m].map(([valor, etiqueta]) => ({ valor, etiqueta }));
  }, [datos]);
  const visibles = (datos?.rutas ?? []).filter((r) => repartidor === 'todos' || r.repartidorId === repartidor);

  return (
    <div data-testid="rutas-admin" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 4px' }}>
      <BarraFiltros>
        <FiltroCombo etiqueta="Día" valor={periodo} opciones={OPCIONES_PERIODO} alCambiar={(v) => setPeriodo(v as PeriodoRutas)} />
        <FiltroCombo
          etiqueta="Repartidor"
          valor={repartidor}
          valorPorDefecto="todos"
          opciones={[{ valor: 'todos', etiqueta: 'Todos' }, ...repartidores]}
          alCambiar={setRepartidor}
        />
      </BarraFiltros>
      {error ? (
        <div role="alert" style={{ color: 'var(--cp-rust)', fontWeight: 700 }}>{error}</div>
      ) : !datos ? (
        <div role="status" style={{ color: 'var(--cp-soft)', fontWeight: 700 }}>Cargando rutas...</div>
      ) : (
        <ListaRutas rutas={visibles} conRepartidor />
      )}
    </div>
  );
}
