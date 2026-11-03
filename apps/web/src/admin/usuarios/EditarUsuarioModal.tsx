import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Campo } from '../../comun/Campo';
import { Combo } from '../../comun/Combo';
import { Confirmar } from '../../comun/Confirmar';
import { Icono } from '../../comun/Icono';
import { useSesion } from '../../comun/sesion';
import type { UsuarioItem } from './tipos';
import { SelectorOtrosRoles } from './SelectorOtrosRoles';
import { HistorialLaboral } from './HistorialLaboral';
import {
  ETIQUETAS_ROLES,
  ROLES_ASIGNABLES,
  TIPOS_DOCUMENTO,
  documentoValido,
  errorCombinacionRoles,
  mensajeDocumento,
} from './roles';
import { EditorHorario } from './EditorHorario';
import { EditorReemplazos } from './EditorReemplazos';
import {
  horarioDesdeServidor,
  horarioVacio,
  horariosParaEnviar,
  reemplazosDesdeServidor,
  reemplazosParaEnviar,
  validarHorario,
  type HorarioEstado,
  type ReemplazosEstado,
} from './horario';
import { BloqueAlertasWhatsApp } from './BloqueAlertasWhatsApp';
import { puedeRecibirAlertasWhatsApp } from './alertasWhatsappApi';
import { AUTOCOMPLETAR_CLAVE, AVISO_REINGRESO, FORMATO_CORREO_ADMIN } from './claves';
import { CambiarClaveModal } from './CambiarClaveModal';
import { FotoUsuarioAdmin } from './FotoUsuarioAdmin';

export interface EditarUsuarioModalProps {
  usuario: UsuarioItem | null;
  abierto: boolean;
  alCerrar: () => void;
  alUsuarioEditado: (usuario: UsuarioItem) => void;
}

const OPCIONES_ROLES = ROLES_ASIGNABLES.map((rol) => ({
  valor: rol,
  etiqueta: ETIQUETAS_ROLES[rol] || rol,
}));

const iguales = (a: string[], b: string[]): boolean =>
  a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

