import { useEffect, useMemo, useState } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { coincideTexto } from '../../comun/normalizarBusqueda';

interface Aviso {
  tipo: string;
  nombre: string;
  detalle: string;
  roles: string[];
}
interface Tabla {
  roles: string[];
  avisos: Aviso[];
}

const NOMBRE_ROL: Record<string, string> = {
  ADMIN: 'Admin',
  CAJERO: 'Caja',
  SUPERVISOR: 'Supervisión',
  COCINA: 'Cocina',
  MOZO: 'Mozo',
  ALMACEN: 'Almacén',
  REPARTIDOR: 'Repartidor',
  APOYO_DELIVERY: 'Apoyo delivery',
  MARKETING: 'Marketing',
};

/**
 * Configuración › Avisos por rol (solo ADMIN): una fila por tipo de aviso y una columna por rol. Lo marcado decide
 * qué rol ve ese aviso en su campanita (lista, contador y aviso en vivo; el servidor aplica el filtro).
 * Una persona con varios roles ve la unión. Los avisos dirigidos a una persona no pasan por aquí.
 */
export function TarjetaAvisosPorRol() {
  const [tabla, setTabla] = useState<Tabla | null>(null);
  const [marcas, setMarcas] = useState<Record<string, string[]>>({});
  const [original, setOriginal] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const tomar = (t: Tabla) => {
    const m = Object.fromEntries(t.avisos.map((a) => [a.tipo, a.roles]));
    setTabla(t);
    setMarcas(m);
    setOriginal(JSON.stringify(m));
  };

  useEffect(() => {
    let vivo = true;
    api
      .get<Tabla>('/admin/notificaciones/avisos-por-rol')
      .then((t) => vivo && tomar(t))
      .catch((e) => vivo && setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar la tabla de avisos'));
    return () => {
      vivo = false;
    };
  }, []);

  const filas = useMemo(
    () => (tabla?.avisos ?? []).filter((a) => coincideTexto(busqueda, a.nombre, a.detalle)),
    [tabla, busqueda],
  );
  const hayCambios = JSON.stringify(marcas) !== original;

  const alternar = (tipo: string, rol: string) =>
    setMarcas((m) => ({ ...m, [tipo]: m[tipo].includes(rol) ? m[tipo].filter((r) => r !== rol) : [...m[tipo], rol] }));

  /** Marca todo (de lo que se ve con el buscador) o, si ya estaba todo marcado, lo quita. */
  const columna = (rol: string) => {
    const todo = filas.every((a) => marcas[a.tipo].includes(rol));
    setMarcas((m) => {
      const n = { ...m };
      for (const a of filas) n[a.tipo] = todo ? n[a.tipo].filter((r) => r !== rol) : n[a.tipo].includes(rol) ? n[a.tipo] : [...n[a.tipo], rol];
      return n;
    });
  };

  const guardar = async () => {
    if (!tabla) return;
    setGuardando(true);
    setError(null);
    try {
      const ordenados = Object.fromEntries(
        Object.entries(marcas).map(([t, rs]) => [t, tabla.roles.filter((r) => rs.includes(r))]),
      );
      await api.put('/admin/notificaciones/avisos-por-rol', { matriz: ordenados });
      setOriginal(JSON.stringify(marcas));
      setExito('Avisos por rol guardados. Se aplican de inmediato en todas las campanitas.');
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudieron guardar los avisos por rol');
    } finally {
      setConfirmar(false);
      setGuardando(false);
    }
  };

  return (
    <section
      data-testid="tarjeta-avisos-por-rol"
      aria-labelledby="avisos-rol-titulo"
      style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '18px 16px', background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 16, marginBottom: 8, minWidth: 0 }}
    >
      <div>
        <div id="avisos-rol-titulo" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--cp-navy)' }}>
          Avisos por rol
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--cp-soft)', marginTop: 2, maxWidth: 620 }}>
          Marca qué rol ve cada aviso en su campanita. Quien tiene varios roles ve la suma. Los avisos dirigidos a una persona (por ejemplo, su cambio de turno) le llegan a ella siempre.
        </div>
      </div>

      <input
        type="search"
        aria-label="Buscar aviso"
        placeholder="Buscar aviso…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{ minHeight: 44, padding: '0 12px', border: '1px solid var(--cp-line)', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', color: 'var(--cp-navy)', background: 'var(--cp-white)' }}
      />

      {!tabla && !error && <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>Cargando avisos…</div>}

      {tabla && (
        <div style={{ overflowX: 'auto', border: '1px solid var(--cp-line)', borderRadius: 12 }} tabIndex={0} aria-label="Tabla de avisos por rol">
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', fontSize: 13, color: 'var(--cp-navy)' }}>
            <thead>
              <tr>
                <th scope="col" style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--cp-white)', textAlign: 'left', padding: '8px 10px', minWidth: 170, borderBottom: '1px solid var(--cp-line)' }}>
                  Aviso
                </th>
                {tabla.roles.map((rol) => {
                  const todo = filas.length > 0 && filas.every((a) => marcas[a.tipo].includes(rol));
                  return (
                    <th key={rol} scope="col" style={{ padding: '8px 4px', minWidth: 78, textAlign: 'center', borderBottom: '1px solid var(--cp-line)' }}>
                      <div style={{ fontWeight: 800 }}>{NOMBRE_ROL[rol] ?? rol}</div>
                      <button
                        type="button"
                        onClick={() => columna(rol)}
                        aria-label={`${todo ? 'Quitar todo' : 'Marcar todo'} en ${NOMBRE_ROL[rol] ?? rol}`}
                        style={{ minHeight: 44, minWidth: 44, border: 0, background: 'transparent', color: 'var(--cp-navy)', textDecoration: 'underline', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        {todo ? 'Ninguno' : 'Todo'}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filas.map((a) => (
                <tr key={a.tipo}>
                  <th scope="row" style={{ position: 'sticky', left: 0, background: 'var(--cp-white)', textAlign: 'left', padding: '8px 10px', fontWeight: 400, borderBottom: '1px solid var(--cp-line)' }}>
                    <div style={{ fontWeight: 700 }}>{a.nombre}</div>
                    <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>{a.detalle}</div>
                  </th>
                  {tabla.roles.map((rol) => (
                    <td key={rol} style={{ textAlign: 'center', borderBottom: '1px solid var(--cp-line)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          style={{ width: 20, height: 20 }}
                          checked={marcas[a.tipo].includes(rol)}
                          onChange={() => alternar(a.tipo, rol)}
                          aria-label={`${a.nombre}: ${NOMBRE_ROL[rol] ?? rol}`}
                        />
                      </label>
                    </td>
                  ))}
                </tr>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={tabla.roles.length + 1} style={{ padding: 14, color: 'var(--cp-soft)' }}>
                    Ningún aviso coincide con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <div role="alert" style={{ fontSize: 13, color: 'var(--cp-red, #b3261e)' }}>
          {error}
        </div>
      )}
      {exito && !hayCambios && (
        <div role="status" style={{ fontSize: 13, color: 'var(--cp-navy)' }}>
          {exito}
        </div>
      )}

      {tabla && (
        <div>
          <Boton variante="primario" disabled={!hayCambios} onClick={() => { setExito(null); setConfirmar(true); }}>
            Guardar avisos por rol
          </Boton>
        </div>
      )}

      <Confirmar
        abierto={confirmar}
        titulo="Guardar los avisos por rol"
        mensaje="Cambia qué avisos ve cada rol en su campanita, desde ahora y para todo el equipo. ¿Guardar?"
        textoSi="Sí, guardar"
        textoNo="No, cancelar"
        cargando={guardando}
        alConfirmar={guardar}
        alCancelar={() => setConfirmar(false)}
      />
    </section>
  );
}
