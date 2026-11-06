import { useCallback, useEffect, useState, useMemo } from 'react';
import { useSesion } from '../../comun/sesion';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { Confirmar } from '../../comun/Confirmar';
import { PisoSalon, Reserva } from './tipos';
import { ModalFormularioReserva } from './componentes/ModalFormularioReserva';
import { ModalNuevoPedidoMesa } from './componentes/ModalNuevoPedidoMesa';
import { ConfirmarAprobacionSolicitud } from './componentes/ConfirmarAprobacionSolicitud';
import { etiquetaMesas } from './componentes/SelectorMesasCroquis';
import { hoyLima, partesLima } from './fechaLima';
import { useSalonSocket } from './useSalonSocket';
import { salonApi } from './api';
import { BarraFiltros, FiltroCombo } from '../../comun/FiltroCombo';

export interface SolicitudWhatsApp {
  id: string;
  nombre: string;
  tel: string;
  personas: number;
  /** Hora de la solicitud en Lima (HH:mm). */
  hora: string;
  /** Fecha de la solicitud en Lima (YYYY-MM-DD). */
  fecha: string;
  /** Instante original de la solicitud (ISO). */
  horaIso: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  mesa?: string;
  mesasIds?: string[];
}

function partesSolicitud(horaIso: string | null | undefined) {
  return { horaIso: horaIso || '', ...partesLima(horaIso) };
}

/** Texto de la insignia de una reserva. NO_ASISTIO es «No llegó» (la mesa ya no está retenida). */
function etiquetaEstadoReserva(estado: string): string {
  if (estado === 'SENTADA') return 'Atendida';
  if (estado === 'CANCELADA') return 'Cancelada';
  if (estado === 'NO_ASISTIO') return 'No llegó';
  return 'Confirmada';
}

