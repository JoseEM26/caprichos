import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSesion } from '../../comun/sesion';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { EstadoError } from '../../comun/EstadoError';
import { Insignia } from '../../comun/Insignia';
import { Icono } from '../../comun/Icono';
import { Paginacion } from '../../comun/Paginacion';
import { useEventos } from '../../comun/socket';
import {
  pedidosApi,
  Pedido,
  CajaActualRespuesta,
} from './pedidosApi';
import { PedidoDetalle } from './PedidoDetalle';
import { ModalCaja } from './ModalCaja';
import { reproducirCampana } from './audioAlerta';
import './pedidos.css';

export type ClavePestanaEstado =
  | 'por_cobrar'
  | 'en_cocina'
  | 'listos'
  | 'en_camino'
  | 'entregados'
  | 'anulados';

interface DefinicionPestana {
  id: ClavePestanaEstado;
  etiqueta: string;
  filtro: (p: Pedido) => boolean;
}

const PESTANAS: DefinicionPestana[] = [
  {
    id: 'por_cobrar',
    etiqueta: 'Por cobrar',
    filtro: (p) =>
      String(p.pago_estado).toUpperCase() !== 'PAGADO' &&
      String(p.estado).toUpperCase() !== 'ANULADO',
  },
  {
    id: 'en_cocina',
    etiqueta: 'En cocina',
    filtro: (p) => {
      const e = String(p.estado).toUpperCase();
      return e === 'COLA' || e === 'PREPARANDO';
    },
  },
  {
    id: 'listos',
    etiqueta: 'Listos',
    filtro: (p) => String(p.estado).toUpperCase() === 'LISTO',
  },
  {
    id: 'en_camino',
    etiqueta: 'En camino',
    filtro: (p) => String(p.estado).toUpperCase() === 'EN_CAMINO',
  },
  {
    id: 'entregados',
    etiqueta: 'Entregados',
    filtro: (p) => String(p.estado).toUpperCase() === 'ENTREGADO',
  },
  {
    id: 'anulados',
    etiqueta: 'Anulados',
    filtro: (p) => String(p.estado).toUpperCase() === 'ANULADO',
  },
];

const CANALES_OPCIONES = ['Todos', 'Carta', 'Bot', 'Mozo', 'Teléfono'];
const MODALIDADES_OPCIONES = ['Todas', 'Delivery', 'Para llevar', 'En mesa'];

