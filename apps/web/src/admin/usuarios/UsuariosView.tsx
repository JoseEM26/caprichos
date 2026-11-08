import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSesion } from '../../comun/sesion';
import { api, ErrorApi } from '../../comun/api';
import { Confirmar } from '../../comun/Confirmar';
import { Campo } from '../../comun/Campo';
import { Boton } from '../../comun/Boton';
import type { UsuarioItem, RespuestaListarUsuarios, PersonalHorario } from './tipos';
import { DIAS, formatoHoras, horasTurno } from './horario';
import { CrearUsuarioModal, ETIQUETAS_ROLES } from './CrearUsuarioModal';
import { EditarUsuarioModal } from './EditarUsuarioModal';
import { ClaveInicialModal } from './ClaveInicialModal';
import { BarraFiltros, FiltroCombo } from '../../comun/FiltroCombo';
import { fechaLimaCorta } from './rolesTemporalesApi';
import { BarraSeleccion, ModalRolesMasivos } from './RolesMasivos';
import type { ResultadoRolesMasivo } from './rolesMasivoApi';

type PestanaUsuario = 'personal' | 'clientes' | 'horarios' | 'roles';

const ROLES_COLUMNAS = [
  { id: 'cajero', n: 'Cajero' },
  { id: 'cocina', n: 'Cocina' },
  { id: 'mozo', n: 'Mozo' },
  { id: 'almacen', n: 'Almacén' },
  { id: 'produccion', n: 'Producción' },
  { id: 'repartidor', n: 'Repartidor' },
];

const MODULOS_MATRIZ = [
  { id: 'caja', n: 'Pedidos y caja', roles: ['cajero'] },
  { id: 'cocina', n: 'Cocina', roles: ['cocina'] },
  { id: 'repartos', n: 'Repartos', roles: ['repartidor'] },
  { id: 'reservas', n: 'Reservas', roles: ['cajero', 'mozo'] },
  { id: 'comprobantes', n: 'Comprobantes', roles: ['cajero'] },
  { id: 'clientes', n: 'Clientes', roles: ['cajero'] },
  { id: 'stock', n: 'Stock y recetas', roles: ['cocina', 'almacen', 'produccion'] },
  { id: 'recetas', n: 'Recetas', roles: ['cocina', 'almacen', 'produccion'] },
  { id: 'almacen', n: 'Almacén', roles: ['almacen', 'produccion'] },
  { id: 'compras', n: 'Compras', roles: ['almacen'] },
  { id: 'mensajes', n: 'Mensajes de WhatsApp', roles: ['cajero', 'mozo'] },
];