export function ReservasView() {
  const { tiene } = useSesion();
  const puedeVer = tiene('reservas/ver');
  const puedeCrear = tiene('reservas/crear');
  const puedeEditar = tiene('reservas/editar');

  // Mesas del salón
  const [pisosSalon, setPisosSalon] = useState<PisoSalon[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);

  // Reservas del backend
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [agendaReservas, setAgendaReservas] = useState<Reserva[]>([]);
  const [recargarKey, setRecargarKey] = useState(0);

  // Solicitudes por WhatsApp
  const [solicitudes, setSolicitudes] = useState<SolicitudWhatsApp[]>([]);

  // Selección de fecha en calendario (por defecto hoy)
  const [hoyY, hoyM, hoyD] = hoyLima().split('-').map(Number);
  const [mesActual, setMesActual] = useState<{ y: number; m: number }>({
    y: hoyY,
    m: hoyM - 1,
  });
  const [diaSeleccionado, setDiaSeleccionado] = useState<number>(hoyD);

  // Búsqueda y filtros de tabla
  const [busquedaTabla, setBusquedaTabla] = useState('');
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroPersonas, setFiltroPersonas] = useState<string>('todos');

  // Modales
  const [modalFormularioAbierto, setModalFormularioAbierto] = useState(false);
  const [reservaParaEditar, setReservaParaEditar] = useState<Reserva | null>(null);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);

  const [modalNuevoPedidoAbierto, setModalNuevoPedidoAbierto] = useState(false);
  const [mesasParaPedido, setMesasParaPedido] = useState<string[]>([]);
  const [reservaIdParaPedido, setReservaIdParaPedido] = useState<string | undefined>(undefined);

  // Confirmaciones Sí/No
  const [confirmarAprobarSol, setConfirmarAprobarSol] = useState<SolicitudWhatsApp | null>(null);
  const [confirmarRechazarSol, setConfirmarRechazarSol] = useState<SolicitudWhatsApp | null>(null);
  const [errorRechazo, setErrorRechazo] = useState<string | null>(null);
  const [confirmarCancelarReserva, setConfirmarCancelarReserva] = useState<Reserva | null>(null);
  const [confirmarSentarReserva, setConfirmarSentarReserva] = useState<Reserva | null>(null);

  // Cargar mesas y reservas
  const cargarDatos = useCallback(async () => {
    try {
      setErrorGlobal(null);
      const diaIso = `${mesActual.y}-${String(mesActual.m + 1).padStart(2, '0')}-${String(diaSeleccionado).padStart(2, '0')}`;
      const mesIso = `${mesActual.y}-${String(mesActual.m + 1).padStart(2, '0')}`;

      const resMesas = salonApi.obtenerMesas ? await Promise.resolve(salonApi.obtenerMesas()).catch(() => null) : null;
      const resAgenda = salonApi.agenda ? await Promise.resolve(salonApi.agenda(diaIso)).catch(() => null) : null;
      const resReservas = salonApi.listarReservas ? await Promise.resolve(salonApi.listarReservas()).catch(() => null) : null;
      const resSolicitudes = salonApi.listarSolicitudes ? await Promise.resolve(salonApi.listarSolicitudes()).catch(() => null) : null;
      if (salonApi.calendario) {
        await Promise.resolve(salonApi.calendario(mesIso)).catch(() => null);
      }

      if (resMesas?.pisos) setPisosSalon(resMesas.pisos);
      if (Array.isArray(resAgenda)) setAgendaReservas(resAgenda);
      if (Array.isArray(resReservas)) setReservas(resReservas);
      if (Array.isArray(resSolicitudes)) {
        setSolicitudes(
          resSolicitudes.map((s: any) => ({
            id: s.id,
            nombre: s.nombre || 'Cliente',
            tel: s.telefono || '',
            personas: s.personas || 2,
            ...partesSolicitud(s.hora),
            estado: s.estado || 'pendiente',
            mesa: s.mesa || undefined,
            mesasIds: s.mesasIds || [],
          })),
        );
      }
    } catch (err: any) {
      setErrorGlobal(err?.message || 'No fue posible cargar las reservas del local.');
    } finally {
      setCargando(false);
    }
  }, [mesActual.y, mesActual.m, diaSeleccionado]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos, recargarKey]);

  // Socket en tiempo real
  const { avisoListo, cerrarAvisoListo } = useSalonSocket({
    onReservaCambio: () => {
      cargarDatos();
    },
    onMesaCambio: () => {
      salonApi
        .obtenerMesas()
        .then((res) => {
          if (res?.pisos) setPisosSalon(res.pisos);
        })
        .catch(() => {});
    },
  });

  const todasLasMesas = useMemo(
    () => pisosSalon.flatMap((p) => p.mesas || []).filter((m) => m.activo),
    [pisosSalon],
  );

  // Solicitudes pendientes e historial
  const solPend = useMemo(
    () => solicitudes.filter((s) => s.estado === 'pendiente'),
    [solicitudes],
  );
  const solHist = useMemo(
    () => solicitudes.filter((s) => s.estado !== 'pendiente'),
    [solicitudes],
  );

  // Días del mes para el calendario
  const RV_MES = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];
  const RV_DIAS = [
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
    'Domingo',
  ];

  const offDias = useMemo(() => {
    return (new Date(mesActual.y, mesActual.m, 1).getDay() + 6) % 7;
  }, [mesActual]);

  const numDiasEnMes = useMemo(() => {
    return new Date(mesActual.y, mesActual.m + 1, 0).getDate();
  }, [mesActual]);

  // Reservas reales de la API (sin datos inventados ni fallbacks estáticos)
  const listaTodasReservas = reservas;

  // Fecha actual formateada (YYYY-MM-DD)
  const hoyIso = useMemo(() => hoyLima(), []);

  /** Reactiva una reserva «No llegó» de hoy (el cliente llegó tarde). El servidor valida y audita. */
  const reactivarReserva = async (r: Reserva) => {
    setErrorGlobal(null);
    try {
      const actualizada = await salonApi.reactivarReserva(r.id);
      setReservas((prev) => prev.map((x) => (x.id === actualizada.id ? actualizada : x)));
    } catch (err: any) {
      setErrorGlobal(err?.message || 'No fue posible reactivar la reserva.');
    }
  };

  // Fecha seleccionada formateada (YYYY-MM-DD)
  const diaIso = useMemo(() => {
    return `${mesActual.y}-${String(mesActual.m + 1).padStart(2, '0')}-${String(diaSeleccionado).padStart(2, '0')}`;
  }, [mesActual.y, mesActual.m, diaSeleccionado]);

  // Reservas del día seleccionado
  const reservasDelDia = useMemo(() => {
    if (agendaReservas && agendaReservas.length > 0) {
      return agendaReservas;
    }
    return listaTodasReservas.filter((r) => {
      const f = partesLima(r.hora).fecha;
      return f === diaIso;
    });
  }, [agendaReservas, listaTodasReservas, diaIso]);

  // Conteo de hoy calculado desde las reservas reales
  const reservasHoyCount = useMemo(() => {
    return listaTodasReservas.filter((r) => {
      const f = partesLima(r.hora).fecha;
      return f === hoyIso && r.estado !== 'CANCELADA';
    }).length;
  }, [listaTodasReservas, hoyIso]);

  const confirmadasCount = useMemo(() => {
    return listaTodasReservas.filter(
      (r) => r.estado === 'ACTIVA' || r.estado === 'SENTADA',
    ).length;
  }, [listaTodasReservas]);

  const pendientesTablaCount = useMemo(() => {
    return listaTodasReservas.filter((r) => r.estado === 'ACTIVA').length;
  }, [listaTodasReservas]);

  // Filtrado de la tabla general
  const reservasFiltradas = useMemo(() => {
    return listaTodasReservas.filter((r) => {
      if (busquedaTabla.trim()) {
        const q = busquedaTabla.toLowerCase().trim();
        const coincide =
          r.nombre.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          r.telefono.includes(q);
        if (!coincide) return false;
      }
      if (filtroEstado !== 'todos') {
        if (filtroEstado === 'Confirmada' && r.estado !== 'ACTIVA') return false;
        if (filtroEstado === 'Atendida' && r.estado !== 'SENTADA') return false;
        if (filtroEstado === 'Cancelada' && r.estado !== 'CANCELADA') return false;
        if (filtroEstado === 'Pendiente' && r.estado !== 'ACTIVA') return false;
        if (filtroEstado === 'No llegó' && r.estado !== 'NO_ASISTIO') return false;
      }
      if (filtroPersonas !== 'todos') {
        if (String(r.personas) !== filtroPersonas) return false;
      }
      return true;
    });
  }, [listaTodasReservas, busquedaTabla, filtroEstado, filtroPersonas]);

  // Guardar (Crear o Actualizar) reserva
  const handleGuardarReserva = async (datos: {
    id?: string;
    nombre: string;
    telefono: string;
    personas: number;
    hora: string;
    mesas: string[];
  }) => {
    setErrorFormulario(null);
    try {
      if (datos.id) {
        if (!puedeEditar) throw new Error('No tienes permiso para editar reservas.');
        await salonApi.actualizarReserva(datos.id, {
          nombre: datos.nombre,
          telefono: datos.telefono,
          personas: datos.personas,
          hora: datos.hora,
          mesas: datos.mesas,
        });
      } else {
        if (!puedeCrear) throw new Error('No tienes permiso para crear reservas.');
        await salonApi.crearReserva({
          nombre: datos.nombre,
          telefono: datos.telefono,
          personas: datos.personas,
          hora: datos.hora,
          mesas: datos.mesas,
        });
      }
      setModalFormularioAbierto(false);
      setReservaParaEditar(null);
      setRecargarKey((k) => k + 1);
      await cargarDatos();
    } catch (err: any) {
      setErrorFormulario(err?.message || 'Error al guardar la reserva.');
      throw err;
    }
  };

  if (!puedeVer) {
    return (
      <div
        role="region"
        aria-label="Sin permiso para ver reservas"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: '24px',
          textAlign: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '28px',
            background: '#FBEDE9',
            border: '2px solid var(--cp-rust)',
            color: 'var(--cp-rust)',
            fontSize: '24px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          !
        </div>
        <h2 style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: '18px' }}>
          No tienes permiso
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--cp-soft)', maxWidth: '380px' }}>
          No tienes los permisos requeridos (reservas/ver) para acceder al módulo de reservas.
        </p>
      </div>
    );
  }

  if (cargando) {
    return <Cargando mensaje="Cargando reservas y salón..." pantallaCompleta={false} />;
  }

  if (errorGlobal) {
    return (
      <EstadoError
        titulo="Error al cargar reservas"
        mensaje={errorGlobal}
        alReintentar={cargarDatos}
      />
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        width: '100%',
      }}
    >
      {/* Toast de aviso en vivo de Socket.IO (salon:listo) */}
      {avisoListo && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            zIndex: 90,
            bottom: '24px',
            right: '24px',
            maxWidth: '420px',
            background: 'var(--cp-navy)',
            color: 'var(--cp-cream)',
            borderLeft: '6px solid var(--cp-ok)',
            borderRadius: '14px',
            padding: '12px 16px',
            boxShadow: '0 12px 36px rgba(11, 44, 62, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: '#7DDB9B',
                letterSpacing: '0.04em',
              }}
            >
              ¡PEDIDO LISTO EN COCINA!
            </div>
            <div style={{ fontWeight: 800, fontSize: '15px' }}>
              Pedido {avisoListo.codigo} de {avisoListo.mesas.join(', ')}
            </div>
            <div style={{ fontSize: '11px', color: '#C9D6DD' }}>
              Hora: {avisoListo.recibidoEn} · Listo para servir en mesa
            </div>
          </div>
          <button
            type="button"
            onClick={cerrarAvisoListo}
            aria-label="Cerrar aviso"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '16px',
              border: 0,
              background: 'rgba(255,255,255,0.15)',
              color: 'var(--cp-cream)',
              fontSize: '16px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* 1. TEXTO EXPLICATIVO SUPERIOR Y BOTÓN + NUEVA RESERVA */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            fontSize: '13px',
            lineHeight: '19px',
            color: 'var(--cp-soft)',
            flex: '1 1 260px',
          }}
        >
          Las reservas llegan por WhatsApp como solicitud y un mozo o caja las aprueba y asigna la
          mesa. La mesa se guarda 15 minutos y luego la reserva se anula sola. La marca R en el
          plano es solo un aviso: no bloquea la mesa.
        </div>

        <button
          type="button"
          onClick={() => {
            setReservaParaEditar(null);
            setErrorFormulario(null);
            setModalFormularioAbierto(true);
          }}
          style={{
            flex: '0 0 auto',
            minHeight: '52px',
            padding: '0 20px',
            border: 0,
            borderRadius: '12px',
            background: 'var(--cp-orange)',
            color: 'var(--cp-navy)',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: '15px',
            cursor: 'pointer',
          }}
        >
          + Nueva reserva
        </button>
      </div>

      {/* 2. 4 TARJETAS DE KPIS SUPERIORES (rvTiles) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '10px',
        }}
      >
        <div
          style={{
            border: solPend.length > 0 ? '1.5px solid var(--cp-orange)' : '1.5px solid var(--cp-line)',
            borderRadius: '14px',
            background: solPend.length > 0 ? 'var(--cp-orange)' : 'var(--cp-white)',
            color: 'var(--cp-navy)',
            padding: '8px 12px',
            minHeight: '64px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, opacity: 0.85 }}>
            Solicitudes por atender
          </div>
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '24px',
              lineHeight: '30px',
            }}
          >
            {solPend.length}
          </div>
        </div>

        <div
          style={{
            border: '1.5px solid var(--cp-line)',
            borderRadius: '14px',
            background: 'var(--cp-white)',
            color: 'var(--cp-navy)',
            padding: '8px 12px',
            minHeight: '64px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, opacity: 0.85 }}>Reservas de hoy</div>
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '24px',
              lineHeight: '30px',
            }}
          >
            {reservasHoyCount}
          </div>
        </div>

        <div
          style={{
            border: '1.5px solid var(--cp-line)',
            borderRadius: '14px',
            background: 'var(--cp-white)',
            color: 'var(--cp-navy)',
            padding: '8px 12px',
            minHeight: '64px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, opacity: 0.85 }}>Confirmadas</div>
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '24px',
              lineHeight: '30px',
            }}
          >
            {confirmadasCount}
          </div>
        </div>

        <div
          style={{
            border: '1.5px solid var(--cp-line)',
            borderRadius: '14px',
            background: 'var(--cp-white)',
            color: 'var(--cp-navy)',
            padding: '8px 12px',
            minHeight: '64px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, opacity: 0.85 }}>
            Pendientes en la tabla
          </div>
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '24px',
              lineHeight: '30px',
            }}
          >
            {pendientesTablaCount}
          </div>
        </div>
      </div>

      {/* 3. CAJA: SOLICITUDES POR WHATSAPP */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: `2px solid ${solPend.length > 0 ? 'var(--cp-orange)' : 'var(--cp-line)'}`,
          borderRadius: '14px',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '16px',
              color: 'var(--cp-navy)',
            }}
          >
            Solicitudes por WhatsApp
          </div>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 800,
              borderRadius: '9999px',
              padding: '2px 12px',
              background: solPend.length > 0 ? 'var(--cp-orange)' : '#DDF1E3',
              color: solPend.length > 0 ? 'var(--cp-navy)' : '#14502B',
            }}
          >
            {solPend.length > 0 ? `${solPend.length} por atender` : 'Todo al día'}
          </span>
        </div>

        {solPend.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
            No hay solicitudes pendientes. Cuando un cliente pida mesa por WhatsApp, aparece aquí.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '12px',
              alignItems: 'start',
            }}
          >
            {solPend.map((r) => {
              const iniciales = r.nombre
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();

              return (
                <div
                  key={r.id}
                  style={{
                    borderLeft: '6px solid var(--cp-orange)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    background: 'var(--cp-cream)',
                  }}
                >
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span
                      style={{
                        flex: 'none',
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: 'var(--cp-navy)',
                        color: 'var(--cp-cream)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                      }}
                    >
                      {iniciales}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: '15px',
                          color: 'var(--cp-navy)',
                        }}
                      >
                        {r.nombre}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                        {r.tel} · {r.personas} personas · {r.hora} · por WhatsApp
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: r.mesa ? 'var(--cp-navy)' : 'var(--cp-soft)',
                    }}
                  >
                    {r.mesa
                      ? `Mesa elegida: ${r.mesa}`
                      : `Elige la mesa en el plano del local (para ${r.personas} personas)`}
                  </div>

                  <button
                    type="button"
                    onClick={() => setConfirmarAprobarSol(r)}
                    style={{
                      minHeight: '48px',
                      border: '1.5px solid var(--cp-navy)',
                      borderRadius: '12px',
                      background: 'var(--cp-white)',
                      color: 'var(--cp-navy)',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 3h18v18H3z M3 9h18 M9 21V9" />
                    </svg>
                    {r.mesa ? 'Cambiar la mesa en el plano' : 'Elegir la mesa en el plano'}
                  </button>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setConfirmarAprobarSol(r)}
                      style={{
                        flex: '1 1 150px',
                        minHeight: '48px',
                        border: 0,
                        borderRadius: '12px',
                        background: 'var(--cp-orange)',
                        color: 'var(--cp-navy)',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      Aprobar y guardar la mesa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setErrorRechazo(null);
                        setConfirmarRechazarSol(r);
                      }}
                      style={{
                        flex: '1 1 100px',
                        minHeight: '48px',
                        border: '1.5px solid var(--cp-rust)',
                        borderRadius: '12px',
                        background: 'transparent',
                        color: 'var(--cp-rust)',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Acordeón de solicitudes atendidas hoy */}
        {solHist.length > 0 && (
          <details style={{ borderTop: '1px solid var(--cp-line)', paddingTop: '8px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '13px', color: 'var(--cp-soft)' }}>
              Ya resueltas
            </summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
              {solHist.map((h) => (
                <div key={h.id} style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                  • {h.nombre} · {h.personas} personas · {h.hora} ·{' '}
                  {h.estado === 'aprobada' ? `aprobada, ${h.mesa || 'Mesa asignada'}` : 'rechazada'}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* 4. CALENDARIO DE RESERVAS Y AGENDA DEL DÍA */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '14px',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {/* Cabecera del calendario: Título a la izquierda, Navegación a la derecha */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '16px',
              color: 'var(--cp-navy)',
            }}
          >
            Calendario de reservas
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => {
                setMesActual((prev) => {
                  let m = prev.m - 1;
                  let y = prev.y;
                  if (m < 0) {
                    m = 11;
                    y--;
                  }
                  return { y, m };
                });
              }}
              aria-label="Mes anterior"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '22px',
                border: '1.5px solid var(--cp-navy)',
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontWeight: 800,
                fontSize: '18px',
                cursor: 'pointer',
              }}
            >
              ‹
            </button>
            <span
              style={{
                minWidth: '130px',
                textAlign: 'center',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '15px',
                color: 'var(--cp-navy)',
              }}
            >
              {RV_MES[mesActual.m]} {mesActual.y}
            </span>
            <button
              type="button"
              onClick={() => {
                setMesActual((prev) => {
                  let m = prev.m + 1;
                  let y = prev.y;
                  if (m > 11) {
                    m = 0;
                    y++;
                  }
                  return { y, m };
                });
              }}
              aria-label="Mes siguiente"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '22px',
                border: '1.5px solid var(--cp-navy)',
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontWeight: 800,
                fontSize: '18px',
                cursor: 'pointer',
              }}
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => {
                const [y, m, d] = hoyLima().split('-').map(Number);
                setMesActual({ y, m: m - 1 });
                setDiaSeleccionado(d);
              }}
              style={{
                minHeight: '44px',
                padding: '0 14px',
                border: '1.5px solid var(--cp-navy)',
                borderRadius: '9999px',
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Hoy
            </button>
          </div>
        </div>

        {/* Nombres de días de semana */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
            <div key={d} style={{ fontSize: '12px', fontWeight: 800, color: 'var(--cp-soft)', padding: '4px 0' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Celdas de días del mes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {Array.from({ length: offDias }).map((_, i) => (
            <div key={`blank-${i}`} style={{ minHeight: '58px' }} />
          ))}

          {Array.from({ length: numDiasEnMes }).map((_, i) => {
            const d = i + 1;
            const esSeleccionado = diaSeleccionado === d;
            const dtIso = `${mesActual.y}-${String(mesActual.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const reservasDia = listaTodasReservas.filter((r) => {
              return partesLima(r.hora).fecha === dtIso;
            });
            const nConf = reservasDia.filter((r) => r.estado !== 'CANCELADA').length;

            return (
              <button
                key={d}
                type="button"
                onClick={() => setDiaSeleccionado(d)}
                aria-pressed={esSeleccionado}
                aria-label={`${d} de ${RV_MES[mesActual.m].toLowerCase()}: ${
                  reservasDia.length ? `${reservasDia.length} reservas` : 'sin reservas'
                }`}
                style={{
                  minHeight: '58px',
                  padding: '4px 2px',
                  borderRadius: '10px',
                  border: esSeleccionado
                    ? '2px solid var(--cp-navy)'
                    : '1.5px solid var(--cp-line)',
                  background: esSeleccionado
                    ? 'var(--cp-navy)'
                    : reservasDia.length > 0
                    ? 'var(--cp-white)'
                    : 'var(--cp-cream)',
                  color: esSeleccionado ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: '3px',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontWeight: 800, fontSize: '14px' }}>{d}</span>
                {reservasDia.length > 0 && (
                  <span
                    style={{
                      display: 'flex',
                      gap: '3px',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                    }}
                  >
                    {nConf > 0 && (
                      <span
                        style={{
                          minWidth: '20px',
                          fontSize: '11px',
                          fontWeight: 800,
                          borderRadius: '9999px',
                          padding: '1px 6px',
                          background: esSeleccionado ? 'var(--cp-orange)' : '#14502B',
                          color: esSeleccionado ? 'var(--cp-navy)' : '#FFFFFF',
                        }}
                      >
                        {nConf}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Leyenda del calendario */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            fontSize: '12px',
            color: 'var(--cp-soft)',
          }}
        >
          <span>
            <b style={{ color: '#14502B' }}>●</b> Confirmadas o atendidas
          </span>
          <span>
            <b style={{ color: 'var(--cp-orange)' }}>●</b> Pendientes
          </span>
          <span>Toca un día para ver su agenda</span>
        </div>

        {/* Agenda interactiva del día elegido */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: '8px',
            flexWrap: 'wrap',
            borderTop: '1px solid var(--cp-line)',
            paddingTop: '10px',
          }}
        >
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '16px',
              color: 'var(--cp-navy)',
            }}
          >
            {RV_DIAS[(new Date(mesActual.y, mesActual.m, diaSeleccionado).getDay() + 6) % 7]}{' '}
            {diaSeleccionado} de {RV_MES[mesActual.m].toLowerCase()}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
            {diaIso === hoyIso ? 'Hoy · ' : ''}
            {reservasDelDia.length} {reservasDelDia.length === 1 ? 'reserva' : 'reservas'}
          </span>
        </div>

        {reservasDelDia.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--cp-soft)', padding: '8px 0' }}>
            No hay reservas para este día.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {reservasDelDia.map((r) => {
              const horaTexto = partesLima(r.hora).hora || '19:00';
              const mesaNom = etiquetaMesas(r.mesas || []);

              return (
                <div
                  key={r.id}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    borderLeft: `6px solid ${
                      r.estado === 'SENTADA'
                        ? 'var(--cp-ok)'
                        : r.estado === 'CANCELADA'
                        ? 'var(--cp-line)'
                        : 'var(--cp-navy)'
                    }`,
                    borderRadius: '12px',
                    padding: '8px 12px',
                    background: 'var(--cp-cream)',
                  }}
                >
                  <div
                    style={{
                      flex: '0 0 auto',
                      width: '64px',
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 800,
                      fontSize: '18px',
                      color: 'var(--cp-navy)',
                    }}
                  >
                    {horaTexto}
                  </div>
                  <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--cp-navy)' }}>
                      {r.nombre}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                      {r.personas} personas · {mesaNom || 'Mesa pendiente'}
                    </div>
                  </div>

                  <div
                    style={{
                      flex: '0 0 auto',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '4px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        borderRadius: '9999px',
                        padding: '2px 10px',
                        background:
                          r.estado === 'SENTADA'
                            ? '#DDF1E3'
                            : r.estado === 'CANCELADA'
                            ? '#FDECE8'
                            : r.estado === 'NO_ASISTIO' ? '#E9ECF2' : '#FFF1C9',
                        color:
                          r.estado === 'SENTADA'
                            ? '#14502B'
                            : r.estado === 'CANCELADA'
                            ? 'var(--cp-rust)'
                            : r.estado === 'NO_ASISTIO' ? '#4A5468' : '#7A5C00',
                      }}
                    >
                      {etiquetaEstadoReserva(r.estado)}
                    </span>

                    {r.estado === 'ACTIVA' && (
                      <button
                        type="button"
                        onClick={() => setConfirmarSentarReserva(r)}
                        style={{
                          minHeight: '34px',
                          padding: '0 12px',
                          borderRadius: '8px',
                          border: 0,
                          background: 'var(--cp-orange)',
                          color: 'var(--cp-navy)',
                          fontWeight: 800,
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Sentar
                      </button>
                    )}

                    {r.estado === 'NO_ASISTIO' && partesLima(r.hora).fecha === hoyIso && (
                      <button
                        type="button"
                        onClick={() => reactivarReserva(r)}
                        style={{
                          minHeight: '34px',
                          padding: '0 12px',
                          borderRadius: '8px',
                          border: 0,
                          background: 'var(--cp-orange)',
                          color: 'var(--cp-navy)',
                          fontWeight: 800,
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Reactivar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. TÍTULO: TODAS LAS RESERVAS Y NOTA */}
      <div
        style={{
          fontFamily: 'Montserrat, sans-serif',
          fontWeight: 800,
          fontSize: '16px',
          marginTop: '4px',
          color: 'var(--cp-navy)',
        }}
      >
        Todas las reservas{' '}
        <span style={{ fontWeight: 500, fontSize: '12px', color: 'var(--cp-soft)' }}>
          · busca y filtra
        </span>
      </div>

      <div
        style={{
          border: '1px solid var(--cp-line)',
          background: 'var(--cp-white)',
          borderRadius: '12px',
          padding: '12px 14px',
          fontSize: '13px',
          lineHeight: '19px',
          color: 'var(--cp-navy)',
        }}
      >
        <b>Nota.</b> Las reservas se piden por WhatsApp. La mesa se guarda 15 minutos de tolerancia
        y luego la reserva se anula sola y la mesa queda libre. En el plano se marca con R, solo
        como aviso visual: no bloquea pedidos ni otras reservas. Llegan como solicitud y un mozo o
        caja las aprueba y asigna la mesa (acta 02).
      </div>

      {/* 6. TABLA / CARDS CON BUSCADOR Y FILTROS */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '12px',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <BarraFiltros>
          <input
            id="t-q"
            type="search"
            value={busquedaTabla}
            onChange={(e) => setBusquedaTabla(e.target.value)}
            placeholder="Buscar por cliente o código"
            style={{
              flex: '2 1 220px',
              minWidth: 0,
              boxSizing: 'border-box',
              minHeight: '44px',
              borderRadius: '9999px',
              border: '1.5px solid var(--cp-line)',
              background: 'var(--cp-cream)',
              color: 'var(--cp-navy)',
              padding: '0 14px',
              fontSize: '14px',
            }}
          />

          <button
            type="button"
            onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}
            aria-expanded={filtrosAbiertos}
            style={{
              flex: '0 0 auto',
              minHeight: '44px',
              padding: '0 12px',
              borderRadius: '9999px',
              border: '1.5px solid var(--cp-navy)',
              background: filtrosAbiertos ? 'var(--cp-navy)' : 'transparent',
              color: filtrosAbiertos ? 'var(--cp-cream)' : 'var(--cp-navy)',
              fontWeight: 700,
              fontSize: '13px',
              display: 'inline-flex',
              gap: '6px',
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 5h18l-7 8v6l-4 2v-8z" />
            </svg>
            Filtros
          </button>
        </BarraFiltros>

        {filtrosAbiertos && (
          <BarraFiltros style={{ borderTop: '1px solid var(--cp-line)', paddingTop: '8px' }}>
            <FiltroCombo
              etiqueta="Estado"
              valor={filtroEstado}
              valorPorDefecto="todos"
              opciones={[
                { valor: 'todos', etiqueta: 'Todos' },
                ...['Confirmada', 'Pendiente', 'Cancelada', 'Atendida', 'No llegó'].map((e) => ({ valor: e, etiqueta: e })),
              ]}
              alCambiar={setFiltroEstado}
            />
            <FiltroCombo
              etiqueta="Personas"
              valor={filtroPersonas}
              valorPorDefecto="todos"
              opciones={[
                { valor: 'todos', etiqueta: 'Todas' },
                ...['2', '4', '6'].map((p) => ({ valor: p, etiqueta: `${p} personas` })),
              ]}
              alCambiar={setFiltroPersonas}
            />
          </BarraFiltros>
        )}

        {/* Grilla de tarjetas de reservas */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
            gap: '12px',
            marginTop: '6px',
          }}
        >
          {reservasFiltradas.map((r) => {
            const lima = partesLima(r.hora);
            const fechaStr = lima.fecha ? `${lima.fecha.slice(8, 10)}/${lima.fecha.slice(5, 7)}` : '15/10';
            const horaStr = lima.hora || '19:00';
            const mesaNom = etiquetaMesas(r.mesas || []);

            const badgeBg =
              r.estado === 'SENTADA'
                ? 'var(--cp-navy)'
                : r.estado === 'CANCELADA'
                ? 'var(--cp-rust)'
                : r.estado === 'ACTIVA'
                ? 'var(--cp-navy)'
                : r.estado === 'NO_ASISTIO'
                ? 'var(--cp-soft)'
                : 'var(--cp-gold)';
            const badgeFg =
              r.estado === 'CANCELADA' ? 'var(--cp-white)' : 'var(--cp-cream)';
            const badgeTexto = etiquetaEstadoReserva(r.estado);

            return (
              <div
                key={r.id}
                style={{
                  background: 'var(--cp-white)',
                  border: '1px solid var(--cp-line)',
                  borderRadius: '12px',
                  boxShadow: 'rgba(11, 44, 62, 0.1) 0px 6px 18px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 800,
                      fontSize: '16px',
                      color: 'var(--cp-navy)',
                    }}
                  >
                    {r.id}
                  </div>
                  <span
                    style={{
                      flex: 'none',
                      fontSize: '12px',
                      fontWeight: 700,
                      borderRadius: '9999px',
                      padding: '2px 10px',
                      background: badgeBg,
                      color: badgeFg,
                    }}
                  >
                    {badgeTexto}
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0px, 1fr))',
                    gap: '8px 12px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>
                      Cliente
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--cp-navy)' }}>{r.nombre}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>
                      Fecha
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--cp-navy)' }}>{fechaStr}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>
                      Hora
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--cp-navy)' }}>{horaStr}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>
                      Personas
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--cp-navy)' }}>{r.personas}</div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>
                      Mesa
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--cp-navy)' }}>
                      {mesaNom || 'Sin mesa asignada'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                  {r.estado === 'NO_ASISTIO' && partesLima(r.hora).fecha === hoyIso && (
                    <button
                      type="button"
                      onClick={() => reactivarReserva(r)}
                      style={{
                        flex: 1,
                        minHeight: '44px',
                        border: 0,
                        borderRadius: '12px',
                        background: 'var(--cp-orange)',
                        color: 'var(--cp-navy)',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      Reactivar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setReservaParaEditar(r);
                      setErrorFormulario(null);
                      setModalFormularioAbierto(true);
                    }}
                    style={{
                      flex: 1,
                      minHeight: '44px',
                      border: '1.5px solid var(--cp-navy)',
                      borderRadius: '12px',
                      background: 'transparent',
                      color: 'var(--cp-navy)',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmarCancelarReserva(r)}
                    style={{
                      flex: 1,
                      minHeight: '44px',
                      border: '1.5px solid var(--cp-navy)',
                      borderRadius: '12px',
                      background: 'transparent',
                      color: 'var(--cp-navy)',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {r.estado === 'CANCELADA' ? 'Anulada' : 'Desactivar'}
                  </button>
                </div>
              </div>
            );
          })}
          {reservasFiltradas.length === 0 && (
            <div
              style={{
                fontSize: '13px',
                color: 'var(--cp-soft)',
                padding: '24px 12px',
                textAlign: 'center',
                gridColumn: '1 / -1',
              }}
            >
              No hay reservas en esta lista.
            </div>
          )}
        </div>
      </div>

      {/* DIÁLOGOS DE CONFIRMACIÓN OBLIGATORIA SÍ/NO */}
      {confirmarAprobarSol && (
        <ConfirmarAprobacionSolicitud
          solicitud={confirmarAprobarSol}
          pisos={pisosSalon}
          obtenerOcupadas={(fecha, hora) => salonApi.mesasOcupadas(fecha, hora)}
          obtenerAvisos={(fecha, hora, mesaIds) => salonApi.avisosMesas(fecha, hora, mesaIds)}
          alAprobar={async ({ mesas, hora, confirmarCapacidad }) => {
            await salonApi.aprobarSolicitud(confirmarAprobarSol.id, { mesas, hora, confirmarCapacidad });
            setSolicitudes((prev) =>
              prev.map((s) =>
                s.id === confirmarAprobarSol.id ? { ...s, estado: 'aprobada' as const } : s,
              ),
            );
            setConfirmarAprobarSol(null);
            cargarDatos();
          }}
          alCancelar={() => setConfirmarAprobarSol(null)}
        />
      )}

      {confirmarRechazarSol && (
        <Confirmar
          abierto={true}
          titulo={`¿Rechazar la solicitud de ${confirmarRechazarSol.nombre}?`}
          mensaje="Se le avisa por WhatsApp que no hay mesa a esa hora."
          textoConfirmar="Sí, rechazar"
          textoNo="No, cancelar"
          alConfirmar={async () => {
            setErrorRechazo(null);
            try {
              await salonApi.rechazarSolicitud(confirmarRechazarSol.id, {
                motivo: 'No hay mesa disponible en el horario solicitado',
              });
              setSolicitudes((prev) =>
                prev.map((s) =>
                  s.id === confirmarRechazarSol.id ? { ...s, estado: 'rechazada' as const } : s,
                ),
              );
              setConfirmarRechazarSol(null);
              cargarDatos();
            } catch (err: any) {
              // El diálogo se queda abierto con el motivo; la pantalla sigue visible.
              setErrorRechazo(err?.message || 'No fue posible rechazar la solicitud.');
            }
          }}
          alCancelar={() => {
            setErrorRechazo(null);
            setConfirmarRechazarSol(null);
          }}
        >
          {errorRechazo && (
            <div role="alert" style={{ fontSize: '13px', color: 'var(--cp-rust)', fontWeight: 700 }}>
              {errorRechazo}
            </div>
          )}
        </Confirmar>
      )}

      {confirmarCancelarReserva && (
        <Confirmar
          abierto={true}
          titulo={`¿Cancelar la reserva de ${confirmarCancelarReserva.nombre}?`}
          mensaje="La mesa quedará libre de inmediato y se guardará el registro en el historial."
          textoConfirmar="Sí, cancelar reserva"
          textoNo="No, conservar"
          alConfirmar={async () => {
            try {
              await salonApi.cancelarReserva(
                confirmarCancelarReserva.id,
                'Cancelada por el administrador',
              );
              setConfirmarCancelarReserva(null);
              setRecargarKey((k) => k + 1);
              await cargarDatos();
            } catch (err: any) {
              setConfirmarCancelarReserva(null);
            }
          }}
          alCancelar={() => setConfirmarCancelarReserva(null)}
        />
      )}

      {confirmarSentarReserva && (
        <Confirmar
          abierto={true}
          titulo="¿Sentar a los clientes de la reserva?"
          mensaje={`Se marcará la reserva de ${confirmarSentarReserva.nombre} como atendida y se abrirá el pedido para sus mesas.`}
          textoConfirmar="Sí, sentar y abrir pedido"
          textoNo="No, cancelar"
          alConfirmar={async () => {
            try {
              const res = await salonApi.sentarReserva(confirmarSentarReserva.id);
              const mesasIds =
                res?.mesas ||
                (confirmarSentarReserva.mesas || []).map((m) => m.mesa_id || m.id || '');
              setMesasParaPedido(mesasIds.filter(Boolean));
              setReservaIdParaPedido(confirmarSentarReserva.id);
              setConfirmarSentarReserva(null);
              setModalNuevoPedidoAbierto(true);
              setRecargarKey((k) => k + 1);
            } catch (err: any) {
              setConfirmarSentarReserva(null);
            }
          }}
          alCancelar={() => setConfirmarSentarReserva(null)}
        />
      )}

      {/* Modal Formulario Reserva (Crear / Editar) */}
      <ModalFormularioReserva
        abierto={modalFormularioAbierto}
        reservaParaEditar={reservaParaEditar}
        mesasDisponibles={todasLasMesas}
        alCerrar={() => {
          setModalFormularioAbierto(false);
          setReservaParaEditar(null);
        }}
        alGuardar={handleGuardarReserva}
        errorServidor={errorFormulario}
        alLimpiarError={() => setErrorFormulario(null)}
      />

      {/* Modal Nuevo Pedido de Mesa (conectado con Sentar) */}
      {modalNuevoPedidoAbierto && (
        <ModalNuevoPedidoMesa
          abierto={true}
          puedeForzarLiberacion={tiene('mesas/liberar')}
          alCerrar={() => {
            setModalNuevoPedidoAbierto(false);
            setMesasParaPedido([]);
            setReservaIdParaPedido(undefined);
          }}
          pisos={pisosSalon}
          mesasPreseleccionadasIds={mesasParaPedido}
          reservaIdPreseleccionada={reservaIdParaPedido}
          alRefrescarMesas={cargarDatos}
        />
      )}
    </div>
  );
}