export function EditarUsuarioModal({
  usuario,
  abierto,
  alCerrar,
  alUsuarioEditado,
}: EditarUsuarioModalProps) {
  const { usuario: yo, salir } = useSesion();
  const navigate = useNavigate();
  const esAdmin = yo?.rol === 'ADMIN';

  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [rol, setRol] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  // Solo ADMIN: documento nuevo (vacío = no cambia), correo y contraseña del administrador para el documento.
  const [dniNuevo, setDniNuevo] = useState('');
  const [tipoDocNuevo, setTipoDocNuevo] = useState('DNI');
  const [claveAdminDni, setClaveAdminDni] = useState('');
  const [otrosRoles, setOtrosRoles] = useState<string[]>([]);
  const [paisNacimiento, setPaisNacimiento] = useState('');
  const [correoNuevo, setCorreoNuevo] = useState('');
  const [quitarCorreo, setQuitarCorreo] = useState(false);
  const [avisosCorreo, setAvisosCorreo] = useState(false);
  const [horario247, setHorario247] = useState(false);
  const [cambiarClaveAbierto, setCambiarClaveAbierto] = useState(false);

  const [confirmarAbierto, setConfirmarAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [seccion, setSeccion] = useState<'datos' | 'horario' | 'reemplazos'>('datos');
  const [horario, setHorario] = useState<HorarioEstado>(horarioVacio);
  const [reemplazos, setReemplazos] = useState<ReemplazosEstado>({});
  const [confirmarHorario, setConfirmarHorario] = useState(false);
  const [msgHorario, setMsgHorario] = useState('');

  useEffect(() => {
    if (!usuario || !abierto) return;
    setSeccion('datos');
    setMsgHorario('');
    api
      .get<{ horarios: any[]; reemplazos: any[] }>(`/admin/usuarios/${usuario.id}/horario`)
      .then((d) => {
        setHorario(horarioDesdeServidor(d.horarios || []));
        setReemplazos(reemplazosDesdeServidor(d.reemplazos || []));
      })
      .catch(() => setErrorServidor('No se pudo cargar el horario de la persona.'));
  }, [usuario, abierto]);

  async function guardarHorario() {
    if (!usuario) return;
    setGuardando(true);
    try {
      await api.put(`/admin/usuarios/${usuario.id}/horario`, {
        horarios: horariosParaEnviar(horario),
        reemplazos: reemplazosParaEnviar(reemplazos),
      });
      setMsgHorario('Horario y reemplazos guardados.');
    } catch (err) {
      setErrorServidor(err instanceof ErrorApi ? err.message || 'No se pudo guardar el horario.' : 'Error de conexión al servidor.');
    } finally {
      setConfirmarHorario(false);
      setGuardando(false);
    }
  }

  function pedirGuardarHorario() {
    setErrorServidor(null);
    setMsgHorario('');
    const m = validarHorario(horario);
    if (m) return setErrorServidor(m);
    setConfirmarHorario(true);
  }

  useEffect(() => {
    if (usuario) {
      setNombres(usuario.nombres);
      setApellidos(usuario.apellidos);
      setRol(usuario.rol);
      setAvisosCorreo(Boolean(usuario.avisosCorreo));
      setHorario247(Boolean(usuario.horario24_7));
      setOtrosRoles((usuario.roles ?? []).filter((r) => r !== usuario.rol));
      setPaisNacimiento(usuario.paisNacimiento ?? '');
      setErrores({});
      setErrorServidor(null);
      setDniNuevo('');
      setTipoDocNuevo(usuario.tipoDocumento ?? 'DNI');
      setClaveAdminDni('');
      setCorreoNuevo('');
      setQuitarCorreo(false);
    }
  }, [usuario]);

  if (!abierto || !usuario) return null;

  function validar(): boolean {
    const nuevosErrores: Record<string, string> = {};

    if (!nombres.trim()) {
      nuevosErrores.nombres = 'Los nombres son requeridos';
    }

    if (!apellidos.trim()) {
      nuevosErrores.apellidos = 'Los apellidos son requeridos';
    }

    if (!rol) {
      nuevosErrores.rol = 'El rol es requerido';
    }
    const combinacion = errorCombinacionRoles(rol, otrosRoles);
    if (combinacion) nuevosErrores.otrosRoles = combinacion;

    if (esAdmin) {
      if (dniNuevo.trim() && !documentoValido(tipoDocNuevo, dniNuevo.trim())) {
        nuevosErrores.dni = mensajeDocumento(tipoDocNuevo);
      } else if (dniNuevo.trim() && !claveAdminDni) {
        nuevosErrores.claveAdmin = 'Escribe tu contraseña de administrador para cambiar el DNI';
      }
      if (!quitarCorreo && correoNuevo.trim() && !FORMATO_CORREO_ADMIN.test(correoNuevo.trim())) {
        nuevosErrores.correo = 'El correo no tiene un formato válido';
      }
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  function handleSolicitarGuardar(e: React.FormEvent) {
    e.preventDefault();
    setErrorServidor(null);
    if (!validar()) return;
    setConfirmarAbierto(true);
  }

  /** El servidor pide volver a entrar (se cambió el DNI o la clave propia): cierra la sesión y avisa. */
  async function volverAIngresar() {
    await salir();
    navigate('/admin/ingresar', { replace: true, state: { aviso: AVISO_REINGRESO } });
  }

  async function handleConfirmarGuardar() {
    if (!usuario) return;
    setGuardando(true);
    try {
      const cuerpo: Record<string, unknown> = {
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        rol,
      };
      if (esAdmin) {
        if (dniNuevo.trim()) {
          cuerpo.tipoDocumento = tipoDocNuevo;
          cuerpo.documento = dniNuevo.trim();
          cuerpo.claveAdmin = claveAdminDni;
        }
        if (quitarCorreo) cuerpo.correo = '';
        else if (correoNuevo.trim()) cuerpo.correo = correoNuevo.trim();
        if (!iguales(otrosRoles, (usuario.roles ?? []).filter((r) => r !== usuario.rol))) {
          cuerpo.otrosRoles = otrosRoles;
        }
        if (paisNacimiento.trim() !== (usuario.paisNacimiento ?? '')) cuerpo.paisNacimiento = paisNacimiento.trim();
        if (avisosCorreo !== Boolean(usuario.avisosCorreo)) cuerpo.avisosCorreo = avisosCorreo;
        if (horario247 !== Boolean(usuario.horario24_7)) cuerpo.horario24_7 = horario247;
      }

      const resp = await api.patch<UsuarioItem & { reingresar?: boolean }>(`/admin/usuarios/${usuario.id}`, cuerpo);

      setConfirmarAbierto(false);
      if (resp.reingresar) {
        await volverAIngresar();
        return;
      }
      alUsuarioEditado(resp);
    } catch (err) {
      setConfirmarAbierto(false);
      if (err instanceof ErrorApi) {
        if (err.codigo === 'ULTIMO_ADMIN') {
          setErrorServidor('No se puede quitar el rol al último administrador activo del sistema.');
        } else {
          setErrorServidor(err.message || 'Error al actualizar el usuario.');
        }
      } else {
        setErrorServidor('Error de conexión al servidor.');
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-editar-usuario-titulo"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 90,
          background: 'rgba(11, 44, 62, 0.65)',
          backdropFilter: 'blur(3px)',
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
            maxWidth: '520px',
            maxHeight: 'calc(100vh - 32px)',
            overflowY: 'auto',
            background: 'var(--cp-white)',
            border: '1.5px solid var(--cp-line)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 16px 40px rgba(11, 44, 62, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2
              id="modal-editar-usuario-titulo"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '20px',
                color: 'var(--cp-navy)',
                margin: 0,
              }}
            >
              Editar usuario
            </h2>
            <button
              type="button"
              onClick={alCerrar}
              disabled={guardando}
              aria-label="Cerrar modal"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '22px',
                border: '1.5px solid var(--cp-line)',
                background: 'transparent',
                color: 'var(--cp-navy)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: guardando ? 'not-allowed' : 'pointer',
              }}
            >
              <Icono nombre="cerrar" tamano={18} />
            </button>
          </div>

          {errorServidor && (
            <div
              role="alert"
              style={{
                background: '#FBEDE9',
                border: '1.5px solid var(--cp-rust)',
                borderRadius: '12px',
                padding: '12px',
                fontSize: '13px',
                color: 'var(--cp-rust)',
                fontWeight: 600,
              }}
            >
              {errorServidor}
            </div>
          )}

          <div role="tablist" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {([['datos', 'Datos'], ['horario', 'Horario'], ['reemplazos', 'Reemplazos']] as const).map(([k, t]) => (
              <Boton
                key={k}
                type="button"
                role="tab"
                aria-selected={seccion === k}
                variante={seccion === k ? 'oscuro' : 'secundario'}
                tamano="pequeno"
                onClick={() => setSeccion(k)}
              >
                {t}
              </Boton>
            ))}
          </div>

          {seccion !== 'datos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {seccion === 'horario' ? (
                <EditorHorario valor={horario} alCambiar={setHorario} deshabilitado={guardando} />
              ) : (
                <EditorReemplazos
                  valor={reemplazos}
                  alCambiar={setReemplazos}
                  horario={horario}
                  rol={rol || usuario.rol}
                  partyIdPropio={usuario.partyId}
                  deshabilitado={guardando}
                />
              )}
              {msgHorario && <div role="status" style={{ color: 'var(--cp-green)', fontWeight: 700, fontSize: '13px' }}>{msgHorario}</div>}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <Boton type="button" variante="primario" tamano="grande" style={{ flex: 1 }} disabled={guardando} onClick={pedirGuardarHorario}>
                  Guardar horario y reemplazos
                </Boton>
                <Boton type="button" variante="secundario" tamano="grande" onClick={alCerrar} disabled={guardando}>
                  Cerrar
                </Boton>
              </div>
            </div>
          )}

          <form hidden={seccion !== 'datos'} onSubmit={handleSolicitarGuardar} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Campo
              id="editar-dni"
              etiqueta={!usuario.tipoDocumento || usuario.tipoDocumento === 'DNI' ? 'DNI actual (Documento de identidad)' : 'Documento actual'}
              type="text"
              value={usuario.dni}
              disabled={true}
              ayuda={esAdmin ? undefined : 'El documento está asociado a la persona y no es editable.'}
            />

            {esAdmin && (
              <>
                <Combo
                  etiqueta="Tipo de documento"
                  opciones={TIPOS_DOCUMENTO}
                  valor={tipoDocNuevo}
                  alCambiar={(nuevo) => {
                    setTipoDocNuevo(nuevo);
                    setDniNuevo('');
                    if (errores.dni) setErrores((prev) => ({ ...prev, dni: '' }));
                  }}
                  deshabilitado={guardando}
                />
                <Campo
                  id="editar-dni-nuevo"
                  etiqueta={
                    tipoDocNuevo === 'DNI'
                      ? 'Nuevo DNI (deja vacío para no cambiarlo)'
                      : 'Nuevo número de documento (deja vacío para no cambiarlo)'
                  }
                  type="text"
                  inputMode={tipoDocNuevo === 'DNI' ? 'numeric' : 'text'}
                  maxLength={tipoDocNuevo === 'DNI' ? 8 : 12}
                  value={dniNuevo}
                  onChange={(e) => {
                    const limpio =
                      tipoDocNuevo === 'DNI'
                        ? e.target.value.replace(/\D/g, '')
                        : e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                    setDniNuevo(limpio);
                    if (errores.dni) setErrores((prev) => ({ ...prev, dni: '' }));
                  }}
                  error={errores.dni}
                  ayuda={
                    tipoDocNuevo === 'DNI'
                      ? 'Es el usuario con el que la persona entra. Debe tener 8 dígitos.'
                      : 'Es el usuario con el que la persona entra. De 7 a 12 letras o números.'
                  }
                  disabled={guardando}
                />
              </>
            )}

            {esAdmin && dniNuevo.trim() && (
              <Campo
                id="editar-clave-admin-dni"
                etiqueta="Tu contraseña de administrador"
                type="password"
                permiteAlternarClave
                autoComplete={AUTOCOMPLETAR_CLAVE.actual}
                value={claveAdminDni}
                onChange={(e) => {
                  setClaveAdminDni(e.target.value);
                  if (errores.claveAdmin) setErrores((prev) => ({ ...prev, claveAdmin: '' }));
                }}
                error={errores.claveAdmin}
                disabled={guardando}
              />
            )}

            <Campo
              id="editar-nombres"
              etiqueta="Nombres"
              type="text"
              value={nombres}
              onChange={(e) => {
                setNombres(e.target.value);
                if (errores.nombres) setErrores((prev) => ({ ...prev, nombres: '' }));
              }}
              error={errores.nombres}
              disabled={guardando}
            />

            <Campo
              id="editar-apellidos"
              etiqueta="Apellidos"
              type="text"
              value={apellidos}
              onChange={(e) => {
                setApellidos(e.target.value);
                if (errores.apellidos) setErrores((prev) => ({ ...prev, apellidos: '' }));
              }}
              error={errores.apellidos}
              disabled={guardando}
            />

            {esAdmin && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Campo
                  id="editar-correo"
                  etiqueta="Correo (deja vacío para no cambiarlo)"
                  type="email"
                  autoComplete="off"
                  value={correoNuevo}
                  onChange={(e) => {
                    setCorreoNuevo(e.target.value);
                    setQuitarCorreo(false);
                    if (errores.correo) setErrores((prev) => ({ ...prev, correo: '' }));
                  }}
                  error={errores.correo}
                  disabled={guardando || quitarCorreo}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '44px', fontSize: '14px', color: 'var(--cp-navy)' }}>
                  <input
                    type="checkbox"
                    checked={quitarCorreo}
                    onChange={(e) => {
                      setQuitarCorreo(e.target.checked);
                      if (e.target.checked) setCorreoNuevo('');
                    }}
                    disabled={guardando}
                  />
                  Quitar el correo actual
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '44px', fontSize: '14px', color: 'var(--cp-navy)' }}>
                  <input
                    type="checkbox"
                    checked={avisosCorreo}
                    onChange={(e) => setAvisosCorreo(e.target.checked)}
                    disabled={guardando}
                  />
                  Recibe los avisos del sistema por correo (necesita correo)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '44px', fontSize: '14px', color: 'var(--cp-navy)' }}>
                  <input
                    type="checkbox"
                    checked={horario247}
                    onChange={(e) => setHorario247(e.target.checked)}
                    disabled={guardando}
                  />
                  Disponible 24/7 (recibe avisos fuera de su horario si nadie está de turno)
                </label>
              </div>
            )}

            {esAdmin && (
              <>
                <FotoUsuarioAdmin usuario={usuario} deshabilitado={guardando} />
                <div>
                  <Boton type="button" variante="secundario" onClick={() => setCambiarClaveAbierto(true)} disabled={guardando}>
                    Cambiar contraseña
                  </Boton>
                </div>
              </>
            )}

            <Combo
              etiqueta="Rol principal"
              opciones={OPCIONES_ROLES}
              valor={rol}
              alCambiar={(nuevoRol) => {
                setRol(nuevoRol);
                setOtrosRoles((previos) => previos.filter((r) => r !== nuevoRol));
                if (errores.rol) setErrores((prev) => ({ ...prev, rol: '' }));
              }}
              error={errores.rol}
              deshabilitado={guardando || !esAdmin}
            />

            <SelectorOtrosRoles
              principal={rol}
              valor={otrosRoles}
              alCambiar={(nuevos) => {
                setOtrosRoles(nuevos);
                if (errores.otrosRoles) setErrores((prev) => ({ ...prev, otrosRoles: '' }));
              }}
              error={errores.otrosRoles}
              deshabilitado={guardando || !esAdmin}
            />

            {esAdmin && (
              <>
                <Campo
                  id="editar-pais"
                  etiqueta="País de nacimiento (opcional)"
                  type="text"
                  value={paisNacimiento}
                  onChange={(e) => setPaisNacimiento(e.target.value)}
                  disabled={guardando}
                />
              </>
            )}

            <HistorialLaboral usuarioId={usuario.id} esAdmin={esAdmin} deshabilitado={guardando} />

            {puedeRecibirAlertasWhatsApp(rol) && (
              <BloqueAlertasWhatsApp
                usuarioId={usuario.id}
                rol={rol}
                deshabilitado={guardando}
              />
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <Boton
                type="submit"
                variante="primario"
                tamano="grande"
                disabled={guardando}
                style={{ flex: 1 }}
              >
                Guardar cambios
              </Boton>
              <Boton
                type="button"
                variante="secundario"
                tamano="grande"
                onClick={alCerrar}
                disabled={guardando}
              >
                Cancelar
              </Boton>
            </div>
          </form>
        </div>
      </div>

      {esAdmin && (
        <CambiarClaveModal
          usuario={usuario}
          abierto={cambiarClaveAbierto}
          alCerrar={() => setCambiarClaveAbierto(false)}
          alReingresar={volverAIngresar}
        />
      )}

      <Confirmar
        abierto={confirmarHorario}
        titulo="¿Guardar horario?"
        mensaje={`¿Guardar el horario y los reemplazos de ${usuario.nombres} ${usuario.apellidos}?`}
        textoSi="Sí, guardar"
        textoNo="No"
        cargando={guardando}
        alConfirmar={guardarHorario}
        alCancelar={() => setConfirmarHorario(false)}
      />

      <Confirmar
        abierto={confirmarAbierto}
        titulo="¿Guardar cambios?"
        mensaje={
          esAdmin && dniNuevo.trim()
            ? `¿Cambiar el DNI de ${usuario.nombres} ${usuario.apellidos}? Si es tu propia cuenta, se cerrará tu sesión.`
            : `¿Estás seguro de modificar los datos de ${usuario.nombres} ${usuario.apellidos}?`
        }
        textoSi="Sí, guardar"
        textoNo="No, cancelar"
        cargando={guardando}
        alConfirmar={handleConfirmarGuardar}
        alCancelar={() => setConfirmarAbierto(false)}
      />
    </>
  );
}
