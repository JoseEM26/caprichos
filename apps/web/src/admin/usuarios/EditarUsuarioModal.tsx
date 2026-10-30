import { useState, useEffect } from 'react';
import { ROLES_SISTEMA } from '@caprichos/compartido';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Campo } from '../../comun/Campo';
import { Combo } from '../../comun/Combo';
import { Confirmar } from '../../comun/Confirmar';
import { Icono } from '../../comun/Icono';
import type { UsuarioItem } from './tipos';
import { ETIQUETAS_ROLES } from './CrearUsuarioModal';
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

export interface EditarUsuarioModalProps {
  usuario: UsuarioItem | null;
  abierto: boolean;
  alCerrar: () => void;
  alUsuarioEditado: (usuario: UsuarioItem) => void;
}

const OPCIONES_ROLES = Object.values(ROLES_SISTEMA).map((rol) => ({
  valor: rol,
  etiqueta: ETIQUETAS_ROLES[rol] || rol,
}));

export function EditarUsuarioModal({
  usuario,
  abierto,
  alCerrar,
  alUsuarioEditado,
}: EditarUsuarioModalProps) {
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [rol, setRol] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

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
      setErrores({});
      setErrorServidor(null);
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

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  function handleSolicitarGuardar(e: React.FormEvent) {
    e.preventDefault();
    setErrorServidor(null);
    if (!validar()) return;
    setConfirmarAbierto(true);
  }

  async function handleConfirmarGuardar() {
    if (!usuario) return;
    setGuardando(true);
    try {
      const resp = await api.patch<UsuarioItem>(`/admin/usuarios/${usuario.id}`, {
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        rol,
      });

      setConfirmarAbierto(false);
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
                width: '40px',
                height: '40px',
                borderRadius: '20px',
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
              etiqueta="DNI (Documento de identidad)"
              type="text"
              value={usuario.dni}
              disabled={true}
              ayuda="El DNI está asociado a la persona y no es editable."
            />

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

            <Combo
              etiqueta="Rol o cargo en el sistema"
              opciones={OPCIONES_ROLES}
              valor={rol}
              alCambiar={(nuevoRol) => {
                setRol(nuevoRol);
                if (errores.rol) setErrores((prev) => ({ ...prev, rol: '' }));
              }}
              error={errores.rol}
              deshabilitado={guardando}
            />

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
        mensaje={`¿Estás seguro de modificar los datos de ${usuario.nombres} ${usuario.apellidos}?`}
        textoSi="Sí, guardar"
        textoNo="No, cancelar"
        cargando={guardando}
        alConfirmar={handleConfirmarGuardar}
        alCancelar={() => setConfirmarAbierto(false)}
      />
    </>
  );
}
