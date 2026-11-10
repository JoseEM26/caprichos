import { useEffect, useMemo, useState } from 'react';
import { api } from '../../comun/api';
import { coincide } from '../asistencia/buscar';
import { GRUPOS_MODULOS, MODULOS } from '../modulos';
import { ETIQUETAS_ROLES } from './roles';
import { fechaLimaCorta } from './rolesTemporalesApi';
import { celdaModulo, contarModulo, type AccesoUsuario } from './accesosModulos';

const nombreRol = (r: string) => (ETIQUETAS_ROLES[r] ?? r).split(' (')[0];

/** Cuadro de solo lectura: qué módulos ve cada persona (roles + roles y permisos extra vigentes). Solo ADMIN. */
export function CuadroAccesos() {
  const [usuarios, setUsuarios] = useState<AccesoUsuario[]>([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [inactivos, setInactivos] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [rol, setRol] = useState('');
  const [modulo, setModulo] = useState('');
  const [soloExcepciones, setSoloExcepciones] = useState(false);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    api
      .get<{ usuarios: AccesoUsuario[] }>(`/admin/usuarios/accesos-modulos${inactivos ? '?inactivos=true' : ''}`)
      .then((r) => vivo && (setUsuarios(r.usuarios), setError('')))
      .catch(() => vivo && setError('No se pudo cargar el cuadro de accesos.'))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [inactivos]);

  const rolesPresentes = useMemo(() => [...new Set(usuarios.flatMap((u) => u.roles.map((r) => r.rol)))].sort(), [usuarios]);
  // Al marcar/desmarcar «Incluir inactivos» el rol elegido puede dejar de existir: se limpia para que el select no diga «Todos» con el filtro activo
  useEffect(() => {
    if (!cargando && rol && !rolesPresentes.includes(rol)) setRol('');
  }, [cargando, rol, rolesPresentes]);
  const columnas = useMemo(
    () => GRUPOS_MODULOS.map((g) => ({ grupo: g, modulos: MODULOS.filter((m) => m.grupo === g && (!modulo || m.clave === modulo)) })).filter((g) => g.modulos.length),
    [modulo],
  );
  const mods = columnas.flatMap((c) => c.modulos);

  const filas = useMemo(() => {
    return usuarios.filter((u) => {
      if (!coincide(u.nombre, busqueda)) return false;
      if (rol && !u.roles.some((r) => r.rol === rol)) return false;
      if (modulo) {
        const m = MODULOS.find((x) => x.clave === modulo);
        if (m && celdaModulo(u, m) === 'no') return false;
      }
      if (soloExcepciones && !MODULOS.some((m) => celdaModulo(u, m) === 'extra')) return false;
      return true;
    });
  }, [usuarios, busqueda, rol, modulo, soloExcepciones]);

  const campo = { minHeight: 40, borderRadius: 10, border: '1px solid var(--cp-line)', padding: '0 10px', background: 'var(--cp-white)' } as const;
  const cab = { position: 'sticky', top: 0, background: 'var(--cp-cream)', zIndex: 2, fontSize: 12, padding: '6px 8px', borderBottom: '1px solid var(--cp-line)' } as const;

  const csv = () => {
    const celdas = (u: AccesoUsuario) => mods.map((m) => (celdaModulo(u, m) === 'no' ? 'No' : 'Sí'));
    const filasCsv = [['Usuario', 'Roles', ...mods.map((m) => m.nombre)], ...filas.map((u) => [u.nombre, u.roles.map((r) => r.rol).join(' + '), ...celdas(u)])];
    const texto = filasCsv.map((f) => f.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' }));
    a.download = 'accesos-por-modulo.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section aria-label="Qué módulos ve cada usuario" style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 18 }}>Accesos por usuario</div>
        <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
          Solo lectura. Muestra los módulos que cada persona ve en el menú, sumando todos sus roles y sus permisos extra vigentes. Para cambiarlos usa «Editar» del usuario.
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <input aria-label="Buscar usuario" placeholder="Buscar usuario" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={campo} />
        <select aria-label="Filtrar por rol" value={rol} onChange={(e) => setRol(e.target.value)} style={campo}>
          <option value="">Todos los roles</option>
          {rolesPresentes.map((r) => (
            <option key={r} value={r}>{nombreRol(r)}</option>
          ))}
        </select>
        <select aria-label="Filtrar por módulo" value={modulo} onChange={(e) => setModulo(e.target.value)} style={campo}>
          <option value="">Todos los módulos</option>
          {MODULOS.map((m) => (
            <option key={m.clave} value={m.clave}>{m.nombre}</option>
          ))}
        </select>
        <label style={{ fontSize: 13 }}>
          <input type="checkbox" checked={soloExcepciones} onChange={(e) => setSoloExcepciones(e.target.checked)} /> Solo diferencias con su rol
        </label>
        <label style={{ fontSize: 13 }}>
          <input type="checkbox" checked={inactivos} onChange={(e) => setInactivos(e.target.checked)} /> Incluir inactivos
        </label>
        <button type="button" onClick={csv} style={{ ...campo, cursor: 'pointer', fontWeight: 700 }}>Exportar CSV</button>
      </div>

      <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
        <b>✔ Sí</b> lo ve por su rol · <b>✔★ Extra</b> lo ve solo por un permiso extra propio (excepción) · <b>— No</b> no lo ve. «Todos»: administrador, control total.
      </div>

      {error && <div role="alert" style={{ color: 'var(--cp-danger, #b00020)' }}>{error}</div>}
      {cargando ? (
        <div>Cargando…</div>
      ) : (
        <div style={{ overflow: 'auto', maxHeight: '70vh' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ ...cab, left: 0, zIndex: 3, textAlign: 'left', minWidth: 190 }}>Usuario y roles</th>
                {columnas.map((c) => (
                  <th key={c.grupo} colSpan={c.modulos.length} style={{ ...cab, borderLeft: '1px solid var(--cp-line)' }}>{c.grupo}</th>
                ))}
              </tr>
              <tr>
                {mods.map((m) => (
                  <th key={m.clave} scope="col" style={{ ...cab, top: 30, minWidth: 74, fontWeight: 600 }}>
                    {m.nombre}
                    <div style={{ fontWeight: 400, color: 'var(--cp-soft)' }}>{contarModulo(usuarios, m)} de {usuarios.length}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((u) => (
                <tr key={u.id}>
                  <th scope="row" style={{ position: 'sticky', left: 0, background: 'var(--cp-white)', textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--cp-line)', opacity: u.activo ? 1 : 0.6 }}>
                    <div style={{ fontWeight: 700 }}>{u.nombre}{!u.activo && ' (inactivo)'}</div>
                    <div style={{ fontWeight: 400, fontSize: 11 }}>
                      {u.roles.map((r, i) => (
                        <span key={r.rol}>
                          {i > 0 && ' + '}
                          {nombreRol(r.rol)}
                          {r.vence_en && <em>{` (vence ${fechaLimaCorta(r.vence_en)})`}</em>}
                        </span>
                      ))}
                      {u.todos && ' · Todos'}
                    </div>
                  </th>
                  {mods.map((m) => {
                    const c = celdaModulo(u, m);
                    return (
                      <td
                        key={m.clave}
                        style={{ textAlign: 'center', borderBottom: '1px solid var(--cp-line)', background: c === 'extra' ? 'var(--cp-gold-soft, #fff3c4)' : undefined }}
                      >
                        <span aria-label={c === 'no' ? 'No' : c === 'extra' ? 'Sí, por permiso extra' : 'Sí'}>{c === 'no' ? '' : c === 'extra' ? '✔★' : '✔'}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filas.length === 0 && (
                <tr><td colSpan={mods.length + 1} style={{ padding: 12 }}>Ningún usuario coincide con los filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
