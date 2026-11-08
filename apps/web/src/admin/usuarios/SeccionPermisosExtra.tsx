import { useEffect, useMemo, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';
import { ETIQUETAS_ROLES } from './roles';
import {
  eleccionesDe,
  guardarPermisosExtra,
  obtenerPermisos,
  permisosAEnviar,
  resumenCambios,
  type AccionPermiso,
  type Elecciones,
  type ModuloPermisos,
  type RespuestaPermisos,
} from './permisosExtra';

export interface SeccionPermisosExtraProps {
  usuarioId: string;
  /** Solo el ADMIN otorga o quita permisos. */
  puedeEditar: boolean;
}

const nombreRol = (r: string) => (ETIQUETAS_ROLES[r] ?? r).split(' (')[0];
const cajaStyle = { display: 'flex', alignItems: 'center', gap: '8px', minHeight: '44px', fontSize: '14px', color: 'var(--cp-navy)' } as const;

/** Casillas del módulo: «Ver», «Crear/editar» y «Otras acciones». */
function gruposDe(m: ModuloPermisos) {
  return {
    ver: m.acciones.filter((a) => a.accion === 'ver'),
    escribir: m.acciones.filter((a) => a.accion === 'crear' || a.accion === 'editar'),
    otras: m.acciones.filter((a) => !['ver', 'crear', 'editar'].includes(a.accion)),
  };
}

export function SeccionPermisosExtra({ usuarioId, puedeEditar }: SeccionPermisosExtraProps) {
  const [datos, setDatos] = useState<RespuestaPermisos | null>(null);
  const [error, setError] = useState('');
  const [elecciones, setElecciones] = useState<Elecciones>({});
  const [busqueda, setBusqueda] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [menu, setMenu] = useState<Array<{ nombre: string; permisoMinimo?: string }>>([]);

  const cargar = () =>
    obtenerPermisos(usuarioId)
      .then((r) => {
        if (!r || !Array.isArray(r.modulos)) throw new Error('sin datos');
        setDatos(r);
        setElecciones(eleccionesDe(r));
        setError('');
      })
      .catch(() => setError('No se pudieron leer los permisos de la persona.'));

  useEffect(() => {
    setDatos(null);
    setMensaje('');
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId]);

  // El menú real del admin (carga diferida: evita arrastrar todas las pantallas al abrir el editor)
  useEffect(() => {
    let vivo = true;
    import('../modulos')
      .then((m) => vivo && setMenu(m.MODULOS.map((x) => ({ nombre: x.nombre, permisoMinimo: x.permisoMinimo }))))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  const sel = useMemo(() => new Set(Object.values(elecciones).flatMap((m) => m.claves)), [elecciones]);
  const cambios = useMemo(() => (datos ? resumenCambios(datos, elecciones) : []), [datos, elecciones]);

  if (error) return <div role="alert" style={{ color: 'var(--cp-rust)', fontSize: '13px', fontWeight: 700 }}>{error}</div>;
  if (!datos) return <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>Cargando permisos…</div>;

  const rolesTexto = datos.roles.map(nombreRol).join(' y ');
  const bloqueadoTotal = !!datos.bloqueado;
  const editable = puedeEditar && !bloqueadoTotal && !guardando;

  const claveEditable = (a: AccionPermiso) => !a.porRol && !a.sensible;

  const alternar = (m: ModuloPermisos, claves: string[], marcar: boolean) =>
    setElecciones((prev) => {
      const act = prev[m.modulo] ?? { claves: [], hasta: '', nota: '' };
      const resto = act.claves.filter((c) => !claves.includes(c));
      const nuevas = marcar ? [...resto, ...claves] : resto;
      const copia = { ...prev };
      if (nuevas.length === 0) delete copia[m.modulo];
      else copia[m.modulo] = { ...act, claves: nuevas };
      return copia;
    });

  const soloLectura = (m: ModuloPermisos) =>
    setElecciones((prev) => {
      const ver = m.acciones.filter((a) => a.accion === 'ver' && claveEditable(a)).map((a) => a.clave);
      const copia = { ...prev };
      if (ver.length === 0) delete copia[m.modulo];
      else copia[m.modulo] = { claves: ver, hasta: prev[m.modulo]?.hasta ?? '', nota: prev[m.modulo]?.nota ?? '' };
      return copia;
    });

  // Resultado = lo que ya da su rol + lo que se está eligiendo como extra
  const resultado = new Set([...datos.modulos.flatMap((m) => m.acciones.filter((a) => a.porRol).map((a) => a.clave)), ...sel]);
  const abrira = menu.filter((x) => !x.permisoMinimo || resultado.has(x.permisoMinimo)).map((x) => x.nombre);

  const filtro = busqueda.trim().toLowerCase();
  const modulos = datos.modulos.filter((m) => !filtro || m.nombre.toLowerCase().includes(filtro));

  const casilla = (m: ModuloPermisos, titulo: string, lista: AccionPermiso[]) => {
    const manejables = lista.filter(claveEditable);
    const cubiertas = lista.filter((a) => a.porRol);
    const sensibles = lista.filter((a) => a.sensible && !a.porRol);
    if (lista.length === 0) return null;
    const todoPorRol = manejables.length === 0 && sensibles.length === 0 && cubiertas.length > 0;
    const marcada = todoPorRol || (manejables.length > 0 && manejables.every((a) => sel.has(a.clave)));
    const soloSensible = manejables.length === 0 && !todoPorRol;
    return (
      <label key={titulo} style={cajaStyle}>
        <input
          type="checkbox"
          checked={marcada}
          disabled={!editable || todoPorRol || soloSensible}
          onChange={(e) => alternar(m, manejables.map((a) => a.clave), e.target.checked)}
        />
        <span>
          {titulo}
          {todoPorRol && <small style={{ color: 'var(--cp-soft)' }}> · Incluido por su rol {rolesTexto}</small>}
          {soloSensible && <small style={{ color: 'var(--cp-soft)' }}> · Solo con rol Administrador</small>}
        </span>
      </label>
    );
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await guardarPermisosExtra(usuarioId, permisosAEnviar(elecciones));
      setMensaje('Permisos guardados. Se aplican la próxima vez que la persona entre o recargue.');
      setConfirmar(false);
      await cargar();
    } catch (e: any) {
      setConfirmar(false);
      setError(e?.mensaje || 'No se pudieron guardar los permisos.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section
      aria-label="Permisos por módulo (extra)"
      onKeyDown={(e) => {
        // Enter en el buscador o la nota no debe guardar el formulario de roles
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault();
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--cp-line)', paddingTop: '12px' }}>
      <strong style={{ color: 'var(--cp-navy)' }}>Permisos por módulo (extra)</strong>
      <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
        Para dar acceso a UN módulo sin dar un rol completo. Se suman a lo que ya le da su rol ({rolesTexto}); nunca le quitan nada.
        Se aplica la próxima vez que la persona entre o recargue.
      </div>
      {bloqueadoTotal && (
        <div role="note" style={{ fontSize: '13px', color: 'var(--cp-navy)', fontWeight: 700 }}>{datos.bloqueado}</div>
      )}
      {!puedeEditar && !bloqueadoTotal && (
        <div role="note" style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>Solo un administrador puede dar o quitar permisos.</div>
      )}
      <input
        type="search"
        aria-label="Buscar módulo"
        placeholder="Buscar módulo…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{ minHeight: '44px', padding: '0 12px', borderRadius: '10px', border: '1px solid var(--cp-line)' }}
      />
      {modulos.map((m) => {
        const g = gruposDe(m);
        const extra = elecciones[m.modulo];
        const nRol = m.acciones.filter((a) => a.porRol).length;
        return (
          <details key={m.modulo} open={!!extra || !!filtro} style={{ border: '1px solid var(--cp-line)', borderRadius: '10px', padding: '0 12px' }}>
            <summary style={{ minHeight: '44px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, color: 'var(--cp-navy)' }}>
              {m.nombre}
              {nRol > 0 && <Insignia variante="neutro">Por su rol</Insignia>}
              {extra && <Insignia variante="aviso">Extra · {extra.claves.length}</Insignia>}
            </summary>
            <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: '8px' }}>
              {casilla(m, 'Ver', g.ver)}
              {casilla(m, 'Crear/editar', g.escribir)}
              {g.otras.length > 0 && (
                <details>
                  <summary style={{ minHeight: '44px', display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '13px', color: 'var(--cp-soft)' }}>
                    Otras acciones ({g.otras.length})
                  </summary>
                  {g.otras.map((a) => (
                    <label key={a.clave} style={cajaStyle}>
                      <input
                        type="checkbox"
                        checked={a.porRol || sel.has(a.clave)}
                        disabled={!editable || !claveEditable(a)}
                        onChange={(e) => alternar(m, [a.clave], e.target.checked)}
                      />
                      <span>
                        {a.nombre}
                        {a.porRol && <small style={{ color: 'var(--cp-soft)' }}> · Incluido por su rol {rolesTexto}</small>}
                        {a.sensible && !a.porRol && <small style={{ color: 'var(--cp-soft)' }}> · Solo con rol Administrador</small>}
                      </span>
                    </label>
                  ))}
                </details>
              )}
              {editable && (
                <div>
                  <Boton variante="secundario" type="button" tamano="pequeno" onClick={() => soloLectura(m)}>
                    Solo lectura
                  </Boton>
                </div>
              )}
              {extra && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--cp-navy)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    Hasta (opcional)
                    <input
                      type="date"
                      value={extra.hasta}
                      disabled={!editable}
                      onChange={(e) => setElecciones((p) => ({ ...p, [m.modulo]: { ...p[m.modulo], hasta: e.target.value } }))}
                      style={{ minHeight: '44px' }}
                    />
                  </label>
                  <label style={{ fontSize: '13px', color: 'var(--cp-navy)', display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: '180px' }}>
                    Nota (opcional)
                    <input
                      type="text"
                      maxLength={200}
                      value={extra.nota}
                      disabled={!editable}
                      onChange={(e) => setElecciones((p) => ({ ...p, [m.modulo]: { ...p[m.modulo], nota: e.target.value } }))}
                      style={{ minHeight: '44px' }}
                    />
                  </label>
                </div>
              )}
            </div>
          </details>
        );
      })}
      <div role="status" aria-label="Resultado final" style={{ fontSize: '13px', color: 'var(--cp-navy)' }}>
        <strong>Resultado final: lo que podrá abrir</strong>
        <div>{abrira.length > 0 ? abrira.join(', ') : 'Cargando el menú…'}</div>
      </div>
      {mensaje && <div role="status" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)' }}>{mensaje}</div>}
      {editable && (
        <div>
          <Boton type="button" deshabilitado={cambios.length === 0} onClick={() => setConfirmar(true)}>
            Guardar permisos extra
          </Boton>
        </div>
      )}
      <Confirmar
        abierto={confirmar}
        titulo="¿Guardar los permisos extra?"
        textoSi="Sí, guardar"
        textoNo="No"
        cargando={guardando}
        alConfirmar={guardar}
        alCancelar={() => setConfirmar(false)}
      >
        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px' }}>
          {cambios.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <p style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>Se aplica la próxima vez que la persona entre o recargue.</p>
      </Confirmar>
    </section>
  );
}
