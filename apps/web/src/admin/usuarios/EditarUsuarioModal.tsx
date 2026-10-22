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

          <form onSubmit={handleSolicitarGuardar} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