export function PedidosAdminView() {
  const { tiene, usuario } = useSesion();

  // Estados de carga y error
  const [cargando, setCargando] = useState<boolean>(true);
  const [errorCarga, setErrorCarga] = useState<string>('');

  // Lista maestra de pedidos (cargados del día o activos)
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pedidoSeleccionadoId, setPedidoSeleccionadoId] = useState<string | null>(null);

  // Pestaña de estado activa
  const [pestanaActiva, setPestanaActiva] = useState<ClavePestanaEstado>('por_cobrar');

  // Filtros y búsqueda
  const [busqueda, setBusqueda] = useState<string>('');
  const [canalFiltro, setCanalFiltro] = useState<string>('Todos');
  const [modalidadFiltro, setModalidadFiltro] = useState<string>('Todas');
  const [mostrarFiltros, setMostrarFiltros] = useState<boolean>(false);

  // Paginación en cliente para la lista lateral
  const [paginaActual, setPaginaActual] = useState<number>(1);
  const pedidosPorPagina = 8;

  // Estado de caja
  const [cajaInfo, setCajaInfo] = useState<CajaActualRespuesta | null>(null);
  const [modalCajaAbierto, setModalCajaAbierto] = useState<boolean>(false);

  // Alerta sonora y visual
  const [silenciado, setSilenciado] = useState<boolean>(() => {
    try {
      return localStorage.getItem('caprichos_pedidos_silenciado') === 'true';
    } catch {
      return false;
    }
  });
  const [pedidosResaltados, setPedidosResaltados] = useState<Set<string>>(new Set());

  const alternarSilencio = () => {
    setSilenciado((prev) => {
      const nuevo = !prev;
      try {
        localStorage.setItem('caprichos_pedidos_silenciado', String(nuevo));
      } catch {
        // Ignorar
      }
      return nuevo;
    });
  };

  // Carga inicial y refresco de pedidos
  const cargarDatos = useCallback(async () => {
    setErrorCarga('');
    try {
      const [resPedidos, resCaja] = await Promise.all([
        pedidosApi.listar({ limite: 100 }),
        tiene('caja/ver') || usuario?.rol === 'ADMIN'
          ? pedidosApi.obtenerCajaActual().catch(() => null)
          : Promise.resolve(null),
      ]);

      setPedidos(resPedidos.items || []);
      if (resCaja) {
        setCajaInfo(resCaja);
      }
    } catch (err: any) {
      setErrorCarga(err?.message || 'Error al cargar los pedidos');
    } finally {
      setCargando(false);
    }
  }, [tiene, usuario?.rol]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Selección por defecto del primer pedido disponible si ninguno está seleccionado
  useEffect(() => {
    if (pedidos.length > 0 && !pedidoSeleccionadoId) {
      setPedidoSeleccionadoId(pedidos[0].id);
    }
  }, [pedidos, pedidoSeleccionadoId]);

  // ==========================================
  // Socket.IO: Actualizaciones en tiempo real
  // ==========================================

  // 1. Evento: Pedido nuevo
  useEventos('pedido:nuevo', (datos: { id: string | number; codigo?: string }) => {
    const idStr = String(datos.id);

    // Sonido si el navegador lo permite y no está silenciado
    if (!silenciado) {
      reproducirCampana();
    }

    // Resaltado visual por 6 segundos
    setPedidosResaltados((prev) => new Set(prev).add(idStr));
    setTimeout(() => {
      setPedidosResaltados((prev) => {
        const next = new Set(prev);
        next.delete(idStr);
        return next;
      });
    }, 6000);

    // Actualizar datos
    pedidosApi.obtenerPorId(idStr).then((nuevoPedido) => {
      setPedidos((prev) => {
        if (prev.some((p) => String(p.id) === idStr)) {
          return prev.map((p) => (String(p.id) === idStr ? nuevoPedido : p));
        }
        return [nuevoPedido, ...prev];
      });
      // Si no había selección, seleccionar el nuevo
      setPedidoSeleccionadoId((prev) => prev || idStr);
    }).catch(() => {
      cargarDatos();
    });
  });

  // 2. Evento: Cambio de estado de pedido
  useEventos('pedido:estado', (datos: { id: string | number; estado?: string }) => {
    const idStr = String(datos.id);
    setPedidos((prev) =>
      prev.map((p) =>
        String(p.id) === idStr && datos.estado
          ? { ...p, estado: datos.estado }
          : p,
      ),
    );
    // Recargar detalle en segundo plano para sincronizar cronómetro y subestados
    pedidosApi.obtenerPorId(idStr).then((pActualizado) => {
      setPedidos((prev) =>
        prev.map((p) => (String(p.id) === idStr ? pActualizado : p)),
      );
    }).catch(() => {});
  });

  // 3. Evento: Pago de pedido registrado
  useEventos('pedido:pago', (datos: { id: string | number }) => {
    const idStr = String(datos.id);
    setPedidos((prev) =>
      prev.map((p) =>
        String(p.id) === idStr
          ? { ...p, pago_estado: 'PAGADO' }
          : p,
      ),
    );
    if (tiene('caja/ver') || usuario?.rol === 'ADMIN') {
      pedidosApi.obtenerCajaActual().then(setCajaInfo).catch(() => {});
    }
  });

  // 4. Eventos de caja
  useEventos('caja:cerrada', () => {
    pedidosApi.obtenerCajaActual().then(setCajaInfo).catch(() => {});
  });

  // ==========================================
  // Filtrado y conteos de pestañas
  // ==========================================

  // Conteos para cada pestaña (sobre la lista completa de pedidos)
  const conteosPestanas = useMemo(() => {
    const resultado: Record<ClavePestanaEstado, number> = {
      por_cobrar: 0,
      en_cocina: 0,
      listos: 0,
      en_camino: 0,
      entregados: 0,
      anulados: 0,
    };
    for (const def of PESTANAS) {
      resultado[def.id] = pedidos.filter(def.filtro).length;
    }
    return resultado;
  }, [pedidos]);

  // Filtrado según pestaña, búsqueda y dropdowns
  const pedidosFiltrados = useMemo(() => {
    const defPestana = PESTANAS.find((p) => p.id === pestanaActiva);
    const filtroPestana = defPestana ? defPestana.filtro : () => true;

    const q = busqueda.trim().toLowerCase();

    return pedidos.filter((p) => {
      // Filtro de pestaña
      if (!filtroPestana(p)) return false;

      // Filtro de búsqueda por código o cliente
      if (q) {
        const codigo = (p.codigo || '').toLowerCase();
        const cliente = (p.cliente_nombre || '').toLowerCase();
        if (!codigo.includes(q) && !cliente.includes(q)) return false;
      }

      // Filtro por canal
      if (canalFiltro !== 'Todos') {
        const canalNorm = (p.canal || '').toUpperCase();
        if (canalFiltro === 'Carta' && canalNorm !== 'CARTA') return false;
        if (canalFiltro === 'Bot' && !['BOT', 'CHATBOT'].includes(canalNorm)) return false;
        if (canalFiltro === 'Mozo' && canalNorm !== 'MOZO') return false;
        if (canalFiltro === 'Teléfono' && canalNorm !== 'TELEFONO') return false;
      }

      // Filtro por modalidad
      if (modalidadFiltro !== 'Todas') {
        const modNorm = (p.modalidad || '').toUpperCase();
        if (modalidadFiltro === 'Delivery' && modNorm !== 'DELIVERY') return false;
        if (modalidadFiltro === 'Para llevar' && !['RECOGER', 'LLEVAR'].includes(modNorm)) return false;
        if (modalidadFiltro === 'En mesa' && modNorm !== 'MESA') return false;
      }

      return true;
    });
  }, [pedidos, pestanaActiva, busqueda, canalFiltro, modalidadFiltro]);

  // Paginación sobre pedidos filtrados
  const totalFiltrados = pedidosFiltrados.length;
  const totalPaginas = Math.max(1, Math.ceil(totalFiltrados / pedidosPorPagina));
  const pedidosPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * pedidosPorPagina;
    return pedidosFiltrados.slice(inicio, inicio + pedidosPorPagina);
  }, [pedidosFiltrados, paginaActual, pedidosPorPagina]);

  // Pedido seleccionado actualmente
  const pedidoSeleccionado = useMemo(() => {
    return pedidos.find((p) => String(p.id) === String(pedidoSeleccionadoId)) || null;
  }, [pedidos, pedidoSeleccionadoId]);

  // Color de indicador según tiempo de espera
  const obtenerColorTiempo = (p: Pedido): { hex: string; bg: string } => {
    const c = p.color || p.colorEspera || 'verde';
    if (c === 'rojo') {
      return { hex: 'var(--cp-rust, #B2500F)', bg: '#FFEBE0' };
    }
    if (c === 'naranja') {
      return { hex: 'var(--cp-orange, #E67929)', bg: '#FFF3E8' };
    }
    return { hex: 'var(--cp-green, #2F7A45)', bg: 'var(--cp-greenbg, #DFF3E3)' };
  };

  // Color de borde de tarjeta según estado y selección
  const obtenerBordeTarjeta = (p: Pedido, seleccionado: boolean) => {
    if (seleccionado) return '2px solid var(--cp-navy, #0B2C3E)';
    if (pedidosResaltados.has(String(p.id))) return '2px solid var(--cp-orange, #E67929)';
    return '1px solid var(--cp-line, #E3D6C6)';
  };

  // Control de permiso de acceso mínimo al módulo
  const tienePermisoModulo =
    tiene('caja/ver') ||
    tiene('pedidos/ver') ||
    usuario?.rol === 'ADMIN' ||
    usuario?.rol === 'CAJERO';

  if (!tienePermisoModulo) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <EstadoError mensaje="No tienes permiso para acceder al módulo de Pedidos y caja." />
      </div>
    );
  }

  if (cargando) {
    return <Cargando mensaje="Cargando pedidos y estado de caja..." />;
  }

  if (errorCarga) {
    return (
      <div style={{ padding: 24 }}>
        <EstadoError
          mensaje={errorCarga}
          alReintentar={() => {
            setCargando(true);
            cargarDatos();
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Barra superior de título y control de caja/alerta */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: 22,
              color: 'var(--cp-navy, #0B2C3E)',
              margin: 0,
            }}
          >
            Pedidos y caja
          </h1>
          <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
            Verifica y gestiona pedidos, cobros y el flujo de caja en tiempo real.
          </div>
        </div>

        {/* Botones de acción y estado de caja */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Botón de alerta sonora */}
          <button
            type="button"
            onClick={alternarSilencio}
            title={silenciado ? 'Activar sonido de pedidos nuevos' : 'Silenciar sonido'}
            aria-label={silenciado ? 'Activar sonido de pedidos nuevos' : 'Silenciar sonido'}
            style={{
              minHeight: 44,
              padding: '0 14px',
              borderRadius: 12,
              border: '1.5px solid var(--cp-navy, #0B2C3E)',
              background: silenciado ? '#FAF2EB' : 'var(--cp-white, #FFFFFF)',
              color: 'var(--cp-navy, #0B2C3E)',
              fontWeight: 700,
              fontSize: 13,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            <Icono nombre={silenciado ? 'silencio' : 'sonido'} tamano={18} />
            <span>{silenciado ? 'Sonido silenciado' : 'Sonido activo'}</span>
          </button>

          {/* Estado de Caja */}
          {(tiene('caja/ver') || usuario?.rol === 'ADMIN') && (
            <button
              type="button"
              onClick={() => setModalCajaAbierto(true)}
              style={{
                minHeight: 44,
                padding: '0 14px',
                borderRadius: 12,
                border: cajaInfo?.abierta
                  ? '1.5px solid var(--cp-green, #2F7A45)'
                  : '1.5px solid var(--cp-rust, #B2500F)',
                background: cajaInfo?.abierta
                  ? 'var(--cp-greenbg, #DFF3E3)'
                  : '#FFF0E6',
                color: cajaInfo?.abierta
                  ? '#1F5C33'
                  : 'var(--cp-rust, #B2500F)',
                fontWeight: 800,
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
              }}
            >
              <Icono nombre="caja" tamano={18} />
              <span>
                {cajaInfo?.abierta
                  ? `Caja abierta · S/ ${cajaInfo.efectivoEsperado.toFixed(2)}`
                  : 'Caja cerrada · Abrir'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Grid de 2 columnas (.cj-grid) */}
      <div className="cj-grid">
        {/* Columna Izquierda: Lista de Pedidos */}
        <div className="cj-left">
          {/* Cabecera de la columna izquierda */}
          <div className="cj-head">
            {/* Pestañas por estado con conteos */}
            <div role="tablist" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PESTANAS.map((pest) => {
                const seleccionada = pestanaActiva === pest.id;
                const cantidad = conteosPestanas[pest.id] || 0;

                return (
                  <button
                    key={pest.id}
                    role="tab"
                    aria-selected={seleccionada}
                    onClick={() => {
                      setPestanaActiva(pest.id);
                      setPaginaActual(1);
                    }}
                    style={{
                      minHeight: 44,
                      padding: '0 12px',
                      borderRadius: 9999,
                      border: '1.5px solid var(--cp-navy, #0B2C3E)',
                      background: seleccionada
                        ? 'var(--cp-navy, #0B2C3E)'
                        : 'transparent',
                      color: seleccionada
                        ? 'var(--cp-cream, #FBF4EC)'
                        : 'var(--cp-navy, #0B2C3E)',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    {pest.etiqueta} · {cantidad}
                  </button>
                );
              })}
            </div>

            {/* Búsqueda y botón de filtros */}
            <div
              style={{
                background: 'var(--cp-white, #FFFFFF)',
                border: '1px solid var(--cp-line, #E3D6C6)',
                borderRadius: 12,
                padding: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label htmlFor="ord-buscar" style={{ position: 'absolute', left: -9999 }}>
                  Buscar por código o cliente
                </label>
                <input
                  id="ord-buscar"
                  type="search"
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    setPaginaActual(1);
                  }}
                  placeholder="Buscar por código o cliente"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    boxSizing: 'border-box',
                    minHeight: 44,
                    borderRadius: 9999,
                    border: '1.5px solid var(--cp-line, #E3D6C6)',
                    background: 'var(--cp-cream, #FBF4EC)',
                    color: 'var(--cp-navy, #0B2C3E)',
                    padding: '0 14px',
                    fontSize: 14,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setMostrarFiltros((prev) => !prev)}
                  aria-expanded={mostrarFiltros}
                  style={{
                    flex: 'none',
                    minHeight: 44,
                    padding: '0 12px',
                    borderRadius: 9999,
                    border: '1.5px solid var(--cp-navy, #0B2C3E)',
                    background: mostrarFiltros ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
                    color: mostrarFiltros ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-navy, #0B2C3E)',
                    fontWeight: 700,
                    fontSize: 13,
                    display: 'inline-flex',
                    gap: 6,
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <Icono nombre="filtro" tamano={16} />
                  <span>Filtros</span>
                  {(canalFiltro !== 'Todos' || modalidadFiltro !== 'Todas') && (
                    <span
                      style={{
                        minWidth: 20,
                        height: 20,
                        boxSizing: 'border-box',
                        borderRadius: 10,
                        background: 'var(--cp-orange, #E67929)',
                        color: 'var(--cp-navy, #0B2C3E)',
                        fontSize: 12,
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 5px',
                      }}
                    >
                      !
                    </span>
                  )}
                </button>
              </div>

              {/* Panel desplegable de filtros */}
              {mostrarFiltros && (
                <div
                  style={{
                    borderTop: '1px solid var(--cp-line, #E3D6C6)',
                    paddingTop: 8,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px 16px',
                  }}
                >
                  {/* Filtro Canal */}
                  <div style={{ flex: '1 1 140px' }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: '0.06em',
                        color: 'var(--cp-soft, #2C4C5D)',
                        marginBottom: 4,
                      }}
                    >
                      CANAL
                    </div>
                    <select
                      value={canalFiltro}
                      onChange={(e) => {
                        setCanalFiltro(e.target.value);
                        setPaginaActual(1);
                      }}
                      style={{
                        width: '100%',
                        minHeight: 44,
                        padding: '0 10px',
                        borderRadius: 8,
                        border: '1.5px solid var(--cp-navy, #0B2C3E)',
                        background: 'var(--cp-white, #FFFFFF)',
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {CANALES_OPCIONES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filtro Modalidad */}
                  <div style={{ flex: '1 1 140px' }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: '0.06em',
                        color: 'var(--cp-soft, #2C4C5D)',
                        marginBottom: 4,
                      }}
                    >
                      MODALIDAD
                    </div>
                    <select
                      value={modalidadFiltro}
                      onChange={(e) => {
                        setModalidadFiltro(e.target.value);
                        setPaginaActual(1);
                      }}
                      style={{
                        width: '100%',
                        minHeight: 44,
                        padding: '0 10px',
                        borderRadius: 8,
                        border: '1.5px solid var(--cp-navy, #0B2C3E)',
                        background: 'var(--cp-white, #FFFFFF)',
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {MODALIDADES_OPCIONES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Botón limpiar */}
                  <div
                    style={{
                      flex: '1 1 100%',
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: 8,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setCanalFiltro('Todos');
                        setModalidadFiltro('Todas');
                        setBusqueda('');
                        setPaginaActual(1);
                      }}
                      style={{
                        minHeight: 34,
                        border: 0,
                        background: 'transparent',
                        color: 'var(--cp-rust, #B2500F)',
                        fontWeight: 700,
                        fontSize: 12,
                        textDecoration: 'underline',
                        cursor: 'pointer',
                      }}
                    >
                      Limpiar filtros
                    </button>
                    <button
                      type="button"
                      onClick={() => setMostrarFiltros(false)}
                      style={{
                        minHeight: 34,
                        padding: '0 14px',
                        border: 0,
                        borderRadius: 8,
                        background: 'var(--cp-navy, #0B2C3E)',
                        color: 'var(--cp-cream, #FBF4EC)',
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      Listo
                    </button>
                  </div>
                </div>
              )}

              {/* Total filtrados */}
              <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)', fontWeight: 600 }}>
                {totalFiltrados} pedido(s) encontrado(s)
              </div>
            </div>
          </div>

          {/* Lista scrolleable de pedidos */}
          <div className="cj-scroll" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pedidosFiltrados.length === 0 ? (
              <EstadoVacio
                titulo="No hay pedidos en esta lista"
                descripcion="Prueba cambiando de pestaña o limpiando los filtros de búsqueda."
              />
            ) : (
              pedidosPaginados.map((p) => {
                const seleccionado = String(p.id) === String(pedidoSeleccionadoId);
                const resaltado = pedidosResaltados.has(String(p.id));
                const tiempoColor = obtenerColorTiempo(p);

                // Resumen de productos
                const resumenLineas = p.lineas
                  ? p.lineas
                      .map((l) => `${l.cantidad}x ${l.nombre}`)
                      .slice(0, 2)
                      .join(', ') + (p.lineas.length > 2 ? '...' : '')
                  : '';

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPedidoSeleccionadoId(p.id)}
                    className={`cj-pedido-card ${resaltado ? 'cj-resaltado' : ''}`}
                    style={{
                      border: obtenerBordeTarjeta(p, seleccionado),
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'Montserrat, sans-serif',
                          fontWeight: 800,
                          fontSize: 16,
                          color: 'var(--cp-navy, #0B2C3E)',
                        }}
                      >
                        {p.codigo}
                      </span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {/* Indicador de minutos y color de espera */}
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            borderRadius: 6,
                            padding: '2px 6px',
                            background: tiempoColor.bg,
                            color: tiempoColor.hex,
                          }}
                        >
                          {p.minutosEspera ?? 0}m
                        </span>
                        <Insignia
                          variante={
                            p.estado === 'ANULADO'
                              ? 'peligro'
                              : p.estado === 'ENTREGADO' || p.pago_estado === 'PAGADO'
                                ? 'exito'
                                : 'aviso'
                          }
                        >
                          {p.estado}
                        </Insignia>
                      </div>
                    </div>

                    <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
                      {p.canal} · {p.modalidad} · {p.cliente_nombre || 'Cliente'}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 13,
                        marginTop: 2,
                      }}
                    >
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '70%',
                        }}
                      >
                        {resumenLineas || `${p.modalidad}`}
                      </span>
                      <span
                        style={{
                          fontWeight: 800,
                          color: 'var(--cp-rust, #B2500F)',
                          fontSize: 14,
                        }}
                      >
                        S/ {Number(p.total).toFixed(2)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Pie de lista con paginación */}
          {totalPaginas > 1 && (
            <div className="cj-foot">
              <Paginacion
                pagina={paginaActual}
                totalPaginas={totalPaginas}
                alCambiarPagina={setPaginaActual}
              />
            </div>
          )}
        </div>

        {/* Columna Derecha: Detalle del Pedido */}
        <div className="cj-right">
          {pedidoSeleccionado ? (
            <PedidoDetalle
              pedido={pedidoSeleccionado}
              alActualizar={cargarDatos}
            />
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
                textAlign: 'center',
                color: 'var(--cp-soft, #2C4C5D)',
                fontSize: 14,
                lineHeight: '21px',
              }}
            >
              Elige un pedido de la lista para ver su detalle, cobrarlo o imprimir sus comprobantes.
            </div>
          )}
        </div>
      </div>

      {/* Modal de gestión de caja */}
      {modalCajaAbierto && (
        <ModalCaja
          cajaInfo={cajaInfo}
          alCerrar={() => setModalCajaAbierto(false)}
          alActualizarCaja={() => {
            pedidosApi.obtenerCajaActual().then(setCajaInfo).catch(() => {});
            cargarDatos();
          }}
          alSeleccionarPedidoPorCobrar={(pedidoId) => {
            setPedidoSeleccionadoId(pedidoId);
          }}
        />
      )}
    </div>
  );
}
export default PedidosAdminView;
