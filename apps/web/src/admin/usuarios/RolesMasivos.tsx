import { useEffect, useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { Boton } from '../../comun/Boton';
import { ErrorApi } from '../../comun/api';
import { ETIQUETAS_ROLES, ROLES_ASIGNABLES, ROLES_EXCLUSIVOS, VISTA_PREVIA_ROL } from './roles';
import { aplicarRolesMasivo, type ResultadoRolesMasivo } from './rolesMasivoApi';

const etiquetaCorta = (rol: string) => (ETIQUETAS_ROLES[rol] || rol).split(' (')[0];
/** Roles que se pueden dar como extra: ADMIN y REPARTIDOR no se combinan con otros. */
const ROLES_EXTRA = ROLES_ASIGNABLES.filter((r) => !ROLES_EXCLUSIVOS.includes(r));

export interface BarraSeleccionProps {
  cantidad: number;
  alAnadir: () => void;
  alQuitar: () => void;
  alCancelar: () => void;
}

/** Barra fija al pie con lo que se puede hacer con los usuarios seleccionados. */
export function BarraSeleccion({ cantidad, alAnadir, alQuitar, alCancelar }: BarraSeleccionProps) {
  const texto = cantidad === 1 ? '1 usuario' : `${cantidad} usuarios`;
  return (
    <div
      role="region"
      aria-label="Acciones sobre la selección"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        background: 'var(--cp-navy)',
        color: 'var(--cp-cream)',
        padding: '16px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 -6px 20px rgba(0,0,0,0.25)',
      }}
    >
      <strong style={{ fontSize: '16px' }}>{texto} seleccionados</strong>
      <Boton onClick={alAnadir} tamano="grande">
        {`Añadir rol a ${texto}`}
      </Boton>
      <Boton onClick={alQuitar} variante="secundario" tamano="grande">
        Quitar rol
      </Boton>
      <Boton onClick={alCancelar} variante="texto" tamano="grande" style={{ color: 'var(--cp-cream)' }}>
        Cancelar selección
      </Boton>
    </div>
  );
}

export interface ModalRolesMasivosProps {
  abierto: boolean;
  accion: 'agregar' | 'quitar';
  /** Rol ya elegido (atajo «Dar acceso a Delivery»): no se puede cambiar. */
  rolFijo?: string;
  /** Cuántos usuarios entran (exacto). */
  cantidad: number;
  /** 'todos' = todas las cuentas activas; si no, los ids marcados. */
  usuarioIds: string[] | 'todos';
  alCerrar: () => void;
  /** Se llama con el resultado cuando el servidor ya aplicó el cambio. */
  alTerminar: (r: ResultadoRolesMasivo) => void;
}

export function ModalRolesMasivos({ abierto, accion, rolFijo, cantidad, usuarioIds, alCerrar, alTerminar }: ModalRolesMasivosProps) {
  const [rol, setRol] = useState(rolFijo ?? ROLES_EXTRA[0]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<ResultadoRolesMasivo | null>(null);

  useEffect(() => {
    if (abierto) {
      setRol(rolFijo ?? ROLES_EXTRA[0]);
      setError('');
      setResultado(null);
    }
  }, [abierto, rolFijo]);

  if (!abierto) return null;

  const texto = cantidad === 1 ? '1 usuario' : `${cantidad} usuarios`;
  const ejecutar = async () => {
    setCargando(true);
    setError('');
    try {
      const r = await aplicarRolesMasivo({ usuarioIds, rol, accion, ...(usuarioIds === 'todos' ? { soloActivos: true } : {}) });
      setResultado(r);
      alTerminar(r);
    } catch (e) {
      setError(e instanceof ErrorApi || e instanceof Error ? e.message : 'No se pudo aplicar el cambio');
    } finally {
      setCargando(false);
    }
  };

  if (resultado) {
    const hecho = accion === 'agregar' ? resultado.agregados : resultado.quitados;
    return (
      <Confirmar
        abierto
        titulo="Listo"
        textoSi="Cerrar"
        textoNo="Volver a la lista"
        alConfirmar={alCerrar}
        alCancelar={alCerrar}
      >
        <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px', fontSize: '15px' }}>
          <div>
            <strong>{hecho}</strong> {accion === 'agregar' ? 'recibieron' : 'perdieron'} el rol {etiquetaCorta(resultado.rol)}.
          </div>
          <div>
            <strong>{resultado.yaTenian}</strong> {accion === 'agregar' ? 'ya lo tenían' : 'no lo tenían como rol extra'}.
          </div>
          <div>
            <strong>{resultado.omitidos.length}</strong> omitidos.
          </div>
          {resultado.omitidos.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: '20px', maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {resultado.omitidos.map((o) => (
                <li key={o.usuarioId}>
                  <strong>{o.usuario}</strong>: {o.motivo}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Confirmar>
    );
  }

  const preview = VISTA_PREVIA_ROL[rol];
  return (
    <Confirmar
      abierto
      titulo={accion === 'agregar' ? 'Añadir rol' : 'Quitar rol'}
      mensaje={
        accion === 'agregar'
          ? `¿Añadir el rol ${etiquetaCorta(rol)} a ${texto}? Conservan el rol que ya tienen. Quien no pueda recibirlo (administradores, cuentas desactivadas) se omite y te diré por qué.`
          : `¿Quitar el rol extra ${etiquetaCorta(rol)} a ${texto}? Nunca se les quita su rol principal.`
      }
      textoSi={accion === 'agregar' ? `Sí, añadir a ${texto}` : `Sí, quitar a ${texto}`}
      textoNo="No"
      peligro={accion === 'quitar'}
      cargando={cargando}
      alConfirmar={ejecutar}
      alCancelar={alCerrar}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
        {!rolFijo && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 700, fontSize: '14px' }}>
            Rol
            <select
              aria-label="Rol"
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              style={{ minHeight: '48px', borderRadius: '10px', border: '1.5px solid var(--cp-line)', padding: '0 12px', fontSize: '15px' }}
            >
              {ROLES_EXTRA.map((r) => (
                <option key={r} value={r}>
                  {etiquetaCorta(r)}
                </option>
              ))}
            </select>
          </label>
        )}
        {accion === 'agregar' && preview && (
          <div style={{ background: 'var(--cp-sand)', borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ fontWeight: 800, marginBottom: '8px' }}>Con este rol podrán:</div>
            <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px' }}>
              {preview.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {error && (
          <div role="alert" style={{ color: 'var(--cp-rust)', fontWeight: 700 }}>
            {error}
          </div>
        )}
      </div>
    </Confirmar>
  );
}
