import { useState, useEffect, useCallback } from 'react';
import { ROLES_SISTEMA } from '@caprichos/compartido';
import { useSesion } from '../../comun/sesion';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Combo } from '../../comun/Combo';
import { Insignia } from '../../comun/Insignia';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { EstadoError } from '../../comun/EstadoError';
import { Confirmar } from '../../comun/Confirmar';
import { Paginacion } from '../../comun/Paginacion';
import { Icono } from '../../comun/Icono';
import { Tarjeta } from '../../comun/Tarjeta';

import type { UsuarioItem, RespuestaListarUsuarios } from './tipos';
import { CrearUsuarioModal, ETIQUETAS_ROLES } from './CrearUsuarioModal';
import { EditarUsuarioModal } from './EditarUsuarioModal';
import { AsignarPinModal } from './AsignarPinModal';
import { ClaveInicialModal } from './ClaveInicialModal';

const OPCIONES_FILTRO_ROL = [
  { valor: '', etiqueta: 'Todos los roles' },
  ...Object.values(ROLES_SISTEMA).map((rol) => ({
    valor: rol,
    etiqueta: ETIQUETAS_ROLES[rol] || rol,
  })),
];

const OPCIONES_FILTRO_ESTADO = [
  { valor: '', etiqueta: 'Todos los estados' },
  { valor: 'true', etiqueta: 'Activos' },
  { valor: 'false', etiqueta: 'Desactivados' },
];

