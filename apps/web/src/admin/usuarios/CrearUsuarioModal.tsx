import { useState } from 'react';
import { ROLES_SISTEMA } from '@caprichos/compartido';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Campo } from '../../comun/Campo';
import { Combo } from '../../comun/Combo';
import { Confirmar } from '../../comun/Confirmar';
import { Icono } from '../../comun/Icono';
import type { UsuarioItem } from './tipos';

export interface CrearUsuarioModalProps {
  abierto: boolean;
  alCerrar: () => void;
  alUsuarioCreado: (usuario: UsuarioItem, claveInicial: string) => void;
}

export const ETIQUETAS_ROLES: Record<string, string> = {
  ADMIN: 'Administrador (Control total)',
  CAJERO: 'Cajero/a (Ventas y cobros)',
  MOZO: 'Mozo (Mesas y pedidos salón)',
  COCINA: 'Cocina (Comandas y preparación)',
  BARRA: 'Barra (Bebidas y postres)',
  REPARTIDOR: 'Repartidor (Delivery)',
  CALLCENTER: 'Call center (Atención y pedidos)',
};

const OPCIONES_ROLES = Object.values(ROLES_SISTEMA).map((rol) => ({
  valor: rol,
  etiqueta: ETIQUETAS_ROLES[rol] || rol,
}));

export function CrearUsuarioModal({
  abierto,
  alCerrar,
  alUsuarioCreado,
}: CrearUsuarioModalProps) {
  const [dni, setDni] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [rol, setRol] = useState<string>(ROLES_SISTEMA.CAJERO);

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);

  if (!abierto) return null;

  function validar(): boolean {
    const nuevosErrores: Record<string, string> = {};

    const dniLimpio = dni.trim();
    if (!dniLimpio) {
      nuevosErrores.dni = 'El DNI es obligatorio';
    } else if (!/^\d{8}$/.test(dniLimpio)) {
      nuevosErrores.dni = 'El DNI debe tener exactamente 8 dígitos numéricos';
    }

    if (!nombres.trim()) {
      nuevosErrores.nombres = 'Los nombres son requeridos';
    }

    if (!apellidos.trim()) {
      nuevosErrores.apellidos = 'Los apellidos son requeridos';
    }

    if (!rol) {
      nuevosErrores.rol = 'Selecciona un rol para el usuario';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorServidor(null);

    if (!validar()) return;

    setConfirmarAbierto(true);
  }

  async function crear() {
    setConfirmarAbierto(false);
    setGuardando(true);
    try {
      const respuesta = await api.post<{
        id: string;
        partyId: string;
        nombres: string;
        apellidos: string;
        dni: string;
        rol: string;
        activo: boolean;
        debeCambiar: boolean;
        claveInicial: string;
      }>('/admin/usuarios', {
        dni: dni.trim(),
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        rol,
      });

      // Limpiar formulario local
      setDni('');
      setNombres('');
      setApellidos('');
      setRol(ROLES_SISTEMA.CAJERO);
      setErrores({});

      // Notificar al padre con el usuario y la clave inicial única
      alUsuarioCreado(
        {
          id: respuesta.id,
          partyId: respuesta.partyId,
          nombres: respuesta.nombres,
          apellidos: respuesta.apellidos,
          dni: respuesta.dni,
          rol: respuesta.rol,
          activo: respuesta.activo,
          debeCambiar: respuesta.debeCambiar,
        },
        respuesta.claveInicial,
      );
    } catch (err) {
      if (err instanceof ErrorApi) {
        if (err.codigo === 'DNI_DUPLICADO') {
          setErrorServidor('El DNI ingresado ya se encuentra registrado en el sistema.');
        } else {
          setErrorServidor(err.message || 'Error al crear el usuario.');
        }
      } else {
        setErrorServidor('Error de conexión al servidor.');
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-crear-usuario-titulo"
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
            id="modal-crear-usuario-titulo"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '20px',
              color: 'var(--cp-navy)',
              margin: 0,
            }}
          >
            Nuevo usuario
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

        <div style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--cp-soft)' }}>
          Ingresa los datos del nuevo integrante. La API generará una contraseña inicial aleatoria que
          se mostrará en pantalla por única vez.
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Campo
            id="crear-dni"
            etiqueta="DNI (8 dígitos)"
            type="text"
            inputMode="numeric"
            maxLength={8}
            placeholder="12345678"
            value={dni}
            onChange={(e) => {
              const solonum = e.target.value.replace(/\D/g, '').slice(0, 8);
              setDni(solonum);
              if (errores.dni) setErrores((prev) => ({ ...prev, dni: '' }));
            }}
            error={errores.dni}
            disabled={guardando}
          />

          <Campo
            id="crear-nombres"
            etiqueta="Nombres"
            type="text"
            placeholder="Ej: Ana María"
            value={nombres}
            onChange={(e) => {
              setNombres(e.target.value);
              if (errores.nombres) setErrores((prev) => ({ ...prev, nombres: '' }));
            }}
            error={errores.nombres}
            disabled={guardando}
          />

          <Campo
            id="crear-apellidos"
            etiqueta="Apellidos"
            type="text"
            placeholder="Ej: Pérez Quispe"
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
              cargando={guardando}
              style={{ flex: 1 }}
            >
              Crear usuario
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
        <Confirmar
          abierto={confirmarAbierto}
          titulo="Crear usuario"
          mensaje={`¿Crear la cuenta de ${nombres.trim()} ${apellidos.trim()} con DNI ${dni.trim()}? Se generará una contraseña inicial que se mostrará una sola vez.`}
          textoSi="Sí, crear"
          textoNo="No"
          alConfirmar={crear}
          alCancelar={() => setConfirmarAbierto(false)}
        />
      </div>
    </div>
  );
}
