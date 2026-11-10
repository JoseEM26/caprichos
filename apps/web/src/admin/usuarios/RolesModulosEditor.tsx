import { useEffect, useMemo, useState } from 'react';
import { api } from '../../comun/api';
import { Confirmar } from '../../comun/Confirmar';
import { GRUPOS_MODULOS, MODULOS } from '../modulos';
import { ETIQUETAS_ROLES } from './roles';

interface EstadoModulo {
  ve: boolean;
  base: boolean;
  ajustado: boolean;
}
interface RolModulos {
  rol: string;
  nombre: string;
  editable: boolean;
  ajustes: number;
  modulos: Record<string, EstadoModulo>;
}
interface Respuesta {
  catalogo: Array<{ clave: string; minimo: string; bloqueado: boolean }>;
  roles: RolModulos[];
}

const nombreRol = (r: string) => (ETIQUETAS_ROLES[r] ?? r).split(' (')[0];

/**
 * Qué ve cada rol, editable (solo ADMIN). Las casillas se guardan en el servidor como ajustes sobre la base del sistema
 * y sobreviven a los despliegues. Los módulos que comparten permiso mínimo (p. ej. Caja y Cierre) se mueven juntos.
 */
export function RolesModulosEditor() {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [borrador, setBorrador] = useState<Record<string, Set<string>>>({});
  const [confirmando, setConfirmando] = useState<'guardar' | string | null>(null); // 'guardar' o el rol a restablecer
  const [trabajando, setTrabajando] = useState(false);
  const [errorConfirmar, setErrorConfirmar] = useState<string | null>(null);

  const cargar = () =>
    api
      .get<Respuesta>('/admin/usuarios/roles-modulos')
      .then((r) => {
        setDatos(r);
        setBorrador(Object.fromEntries(r.roles.map((x) => [x.rol, new Set(Object.entries(x.modulos).filter(([, e]) => e.ve).map(([c]) => c))])));
        setError('');
      })
      .catch(() => setError('No se pudo cargar lo que ve cada rol.'));

  useEffect(() => {
    void cargar();
  }, []);

  const minimoDe = useMemo(() => new Map((datos?.catalogo ?? []).map((c) => [c.clave, c])), [datos]);
  const columnas = useMemo(
    () => GRUPOS_MODULOS.map((g) => ({ grupo: g, modulos: MODULOS.filter((m) => m.grupo === g && minimoDe.has(m.clave)) })).filter((g) => g.modulos.length),
    [minimoDe],
  );
  const nombreModulo = (clave: string) => MODULOS.find((m) => m.clave === clave)?.nombre ?? clave;

  const cambiosDe = (r: RolModulos) => {
    const b = borrador[r.rol] ?? new Set<string>();
    const actuales = Object.entries(r.modulos).filter(([, e]) => e.ve).map(([c]) => c);
    return { agregan: [...b].filter((c) => !actuales.includes(c)), quitan: actuales.filter((c) => !b.has(c)) };
  };
  const roles = datos?.roles ?? [];
  const sucios = roles.filter((r) => r.editable && (cambiosDe(r).agregan.length || cambiosDe(r).quitan.length));

  const alternar = (rol: string, clave: string) => {
    const cat = minimoDe.get(clave);
    if (!cat) return;
    setBorrador((prev) => {
      const s = new Set(prev[rol]);
      const poner = !s.has(clave);
      for (const c of datos!.catalogo.filter((x) => x.minimo === cat.minimo && !x.bloqueado)) poner ? s.add(c.clave) : s.delete(c.clave);
      return { ...prev, [rol]: s };
    });
    setAviso('');
  };

  const guardar = async () => {
    setTrabajando(true);
    setErrorConfirmar(null);
    try {
      for (const r of sucios) await api.put(`/admin/usuarios/roles-modulos/${r.rol}`, { modulos: [...borrador[r.rol]] });
      setConfirmando(null);
      setAviso('Cambios guardados. Cada persona los verá la próxima vez que inicie sesión o recargue.');
      await cargar();
    } catch (e: any) {
      setErrorConfirmar(e?.mensaje ?? 'No se pudieron guardar los cambios. Revisa e inténtalo de nuevo.');
    } finally {
      setTrabajando(false);
    }
  };

  const restablecer = async (rol: string) => {
    setTrabajando(true);
    setErrorConfirmar(null);
    try {
      await api.post(`/admin/usuarios/roles-modulos/${rol}/restablecer`);
      setConfirmando(null);
      setAviso(`${nombreRol(rol)} volvió a lo que trae el sistema.`);
      await cargar();
    } catch (e: any) {
      setErrorConfirmar(e?.mensaje ?? 'No se pudo restablecer el rol.');
    } finally {
      setTrabajando(false);
    }
  };

  if (error) return <div role="alert" style={{ color: 'var(--cp-danger, #b00020)' }}>{error}</div>;
  if (!datos) return <div>Cargando…</div>;

  const cab = { position: 'sticky', top: 0, background: 'var(--cp-cream)', zIndex: 2, fontSize: 12, padding: '6px 8px', borderBottom: '1px solid var(--cp-line)' } as const;
  const boton = { minHeight: 44, padding: '0 16px', borderRadius: 12, fontWeight: 800, cursor: 'pointer' } as const;

  return (
    <section aria-label="Qué ve cada rol" style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 18 }}>Qué ve cada rol</div>
        <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
          Marca los módulos de cada rol y guarda: el cambio queda en el servidor y no se pierde al actualizar el sistema. El administrador siempre ve todo.
          Los módulos que comparten permiso (p. ej. Caja y Cierre) se marcan juntos. Marcar asistencia y Notificaciones son obligatorios. ★ = distinto de lo que trae el sistema.
        </div>
      </div>

      <div style={{ overflow: 'auto', maxHeight: '65vh' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
          <thead>
            <tr>
              <th scope="col" style={{ ...cab, left: 0, zIndex: 3, textAlign: 'left', minWidth: 170 }}>Módulo</th>
              {roles.map((r) => (
                <th key={r.rol} scope="col" style={{ ...cab, minWidth: 96 }}>
                  <div>{nombreRol(r.rol)}</div>
                  {r.ajustes > 0 && (
                    <button type="button" onClick={() => { setErrorConfirmar(null); setConfirmando(r.rol); }} style={{ minHeight: 32, fontSize: 11, border: '1px solid var(--cp-navy)', borderRadius: 8, background: 'transparent', cursor: 'pointer' }}>
                      Restablecer rol
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {columnas.map((g) => (
              <FilasGrupo key={g.grupo} grupo={g.grupo} modulos={g.modulos.map((m) => m.clave)} roles={roles} borrador={borrador} minimoDe={minimoDe} nombreModulo={nombreModulo} alternar={alternar} />
            ))}
          </tbody>
        </table>
      </div>

      {aviso && <div role="status" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-green)' }}>{aviso}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          disabled={sucios.length === 0}
          onClick={() => { setErrorConfirmar(null); setConfirmando('guardar'); }}
          style={{ ...boton, border: 0, background: 'var(--cp-orange)', color: 'var(--cp-navy)', opacity: sucios.length ? 1 : 0.5 }}
        >
          Guardar cambios
        </button>
        <button
          type="button"
          disabled={sucios.length === 0}
          onClick={() => { setBorrador(Object.fromEntries(roles.map((x) => [x.rol, new Set(Object.entries(x.modulos).filter(([, e]) => e.ve).map(([c]) => c))]))); setAviso(''); }}
          style={{ ...boton, border: '1.5px solid var(--cp-navy)', background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700 }}
        >
          Descartar
        </button>
        {sucios.length > 0 && <span style={{ fontSize: 13 }}>{sucios.length === 1 ? '1 rol con cambios sin guardar' : `${sucios.length} roles con cambios sin guardar`}</span>}
      </div>

      <Confirmar
        abierto={confirmando === 'guardar'}
        titulo="Guardar lo que ve cada rol"
        mensaje="¿Guardar estos cambios? Se aplican a todas las personas con estos roles."
        textoSi="Sí, guardar"
        textoNo="No"
        cargando={trabajando}
        error={errorConfirmar}
        alConfirmar={guardar}
        alCancelar={() => setConfirmando(null)}
      >
        <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 14 }}>
          {sucios.map((r) => {
            const c = cambiosDe(r);
            return (
              <li key={r.rol}>
                <b>{nombreRol(r.rol)}</b>
                {c.agregan.length > 0 && <> · ve ahora: {c.agregan.map(nombreModulo).join(', ')}</>}
                {c.quitan.length > 0 && <> · deja de ver: {c.quitan.map(nombreModulo).join(', ')}</>}
              </li>
            );
          })}
        </ul>
      </Confirmar>

      <Confirmar
        abierto={!!confirmando && confirmando !== 'guardar'}
        titulo="Restablecer rol"
        mensaje={`¿Volver ${confirmando && confirmando !== 'guardar' ? nombreRol(confirmando) : ''} a lo que trae el sistema? Se pierden los cambios guardados de este rol.`}
        textoSi="Sí, restablecer"
        textoNo="No"
        peligro
        cargando={trabajando}
        error={errorConfirmar}
        alConfirmar={() => restablecer(confirmando as string)}
        alCancelar={() => setConfirmando(null)}
      />
    </section>
  );
}

function FilasGrupo(p: {
  grupo: string;
  modulos: string[];
  roles: RolModulos[];
  borrador: Record<string, Set<string>>;
  minimoDe: Map<string, { clave: string; minimo: string; bloqueado: boolean }>;
  nombreModulo: (c: string) => string;
  alternar: (rol: string, clave: string) => void;
}) {
  return (
    <>
      <tr>
        <th colSpan={p.roles.length + 1} scope="colgroup" style={{ textAlign: 'left', padding: '8px 8px 4px', fontSize: 12, textTransform: 'uppercase', color: 'var(--cp-soft)' }}>
          {p.grupo}
        </th>
      </tr>
      {p.modulos.map((clave) => (
        <tr key={clave}>
          <th scope="row" style={{ position: 'sticky', left: 0, background: 'var(--cp-white)', textAlign: 'left', fontWeight: 600, padding: '4px 8px', borderBottom: '1px solid var(--cp-line)' }}>
            {p.nombreModulo(clave)}
          </th>
          {p.roles.map((r) => {
            const e = r.modulos[clave];
            const marcado = r.rol === 'ADMIN' ? true : p.borrador[r.rol]?.has(clave) ?? false;
            const bloqueado = !r.editable || p.minimoDe.get(clave)?.bloqueado;
            const distinto = r.editable && marcado !== e.base;
            return (
              <td key={r.rol} style={{ textAlign: 'center', borderBottom: '1px solid var(--cp-line)', background: distinto ? 'var(--cp-gold-soft, #fff3c4)' : undefined }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44, gap: 2, cursor: bloqueado ? 'not-allowed' : 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={marcado}
                    disabled={!!bloqueado}
                    onChange={() => p.alternar(r.rol, clave)}
                    aria-label={`${nombreRol(r.rol)}: ${p.nombreModulo(clave)}`}
                  />
                  {distinto && <span aria-label="modificado respecto al sistema" title="Distinto de lo que trae el sistema">★</span>}
                </label>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