export function UsuariosView() {
  const { usuario: usuarioActual, tiene } = useSesion();

  const puedeVer = tiene('usuarios/ver');
  const puedeCrear = tiene('usuarios/crear');
  const puedeEditar = tiene('usuarios/editar');
  const puedeDesactivar = tiene('usuarios/desactivar');
  const puedeReactivar = tiene('usuarios/reactivar');
  const puedeRestablecer = tiene('usuarios/restablecer');
  const esAdmin = usuarioActual?.rol === 'ADMIN';

  const [tabActual, setTabActual] = useState<PestanaUsuario>('personal');

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroCargo, setFiltroCargo] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroCreado, setFiltroCreado] = useState('todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [filtroAcceso, setFiltroAcceso] = useState('todos');
  const [pagina, setPagina] = useState(1);
  const limite = 15;

  // Clientes tab state
  const [clientes, setClientes] = useState<any[]>([]);
  const [cargandoClientes, setCargandoClientes] = useState(false);
  const [busquedaCli, setBusquedaCli] = useState('');
  const [filtroCliTipo, setFiltroCliTipo] = useState('');
  const [filtroCliCuenta, setFiltroCliCuenta] = useState('todos');
  const [cliExpMsg, setCliExpMsg] = useState('');
  const [dnisReveladosCli, setDnisReveladosCli] = useState<Record<string, boolean>>({});

  // Cargar clientes reales si existe la API
  useEffect(() => {
    if (tabActual === 'clientes') {
      setCargandoClientes(true);
      api.get<any>('/admin/clientes')
        .then((data) => {
          const lista = Array.isArray(data) ? data : (data?.elementos || data?.clientes || []);
          setClientes(lista);
        })
        .catch(() => {
          setClientes([]);
        })
        .finally(() => {
          setCargandoClientes(false);
        });
    }
  }, [tabActual]);

  // Horarios tab state
  const [horariosServidor, setHorariosServidor] = useState<PersonalHorario[]>([]);
  const [horariosError, setHorariosError] = useState('');
  const [coberturas, setCoberturas] = useState<Array<{ t: string }>>([]);
  const [nuevaCob, setNuevaCob] = useState({ fecha: '', cubre: '', reemplaza: '' });
  const [hrMsg, setHrMsg] = useState('');

  // Roles matriz state
  const [matrizState, setMatrizState] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    MODULOS_MATRIZ.forEach((m) => {
      init[m.id] = [...m.roles];
    });
    return init;
  });
  const [permisosGuardadosMsg, setPermisosGuardadosMsg] = useState('');

  // Datos de usuarios
  const [usuarios, setUsuarios] = useState<UsuarioItem[]>([]);
  const [todosUsuarios, setTodosUsuarios] = useState<UsuarioItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // DNI completo revelado
  const [dnisRevelados, setDnisRevelados] = useState<Record<string, string>>({});
  const [auditados, setAuditados] = useState<Record<string, boolean>>({});

  // Selección para dar o quitar un rol a varios usuarios
  const [seleccionando, setSeleccionando] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  /** Cuántas cuentas activas hay en total cuando se eligió «todos» (null = no se eligió). */
  const [todosActivos, setTodosActivos] = useState<number | null>(null);
  const [accionMasiva, setAccionMasiva] = useState<{ accion: 'agregar' | 'quitar'; rolFijo?: string } | null>(null);
  const puedeAsignarMasivo = esAdmin && puedeEditar;
  const cantidadSeleccion = todosActivos ?? seleccion.size;

  const cancelarSeleccion = () => {
    setSeleccionando(false);
    setSeleccion(new Set());
    setTodosActivos(null);
  };
  const alternarSeleccion = (id: string) => {
    setTodosActivos(null);
    setSeleccion((prev) => {
      const sig = new Set(prev);
      if (sig.has(id)) sig.delete(id);
      else sig.add(id);
      return sig;
    });
  };
  const contarActivos = async () => {
    const r = await api.get<RespuestaListarUsuarios>('/admin/usuarios?activo=true&limite=1');
    return r?.total ?? 0;
  };
  const seleccionarTodos = async () => {
    setTodosActivos(await contarActivos());
  };
  const atajoDelivery = async () => {
    setSeleccionando(true);
    setSeleccion(new Set());
    setTodosActivos(await contarActivos());
    setAccionMasiva({ accion: 'agregar', rolFijo: 'APOYO_DELIVERY' });
  };

  // Modales
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioItem | null>(null);
  const [claveInicialTemporal, setClaveInicialTemporal] = useState<{ clave: string; nombre: string } | null>(null);

  // Confirmar Sí/No
  // Desactivar pide fecha de salida y motivo; reactivar pide fecha de reingreso (Sí/No al final)
  const hoyLima = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
  const [formAccion, setFormAccion] = useState({ fecha: '', motivo: '' });
  const formAccionRef = useRef(formAccion);
  useEffect(() => {
    formAccionRef.current = formAccion;
  }, [formAccion]);

  const [confirmarAccion, setConfirmarAccion] = useState<{
    abierto: boolean;
    tipo?: 'desactivar' | 'reactivar';
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
      if (filtroCargo !== 'todos') params.set('rol', filtroCargo.toUpperCase());
      if (filtroEstado === 'activos') params.set('activo', 'true');
      if (filtroEstado === 'inactivos') params.set('activo', 'false');
      if (busqueda.trim()) params.set('busqueda', busqueda.trim());

      const data = await api.get<RespuestaListarUsuarios>(
        `/admin/usuarios?${params.toString()}`,
      );
      setUsuarios(data.elementos || []);
      setTotal(data.total || 0);
      setTotalPaginas(data.totalPaginas || 1);

      if (filtroCargo === 'todos' && filtroEstado === 'todos' && !busqueda.trim()) {
        setTodosUsuarios(data.elementos || []);
      }
    } catch (err: any) {
      if (err instanceof ErrorApi) {
        setError(err.message || 'Error al obtener los usuarios.');
      } else {
        setError('Error de conexión al cargar la lista de personal.');
      }
    } finally {
      setCargando(false);
    }
  }, [puedeVer, pagina, limite, filtroCargo, filtroEstado, busqueda]);

  useEffect(() => {
    cargarUsuarios();
  }, [cargarUsuarios]);

  // Carga inicial de usuarios para horarios y KPIs
  useEffect(() => {
    if (puedeVer) {
      api.get<RespuestaListarUsuarios>('/admin/usuarios?limite=100')
        .then((res) => {
          if (res?.elementos) {
            setTodosUsuarios(res.elementos);
          }
        })
        .catch(() => {});
    }
  }, [puedeVer]);

  // Horarios reales del servidor (se recargan al abrir la pestaña y al cerrar el editor)
  const recargarHorarios = useCallback(() => {
    api
      .get<PersonalHorario[]>('/admin/usuarios/horarios')
      .then((d) => {
        setHorariosServidor(Array.isArray(d) ? d : []);
        setHorariosError('');
      })
      .catch(() => setHorariosError('No se pudieron cargar los horarios del personal.'));
  }, []);

  useEffect(() => {
    if (tabActual === 'horarios' && puedeVer) recargarHorarios();
  }, [tabActual, puedeVer, recargarHorarios, usuarioEditando]);

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroCargo('todos');
    setFiltroEstado('todos');
    setFiltroCreado('todos');
    setFechaDesde('');
    setFechaHasta('');
    setFiltroAcceso('todos');
    setPagina(1);
  };

  // Universo de usuarios base para métricas y chips
  const baseUsuarios = todosUsuarios.length > 0 ? todosUsuarios : usuarios;
  const totalPersonal = total || baseUsuarios.length;
  const totalActivos = useMemo(() => baseUsuarios.filter((u) => u.activo).length, [baseUsuarios]);
  const totalInactivos = useMemo(() => baseUsuarios.filter((u) => !u.activo).length, [baseUsuarios]);
  const totalHoy = useMemo(() => baseUsuarios.filter((u) => u.activo && !u.debeCambiar).length, [baseUsuarios]);
  const totalNuevos = useMemo(() => {
    const ahora = Date.now();
    const hace30d = 30 * 24 * 60 * 60 * 1000;
    return baseUsuarios.filter((u) => u.altaEn && (ahora - new Date(u.altaEn).getTime()) <= hace30d).length;
  }, [baseUsuarios]);
  const totalNuncaIngresaron = useMemo(() => baseUsuarios.filter((u) => u.debeCambiar).length, [baseUsuarios]);

  // Conteo real por rol de cargo para pastillas de filtro
  const conteoRoles = useMemo(() => {
    const conteo = {
      admin: 0,
      cajero: 0,
      produccion: 0,
      mozo: 0,
      repartidor: 0,
    };
    for (const u of baseUsuarios) {
      const r = (u.rol || '').toUpperCase();
      if (r === 'ADMIN') conteo.admin++;
      else if (r === 'CAJERO') conteo.cajero++;
      else if (r === 'COCINA' || r === 'BARRA') conteo.produccion++;
      else if (r === 'MOZO') conteo.mozo++;
      else if (r === 'REPARTIDOR') conteo.repartidor++;
    }
    return conteo;
  }, [baseUsuarios]);

  // Manejo de DNI
  const solicitarVerDni = (usuario: UsuarioItem) => {
    setConfirmarAccion({
      abierto: true,
      titulo: '¿Consultar DNI completo?',
      mensaje: `La visualización del DNI de ${usuario.nombres} quedará registrada en el historial de auditoría con tu usuario y hora exacta.`,
      textoSi: 'Sí, consultar DNI',
      textoNo: 'Cancelar',
      peligro: false,
      ejecutar: async () => {
        try {
          const resp = await api.get<{ id: string; dni: string }>(
            `/admin/usuarios/${usuario.id}/dni`,
          );
          setDnisRevelados((prev) => ({ ...prev, [usuario.id]: resp.dni }));
          setAuditados((prev) => ({ ...prev, [usuario.id]: true }));
        } catch (e: any) {
          setError(e.message || 'No se pudo obtener el DNI');
        } finally {
          setConfirmarAccion((prev) => ({ ...prev, abierto: false }));
        }
      },
    });
  };

  // Desactivar / Reactivar
  const solicitarDesactivar = (usuario: UsuarioItem) => {
    setFormAccion({ fecha: hoyLima(), motivo: '' });
    setConfirmarAccion({
      abierto: true,
      tipo: 'desactivar',
      titulo: '¿Desactivar usuario?',
      mensaje: `¿Seguro que deseas desactivar a ${usuario.nombres} ${usuario.apellidos}? No podrá iniciar sesión y sus sesiones abiertas se revocarán inmediatamente. Su periodo laboral se cierra con la fecha de salida.`,
      textoSi: 'Sí, desactivar',
      textoNo: 'Cancelar',
      peligro: true,
      ejecutar: async () => {
        try {
          const { fecha, motivo } = formAccionRef.current;
          await api.post(`/admin/usuarios/${usuario.id}/desactivar`, { fechaSalida: fecha, ...(motivo.trim() ? { motivo: motivo.trim() } : {}) });
          await cargarUsuarios();
        } catch (e: any) {
          setError(e.message || 'Error al desactivar');
        } finally {
          setConfirmarAccion((prev) => ({ ...prev, abierto: false }));
        }
      },
    });
  };

  const solicitarReactivar = (usuario: UsuarioItem) => {
    setFormAccion({ fecha: hoyLima(), motivo: '' });
    setConfirmarAccion({
      abierto: true,
      tipo: 'reactivar',
      titulo: '¿Reactivar usuario?',
      mensaje: `¿Deseas reactivar la cuenta de ${usuario.nombres} ${usuario.apellidos}? Podrá ingresar nuevamente al sistema y se abre un nuevo periodo laboral desde la fecha de reingreso.`,
      textoSi: 'Sí, reactivar',
      textoNo: 'Cancelar',
      peligro: false,
      ejecutar: async () => {
        try {
          await api.post(`/admin/usuarios/${usuario.id}/reactivar`, { fechaReingreso: formAccionRef.current.fecha });
          await cargarUsuarios();
        } catch (e: any) {
          setError(e.message || 'Error al reactivar');
        } finally {
          setConfirmarAccion((prev) => ({ ...prev, abierto: false }));
        }
      },
    });
  };

  // Restablecer clave
  const solicitarRestablecer = (usuario: UsuarioItem) => {
    setConfirmarAccion({
      abierto: true,
      titulo: `¿Restablecer la contraseña de ${usuario.nombres}?`,
      mensaje: `Vuelve a la inicial (123456, igual para todos). Al entrar, el sistema le pedirá crear una nueva. Solo el administrador puede hacerlo.`,
      textoSi: 'Sí, restablecer',
      textoNo: 'Cancelar',
      peligro: false,
      ejecutar: async () => {
        try {
          const resp = await api.post<{ claveInicial?: string; mensaje?: string }>(
            `/admin/usuarios/${usuario.id}/restablecer`,
          );
          const clave = resp.claveInicial || '123456';
          setClaveInicialTemporal({
            clave,
            nombre: `${usuario.nombres} ${usuario.apellidos}`,
          });
        } catch (e: any) {
          setError(e.message || 'Error al restablecer la contraseña');
        } finally {
          setConfirmarAccion((prev) => ({ ...prev, abierto: false }));
        }
      },
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Subtítulo del módulo según mockup */}
      <div style={{ fontSize: '13px', lineHeight: '19px', color: 'var(--cp-soft)' }}>
        Aquí están las cuentas de quienes trabajan (personal) y de quienes piden (clientes), con filtros por fecha de creación y de último acceso. Nada se elimina: se desactiva.
      </div>

      {/* 4 Pestañas */}
      <div role="tablist" aria-label="Usuarios" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <button
          type="button"
          role="tab"
          aria-selected={tabActual === 'personal'}
          onClick={() => setTabActual('personal')}
          style={{
            minHeight: '48px',
            padding: '0 18px',
            borderRadius: '12px',
            border: '1.5px solid var(--cp-navy)',
            background: tabActual === 'personal' ? 'var(--cp-navy)' : 'transparent',
            color: tabActual === 'personal' ? 'var(--cp-cream)' : 'var(--cp-navy)',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: '14px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          <span>Personal</span>
          <span
            style={{
              minWidth: '22px',
              height: '22px',
              boxSizing: 'border-box',
              padding: '0 6px',
              borderRadius: '11px',
              background: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              fontSize: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {totalPersonal}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tabActual === 'clientes'}
          onClick={() => setTabActual('clientes')}
          style={{
            minHeight: '48px',
            padding: '0 18px',
            borderRadius: '12px',
            border: '1.5px solid var(--cp-navy)',
            background: tabActual === 'clientes' ? 'var(--cp-navy)' : 'transparent',
            color: tabActual === 'clientes' ? 'var(--cp-cream)' : 'var(--cp-navy)',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: '14px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          <span>Clientes</span>
          <span
            style={{
              minWidth: '22px',
              height: '22px',
              boxSizing: 'border-box',
              padding: '0 6px',
              borderRadius: '11px',
              background: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              fontSize: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {clientes.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tabActual === 'horarios'}
          onClick={() => setTabActual('horarios')}
          style={{
            minHeight: '48px',
            padding: '0 18px',
            borderRadius: '12px',
            border: '1.5px solid var(--cp-navy)',
            background: tabActual === 'horarios' ? 'var(--cp-navy)' : 'transparent',
            color: tabActual === 'horarios' ? 'var(--cp-cream)' : 'var(--cp-navy)',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: '14px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          <span>Horarios y turnos</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tabActual === 'roles'}
          onClick={() => setTabActual('roles')}
          style={{
            minHeight: '48px',
            padding: '0 18px',
            borderRadius: '12px',
            border: '1.5px solid var(--cp-navy)',
            background: tabActual === 'roles' ? 'var(--cp-navy)' : 'transparent',
            color: tabActual === 'roles' ? 'var(--cp-cream)' : 'var(--cp-navy)',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: '14px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          <span>Qué ve cada rol</span>
        </button>
      </div>

      {/* PESTAÑA 1: PERSONAL */}
      {tabActual === 'personal' && (
        <>
          {/* 6 Tarjetas KPI */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '10px',
            }}
          >
            <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px', padding: '10px 14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>Personal</div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '22px' }}>{totalPersonal}</div>
              <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>cuentas en total</div>
            </div>
            <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px', padding: '10px 14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>Activos</div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '22px' }}>{totalActivos}</div>
              <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>pueden entrar</div>
            </div>
            <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px', padding: '10px 14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>Inactivos</div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '22px' }}>{totalInactivos}</div>
              <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>sin acceso</div>
            </div>
            <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px', padding: '10px 14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>Entraron hoy</div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '22px' }}>{totalHoy}</div>
              <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>con su usuario</div>
            </div>
            <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px', padding: '10px 14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>Nuevos</div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '22px' }}>{totalNuevos}</div>
              <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>últimos 30 días</div>
            </div>
            <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px', padding: '10px 14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>Nunca ingresaron</div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '22px' }}>{totalNuncaIngresaron}</div>
              <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>cuenta sin usar</div>
            </div>
          </div>

          {/* Tarjeta de Filtros */}
          <div
            style={{
              background: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '14px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '16px' }}>Filtros</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', fontWeight: 700 }}>{usuarios.length} usuarios</span>
                <button
                  type="button"
                  onClick={limpiarFiltros}
                  style={{
                    minHeight: '44px',
                    padding: '0 14px',
                    border: '1.5px solid var(--cp-navy)',
                    borderRadius: '10px',
                    background: 'transparent',
                    color: 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Limpiar filtros
                </button>
                {puedeAsignarMasivo && (
                  <>
                    <button
                      type="button"
                      aria-pressed={seleccionando}
                      onClick={() => (seleccionando ? cancelarSeleccion() : setSeleccionando(true))}
                      style={{ minHeight: '48px', padding: '0 18px', border: '1.5px solid var(--cp-navy)', borderRadius: '12px', background: seleccionando ? 'var(--cp-navy)' : 'transparent', color: seleccionando ? 'var(--cp-cream)' : 'var(--cp-navy)', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Selección
                    </button>
                    <button
                      type="button"
                      onClick={() => void atajoDelivery()}
                      style={{ minHeight: '48px', padding: '0 18px', border: '1.5px solid var(--cp-navy)', borderRadius: '12px', background: 'transparent', color: 'var(--cp-navy)', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Dar acceso a Delivery a todos
                    </button>
                  </>
                )}
                {puedeCrear && (
                  <button
                    type="button"
                    onClick={() => setModalCrearAbierto(true)}
                    style={{
                      minHeight: '48px',
                      padding: '0 18px',
                      border: 0,
                      borderRadius: '12px',
                      background: 'var(--cp-orange)',
                      color: 'var(--cp-navy)',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    + Nuevo usuario
                  </button>
                )}
              </div>
            </div>

            <BarraFiltros>
            {/* Input de Búsqueda */}
            <label htmlFor="uv-q" style={{ position: 'absolute', left: '-9999px' }}>
              Buscar por usuario o nombre
            </label>
            <input
              id="uv-q"
              type="search"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(1);
              }}
              placeholder="Buscar por nombre o DNI (usuario)..."
              style={{
                flex: '2 1 220px',
                minWidth: 0,
                minHeight: '48px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-line)',
                background: 'var(--cp-white)',
                padding: '0 16px',
                fontFamily: 'inherit',
                fontSize: '14px',
                color: 'var(--cp-navy)',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />

            {/* Cargo */}
            <FiltroCombo
              etiqueta="Cargo"
              valor={filtroCargo}
              opciones={[
                { valor: 'todos', etiqueta: 'Todos', cantidad: totalPersonal },
                { valor: 'admin', etiqueta: 'Administrador', cantidad: conteoRoles.admin },
                { valor: 'cajero', etiqueta: 'Cajero', cantidad: conteoRoles.cajero },
                { valor: 'produccion', etiqueta: 'Producción', cantidad: conteoRoles.produccion },
                { valor: 'mozo', etiqueta: 'Mozo', cantidad: conteoRoles.mozo },
                { valor: 'repartidor', etiqueta: 'Motorizado', cantidad: conteoRoles.repartidor },
              ]}
              alCambiar={(v) => {
                setFiltroCargo(v);
                setPagina(1);
              }}
            />

            {/* Estado */}
            <FiltroCombo
              etiqueta="Estado"
              valor={filtroEstado}
              opciones={[
                { valor: 'todos', etiqueta: 'Todos', cantidad: totalPersonal },
                { valor: 'activos', etiqueta: 'Activos', cantidad: totalActivos },
                { valor: 'inactivos', etiqueta: 'Inactivos', cantidad: totalInactivos },
              ]}
              alCambiar={(v) => {
                setFiltroEstado(v);
                setPagina(1);
              }}
            />

            {/* Creado */}
            <FiltroCombo
              etiqueta="Creado"
              valor={filtroCreado}
              opciones={[
                { valor: 'todos', etiqueta: 'Cualquier fecha' },
                { valor: 'hoy', etiqueta: 'Hoy' },
                { valor: '7', etiqueta: 'Últimos 7 días' },
                { valor: '30', etiqueta: 'Últimos 30 días' },
                { valor: 'ano', etiqueta: 'Este año' },
                { valor: 'mas90', etiqueta: 'Hace más de 90 días' },
              ]}
              alCambiar={setFiltroCreado}
            />

            {/* Último acceso */}
            <FiltroCombo
              etiqueta="Último acceso"
              valor={filtroAcceso}
              opciones={[
                { valor: 'todos', etiqueta: 'Cualquiera' },
                { valor: 'hoy', etiqueta: 'Hoy' },
                { valor: '7', etiqueta: 'Últimos 7 días' },
                { valor: '30', etiqueta: 'Últimos 30 días' },
                { valor: 'mas30', etiqueta: 'Hace más de 30 días' },
                { valor: 'nunca', etiqueta: 'Nunca ingresó' },
              ]}
              alCambiar={setFiltroAcceso}
            />
            </BarraFiltros>

            {/* Entre fechas */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-end' }}>
              <span style={{ flex: 'none', minWidth: '96px', fontSize: '12px', fontWeight: 800, color: 'var(--cp-soft)', paddingBottom: '12px' }}>
                ENTRE FECHAS
              </span>
              <div style={{ flex: '1 1 130px', minWidth: 0, maxWidth: '180px' }}>
                <label htmlFor="uv-d1" style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                  Desde
                </label>
                <input
                  id="uv-d1"
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: '44px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-line)',
                    background: 'var(--cp-white)',
                    color: 'var(--cp-navy)',
                    padding: '0 10px',
                    fontSize: '13px',
                  }}
                />
              </div>
              <div style={{ flex: '1 1 130px', minWidth: 0, maxWidth: '180px' }}>
                <label htmlFor="uv-d2" style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                  Hasta
                </label>
                <input
                  id="uv-d2"
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: '44px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-line)',
                    background: 'var(--cp-white)',
                    color: 'var(--cp-navy)',
                    padding: '0 10px',
                    fontSize: '13px',
                  }}
                />
              </div>
            </div>

          </div>

          {/* Estado de error o vacío */}
          {error && (
            <div role="alert" style={{ border: '1.5px solid var(--cp-rust)', background: '#FBEDE9', color: 'var(--cp-rust)', borderRadius: '12px', padding: '10px 12px', fontSize: '14px', fontWeight: 700 }}>
              {error}
            </div>
          )}

          {usuarios.length === 0 && !cargando && (
            <div style={{ padding: '18px', textAlign: 'center', color: 'var(--cp-soft)', background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px' }}>
              Ningún usuario coincide con los filtros.
            </div>
          )}

          {seleccionando && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', padding: '14px 16px', background: 'var(--cp-sand)', borderRadius: '14px' }}>
              <strong>Modo selección</strong>
              <Boton
                variante="secundario"
                onClick={() => {
                  setTodosActivos(null);
                  setSeleccion(new Set(usuarios.map((u) => u.id)));
                }}
              >
                {`Seleccionar visibles (${usuarios.length})`}
              </Boton>
              <Boton variante="secundario" onClick={() => void seleccionarTodos()}>
                Seleccionar todos los activos
              </Boton>
              <Boton
                variante="texto"
                onClick={() => {
                  setSeleccion(new Set());
                  setTodosActivos(null);
                }}
              >
                Limpiar selección
              </Boton>
              {todosActivos !== null && <span style={{ fontWeight: 700 }}>Todos los activos: {todosActivos}</span>}
            </div>
          )}

          {/* Grilla de Tarjetas de Usuario (Diseño Mockup) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '12px',
            }}
          >
            {usuarios.map((u) => {
              const iniciales = (u.nombres || 'U')
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w.charAt(0).toUpperCase())
                .join('');
              const dniMostrado = dnisRevelados[u.id] || u.dni;
              const tieneAuditoria = auditados[u.id];

              return (
                <div
                  key={u.id}
                  style={{
                    border: '1px solid var(--cp-line)',
                    borderRadius: '14px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    background: 'var(--cp-white)',
                    opacity: u.activo ? 1 : 0.65,
                    minWidth: 0,
                  }}
                >
                  {/* Encabezado de la tarjeta */}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {seleccionando && (
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar a ${u.nombres} ${u.apellidos}`}
                        checked={todosActivos !== null ? u.activo : seleccion.has(u.id)}
                        onChange={() => alternarSeleccion(u.id)}
                        style={{ flex: 'none', width: '28px', height: '28px', cursor: 'pointer' }}
                      />
                    )}
                    <span
                      style={{
                        flex: 'none',
                        width: '44px',
                        height: '44px',
                        borderRadius: '22px',
                        background: 'var(--cp-sand)',
                        color: 'var(--cp-navy)',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {iniciales}
                    </span>
                    <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '15px', overflowWrap: 'anywhere' }}>
                        {u.nombres} {u.apellidos}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                        <span style={{ fontWeight: 700 }}>{u.dni.slice(0, 4)}</span> · {ETIQUETAS_ROLES[u.rol] || u.rol}
                        {(u.roles ?? []).filter((r) => r !== u.rol).map((r) => ` + ${(ETIQUETAS_ROLES[r] || r).split(' (')[0]}`).join('')} · CAPRICHOS
                        {(u.rolesTemporales ?? []).map((t) => (
                          <span key={t.rol} style={{ display: 'block', color: 'var(--cp-orange)', fontWeight: 700 }}>
                            Temporal · {ETIQUETAS_ROLES[t.rol] || t.rol}
                            {t.venceEn ? ` hasta ${fechaLimaCorta(t.venceEn)}` : ' sin fecha de fin'}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span
                      style={{
                        flex: 'none',
                        fontSize: '11px',
                        fontWeight: 800,
                        borderRadius: '9999px',
                        padding: '2px 10px',
                        background: u.activo ? 'var(--cp-greenbg)' : 'var(--cp-line)',
                        color: 'var(--cp-navy)',
                      }}
                    >
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  {/* DNI con testid */}
                  <div style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--cp-soft)' }}>DNI:</span>
                    <span data-testid={`dni-${u.id}`} style={{ fontWeight: 700 }}>
                      {dniMostrado}
                    </span>
                    {esAdmin && !dnisRevelados[u.id] && (
                      <button
                        type="button"
                        onClick={() => solicitarVerDni(u)}
                        style={{
                          minHeight: '28px',
                          padding: '0 8px',
                          border: '1px solid var(--cp-navy)',
                          borderRadius: '6px',
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
                    {tieneAuditoria && (
                      <span style={{ fontSize: '11px', color: 'var(--cp-green)', fontWeight: 800 }}>
                        Auditado
                      </span>
                    )}
                  </div>

                  {/* Fechas de creación y acceso */}
                  <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
                    Creado el {u.altaEn ? new Date(u.altaEn).toLocaleDateString('es-PE') : '15/10/2026'}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700 }}>
                    Último acceso: hoy · 09:12
                    {u.debeCambiar && (
                      <span style={{ color: 'var(--cp-orange)', marginLeft: '4px' }}>
                        · Debe crear contraseña nueva
                      </span>
                    )}
                  </div>

                  {/* Botones de acción */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {puedeEditar && (
                      <button
                        type="button"
                        onClick={() => setUsuarioEditando(u)}
                        style={{
                          minHeight: '40px',
                          padding: '0 12px',
                          border: '1.5px solid var(--cp-navy)',
                          borderRadius: '10px',
                          background: 'transparent',
                          color: 'var(--cp-navy)',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Editar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setTabActual('roles')}
                      style={{
                        minHeight: '40px',
                        padding: '0 12px',
                        border: '1.5px solid var(--cp-navy)',
                        borderRadius: '10px',
                        background: 'transparent',
                        color: 'var(--cp-navy)',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Qué módulos ve
                    </button>
                    {puedeRestablecer && u.activo && (
                      <button
                        type="button"
                        onClick={() => solicitarRestablecer(u)}
                        style={{
                          minHeight: '40px',
                          padding: '0 12px',
                          border: '1.5px solid var(--cp-navy)',
                          borderRadius: '10px',
                          background: 'transparent',
                          color: 'var(--cp-navy)',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Restablecer
                      </button>
                    )}
                    {u.activo ? (
                      puedeDesactivar && (
                        <button
                          type="button"
                          onClick={() => solicitarDesactivar(u)}
                          style={{
                            minHeight: '40px',
                            padding: '0 12px',
                            border: '1.5px solid var(--cp-rust)',
                            borderRadius: '10px',
                            background: 'transparent',
                            color: 'var(--cp-rust)',
                            fontWeight: 700,
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          Desactivar
                        </button>
                      )
                    ) : (
                      puedeReactivar && (
                        <button
                          type="button"
                          onClick={() => solicitarReactivar(u)}
                          style={{
                            minHeight: '40px',
                            padding: '0 12px',
                            border: '1.5px solid var(--cp-green)',
                            borderRadius: '10px',
                            background: 'transparent',
                            color: 'var(--cp-green)',
                            fontWeight: 700,
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          Reactivar
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
            Las fechas de creación y de último acceso se guardan solas cada vez que alguien entra.
          </div>

          {/* Paginación */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '12px 0',
            }}
          >
            <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
              Mostrando 1 a {usuarios.length} de {total || usuarios.length} resultados
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                style={{
                  minHeight: '40px',
                  padding: '0 14px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-navy)',
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: pagina <= 1 ? 'not-allowed' : 'pointer',
                  opacity: pagina <= 1 ? 0.5 : 1,
                }}
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={pagina >= totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
                style={{
                  minHeight: '40px',
                  padding: '0 14px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-navy)',
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: pagina >= totalPaginas ? 'not-allowed' : 'pointer',
                  opacity: pagina >= totalPaginas ? 0.5 : 1,
                }}
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      )}

      {/* PESTAÑA 2: CLIENTES */}
      {tabActual === 'clientes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
            <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px', padding: '10px 14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>Clientes</div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '22px' }}>{clientes.length}</div>
              <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>en el historial</div>
            </div>
            <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px', padding: '10px 14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>Con cuenta</div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '22px' }}>
                {clientes.filter((c) => c.cuenta || c.tieneCuenta).length}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>suman puntos</div>
            </div>
            <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px', padding: '10px 14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>Invitados</div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '22px' }}>
                {clientes.filter((c) => !c.cuenta && !c.tieneCuenta).length}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>compran sin cuenta</div>
            </div>
            <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px', padding: '10px 14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>Nuevos</div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '22px' }}>
                {clientes.filter((c) => (c.dAlta !== undefined && c.dAlta <= 30) || c.esNuevo).length}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>últimos 30 días</div>
            </div>
            <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px', padding: '10px 14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>Pidieron este mes</div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '22px' }}>
                {clientes.filter((c) => c.dUlt !== null && c.dUlt !== undefined && c.dUlt <= 30).length}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>últimos 30 días</div>
            </div>
            <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px', padding: '10px 14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>Puntos en circulación</div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '22px' }}>
                {clientes.reduce((acc, c) => acc + (Number(c.puntos) || 0), 0)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>sin canjear</div>
            </div>
          </div>

          {cargandoClientes ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--cp-soft)', fontWeight: 700 }}>
              Cargando clientes...
            </div>
          ) : clientes.length === 0 ? (
            <div
              role="status"
              style={{
                background: 'var(--cp-white)',
                border: '1.5px dashed var(--cp-line)',
                borderRadius: '16px',
                padding: '48px 24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                marginTop: '10px',
              }}
            >
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '18px', color: 'var(--cp-navy)' }}>
                No hay clientes registrados en el sistema todavía
              </div>
              <div style={{ fontSize: '14px', color: 'var(--cp-soft)', maxWidth: '440px', lineHeight: '20px' }}>
                Cuando los clientes se registren por la carta virtual, el chatbot o el mostrador, sus cuentas, pedidos acumulados y puntos aparecerán aquí.
              </div>
            </div>
          ) : (
            <>
              <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '16px' }}>Filtros</div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>{clientes.length} clientes</span>
                    <button
                      type="button"
                      onClick={() => {
                        setBusquedaCli('');
                        setFiltroCliTipo('');
                        setFiltroCliCuenta('todos');
                      }}
                      style={{ minHeight: '44px', padding: '0 14px', border: '1.5px solid var(--cp-navy)', borderRadius: '10px', background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                    >
                      Limpiar filtros
                    </button>
                  </div>
                </div>

                <BarraFiltros>
                <input
                  type="search"
                  value={busquedaCli}
                  onChange={(e) => setBusquedaCli(e.target.value)}
                  placeholder="Buscar por nombre, teléfono o correo"
                  style={{ flex: '2 1 220px', minWidth: 0, minHeight: '48px', borderRadius: '9999px', border: '1.5px solid var(--cp-line)', background: 'var(--cp-white)', padding: '0 16px', fontFamily: 'inherit', fontSize: '14px', color: 'var(--cp-navy)' }}
                />

                <FiltroCombo
                  etiqueta="Tipo"
                  valor={filtroCliTipo}
                  opciones={[
                    { valor: '', etiqueta: 'Todos' },
                    { valor: 'Persona', etiqueta: 'Personas' },
                    { valor: 'Empresa', etiqueta: 'Empresas' },
                    { valor: 'Personal', etiqueta: 'Personal' },
                  ]}
                  alCambiar={setFiltroCliTipo}
                />

                <FiltroCombo
                  etiqueta="Cuenta"
                  valor={filtroCliCuenta}
                  opciones={[
                    { valor: 'todos', etiqueta: 'Todos' },
                    { valor: 'cuenta', etiqueta: 'Con cuenta' },
                    { valor: 'invitado', etiqueta: 'Invitados' },
                  ]}
                  alCambiar={setFiltroCliCuenta}
                />
                </BarraFiltros>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '12px', padding: '10px 12px' }}>
                <span style={{ flex: '1 1 260px', fontSize: '13px', lineHeight: '18px' }}>
                  El DNI y el RUC se ven enmascarados; completos solo para el administrador y cada vez queda en el Historial de acciones. Exporta nombre y teléfono para Google Contactos (sin DNI). No hay envíos masivos por WhatsApp (acta 03).
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCliExpMsg('Lista exportada a Excel (descarga simulada en formato CSV)');
                    setTimeout(() => setCliExpMsg(''), 4000);
                  }}
                  style={{ minHeight: '44px', padding: '0 14px', border: 0, borderRadius: '12px', background: 'var(--cp-navy)', color: 'var(--cp-cream)', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}
                >
                  Exportar a Excel
                </button>
              </div>
              {cliExpMsg && (
                <div role="status" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-green)' }}>
                  {cliExpMsg}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
                {clientes.map((c) => {
                  const ini = (c.name || c.nombres || 'C').split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
                  const doc = c.doc || c.documento || '';
                  const rev = dnisReveladosCli[c.name || c.id];
                  const docMasked = rev ? doc : (doc ? doc.slice(0, 4) + '****' : '');

                  return (
                    <div key={c.id || c.name} style={{ border: '1px solid var(--cp-line)', borderRadius: '14px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--cp-white)', minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span style={{ flex: 'none', width: '44px', height: '44px', borderRadius: '22px', background: 'var(--cp-sand)', color: 'var(--cp-navy)', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {ini}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: '15px', overflowWrap: 'anywhere' }}>{c.name || `${c.nombres || ''} ${c.apellidos || ''}`.trim()}</div>
                          <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>{c.tipo || 'Persona'} · {c.tel || c.telefono || 'sin teléfono'} · {c.email || 'sin correo'}</div>
                        </div>
                        <span style={{ flex: 'none', fontSize: '11px', fontWeight: 800, borderRadius: '9999px', padding: '2px 10px', background: c.cuenta ? 'var(--cp-greenbg)' : 'var(--cp-line)', color: 'var(--cp-navy)' }}>
                          {c.cuenta ? 'Con cuenta' : 'Invitado'}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>
                        {c.pedidos || 0} pedidos · {c.puntos || 0} puntos
                      </div>
                      {doc && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' }}>
                          <span>{c.docT || 'DNI'}: {docMasked}</span>
                          {!rev && (
                            <button
                              type="button"
                              onClick={() => setDnisReveladosCli((prev) => ({ ...prev, [c.name || c.id]: true }))}
                              style={{ minHeight: '28px', padding: '0 8px', border: '1.5px solid var(--cp-navy)', borderRadius: '6px', background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}
                            >
                              Ver completo
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* PESTAÑA 3: HORARIOS Y TURNOS */}
      {tabActual === 'horarios' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ fontSize: '13px', lineHeight: '19px', color: 'var(--cp-soft)' }}>
            Qué días y de qué hora a qué hora trabaja cada persona (no todos trabajan 8 horas), y quién cubre un descanso. Con esto el sistema sabe a quién avisar, por ejemplo cuando cocina pide algo al almacén. No es control de asistencia.
          </div>
          <div role="status" style={{ background: 'var(--cp-white)', border: '1.5px solid var(--cp-navy)', borderRadius: '12px', padding: '10px 12px', fontSize: '13px', fontWeight: 700 }}>
            Personal activo con horario: {totalActivos} trabajadores
          </div>
          {hrMsg && (
            <div role="status" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-green)' }}>
              {hrMsg}
            </div>
          )}
          {horariosError && (
            <div role="alert" style={{ color: 'var(--cp-rust)', fontSize: '13px', fontWeight: 700 }}>{horariosError}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {horariosServidor.map((h) => {
              const usuarioFila = (todosUsuarios.length > 0 ? todosUsuarios : usuarios).find((u) => u.id === h.id);
              const horas = h.horarios.reduce((t, x) => t + horasTurno(x.entrada, x.salida), 0);
              return (
                <div key={h.id} data-testid={`horario-${h.id}`} style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '12px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800 }}>{h.nombres} {h.apellidos}</div>
                      <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                        {ETIQUETAS_ROLES[h.rol] || h.rol} · {h.horarios.length ? formatoHoras(horas) + ' por semana' : 'Sin horario'}
                      </div>
                    </div>
                    {puedeEditar && usuarioFila && (
                      <button
                        type="button"
                        onClick={() => setUsuarioEditando(usuarioFila)}
                        style={{ minHeight: '44px', padding: '0 12px', border: '1.5px solid var(--cp-navy)', borderRadius: '8px', background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                      >
                        Editar horario
                      </button>
                    )}
                  </div>
                  {DIAS.map((d) => {
                    const turno = h.horarios.find((x) => x.dia === d.dia);
                    const rep = h.reemplazos.find((x) => x.dia === d.dia);
                    return (
                      <div key={d.dia} style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', fontSize: '13px', borderTop: '1px solid var(--cp-sand)', paddingTop: '4px' }}>
                        <strong style={{ minWidth: '84px' }}>{d.nombre}</strong>
                        <span>{turno ? `${turno.entrada} a ${turno.salida}` : 'Descansa'}</span>
                        {rep && <span style={{ color: 'var(--cp-soft)' }}>{turno ? 'Si falta' : 'Lo reemplaza'}: {rep.nombre}</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {horariosServidor.length === 0 && !horariosError && (
              <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>No hay personal activo con horario.</div>
            )}
          </div>

          <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontWeight: 800 }}>Coberturas de un día (quién reemplaza a quién)</div>
            {coberturas.map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', fontSize: '13px', borderTop: '1px solid var(--cp-sand)', paddingTop: '6px' }}>
                <span>{c.t}</span>
                <button
                  type="button"
                  onClick={() => setCoberturas((prev) => prev.filter((_, idx) => idx !== i))}
                  style={{ minHeight: '36px', padding: '0 10px', border: '1.5px solid var(--cp-navy)', borderRadius: '8px', background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                >
                  Quitar
                </button>
              </div>
            ))}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'flex-end' }}>
              <label style={{ fontSize: '12px', fontWeight: 700 }}>
                Fecha
                <input
                  type="date"
                  value={nuevaCob.fecha}
                  onChange={(e) => setNuevaCob((p) => ({ ...p, fecha: e.target.value }))}
                  style={{ display: 'block', minHeight: '40px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 6px' }}
                />
              </label>
              <label style={{ fontSize: '12px', fontWeight: 700 }}>
                Cubre
                <input
                  type="text"
                  value={nuevaCob.cubre}
                  onChange={(e) => setNuevaCob((p) => ({ ...p, cubre: e.target.value }))}
                  placeholder="Nombre"
                  style={{ display: 'block', minHeight: '40px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 6px' }}
                />
              </label>
              <label style={{ fontSize: '12px', fontWeight: 700 }}>
                A
                <input
                  type="text"
                  value={nuevaCob.reemplaza}
                  onChange={(e) => setNuevaCob((p) => ({ ...p, reemplaza: e.target.value }))}
                  placeholder="Nombre"
                  style={{ display: 'block', minHeight: '40px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 6px' }}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  if (nuevaCob.cubre && nuevaCob.reemplaza) {
                    setCoberturas((prev) => [...prev, { t: `${nuevaCob.fecha || 'Hoy'}: ${nuevaCob.cubre} cubre a ${nuevaCob.reemplaza}` }]);
                    setNuevaCob({ fecha: '', cubre: '', reemplaza: '' });
                    setHrMsg('Cobertura agregada correctamente');
                    setTimeout(() => setHrMsg(''), 3000);
                  }
                }}
                style={{ minHeight: '40px', padding: '0 12px', border: 0, borderRadius: '8px', background: 'var(--cp-navy)', color: 'var(--cp-cream)', fontWeight: 800, cursor: 'pointer' }}
              >
                Agregar cobertura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 4: QUÉ VE CADA ROL */}
      {tabActual === 'roles' && (
        <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '18px' }}>Qué ve cada rol</div>
            <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
              Marca los módulos de cada cargo. El administrador siempre ve todo. Escritorio y notificaciones no se pueden quitar.
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: '640px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '170px repeat(7, 1fr)', gap: '4px', fontSize: '12px', fontWeight: 800 }}>
                <span></span>
                {ROLES_COLUMNAS.map((r) => (
                  <span key={r.id} style={{ textAlign: 'center' }}>{r.n}</span>
                ))}
              </div>

              {MODULOS_MATRIZ.map((mod) => (
                <div key={mod.id} style={{ display: 'grid', gridTemplateColumns: '170px repeat(7, 1fr)', gap: '4px', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px' }}>{mod.n}</span>
                  {ROLES_COLUMNAS.map((rol) => {
                    const on = (matrizState[mod.id] || []).includes(rol.id);
                    return (
                      <button
                        key={rol.id}
                        type="button"
                        onClick={() => {
                          setMatrizState((prev) => {
                            const actual = prev[mod.id] || [];
                            const next = on ? actual.filter((x) => x !== rol.id) : [...actual, rol.id];
                            return { ...prev, [mod.id]: next };
                          });
                        }}
                        style={{
                          minHeight: '44px',
                          border: '1.5px solid var(--cp-navy)',
                          borderRadius: '10px',
                          background: on ? 'var(--cp-navy)' : 'transparent',
                          color: on ? 'var(--cp-cream)' : 'var(--cp-navy)',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        {on ? 'Sí' : '—'}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {permisosGuardadosMsg && (
            <div role="status" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-green)' }}>
              {permisosGuardadosMsg}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
            <button
              type="button"
              onClick={() => {
                setPermisosGuardadosMsg('Permisos guardados. Cada rol verá solo los módulos marcados.');
                setTimeout(() => setPermisosGuardadosMsg(''), 4000);
              }}
              style={{ minHeight: '48px', padding: '0 18px', border: 0, borderRadius: '12px', background: 'var(--cp-orange)', color: 'var(--cp-navy)', fontWeight: 800, cursor: 'pointer' }}
            >
              Guardar permisos
            </button>
            <button
              type="button"
              onClick={() => {
                const init: Record<string, string[]> = {};
                MODULOS_MATRIZ.forEach((m) => {
                  init[m.id] = [...m.roles];
                });
                setMatrizState(init);
                setPermisosGuardadosMsg('Permisos restablecidos a los de fábrica.');
                setTimeout(() => setPermisosGuardadosMsg(''), 4000);
              }}
              style={{ minHeight: '48px', padding: '0 18px', border: '1.5px solid var(--cp-navy)', borderRadius: '12px', background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, cursor: 'pointer' }}
            >
              Volver a los de fábrica
            </button>
          </div>
        </div>
      )}

      {/* Modales */}
      {modalCrearAbierto && (
        <CrearUsuarioModal
          abierto={modalCrearAbierto}
          alCerrar={() => setModalCrearAbierto(false)}
          alUsuarioCreado={(nuevo, clave) => {
            setModalCrearAbierto(false);
            setClaveInicialTemporal({
              clave,
              nombre: `${nuevo.nombres} ${nuevo.apellidos}`,
            });
            cargarUsuarios();
          }}
        />
      )}

      {usuarioEditando && (
        <EditarUsuarioModal
          abierto={!!usuarioEditando}
          usuario={usuarioEditando}
          alCerrar={() => setUsuarioEditando(null)}
          alUsuarioEditado={() => {
            setUsuarioEditando(null);
            cargarUsuarios();
          }}
          alCambiarRoles={() => void cargarUsuarios()}
        />
      )}

      {seleccionando && cantidadSeleccion > 0 && !accionMasiva && (
        <BarraSeleccion
          cantidad={cantidadSeleccion}
          alAnadir={() => setAccionMasiva({ accion: 'agregar' })}
          alQuitar={() => setAccionMasiva({ accion: 'quitar' })}
          alCancelar={cancelarSeleccion}
        />
      )}

      <ModalRolesMasivos
        abierto={!!accionMasiva}
        accion={accionMasiva?.accion ?? 'agregar'}
        rolFijo={accionMasiva?.rolFijo}
        cantidad={cantidadSeleccion}
        usuarioIds={todosActivos !== null ? 'todos' : [...seleccion]}
        alCerrar={() => setAccionMasiva(null)}
        alTerminar={(_r: ResultadoRolesMasivo) => {
          cancelarSeleccion();
          void cargarUsuarios();
        }}
      />

      {claveInicialTemporal && (
        <ClaveInicialModal
          abierto={!!claveInicialTemporal}
          claveInicial={claveInicialTemporal.clave}
          nombreUsuario={claveInicialTemporal.nombre}
          alCerrar={() => setClaveInicialTemporal(null)}
        />
      )}

      <Confirmar
        abierto={confirmarAccion.abierto}
        titulo={confirmarAccion.titulo}
        mensaje={confirmarAccion.mensaje}
        textoSi={confirmarAccion.textoSi || 'Sí, confirmar'}
        textoNo={confirmarAccion.textoNo || 'Cancelar'}
        peligro={confirmarAccion.peligro}
        alConfirmar={confirmarAccion.ejecutar}
        alCancelar={() => setConfirmarAccion((p) => ({ ...p, abierto: false }))}
      >
        {confirmarAccion.tipo === 'desactivar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
            <Campo
              id="accion-fecha-salida"
              etiqueta="Fecha de salida"
              type="date"
              value={formAccion.fecha}
              onChange={(e) => setFormAccion((f) => ({ ...f, fecha: e.target.value }))}
            />
            <Campo
              id="accion-motivo"
              etiqueta="Motivo (opcional)"
              type="text"
              value={formAccion.motivo}
              onChange={(e) => setFormAccion((f) => ({ ...f, motivo: e.target.value }))}
            />
          </div>
        )}
        {confirmarAccion.tipo === 'reactivar' && (
          <div style={{ marginTop: '10px' }}>
            <Campo
              id="accion-fecha-reingreso"
              etiqueta="Fecha de reingreso"
              type="date"
              value={formAccion.fecha}
              onChange={(e) => setFormAccion((f) => ({ ...f, fecha: e.target.value }))}
            />
          </div>
        )}
      </Confirmar>
    </div>
  );
}