export function UsuariosView() {
  const { usuario: usuarioActual, tiene } = useSesion();

  // Permisos
  const puedeVer = tiene('usuarios/ver');
  const puedeCrear = tiene('usuarios/crear');
  const puedeEditar = tiene('usuarios/editar');
  const puedeDesactivar = tiene('usuarios/desactivar');
  const puedeReactivar = tiene('usuarios/reactivar');
  const puedeRestablecer = tiene('usuarios/restablecer');
  const esAdmin = usuarioActual?.rol === 'ADMIN';

  // Pestañas: 'personal' | 'roles'
  const [tabActual, setTabActual] = useState<'personal' | 'roles'>('personal');

  // Filtros y paginación
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [filtroActivo, setFiltroActivo] = useState('');
  const [pagina, setPagina] = useState(1);
  const limite = 15;

  // Datos
  const [usuarios, setUsuarios] = useState<UsuarioItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mensaje de éxito / notificación temporal
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Mapa de DNIs completos revelados (id -> DNI sin enmascarar)
  const [dnisRevelados, setDnisRevelados] = useState<Record<string, string>>({});

  // Modales
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioItem | null>(null);
  const [usuarioPin, setUsuarioPin] = useState<UsuarioItem | null>(null);

  // Modal de contraseña inicial (una sola vez)
  const [claveInicialTemporal, setClaveInicialTemporal] = useState<{
    clave: string;
    nombre: string;
  } | null>(null);

  // Diálogo de confirmación genérico para acciones Sí/No
  const [confirmarAccion, setConfirmarAccion] = useState<{
    abierto: boolean;
    titulo: string;
    mensaje: string;
    textoSi?: string;
    textoNo?: string;
    peligro?: boolean;
    cargando?: boolean;
    ejecutar: () => Promise<void>;
  }>({
    abierto: false,
    titulo: '',
    mensaje: '',
    ejecutar: async () => {},
  });

  const cargarUsuarios = useCallback(async () => {
    if (!puedeVer) return;

    setCargando(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('pagina', pagina.toString());
      params.set('limite', limite.toString());
      if (filtroRol) params.set('rol', filtroRol);
      if (filtroActivo !== '') params.set('activo', filtroActivo);
      if (busqueda.trim()) params.set('busqueda', busqueda.trim());

      const data = await api.get<RespuestaListarUsuarios>(
        `/admin/usuarios?${params.toString()}`,
      );
      setUsuarios(data.elementos || []);
      setTotal(data.total || 0);
      setTotalPaginas(data.totalPaginas || 1);
    } catch (err) {
      if (err instanceof ErrorApi) {
        setError(err.message || 'Error al obtener los usuarios.');
      } else {
        setError('Error de comunicación con el servidor.');
      }
    } finally {
      setCargando(false);
    }
  }, [puedeVer, pagina, limite, filtroRol, filtroActivo, busqueda]);

  useEffect(() => {
    cargarUsuarios();
  }, [cargarUsuarios]);

  // Limpiar filtros
  function limpiarFiltros() {
    setBusqueda('');
    setFiltroRol('');
    setFiltroActivo('');
    setPagina(1);
  }

  // Ver DNI completo con confirmación y auditoría (solo ADMIN)
  function solicitarVerDni(u: UsuarioItem) {
    if (!esAdmin) return;

    setConfirmarAccion({
      abierto: true,
      titulo: '¿Consultar DNI completo?',
      mensaje: `Se solicitará el DNI completo de ${u.nombres} ${u.apellidos}. De acuerdo a la Ley 29733 y DT-75, esta consulta sensible quedará registrada en el historial de auditoría con tu usuario y fecha.`,
      textoSi: 'Sí, consultar DNI',
      textoNo: 'Cancelar',
      peligro: false,
      cargando: false,
      ejecutar: async () => {
        try {
          const resp = await api.get<{ id: string; dni: string }>(
            `/admin/usuarios/${u.id}/dni`,
          );
          setDnisRevelados((prev) => ({ ...prev, [u.id]: resp.dni }));
          setConfirmarAccion((prev) => ({ ...prev, abierto: false }));
        } catch (err) {
          setConfirmarAccion((prev) => ({ ...prev, abierto: false }));
          if (err instanceof ErrorApi) {
            alert(err.message);
          }
        }
      },
    });
  }

  // Desactivar usuario
  function solicitarDesactivar(u: UsuarioItem) {
    setConfirmarAccion({
      abierto: true,
      titulo: '¿Desactivar usuario?',
      mensaje: `¿Estás seguro de desactivar a ${u.nombres} ${u.apellidos}? El usuario no podrá iniciar sesión y sus sesiones abiertas se revocarán de inmediato. Su historial se conserva íntegro; nada se elimina del sistema.`,
      textoSi: 'Sí, desactivar',
      textoNo: 'Cancelar',
      peligro: true,
      cargando: false,
      ejecutar: async () => {
        try {
          await api.post(`/admin/usuarios/${u.id}/desactivar`);
          setConfirmarAccion((prev) => ({ ...prev, abierto: false }));
          setMensajeExito(`Usuario ${u.nombres} ${u.apellidos} desactivado correctamente.`);
          setTimeout(() => setMensajeExito(null), 5000);
          cargarUsuarios();
        } catch (err) {
          setConfirmarAccion((prev) => ({ ...prev, abierto: false }));
          if (err instanceof ErrorApi) {
            alert(err.message);
          }
        }
      },
    });
  }

  // Reactivar usuario
  function solicitarReactivar(u: UsuarioItem) {
    setConfirmarAccion({
      abierto: true,
      titulo: '¿Reactivar usuario?',
      mensaje: `¿Deseas reactivar la cuenta de ${u.nombres} ${u.apellidos}? Podrá ingresar nuevamente con su usuario y contraseña anterior.`,
      textoSi: 'Sí, reactivar',
      textoNo: 'Cancelar',
      peligro: false,
      cargando: false,
      ejecutar: async () => {
        try {
          await api.post(`/admin/usuarios/${u.id}/reactivar`);
          setConfirmarAccion((prev) => ({ ...prev, abierto: false }));
          setMensajeExito(`Usuario ${u.nombres} ${u.apellidos} reactivado correctamente.`);
          setTimeout(() => setMensajeExito(null), 5000);
          cargarUsuarios();
        } catch (err) {
          setConfirmarAccion((prev) => ({ ...prev, abierto: false }));
          if (err instanceof ErrorApi) {
            alert(err.message);
          }
        }
      },
    });
  }

  // Restablecer contraseña aleatoria
  function solicitarRestablecer(u: UsuarioItem) {
    setConfirmarAccion({
      abierto: true,
      titulo: '¿Restablecer contraseña?',
      mensaje: `Se generará una nueva contraseña temporal aleatoria de 12 caracteres para ${u.nombres} ${u.apellidos}. Todas sus sesiones abiertas serán cerradas y en su próximo ingreso se le exigirá crear una nueva contraseña.`,
      textoSi: 'Sí, restablecer',
      textoNo: 'Cancelar',
      peligro: true,
      cargando: false,
      ejecutar: async () => {
        try {
          const resp = await api.post<{ claveInicial: string; mensaje: string }>(
            `/admin/usuarios/${u.id}/restablecer`,
          );
          setConfirmarAccion((prev) => ({ ...prev, abierto: false }));
          // Mostrar la contraseña inicial en el modal una sola vez
          setClaveInicialTemporal({
            clave: resp.claveInicial,
            nombre: `${u.nombres} ${u.apellidos}`,
          });
        } catch (err) {
          setConfirmarAccion((prev) => ({ ...prev, abierto: false }));
          if (err instanceof ErrorApi) {
            alert(err.message);
          }
        }
      },
    });
  }

  // Callback al crear usuario
  function handleUsuarioCreado(nuevo: UsuarioItem, claveInicial: string) {
    setModalCrearAbierto(false);
    cargarUsuarios();
    setClaveInicialTemporal({
      clave: claveInicial,
      nombre: `${nuevo.nombres} ${nuevo.apellidos}`,
    });
  }

  // Callback al editar usuario
  function handleUsuarioEditado(editado: UsuarioItem) {
    setUsuarioEditando(null);
    setMensajeExito(`Usuario ${editado.nombres} ${editado.apellidos} actualizado.`);
    setTimeout(() => setMensajeExito(null), 4000);
    cargarUsuarios();
  }

  // Callback al asignar PIN
  function handlePinAsignado(mensaje: string) {
    setUsuarioPin(null);
    setMensajeExito(mensaje);
    setTimeout(() => setMensajeExito(null), 4000);
  }

  // Si no tiene permiso de ver
  if (!puedeVer) {
    return (
      <div style={{ padding: '24px' }}>
        <Tarjeta>
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '24px',
                background: '#FBEDE9',
                color: 'var(--cp-rust)',
                margin: '0 auto 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icono nombre="alerta" tamano={24} />
            </div>
            <h2
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '18px',
                color: 'var(--cp-navy)',
                marginBottom: '8px',
              }}
            >
              Sin permiso de acceso
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--cp-soft)', maxWidth: '400px', margin: '0 auto' }}>
              No tienes permiso para ver la gestión de usuarios y personal. Contacta al administrador si
              requieres acceso.
            </p>
          </div>
        </Tarjeta>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Encabezado y pestañas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '13px', lineHeight: '19px', color: 'var(--cp-soft)' }}>
          Aquí están las cuentas de quienes trabajan (personal). Nada se elimina: las cuentas se
          desactivan para preservar el historial de auditoría y operaciones.
        </div>

        <div role="tablist" aria-label="Secciones de usuarios" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            role="tab"
            aria-selected={tabActual === 'personal'}
            onClick={() => setTabActual('personal')}
            style={{
              minHeight: '44px',
              padding: '0 18px',
              borderRadius: '12px',
              border: '1.5px solid var(--cp-navy)',
              background: tabActual === 'personal' ? 'var(--cp-navy)' : 'var(--cp-white)',
              color: tabActual === 'personal' ? 'var(--cp-cream)' : 'var(--cp-navy)',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Icono nombre="usuarios" tamano={18} />
            Personal ({total})
          </button>

          <button
            role="tab"
            aria-selected={tabActual === 'roles'}
            onClick={() => setTabActual('roles')}
            style={{
              minHeight: '44px',
              padding: '0 18px',
              borderRadius: '12px',
              border: '1.5px solid var(--cp-navy)',
              background: tabActual === 'roles' ? 'var(--cp-navy)' : 'var(--cp-white)',
              color: tabActual === 'roles' ? 'var(--cp-cream)' : 'var(--cp-navy)',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Icono nombre="paleta" tamano={18} />
            Roles y permisos
          </button>
        </div>
      </div>

      {/* Notificación de éxito */}
      {mensajeExito && (
        <div
          role="status"
          style={{
            border: '1.5px solid var(--cp-green)',
            background: 'var(--cp-greenbg)',
            color: 'var(--cp-green)',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Icono nombre="check" tamano={18} />
          {mensajeExito}
        </div>
      )}

      {/* Contenido según pestaña */}
      {tabActual === 'roles' ? (
        <Tarjeta>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '12px 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '18px',
                  background: 'var(--cp-sand)',
                  color: 'var(--cp-navy)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icono nombre="paleta" tamano={20} />
              </div>
              <div>
                <h3
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 800,
                    fontSize: '18px',
                    color: 'var(--cp-navy)',
                    margin: 0,
                  }}
                >
                  Roles y permisos del sistema
                </h3>
                <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
                  Definición contractual fija de privilegios por cargo (solo lectura).
                </div>
              </div>
            </div>

            <div
              style={{
                background: '#FFF8E6',
                border: '1px solid var(--cp-gold)',
                borderRadius: '12px',
                padding: '16px',
                fontSize: '14px',
                lineHeight: '20px',
                color: 'var(--cp-navy)',
              }}
            >
              <b>Nota de arquitectura (F2):</b> La matriz de permisos por rol no se encuentra exportada
              como tabla fija en <code>@caprichos/compartido</code>. Según las especificaciones de diseño
              y el contrato de la ola F2, los permisos no deben inferirse a partir de la llamada{' '}
              <code>GET /auth/yo</code> del usuario logueado ni inventarse en el frontend. La vista se
              habilitará en cuanto el paquete compartido exporte la matriz formal de permisos.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
              {Object.entries(ROLES_SISTEMA).map(([key, val]) => (
                <div
                  key={key}
                  style={{
                    background: 'var(--cp-white)',
                    border: '1px solid var(--cp-line)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--cp-navy)' }}>
                    {ETIQUETAS_ROLES[val] || val}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--cp-soft)', marginTop: '4px' }}>
                    Código de rol: <code>{val}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Tarjeta>
      ) : (
        /* Pestaña Personal */
        <Tarjeta>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Barra de filtros y botón nuevo */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', flex: '1 1 300px' }}>
                {/* Buscador */}
                <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
                  <label htmlFor="buscar-usuario" style={{ position: 'absolute', left: '-9999px' }}>
                    Buscar por nombre o DNI
                  </label>
                  <input
                    id="buscar-usuario"
                    type="search"
                    placeholder="Buscar por nombre o DNI..."
                    value={busqueda}
                    onChange={(e) => {
                      setBusqueda(e.target.value);
                      setPagina(1);
                    }}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: '44px',
                      borderRadius: '12px',
                      border: '1.5px solid var(--cp-line)',
                      background: 'var(--cp-white)',
                      padding: '0 14px',
                      fontSize: '14px',
                      color: 'var(--cp-navy)',
                    }}
                  />
                </div>

                {/* Combo Rol */}
                <div style={{ width: '180px' }}>
                  <Combo
                    opciones={OPCIONES_FILTRO_ROL}
                    valor={filtroRol}
                    alCambiar={(nuevoRol) => {
                      setFiltroRol(nuevoRol);
                      setPagina(1);
                    }}
                    placeholder="Rol..."
                  />
                </div>

                {/* Combo Estado */}
                <div style={{ width: '160px' }}>
                  <Combo
                    opciones={OPCIONES_FILTRO_ESTADO}
                    valor={filtroActivo}
                    alCambiar={(nuevoEstado) => {
                      setFiltroActivo(nuevoEstado);
                      setPagina(1);
                    }}
                    placeholder="Estado..."
                  />
                </div>

                {(busqueda || filtroRol || filtroActivo) && (
                  <Boton
                    type="button"
                    variante="texto"
                    tamano="pequeno"
                    onClick={limpiarFiltros}
                  >
                    Limpiar filtros
                  </Boton>
                )}
              </div>

              {puedeCrear && (
                <Boton
                  type="button"
                  variante="primario"
                  tamano="normal"
                  onClick={() => setModalCrearAbierto(true)}
                >
                  <Icono nombre="punto" tamano={16} />
                  + Nuevo usuario
                </Boton>
              )}
            </div>

            {/* Estados de carga / error / vacío / lista */}
            {cargando ? (
              <div style={{ padding: '32px 0' }}>
                <Cargando mensaje="Cargando usuarios..." />
              </div>
            ) : error ? (
              <EstadoError
                mensaje={error}
                alReintentar={cargarUsuarios}
              />
            ) : usuarios.length === 0 ? (
              <EstadoVacio
                titulo="Ningún usuario coincide con los filtros"
                descripcion="Verifica la ortografía o intenta limpiar los filtros de búsqueda."
              />
            ) : (
              <>
                {/* VISTA ESCRITORIO: Tabla */}
                <div className="usuarios-tabla-contenedor" style={{ overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '14px',
                      textAlign: 'left',
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--cp-line)', color: 'var(--cp-soft)' }}>
                        <th style={{ padding: '12px 14px', fontWeight: 800, fontSize: '12px', letterSpacing: '0.05em' }}>
                          PERSONA
                        </th>
                        <th style={{ padding: '12px 14px', fontWeight: 800, fontSize: '12px', letterSpacing: '0.05em' }}>
                          DNI
                        </th>
                        <th style={{ padding: '12px 14px', fontWeight: 800, fontSize: '12px', letterSpacing: '0.05em' }}>
                          ROL
                        </th>
                        <th style={{ padding: '12px 14px', fontWeight: 800, fontSize: '12px', letterSpacing: '0.05em' }}>
                          ESTADO
                        </th>
                        <th
                          style={{
                            padding: '12px 14px',
                            fontWeight: 800,
                            fontSize: '12px',
                            letterSpacing: '0.05em',
                            textAlign: 'right',
                          }}
                        >
                          ACCIONES
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuarios.map((u) => {
                        const dniCompleto = dnisRevelados[u.id];
                        const dniAMostrar = dniCompleto || u.dni;
                        const esFilaAdmin = u.rol === 'ADMIN';

                        return (
                          <tr
                            key={u.id}
                            style={{
                              borderBottom: '1px solid var(--cp-line)',
                              opacity: u.activo ? 1 : 0.6,
                              background: 'transparent',
                            }}
                          >
                            {/* Persona */}
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div
                                  style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '18px',
                                    background: 'var(--cp-sand)',
                                    color: 'var(--cp-navy)',
                                    fontWeight: 800,
                                    fontSize: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  {u.nombres.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 800, color: 'var(--cp-navy)' }}>
                                    {u.nombres} {u.apellidos}
                                  </div>
                                  <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                                    ID: {u.id}
                                    {u.debeCambiar && ' · Clave temporal pendiente de cambio'}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* DNI */}
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span
                                  data-testid={`dni-${u.id}`}
                                  style={{
                                    fontFamily: 'ui-monospace, Menlo, monospace',
                                    fontSize: '13px',
                                    fontWeight: 700,
                                  }}
                                >
                                  {dniAMostrar}
                                </span>

                                {esAdmin && !dniCompleto && (
                                  <button
                                    type="button"
                                    onClick={() => solicitarVerDni(u)}
                                    title="Consultar DNI completo (registra auditoría)"
                                    style={{
                                      minHeight: '32px',
                                      padding: '0 8px',
                                      borderRadius: '6px',
                                      border: '1px solid var(--cp-navy)',
                                      background: 'transparent',
                                      color: 'var(--cp-navy)',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Ver DNI
                                  </button>
                                )}

                                {dniCompleto && (
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      background: 'var(--cp-greenbg)',
                                      color: 'var(--cp-green)',
                                      fontWeight: 700,
                                    }}
                                  >
                                    Auditado
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Rol */}
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ fontWeight: 700, color: 'var(--cp-navy)' }}>
                                {ETIQUETAS_ROLES[u.rol] || u.rol}
                              </span>
                            </td>

                            {/* Estado */}
                            <td style={{ padding: '12px 14px' }}>
                              <Insignia variante={u.activo ? 'exito' : 'peligro'}>
                                {u.activo ? 'Activo' : 'Desactivado'}
                              </Insignia>
                            </td>

                            {/* Acciones */}
                            <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                              <div
                                style={{
                                  display: 'inline-flex',
                                  gap: '6px',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  justifyContent: 'flex-end',
                                }}
                              >
                                {puedeEditar && (
                                  <Boton
                                    type="button"
                                    variante="secundario"
                                    tamano="pequeno"
                                    onClick={() => setUsuarioEditando(u)}
                                  >
                                    Editar
                                  </Boton>
                                )}

                                {esAdmin && esFilaAdmin && puedeEditar && (
                                  <Boton
                                    type="button"
                                    variante="secundario"
                                    tamano="pequeno"
                                    onClick={() => setUsuarioPin(u)}
                                    title="Asignar PIN de supervisor"
                                  >
                                    PIN
                                  </Boton>
                                )}

                                {puedeRestablecer && (
                                  <Boton
                                    type="button"
                                    variante="secundario"
                                    tamano="pequeno"
                                    onClick={() => solicitarRestablecer(u)}
                                    title="Restablecer a contraseña temporal aleatoria"
                                  >
                                    Restablecer
                                  </Boton>
                                )}

                                {u.activo && puedeDesactivar && (
                                  <Boton
                                    type="button"
                                    variante="peligro"
                                    tamano="pequeno"
                                    onClick={() => solicitarDesactivar(u)}
                                  >
                                    Desactivar
                                  </Boton>
                                )}

                                {!u.activo && puedeReactivar && (
                                  <Boton
                                    type="button"
                                    variante="primario"
                                    tamano="pequeno"
                                    onClick={() => solicitarReactivar(u)}
                                  >
                                    Reactivar
                                  </Boton>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* VISTA CELULAR: Tarjetas */}
                <div className="usuarios-tarjetas" style={{ display: 'none', flexDirection: 'column', gap: '12px' }}>
                  {usuarios.map((u) => {
                    const dniCompleto = dnisRevelados[u.id];
                    const dniAMostrar = dniCompleto || u.dni;
                    const esFilaAdmin = u.rol === 'ADMIN';

                    return (
                      <div
                        key={`card-${u.id}`}
                        style={{
                          background: 'var(--cp-white)',
                          border: '1px solid var(--cp-line)',
                          borderRadius: '14px',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          opacity: u.activo ? 1 : 0.6,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '20px',
                                background: 'var(--cp-sand)',
                                color: 'var(--cp-navy)',
                                fontWeight: 800,
                                fontSize: '15px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {u.nombres.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--cp-navy)' }}>
                                {u.nombres} {u.apellidos}
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                                {ETIQUETAS_ROLES[u.rol] || u.rol}
                              </div>
                            </div>
                          </div>
                          <Insignia variante={u.activo ? 'exito' : 'peligro'}>
                            {u.activo ? 'Activo' : 'Desactivado'}
                          </Insignia>
                        </div>

                        {/* DNI en celular */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'var(--cp-sand)',
                            borderRadius: '8px',
                            padding: '6px 10px',
                            fontSize: '13px',
                          }}
                        >
                          <span style={{ color: 'var(--cp-soft)', fontWeight: 700 }}>DNI:</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 800 }}>
                              {dniAMostrar}
                            </span>
                            {esAdmin && !dniCompleto && (
                              <button
                                type="button"
                                onClick={() => solicitarVerDni(u)}
                                style={{
                                  minHeight: '30px',
                                  padding: '0 8px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--cp-navy)',
                                  background: 'transparent',
                                  color: 'var(--cp-navy)',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                }}
                              >
                                Ver DNI
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Botones de acción en celular */}
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                          {puedeEditar && (
                            <Boton
                              type="button"
                              variante="secundario"
                              tamano="pequeno"
                              onClick={() => setUsuarioEditando(u)}
                              style={{ flex: 1 }}
                            >
                              Editar
                            </Boton>
                          )}

                          {esAdmin && esFilaAdmin && puedeEditar && (
                            <Boton
                              type="button"
                              variante="secundario"
                              tamano="pequeno"
                              onClick={() => setUsuarioPin(u)}
                              style={{ flex: 1 }}
                            >
                              PIN
                            </Boton>
                          )}

                          {puedeRestablecer && (
                            <Boton
                              type="button"
                              variante="secundario"
                              tamano="pequeno"
                              onClick={() => solicitarRestablecer(u)}
                              style={{ flex: 1 }}
                            >
                              Restablecer
                            </Boton>
                          )}

                          {u.activo && puedeDesactivar && (
                            <Boton
                              type="button"
                              variante="peligro"
                              tamano="pequeno"
                              onClick={() => solicitarDesactivar(u)}
                              style={{ flex: 1 }}
                            >
                              Desactivar
                            </Boton>
                          )}

                          {!u.activo && puedeReactivar && (
                            <Boton
                              type="button"
                              variante="primario"
                              tamano="pequeno"
                              onClick={() => solicitarReactivar(u)}
                              style={{ flex: 1 }}
                            >
                              Reactivar
                            </Boton>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Paginación */}
                <Paginacion
                  pagina={pagina}
                  totalPaginas={totalPaginas}
                  totalRegistros={total}
                  tamanoPagina={limite}
                  alCambiarPagina={(nuevaPagina) => setPagina(nuevaPagina)}
                />
              </>
            )}
          </div>
        </Tarjeta>
      )}

      {/* Modal Crear Usuario */}
      <CrearUsuarioModal
        abierto={modalCrearAbierto}
        alCerrar={() => setModalCrearAbierto(false)}
        alUsuarioCreado={handleUsuarioCreado}
      />

      {/* Modal Editar Usuario */}
      <EditarUsuarioModal
        usuario={usuarioEditando}
        abierto={usuarioEditando !== null}
        alCerrar={() => setUsuarioEditando(null)}
        alUsuarioEditado={handleUsuarioEditado}
      />

      {/* Modal PIN Supervisor */}
      <AsignarPinModal
        usuario={usuarioPin}
        abierto={usuarioPin !== null}
        alCerrar={() => setUsuarioPin(null)}
        alPinAsignado={handlePinAsignado}
      />

      {/* Modal Clave Inicial Única */}
      <ClaveInicialModal
        clave={claveInicialTemporal ? claveInicialTemporal.clave : null}
        nombreUsuario={claveInicialTemporal ? claveInicialTemporal.nombre : undefined}
        alCerrar={() => setClaveInicialTemporal(null)}
      />

      {/* Diálogo Confirmar Acción */}
      <Confirmar
        abierto={confirmarAccion.abierto}
        titulo={confirmarAccion.titulo}
        mensaje={confirmarAccion.mensaje}
        textoSi={confirmarAccion.textoSi}
        textoNo={confirmarAccion.textoNo}
        peligro={confirmarAccion.peligro}
        cargando={confirmarAccion.cargando}
        alConfirmar={confirmarAccion.ejecutar}
        alCancelar={() => setConfirmarAccion((prev) => ({ ...prev, abierto: false }))}
      />

      {/* Media query para celular vs PC */}
      <style>{`
        @media (max-width: 768px) {
          .usuarios-tabla-contenedor { display: none !important; }
          .usuarios-tarjetas { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
