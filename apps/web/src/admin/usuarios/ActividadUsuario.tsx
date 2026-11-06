import { useEffect, useState } from 'react';
import { ErrorApi } from '../../comun/api';
import { Cargando } from '../../comun/Cargando';
import { Paginacion } from '../../comun/Paginacion';
import { listarActividad, type EventoActividad, type RespuestaActividad } from './rolesTemporalesApi';

export interface ActividadUsuarioProps {
  usuarioId: string;
  deshabilitado?: boolean;
}

const COLOR_TIPO: Record<string, string> = {
  roles: 'var(--cp-orange)',
  datos: 'var(--cp-navy)',
  horario: 'var(--cp-soft)',
  estado: 'var(--cp-rust)',
  clave: 'var(--cp-rust)',
  areas: 'var(--cp-soft)',
  asistencia: 'var(--cp-soft)',
  acciones: 'var(--cp-navy)',
};

/** Línea de tiempo de lo que pasó con esta persona (y lo que ella hizo). Solo la ve el ADMIN. */
export function ActividadUsuario({ usuarioId, deshabilitado = false }: ActividadUsuarioProps) {
  const [tipo, setTipo] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<RespuestaActividad | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    listarActividad(usuarioId, { tipo, desde, hasta, pagina })
      .then((r) => vigente && setDatos(r))
      .catch((err) => vigente && setError(err instanceof ErrorApi ? err.message : 'No se pudo cargar la actividad.'))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [usuarioId, tipo, desde, hasta, pagina]);

  const cambiarFiltro = (fn: () => void) => {
    fn();
    setPagina(1);
  };

  return (
    <section aria-label="Actividad de la persona" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <strong style={{ color: 'var(--cp-navy)' }}>Actividad</strong>
      <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
        Todo lo que se cambió de esta persona y lo que ella hizo, del más reciente al más antiguo. Las contraseñas no se muestran.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px', fontWeight: 700, color: 'var(--cp-navy)' }}>
          Tipo
          <select
            value={tipo}
            disabled={deshabilitado}
            onChange={(e) => cambiarFiltro(() => setTipo(e.target.value))}
            style={{ minHeight: '40px', borderRadius: '10px', padding: '0 8px' }}
          >
            <option value="">Todo</option>
            {(datos?.tipos ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px', fontWeight: 700, color: 'var(--cp-navy)' }}>
          Desde
          <input
            type="date"
            value={desde}
            onChange={(e) => cambiarFiltro(() => setDesde(e.target.value))}
            style={{ minHeight: '40px', borderRadius: '10px', padding: '0 8px' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px', fontWeight: 700, color: 'var(--cp-navy)' }}>
          Hasta
          <input
            type="date"
            value={hasta}
            onChange={(e) => cambiarFiltro(() => setHasta(e.target.value))}
            style={{ minHeight: '40px', borderRadius: '10px', padding: '0 8px' }}
          />
        </label>
      </div>

      {cargando && <Cargando />}
      {error && (
        <div role="alert" style={{ color: 'var(--cp-rust)', fontSize: '13px', fontWeight: 700 }}>
          {error}
        </div>
      )}
      {!cargando && datos && datos.datos.length === 0 && (
        <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>Sin movimientos con esos filtros.</div>
      )}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {(datos?.datos ?? []).map((e: EventoActividad) => (
          <li
            key={e.id}
            style={{ borderLeft: `3px solid ${COLOR_TIPO[e.tipo] ?? 'var(--cp-line)'}`, paddingLeft: '10px', fontSize: '13px', color: 'var(--cp-navy)' }}
          >
            <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>{e.enTexto}</div>
            <div>{e.texto}</div>
            {e.motivo && <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>Motivo: {e.motivo}</div>}
          </li>
        ))}
      </ol>
      {datos && datos.paginas > 1 && (
        <Paginacion
          paginaActual={pagina}
          totalPaginas={datos.paginas}
          totalRegistros={datos.total}
          tamanoPagina={datos.limite}
          alCambiarPagina={setPagina}
        />
      )}
    </section>
  );
}
