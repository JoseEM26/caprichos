import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Confirmar } from '../../comun/Confirmar';
import { useEventos } from '../../comun/socket';
import {
  listarHistorialNotificaciones,
  marcarNotificacion,
  marcarTodasNotificacionesLeidas,
} from './notificacionesApi';
import {
  FiltrosHistorial,
  NotificacionHistorialItem,
  NotificacionPendiente,
  RespuestaHistorialNotificaciones,
} from './notificacionesTipos';
import { NuevoMensajeModal } from './NuevoMensajeModal';

const TIPOS_DISPONIBLES = [
  'Todos',
  'Pedido por confirmar',
  'Delivery por confirmar',
  'Stock bajo',
  'Error de impresora',
  'Comprobante pendiente',
  'Mensaje interno',
];

const calcularEspera = (desdeIso: string | null) => {
  if (!desdeIso) return null;
  const difMs = Date.now() - new Date(desdeIso).getTime();
  const min = Math.max(0, Math.floor(difMs / 60000));
  if (min < 60) return `espera ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `espera ${h} h ${m} min`;
};

const horaDeIso = (desdeIso: string | null) => {
  if (!desdeIso) return '';
  try {
    return new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(desdeIso));
  } catch {
    return '';
  }
};

export function NotificacionesView() {
  const navigate = useNavigate();
  const [cargando, setCargando] = useState(true);
  const [data, setData] = useState<RespuestaHistorialNotificaciones | null>(null);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [tipoSeleccionado, setTipoSeleccionado] = useState('Todos');
  const [estadoSeleccionado, setEstadoSeleccionado] = useState<'todas' | 'nuevas' | 'leidas'>('todas');
  const [presetFecha, setPresetFecha] = useState<'todo' | 'hoy' | 'ayer' | 'semana'>('todo');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  // Modales
  const [modalNuevoMensaje, setModalNuevoMensaje] = useState(false);
  const [confirmarMarcarTodas, setConfirmarMarcarTodas] = useState(false);
  const [pendienteLeida, setPendienteLeida] = useState<NotificacionPendiente | null>(null);

  // Cargar datos del historial y pendientes
  const cargar = useCallback(async () => {
    try {
      const filtros: FiltrosHistorial = {
        q: busqueda,
        tipo: tipoSeleccionado !== 'Todos' ? tipoSeleccionado : undefined,
        estado: estadoSeleccionado,
        desde: desde || undefined,
        hasta: hasta || undefined,
      };
      const res = await listarHistorialNotificaciones(filtros);
      setData(res);
    } catch {
      // Ignorar error transitorio
    } finally {
      setCargando(false);
    }
  }, [busqueda, tipoSeleccionado, estadoSeleccionado, desde, hasta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Manejar presets de fecha
  const aplicarPresetFecha = (preset: 'todo' | 'hoy' | 'ayer' | 'semana') => {
    setPresetFecha(preset);
    const ahora = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' });
    const hoyStr = formatter.format(ahora);

    if (preset === 'todo') {
      setDesde('');
      setHasta('');
    } else if (preset === 'hoy') {
      setDesde(hoyStr);
      setHasta(hoyStr);
    } else if (preset === 'ayer') {
      const ayer = new Date(ahora.getTime() - 86400000);
      const ayerStr = formatter.format(ayer);
      setDesde(ayerStr);
      setHasta(ayerStr);
    } else if (preset === 'semana') {
      const hace7 = new Date(ahora.getTime() - 7 * 86400000);
      setDesde(formatter.format(hace7));
      setHasta(hoyStr);
    }
  };

  const limpiarFiltros = () => {
    setBusqueda('');
    setTipoSeleccionado('Todos');
    setEstadoSeleccionado('todas');
    setPresetFecha('todo');
    setDesde('');
    setHasta('');
  };

  // Socket en vivo
  useEventos('notificaciones:nueva', () => cargar());
  useEventos('notificaciones:actualizada', () => cargar());

  // Acciones individuales
  const handleToggleLeida = async (item: NotificacionHistorialItem) => {
    try {
      await marcarNotificacion(`n:${item.id}`, !item.leida);
      await cargar();
    } catch { /* best-effort: el refresco es opcional, la vista ya cargo */ }
  };

  const handleMarcarPendienteLeida = async () => {
    if (!pendienteLeida) return;
    try {
      await marcarNotificacion(pendienteLeida.clave);
      await cargar();
    } catch { /* best-effort: el refresco es opcional, la vista ya cargo */ }
    setPendienteLeida(null);
  };

  const handleMarcarTodasLeidas = async () => {
    try {
      await marcarTodasNotificacionesLeidas();
      setConfirmarMarcarTodas(false);
      await cargar();
    } catch { /* best-effort: el refresco es opcional, la vista ya cargo */ }
  };

  // Agrupar items por día
  const gruposPorDia = useMemo(() => {
    if (!data?.items) return [];
    const grupos: { iso: string; label: string; items: NotificacionHistorialItem[] }[] = [];
    const hoyIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
    const ayerIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(
      new Date(Date.now() - 86400000),
    );

    for (const item of data.items) {
      let g = grupos.find((x) => x.iso === item.iso);
      if (!g) {
        let prefijo = 'Antes';
        if (item.iso === hoyIso) prefijo = 'Hoy';
        else if (item.iso === ayerIso) prefijo = 'Ayer';
        g = {
          iso: item.iso,
          label: `${prefijo} · ${item.fecha}`,
          items: [],
        };
        grupos.push(g);
      }
      g.items.push(item);
    }
    return grupos;
  }, [data]);

  const totalSinLeer = data?.metricas.sinLeerHistorial ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Subtítulo descriptivo */}
      <div style={{ fontSize: '13px', lineHeight: '19px', color: 'var(--cp-soft)' }}>
        Arriba está lo que pide atención ahora, con el botón para resolverlo. Abajo queda el historial de avisos, que puedes filtrar por tipo, estado y fecha.
      </div>

      {/* 4 Tarjetas de Métricas */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '10px',
        }}
      >
        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '10px 14px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>
            Pendientes ahora
          </div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '24px' }}>
            {data?.metricas.pendientesAhora ?? 0}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>
            para {data?.metricas.rolNombre ?? 'personal'}
          </div>
        </div>

        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '10px 14px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>
            Urgentes ahora
          </div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '24px' }}>
            {data?.metricas.urgentesAhora ?? 0}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>
            prioridad alta
          </div>
        </div>

        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '10px 14px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>
            Sin leer en el historial
          </div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '24px' }}>
            {data?.metricas.sinLeerHistorial ?? 0}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>
            de {data?.metricas.totalHistorial ?? 0}
          </div>
        </div>

        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '10px 14px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>
            Del día de hoy
          </div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '24px' }}>
            {data?.metricas.delDiaDeHoy ?? 0}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>
            avisos registrados
          </div>
        </div>
      </div>

      {/* Bloque: Pendientes ahora */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '2px solid var(--cp-orange)',
          borderRadius: '14px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '8px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '16px' }}>
            Pendientes ahora
          </div>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 800,
              borderRadius: '9999px',
              padding: '2px 12px',
              background: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
            }}
          >
            {data?.pendientes.length ?? 0}
          </span>
        </div>

        {cargando ? (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--cp-soft)' }}>
            Cargando pendientes...
          </div>
        ) : !data?.pendientes.length ? (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--cp-soft)', fontSize: '13px' }}>
            No hay alertas pendientes que requieran atención inmediata en este momento.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '10px',
            }}
          >
            {data.pendientes.map((p) => {
              const esAlta = p.prioridad === 'ALTA';
              const colorTira = esAlta ? 'rgb(199, 62, 42)' : 'var(--cp-orange)';
              const hora = horaDeIso(p.desde);
              const espera = calcularEspera(p.desde);
              const rutaDestino = `/admin/${p.modulo}`;

              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    border: '1px solid var(--cp-line)',
                    borderRadius: '12px',
                    padding: '12px',
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      flex: '0 0 auto',
                      width: '6px',
                      borderRadius: '3px',
                      background: colorTira,
                    }}
                  />
                  <div style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: 800, fontSize: '14px', lineHeight: '19px', overflowWrap: 'anywhere' }}>
                        {p.titulo}
                      </span>
                      <span
                        style={{
                          flex: '0 0 auto',
                          fontSize: '11px',
                          fontWeight: 800,
                          color: 'var(--cp-white)',
                          background: colorTira,
                          borderRadius: '9999px',
                          padding: '2px 10px',
                        }}
                      >
                        {esAlta ? 'Alta' : 'Media'}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--cp-soft)' }}>
                      {p.detalle}
                    </div>
                    {hora && (
                      <div style={{ fontSize: '12px', color: 'var(--cp-soft)', fontVariantNumeric: 'tabular-nums' }}>
                        {hora} · {espera}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                      <button
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
                        onClick={() => navigate(rutaDestino)}
                      >
                        {p.accion}
                      </button>
                      {(
                        <button
                          style={{
                            minHeight: '44px',
                            padding: '0 14px',
                            border: '1.5px solid var(--cp-line)',
                            borderRadius: '10px',
                            background: 'var(--cp-white)',
                            color: 'var(--cp-soft)',
                            fontWeight: 700,
                            fontSize: '13px',
                            cursor: 'pointer',
                          }}
                          onClick={() => setPendienteLeida(p)}
                        >
                          Leído
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bloque: Historial de avisos */}
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '8px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '16px' }}>
            Historial de avisos
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 700 }}>
              {data?.items.length ?? 0} avisos
            </span>
            <button
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
              onClick={() => setConfirmarMarcarTodas(true)}
            >
              Marcar todas como leídas
            </button>
            <button
              style={{
                minHeight: '44px',
                padding: '0 14px',
                border: '0',
                borderRadius: '10px',
                background: 'var(--cp-navy)',
                color: 'var(--cp-cream)',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
              }}
              onClick={() => setModalNuevoMensaje(true)}
            >
              + Mensaje interno
            </button>
          </div>
        </div>

        {/* Buscador */}
        <label htmlFor="nf-q" style={{ position: 'absolute', left: '-9999px' }}>
          Buscar notificación
        </label>
        <input
          id="nf-q"
          type="search"
          placeholder="Buscar en los avisos"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{
            minHeight: '48px',
            borderRadius: '9999px',
            border: '1.5px solid var(--cp-line)',
            background: 'var(--cp-white)',
            padding: '0 16px',
            fontFamily: 'inherit',
            fontSize: '14px',
            color: 'var(--cp-navy)',
          }}
        />

        {/* Filtros por TIPO */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          <span style={{ flex: '0 0 auto', minWidth: '70px', fontSize: '12px', fontWeight: 800, color: 'var(--cp-soft)' }}>
            TIPO
          </span>
          {TIPOS_DISPONIBLES.map((t) => {
            const count = data?.conteosPorTipo[t] ?? 0;
            const activo = tipoSeleccionado === t;
            return (
              <button
                key={t}
                style={{
                  minHeight: '40px',
                  padding: '0 12px',
                  borderRadius: '9999px',
                  border: '1.5px solid var(--cp-navy)',
                  background: activo ? 'var(--cp-navy)' : 'transparent',
                  color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
                onClick={() => setTipoSeleccionado(t)}
              >
                {t} ({count})
              </button>
            );
          })}
        </div>

        {/* Filtros por ESTADO */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          <span style={{ flex: '0 0 auto', minWidth: '70px', fontSize: '12px', fontWeight: 800, color: 'var(--cp-soft)' }}>
            ESTADO
          </span>
          {[
            { id: 'todas', label: 'Todas', count: data?.conteosPorEstado.todas ?? 0 },
            { id: 'nuevas', label: 'Nuevas', count: data?.conteosPorEstado.nuevas ?? 0 },
            { id: 'leidas', label: 'Leídas', count: data?.conteosPorEstado.leidas ?? 0 },
          ].map((est) => {
            const activo = estadoSeleccionado === est.id;
            return (
              <button
                key={est.id}
                style={{
                  minHeight: '40px',
                  padding: '0 12px',
                  borderRadius: '9999px',
                  border: '1.5px solid var(--cp-navy)',
                  background: activo ? 'var(--cp-navy)' : 'transparent',
                  color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
                onClick={() => setEstadoSeleccionado(est.id as any)}
              >
                {est.label} ({est.count})
              </button>
            );
          })}
        </div>

        {/* Filtros por FECHA */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          <span style={{ flex: '0 0 auto', minWidth: '70px', fontSize: '12px', fontWeight: 800, color: 'var(--cp-soft)' }}>
            FECHA
          </span>
          {[
            { id: 'todo', label: 'Todo' },
            { id: 'hoy', label: 'Hoy' },
            { id: 'ayer', label: 'Ayer' },
            { id: 'semana', label: 'Últimos 7 días' },
          ].map((pf) => {
            const activo = presetFecha === pf.id;
            return (
              <button
                key={pf.id}
                style={{
                  minHeight: '40px',
                  padding: '0 12px',
                  borderRadius: '9999px',
                  border: '1.5px solid var(--cp-navy)',
                  background: activo ? 'var(--cp-navy)' : 'transparent',
                  color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
                onClick={() => aplicarPresetFecha(pf.id as any)}
              >
                {pf.label}
              </button>
            );
          })}

          <div style={{ flex: '1 1 130px', minWidth: 0, maxWidth: '180px' }}>
            <label htmlFor="nf-d1" style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
              Desde
            </label>
            <input
              id="nf-d1"
              type="date"
              value={desde}
              onChange={(e) => {
                setDesde(e.target.value);
                setPresetFecha('todo');
              }}
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
            <label htmlFor="nf-d2" style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
              Hasta
            </label>
            <input
              id="nf-d2"
              type="date"
              value={hasta}
              onChange={(e) => {
                setHasta(e.target.value);
                setPresetFecha('todo');
              }}
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

          <button
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
            onClick={limpiarFiltros}
          >
            Limpiar filtros
          </button>
        </div>

        {/* Lista de Notificaciones agrupada por día */}
        {cargando ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--cp-soft)' }}>
            Cargando historial...
          </div>
        ) : gruposPorDia.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--cp-soft)', fontSize: '13px' }}>
            No se encontraron avisos que coincidan con los filtros aplicados.
          </div>
        ) : (
          gruposPorDia.map((grupo) => (
            <div key={grupo.iso} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.06em', color: 'var(--cp-soft)' }}>
                {grupo.label}
              </div>

              {grupo.items.map((it) => (
                <div
                  key={it.id}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    border: '1px solid var(--cp-line)',
                    borderRadius: '12px',
                    padding: '10px 12px',
                    opacity: it.leida ? 0.75 : 1,
                    background: 'var(--cp-white)',
                  }}
                >
                  <span
                    style={{
                      flex: '0 0 auto',
                      width: '6px',
                      borderRadius: '3px',
                      background: it.color,
                    }}
                  />
                  <div style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: '13px' }}>
                        {it.tipo}{' '}
                        <span style={{ fontWeight: 600, color: 'var(--cp-soft)' }}>
                          · {it.hora}
                        </span>
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          borderRadius: '9999px',
                          padding: '2px 10px',
                          background: it.leida ? 'var(--cp-line)' : 'var(--cp-orange)',
                          color: 'var(--cp-navy)',
                        }}
                      >
                        {it.leida ? 'Leída' : 'Nueva'}
                      </span>
                    </div>

                    <div style={{ fontSize: '14px', lineHeight: '20px' }}>
                      {it.mensaje}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {it.modulo && it.accion && (
                        <button
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
                          onClick={() => navigate(it.enlace && it.enlace.startsWith('/admin/') ? it.enlace : `/admin/${it.modulo}`)}
                        >
                          {it.accion}
                        </button>
                      )}
                      <button
                        style={{
                          minHeight: '40px',
                          padding: '0 12px',
                          border: '1.5px solid var(--cp-line)',
                          borderRadius: '10px',
                          background: 'transparent',
                          color: 'var(--cp-soft)',
                          fontWeight: 600,
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                        onClick={() => handleToggleLeida(it)}
                      >
                        {it.leida ? 'Marcar como nueva' : 'Marcar como leída'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Modal: marcar un aviso pendiente como leído (sale de la cola, sigue en el historial) */}
      <Confirmar
        abierto={pendienteLeida !== null}
        titulo="¿Marcar como leída esta notificación?"
        mensaje={pendienteLeida?.titulo}
        textoSi="Sí, marcar leída"
        alConfirmar={handleMarcarPendienteLeida}
        alCancelar={() => setPendienteLeida(null)}
      />

      {/* Modal Marcar Todas como Leídas */}
      <Confirmar
        abierto={confirmarMarcarTodas}
        titulo={`¿Marcar como leídas ${totalSinLeer} notificaciones?`}
        mensaje="Todas las alertas sin leer del historial pasarán a estado Leída."
        textoSi="Sí, marcar todas"
        alConfirmar={handleMarcarTodasLeidas}
        alCancelar={() => setConfirmarMarcarTodas(false)}
      />

      {/* Modal Nuevo Mensaje Interno */}
      <NuevoMensajeModal
        abierto={modalNuevoMensaje}
        alCerrar={() => setModalNuevoMensaje(false)}
        alGuardarExitoso={cargar}
      />
    </div>
  );
}
