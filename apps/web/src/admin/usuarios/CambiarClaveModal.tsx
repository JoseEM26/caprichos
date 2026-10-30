import { useState } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Campo } from '../../comun/Campo';
import { Confirmar } from '../../comun/Confirmar';
import { Icono } from '../../comun/Icono';
import type { UsuarioItem } from './tipos';
import { AUTOCOMPLETAR_CLAVE, validarClaveNueva } from './claves';

export interface CambiarClaveModalProps {
  usuario: UsuarioItem;
  abierto: boolean;
  alCerrar: () => void;
  /** Lo llama cuando el servidor pide volver a ingresar (se cambió la clave propia). */
  alReingresar: () => Promise<void>;
}

/** Cambia la contraseña de otra persona sin pedir la anterior. Exige la contraseña del administrador. */
export function CambiarClaveModal({ usuario, abierto, alCerrar, alReingresar }: CambiarClaveModalProps) {
  const [claveNueva, setClaveNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [claveAdmin, setClaveAdmin] = useState('');
  const [error, setError] = useState('');
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState('');

  if (!abierto) return null;

  const pedirGuardar = () => {
    setError('');
    setExito('');
    const errorClave = validarClaveNueva(claveNueva);
    if (errorClave) return setError(errorClave);
    if (claveNueva !== confirmacion) return setError('Las dos contraseñas no son iguales.');
    if (!claveAdmin) return setError('Escribe tu contraseña de administrador.');
    setConfirmarAbierto(true);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const resp = await api.post<{ reingresar: boolean; mensaje: string }>(`/admin/usuarios/${usuario.id}/clave`, {
        claveNueva,
        claveAdmin,
      });
      setConfirmarAbierto(false);
      if (resp.reingresar) {
        await alReingresar();
        return;
      }
      setClaveNueva('');
      setConfirmacion('');
      setClaveAdmin('');
      setExito(`Contraseña cambiada. ${usuario.nombres} deberá cambiarla al ingresar.`);
    } catch (err) {
      setConfirmarAbierto(false);
      setError(err instanceof ErrorApi ? err.message || 'No se pudo cambiar la contraseña.' : 'Error de conexión al servidor.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-cambiar-clave-titulo"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 95,
          background: 'rgba(11, 44, 62, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
        onClick={guardando ? undefined : alCerrar}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '460px',
            background: 'var(--cp-white)',
            border: '1.5px solid var(--cp-line)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 id="modal-cambiar-clave-titulo" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '18px', color: 'var(--cp-navy)', margin: 0 }}>
              Cambiar contraseña de {usuario.nombres}
            </h2>
            <button
              type="button"
              onClick={alCerrar}
              disabled={guardando}
              aria-label="Cerrar cambio de contraseña"
              style={{ width: '44px', height: '44px', borderRadius: '22px', border: '1.5px solid var(--cp-line)', background: 'transparent', color: 'var(--cp-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: guardando ? 'not-allowed' : 'pointer' }}
            >
              <Icono nombre="cerrar" tamano={18} />
            </button>
          </div>

          <p style={{ margin: 0, fontSize: '13px', color: 'var(--cp-soft)' }}>
            No hace falta la contraseña anterior. Al guardar se cierran sus sesiones y deberá cambiarla al ingresar.
          </p>

          {error && (
            <div role="alert" style={{ background: '#FBEDE9', border: '1.5px solid var(--cp-rust)', borderRadius: '12px', padding: '10px 12px', fontSize: '13px', color: 'var(--cp-rust)', fontWeight: 600 }}>
              {error}
            </div>
          )}
          {exito && (
            <div role="status" style={{ color: 'var(--cp-green)', fontWeight: 700, fontSize: '13px' }}>
              {exito}
            </div>
          )}

          <Campo
            id="clave-nueva-usuario"
            etiqueta="Contraseña nueva"
            type="password"
            permiteAlternarClave
            autoComplete={AUTOCOMPLETAR_CLAVE.nueva}
            value={claveNueva}
            onChange={(e) => setClaveNueva(e.target.value)}
            ayuda="Mínimo 8 caracteres, con letras y números."
            disabled={guardando}
          />
          <Campo
            id="clave-confirmacion-usuario"
            etiqueta="Confirmar contraseña nueva"
            type="password"
            permiteAlternarClave
            autoComplete={AUTOCOMPLETAR_CLAVE.nueva}
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            disabled={guardando}
          />
          <Campo
            id="clave-admin-usuario"
            etiqueta="Tu contraseña de administrador"
            type="password"
            permiteAlternarClave
            autoComplete={AUTOCOMPLETAR_CLAVE.actual}
            value={claveAdmin}
            onChange={(e) => setClaveAdmin(e.target.value)}
            ayuda="Para confirmar que eres tú quien hace el cambio."
            disabled={guardando}
          />

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Boton type="button" variante="primario" tamano="grande" style={{ flex: 1 }} disabled={guardando} onClick={pedirGuardar}>
              Guardar contraseña
            </Boton>
            <Boton type="button" variante="secundario" tamano="grande" onClick={alCerrar} disabled={guardando}>
              Cerrar
            </Boton>
          </div>
        </div>
      </div>

      <Confirmar
        abierto={confirmarAbierto}
        titulo="¿Cambiar la contraseña?"
        mensaje={`Se cambiará la contraseña de ${usuario.nombres} ${usuario.apellidos} y se cerrarán sus sesiones activas.`}
        textoSi="Sí, cambiar"
        textoNo="No, revisar"
        cargando={guardando}
        alConfirmar={guardar}
        alCancelar={() => setConfirmarAbierto(false)}
      />
    </>
  );
}
