import { useEffect, useState } from 'react';
import { FiltroCombo } from '../../comun/FiltroCombo';
import { ListaRutas } from './ListaRutas';
import { repartosApi, type RespuestaRutas, type RutaHistorial } from './repartosApi';

/** Fecha YYYY-MM-DD en Lima, `dias` días atrás. */
export function fechaLima(dias = 0, ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date(ahora.getTime() - dias * 86_400_000));
}

export type PeriodoRutas = 'hoy' | 'ayer' | 'semana';
export const OPCIONES_PERIODO = [
  { valor: 'hoy', etiqueta: 'Hoy' },
  { valor: 'ayer', etiqueta: 'Ayer' },
  { valor: 'semana', etiqueta: 'Últimos 7 días' },
];

/** Rango de fechas del combo Hoy / Ayer / Últimos 7 días. */
export function rangoPeriodo(p: PeriodoRutas): { desde: string; hasta: string } {
  if (p === 'ayer') return { desde: fechaLima(1), hasta: fechaLima(1) };
  if (p === 'semana') return { desde: fechaLima(6), hasta: fechaLima(0) };
  return { desde: fechaLima(0), hasta: fechaLima(0) };
}

/** «Mis rutas» del repartidor: rutas del periodo como tarjetas; tocar una la dibuja en el mapa. */
export function MisRutas({ alDibujar }: { alDibujar: (r: RutaHistorial) => void }) {
  const [periodo, setPeriodo] = useState<PeriodoRutas>('hoy');
  const [datos, setDatos] = useState<RespuestaRutas | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    let vivo = true;
    repartosApi
      .listarMisRutas({ ...rangoPeriodo(periodo), pagina })
      .then((r) => vivo && (setDatos(r), setError(null)))
      .catch((e) => vivo && setError(e?.message || 'No se pudieron cargar tus rutas'));
    return () => {
      vivo = false;
    };
  }, [periodo, pagina]);

  return (
    <div data-testid="contenido-mis-rutas" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <FiltroCombo
        etiqueta="Periodo"
        valor={periodo}
        opciones={OPCIONES_PERIODO}
        alCambiar={(v) => {
          setPeriodo(v as PeriodoRutas);
          setPagina(1);
        }}
      />
      {error ? (
        <div role="alert" style={{ color: 'var(--cp-rust)', fontWeight: 700 }}>{error}</div>
      ) : !datos ? (
        <div role="status" style={{ color: 'var(--cp-soft)', fontWeight: 700 }}>Cargando rutas...</div>
      ) : (
        <>
          <ListaRutas rutas={datos.rutas} alDibujar={alDibujar} />
          {datos.totalPaginas > 1 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
              <button type="button" disabled={pagina <= 1} onClick={() => setPagina((n) => n - 1)} style={{ minHeight: 44, minWidth: 44 }}>Anterior</button>
              <span>{pagina} / {datos.totalPaginas}</span>
              <button type="button" disabled={pagina >= datos.totalPaginas} onClick={() => setPagina((n) => n + 1)} style={{ minHeight: 44, minWidth: 44 }}>Siguiente</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
