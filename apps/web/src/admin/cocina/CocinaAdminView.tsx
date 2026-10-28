import { comoLista } from '../../comun/comoLista';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  AltaDemandaEstado,
  AreaCocina,
  Comanda,
  HistorialComanda,
  PedidoDespacho,
} from './cocinaTipos';
import {
  despejarComanda,
  devolverComanda,
  listarAreasCocina,
  listarComandasArea,
  listarDespacho,
  listarHistorialCocina,
  obtenerAltaDemanda,
  pedirInsumosAlmacen,
  registrarMermaIndividual,
  registrarMermaMultiple,
} from './cocinaApi';
import {
  estaSilenciado,
  reproducirCampanaCocina,
  setSilenciado,
} from './audioAlerta';
import { ComandaTarjeta, LineasComanda, areasQueFaltan } from './ComandaTarjeta';
import { ModalAgotados } from './ModalAgotados';
import { ModalMerma } from './ModalMerma';
import { ModalPedirAlmacen } from './ModalPedirAlmacen';
import { HistorialView } from './HistorialView';
import { DespachoView } from './DespachoView';
import { Confirmar } from '../../comun/Confirmar';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { useEventos } from '../../comun/socket';
import { useSesion } from '../../comun/sesion';

export type ModoCocina = 'area' | 'hist' | 'desp';

const AREAS_MOCKUP = [
  { id: 'todas', n: 'Todas' },
  { id: 'bebidas', n: 'Bebidas' },
  { id: 'postres', n: 'Postres' },
  { id: 'salados', n: 'Salados' },
] as const;

/** Botón del selector de áreas que corresponde a un área de cocina por su nombre. */
function idMockupDeArea(nombre: string): string {
  const nom = nombre.toLowerCase();
  if (nom.includes('bebida') || nom.includes('barra')) return 'bebidas';
  if (nom.includes('salado') || nom.includes('cocina')) return 'salados';
  if (nom.includes('postre')) return 'postres';
  return 'todas';
}

/**
 * Ordena las comandas por hora de llegada ascendente (FIFO estricto).
 * Primero las pendientes de la propia área; después las de solo seguimiento (ya despejadas).
 * La comanda que llegó primero (menor fecha / mayor tiempo transcurrido) va primero.
 */
export function ordenarComandasPorHoraLlegada(lista: Comanda[]): Comanda[] {
  return [...lista].sort((a, b) => {
    if (!!a.despejada !== !!b.despejada) return a.despejada ? 1 : -1;
    const fechaA = a.llego_en || a.creado_en ? new Date(a.llego_en || a.creado_en!).getTime() : 0;
    const fechaB = b.llego_en || b.creado_en ? new Date(b.llego_en || b.creado_en!).getTime() : 0;
    if (fechaA > 0 && fechaB > 0 && fechaA !== fechaB) {
      return fechaA - fechaB; // Ascendente (menor timestamp = más antiguo = llegó primero)
    }
    const minA = a.minutos ?? a.minutosEspera ?? 0;
    const minB = b.minutos ?? b.minutosEspera ?? 0;
    if (minA !== minB) {
      return minB - minA; // Mayor tiempo transcurrido = llegó primero
    }
    const pIdA = a.pedidoId ? BigInt(a.pedidoId) : 0n;
    const pIdB = b.pedidoId ? BigInt(b.pedidoId) : 0n;
    if (pIdA !== pIdB) {
      return pIdA < pIdB ? -1 : 1;
    }
    return (a.codigo || a.ticket || '').localeCompare(b.codigo || b.ticket || '');
  });
}

/**
 * Vista Todas: el servidor devuelve una fila por área del pedido (la pantalla TV las cuenta así),
 * pero aquí cada pedido es una sola boleta con el estado de todas sus áreas.
 * La fila que se muestra es una pendiente (si la hay), porque la boleta lleva las áreas completas.
 */
export function agruparPorPedido(lista: Comanda[]): Comanda[] {
  const porPedido = new Map<string, Comanda>();
  for (const c of lista) {
    const previa = porPedido.get(c.pedidoId);
    if (!previa || (previa.despejada && !c.despejada)) porPedido.set(c.pedidoId, c);
  }
  return [...porPedido.values()];
}

export function CocinaAdminView() {
  const { tiene } = useSesion();

  const puedeVer = tiene('cocina/ver');
  const puedeDespejar = tiene('cocina/despejar');

  // Modo de pestañas: 'area' (Pantalla del área), 'hist' (Despejadas hoy), 'desp' (Despacho)
  const [modo, setModo] = useState<ModoCocina>('area');
  const [areaActiva, setAreaActiva] = useState<string>('todas');
  const [areaSeleccionada, setAreaSeleccionada] = useState<string>('');
  const [areasApi, setAreasApi] = useState<AreaCocina[]>([]);

  // Datos
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [historial, setHistorial] = useState<HistorialComanda[]>([]);
  const [despacho, setDespacho] = useState<PedidoDespacho[]>([]);
  const [altaDemanda, setAltaDemanda] = useState<AltaDemandaEstado>({
    activa: false,
    minutos: 0,
    pausa: false,
  });

  // Estados de carga / error / retroalimentación
  const [cargandoInicial, setCargandoInicial] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mensajeAccion, setMensajeAccion] = useState<string | null>(null);

  // Audio
  const [silenciado, setSilenciadoEstado] = useState<boolean>(estaSilenciado());

  // Tooltip de ayuda activa en barra de acciones
  const [ayudaActiva, setAyudaActiva] = useState<string | null>(null);
  const [ayudaHover, setAyudaHover] = useState<string | null>(null);

  // Modales
  const [modalAgotadosAbierto, setModalAgotadosAbierto] = useState<boolean>(false);
  const [modalMermaAbierto, setModalMermaAbierto] = useState<boolean>(false);
  const [modalPedirAlmacenAbierto, setModalPedirAlmacenAbierto] = useState<boolean>(false);
  const [kFullAbierto, setKFullAbierto] = useState<boolean>(false);

  // Despeje con confirmación
  const [comandaParaDespejar, setComandaParaDespejar] = useState<Comanda | null>(null);
  const [despejando, setDespejando] = useState<boolean>(false);

  // Floating Undo toast
  const [undoInfo, setUndoInfo] = useState<{
    pedidoId: string;
    areaId: string;
    texto: string;
  } | null>(null);

  const cargarAreas = useCallback(async () => {
    try {
      const res = await listarAreasCocina();
      setAreasApi(comoLista<AreaCocina>(res));
      return res;
    } catch {
      return [];
    }
  }, []);

  const cargarComandas = useCallback(async (areaId: string) => {
    try {
      setError(null);
      const res = await listarComandasArea(areaId);
      setComandas(ordenarComandasPorHoraLlegada(res));
    } catch (err: any) {
      setError(err?.message || 'Error al cargar comandas de cocina');
    }
  }, []);

  const cargarHistorial = useCallback(async (areaId: string) => {
    try {
      setError(null);
      const res = await listarHistorialCocina(areaId);
      setHistorial(res);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar historial de cocina');
    }
  }, []);

  const cargarDespacho = useCallback(async () => {
    try {
      setError(null);
      const res = await listarDespacho();
      setDespacho(res);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar vista de despacho');
    }
  }, []);

  const cargarAltaDemanda = useCallback(async () => {
    try {
      const res = await obtenerAltaDemanda();
      setAltaDemanda(res);
    } catch {
      // Ignorar fallo secundario
    }
  }, []);

  // Inicialización (montaje inicial)
  useEffect(() => {
    if (!puedeVer) {
      setCargandoInicial(false);
      return;
    }

    const inicializar = async () => {
      try {
        setCargandoInicial(true);
        const listaAreas = await listarAreasCocina();
        setAreasApi(listaAreas);
        const areaDefault = listaAreas.length > 0 ? listaAreas[0].id : '';
        setAreaSeleccionada(areaDefault);
        // El botón marcado debe ser el de los datos que se muestran (antes quedaba «Todas» con el área cargada)
        setAreaActiva(idMockupDeArea(listaAreas[0]?.nombre ?? ''));
        await cargarAltaDemanda();
      } catch (err: any) {
        setError(err?.message || 'Error al iniciar módulo de cocina');
      } finally {
        setCargandoInicial(false);
      }
    };

    inicializar();
  }, [puedeVer, cargarAltaDemanda]);

  // Recarga al cambiar modo o área activa
  useEffect(() => {
    if (cargandoInicial || !puedeVer) return;

    if (modo === 'area') {
      cargarComandas(areaSeleccionada);
    } else if (modo === 'hist') {
      cargarHistorial(areaSeleccionada);
    } else if (modo === 'desp') {
      cargarDespacho();
    }
  }, [
    modo,
    areaSeleccionada,
    cargandoInicial,
    puedeVer,
    cargarComandas,
    cargarHistorial,
    cargarDespacho,
  ]);

  // Auto-cierre de mensaje de retroalimentación
  useEffect(() => {
    if (!mensajeAccion) return;
    const t = setTimeout(() => setMensajeAccion(null), 4000);
    return () => clearTimeout(t);
  }, [mensajeAccion]);

  // Cerrar tooltips al hacer click afuera
  useEffect(() => {
    const alClicAfuera = () => setAyudaActiva(null);
    window.addEventListener('click', alClicAfuera);
    return () => window.removeEventListener('click', alClicAfuera);
  }, []);

  // Socket.IO
  useEventos('pedido:nuevo', () => {
    reproducirCampanaCocina();
    cargarAreas();
    if (modo === 'area') cargarComandas(areaSeleccionada);
    if (modo === 'desp') cargarDespacho();
  });

  useEventos('cocina:comanda', () => {
    cargarAreas();
    if (modo === 'area') cargarComandas(areaSeleccionada);
    if (modo === 'hist') cargarHistorial(areaSeleccionada);
    if (modo === 'desp') cargarDespacho();
  });

  useEventos('pedido:estado', () => {
    cargarAreas();
    if (modo === 'area') cargarComandas(areaSeleccionada);
    if (modo === 'desp') cargarDespacho();
  });

  useEventos('cocina:alta-demanda', (datos: AltaDemandaEstado) => {
    setAltaDemanda(datos);
  });

  const alternarSonido = () => {
    const nuevo = !silenciado;
    setSilenciadoEstado(nuevo);
    setSilenciado(nuevo);
  };

  const seleccionarAreaMockup = (areaId: string) => {
    setAreaActiva(areaId);
    if (areaId === 'todas') {
      setAreaSeleccionada('');
      return;
    }
    const match = areasApi.find((a) => {
      const nom = a.nombre.toLowerCase();
      if (areaId === 'bebidas') return nom.includes('bebida') || nom.includes('barra');
      if (areaId === 'salados') return nom.includes('salado') || nom.includes('cocina');
      if (areaId === 'postres') return nom.includes('postre');
      return false;
    });
    setAreaSeleccionada(match ? match.id : areaId);
  };

  // Despejar comanda
  const ejecutarDespeje = async () => {
    if (!comandaParaDespejar) return;
    try {
      setDespejando(true);
      await despejarComanda(
        comandaParaDespejar.pedidoId,
        comandaParaDespejar.areaId,
      );

      const cod = comandaParaDespejar.ticket || comandaParaDespejar.codigo;
      const nomArea =
        areaActiva === 'todas'
          ? ''
          : ` (${AREAS_MOCKUP.find((a) => a.id === areaActiva)?.n || areaActiva})`;
      setUndoInfo({
        pedidoId: comandaParaDespejar.pedidoId,
        areaId: comandaParaDespejar.areaId,
        texto: `${cod}: despejado${nomArea}`,
      });

      setComandaParaDespejar(null);
      await cargarComandas(areaSeleccionada);
    } catch (err: any) {
      setError(err?.message || 'Error al despejar la comanda');
      setComandaParaDespejar(null);
    } finally {
      setDespejando(false);
    }
  };

  // Deshacer despeje
  const ejecutarDeshacer = async () => {
    if (!undoInfo) return;
    try {
      await devolverComanda(undoInfo.pedidoId, undoInfo.areaId);
      setUndoInfo(null);
      await cargarComandas(areaSeleccionada);
    } catch (err: any) {
      setError(err?.message || 'No se pudo deshacer el despeje');
    }
  };

  const nombreAreaActual =
    AREAS_MOCKUP.find((a) => a.id === areaActiva)?.n || 'Todas';

  // En Todas: una boleta por pedido, sin Despejar (no hay un área actual que despeje)
  const enTodas = areaActiva === 'todas';
  const tarjetas = enTodas ? agruparPorPedido(comandas) : comandas;

  if (!puedeVer) {
    return (
      <div style={{ padding: '24px' }}>
        <EstadoError mensaje="No tienes permiso para ver la pantalla de cocina." />
      </div>
    );
  }

  if (cargandoInicial) {
    return (
      <div style={{ padding: '32px' }}>
        <Cargando mensaje="Cargando pantalla de cocina..." />
      </div>
    );
  }

  // Componente interno para botón de acción con icono y tooltip '?'
  const renderBotonAccion = (
    id: string,
    texto: string,
    explicacion: string,
    onClick: () => void,
    estilosBoton: React.CSSProperties,
    icono: React.ReactNode,
  ) => {
    const abierto = ayudaActiva === id || ayudaHover === id;

    return (
      <div
        key={id}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          position: 'relative',
          gap: '2px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClick}
          style={{
            minHeight: '44px',
            padding: '0 14px',
            borderRadius: '12px',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxSizing: 'border-box',
            ...estilosBoton,
          }}
        >
          {icono}
          <span>{texto}</span>
        </button>

        <button
          type="button"
          aria-label={`¿Para qué sirve ${texto}?`}
          aria-expanded={abierto}
          aria-controls={`tooltip-${id}`}
          onClick={(e) => {
            e.stopPropagation();
            setAyudaActiva((prev) => (prev === id ? null : id));
          }}
          onMouseEnter={() => setAyudaHover(id)}
          onMouseLeave={() => setAyudaHover(null)}
          onFocus={() => setAyudaHover(id)}
          onBlur={() => setAyudaHover(null)}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '14px',
            border: '1.5px solid var(--cp-soft)',
            background: abierto ? 'var(--cp-navy)' : 'var(--cp-cream)',
            color: abierto ? 'var(--cp-cream)' : 'var(--cp-navy)',
            fontWeight: 800,
            fontSize: '13px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0,
          }}
        >
          ?
        </button>

        {abierto && (
          <div
            id={`tooltip-${id}`}
            role="tooltip"
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              zIndex: 80,
              background: 'var(--cp-navy)',
              color: 'var(--cp-cream)',
              fontSize: '12px',
              lineHeight: '1.4',
              fontWeight: 600,
              borderRadius: '8px',
              padding: '8px 12px',
              boxShadow: '0 8px 24px rgba(11, 44, 62, 0.35)',
              minWidth: '220px',
              maxWidth: '300px',
              pointerEvents: 'none',
              whiteSpace: 'normal',
            }}
          >
            {explicacion}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '100%',
        boxSizing: 'border-box',
        fontFamily: 'Montserrat, system-ui, sans-serif',
        color: 'var(--cp-navy)',
      }}
    >
      {/* 1. Texto de ayuda de los tiempos */}
      <div style={{ fontSize: '13px', color: 'var(--cp-soft)', lineHeight: '1.5' }}>
        Cada área ve solo lo suyo y lo despeja con un toque cuando lo terminó. Los
        tiempos cuentan desde que el cliente terminó su pedido: naranja desde 35
        min (retraso) y rojo desde 50 min (crítico).
      </div>

      {/* 2. Indicador pequeño de solo lectura de Alta Demanda (RQ-COC-03) */}
      {altaDemanda.activa && (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Link
            to="/admin/configuracion"
            data-testid="indicador-alta-demanda"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: '10px',
              background: 'var(--cp-rust)',
              color: 'var(--cp-white)',
              fontWeight: 800,
              fontSize: '13px',
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(184, 51, 42, 0.25)',
              transition: 'opacity 0.2s ease',
            }}
            title="Ir a Configuración para cambiar alta demanda"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>
              Alta demanda +{altaDemanda.minutos} min
              {altaDemanda.pausa ? ' · Pedidos pausados' : ''}
            </span>
            <span
              style={{
                fontSize: '11px',
                textDecoration: 'underline',
                opacity: 0.9,
                fontWeight: 600,
              }}
            >
              Configurar
            </span>
          </Link>
        </div>
      )}

      {/* 3. Mensaje de retroalimentación de acción */}
      {mensajeAccion && (
        <div
          role="status"
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'var(--cp-greenbg, #e8f5e9)',
            border: '1px solid #2f9e57',
            color: '#1b5e20',
            fontSize: '13px',
            fontWeight: 700,
          }}
        >
          {mensajeAccion}
        </div>
      )}

      {/* 4. Barra de acciones de cocina con iconos SVG y '?' accesible */}
      <div
        role="toolbar"
        aria-label="Acciones de cocina"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
        }}
      >
        {renderBotonAccion(
          'agotado',
          'Marcar agotado',
          'Marca un producto, sabor u opción que se acabó hoy. Deja de ofrecerse al instante en la carta y el chatbot.',
          () => setModalAgotadosAbierto(true),
          {
            border: 0,
            background: 'var(--cp-rust)',
            color: 'var(--cp-white)',
          },
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>,
        )}

        {renderBotonAccion(
          'pedir-almacen',
          'Pedir al almacén',
          'Pide insumos necesarios al almacén central. Suena en su pantalla hasta que marquen recibido.',
          () => setModalPedirAlmacenAbierto(true),
          {
            border: '1.5px solid var(--cp-navy)',
            background: 'transparent',
            color: 'var(--cp-navy)',
          },
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>,
        )}

        {renderBotonAccion(
          'merma',
          'Registrar mermas',
          'Registra la pérdida de uno o varios productos o insumos por caída, vencimiento, mala preparación o calibración.',
          () => setModalMermaAbierto(true),
          {
            border: '1.5px solid var(--cp-navy)',
            background: 'transparent',
            color: 'var(--cp-navy)',
          },
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>,
        )}

        <button
          type="button"
          role="switch"
          aria-checked={!silenciado}
          aria-label={silenciado ? 'Sonido apagado. Clic para encender' : 'Sonido encendido. Clic para apagar'}
          onClick={alternarSonido}
          style={{
            minHeight: '44px',
            padding: '0 14px',
            borderRadius: '12px',
            border: `1.5px solid ${!silenciado ? '#22C55E' : 'var(--cp-navy)'}`,
            background: !silenciado ? '#DCFCE7' : 'transparent',
            color: 'var(--cp-navy)',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {silenciado ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          )}
          <span>Sonido</span>
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: !silenciado ? '#22C55E' : 'var(--cp-soft)',
              marginLeft: '2px',
            }}
          />
        </button>
      </div>

      {/* 5. Selector de Área y Pantalla completa */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
          marginTop: '4px',
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 700, marginRight: '4px' }}>
          Área
        </span>

        {AREAS_MOCKUP.map((a) => {
          const activa = areaActiva === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => seleccionarAreaMockup(a.id)}
              style={{
                minHeight: '44px',
                padding: '0 16px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                background: activa ? 'var(--cp-navy)' : 'transparent',
                color: activa ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {a.n}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setKFullAbierto(true)}
          style={{
            minHeight: '44px',
            padding: '0 16px',
            borderRadius: '12px',
            border: 0,
            background: 'var(--cp-orange)',
            color: 'var(--cp-navy)',
            fontWeight: 800,
            fontSize: '12px',
            cursor: 'pointer',
            marginLeft: 'auto',
          }}
        >
          Pantalla completa, sin desplazar
        </button>
      </div>

      {/* 6. Selector de Pestañas: Pantalla del área / Despejadas hoy / Despacho */}
      <div
        role="tablist"
        aria-label="Vista de cocina"
        style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}
      >
        <button
          role="tab"
          aria-selected={modo === 'area'}
          type="button"
          onClick={() => setModo('area')}
          style={{
            minHeight: '44px',
            padding: '0 18px',
            borderRadius: '12px',
            border: '1.5px solid var(--cp-navy)',
            background: modo === 'area' ? 'var(--cp-navy)' : 'transparent',
            color: modo === 'area' ? 'var(--cp-cream)' : 'var(--cp-navy)',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Pantalla del área
        </button>
        <button
          role="tab"
          aria-selected={modo === 'hist'}
          type="button"
          onClick={() => setModo('hist')}
          style={{
            minHeight: '44px',
            padding: '0 18px',
            borderRadius: '12px',
            border: '1.5px solid var(--cp-navy)',
            background: modo === 'hist' ? 'var(--cp-navy)' : 'transparent',
            color: modo === 'hist' ? 'var(--cp-cream)' : 'var(--cp-navy)',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Despejadas hoy
        </button>
        <button
          role="tab"
          aria-selected={modo === 'desp'}
          type="button"
          onClick={() => setModo('desp')}
          style={{
            minHeight: '44px',
            padding: '0 18px',
            borderRadius: '12px',
            border: '1.5px solid var(--cp-navy)',
            background: modo === 'desp' ? 'var(--cp-navy)' : 'transparent',
            color: modo === 'desp' ? 'var(--cp-cream)' : 'var(--cp-navy)',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Despacho
        </button>
      </div>

      {/* Mensajes de error general */}
      {error && <EstadoError mensaje={error} />}

      {/* 7. Contenido según la pestaña activa */}
      {modo === 'area' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '15px',
              letterSpacing: '0.04em',
            }}
          >
            EN COCINA · {tarjetas.filter((c) => !c.despejada).length}
          </div>

          {tarjetas.length === 0 ? (
            <div style={{ color: 'var(--cp-soft)', fontSize: '13px', padding: '16px 0' }}>
              Sin pedidos para esta área.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                gap: '16px',
                width: '100%',
                alignItems: 'stretch',
                boxSizing: 'border-box',
              }}
            >
              {tarjetas.map((c) => (
                <ComandaTarjeta
                  key={enTodas ? c.pedidoId : c.id}
                  comanda={c}
                  mostrarArea={enTodas}
                  soloArea={!enTodas}
                  soloLectura={enTodas}
                  onDespejar={puedeDespejar && !enTodas ? (com) => setComandaParaDespejar(com) : undefined}
                  despejando={despejando}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {modo === 'hist' && (
        <HistorialView
          historial={historial}
          nombreAreaActual={nombreAreaActual}
          alDevolverExito={async () => {
            await cargarHistorial(areaSeleccionada);
            await cargarComandas(areaSeleccionada);
          }}
        />
      )}

      {modo === 'desp' && <DespachoView pedidos={despacho} />}

      {/* Floating Undo Toast (Deshacer) */}
      {undoInfo && (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: '16px',
            zIndex: 120,
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            background: 'var(--cp-navy)',
            color: 'var(--cp-cream)',
            borderRadius: '14px',
            padding: '10px 12px 10px 16px',
            boxShadow: '0 10px 30px rgba(11,44,62,0.4)',
            maxWidth: 'calc(100% - 24px)',
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 700 }}>
            {undoInfo.texto}
          </span>
          <button
            type="button"
            onClick={ejecutarDeshacer}
            style={{
              minHeight: '44px',
              padding: '0 16px',
              border: 0,
              borderRadius: '10px',
              background: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Deshacer
          </button>
          <button
            type="button"
            onClick={() => setUndoInfo(null)}
            aria-label="Cerrar aviso"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '22px',
              border: 0,
              background: 'rgba(255,255,255,0.12)',
              color: 'var(--cp-cream)',
              fontSize: '18px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Modal Pantalla Completa (kFullAbierto) */}
      {kFullAbierto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99,
            background: 'var(--cp-navy)',
            color: 'var(--cp-cream)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            padding: '16px',
            gap: '14px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '24px',
                letterSpacing: '0.05em',
              }}
            >
              {areaActiva === 'todas'
                ? 'TODAS LAS ÁREAS'
                : nombreAreaActual.toUpperCase()}
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {AREAS_MOCKUP.map((a) => {
                const activa = areaActiva === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => seleccionarAreaMockup(a.id)}
                    style={{
                      minHeight: '44px',
                      padding: '0 14px',
                      borderRadius: '9999px',
                      border: '1.5px solid var(--cp-cream)',
                      background: activa ? 'var(--cp-cream)' : 'transparent',
                      color: activa ? 'var(--cp-navy)' : 'var(--cp-cream)',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    {a.n}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setKFullAbierto(false)}
                style={{
                  minHeight: '44px',
                  padding: '0 16px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--cp-cream)',
                  background: 'transparent',
                  color: 'var(--cp-cream)',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Salir
              </button>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                flex: '1 1 0',
                minWidth: 0,
                minHeight: 0,
                overflowY: 'auto',
                background: '#14405A',
                borderRadius: '14px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: '18px',
                }}
              >
                EN COCINA · {comandas.filter((c) => !c.despejada).length}
              </div>

              {comandas.length === 0 ? (
                <div style={{ fontSize: '16px', opacity: 0.8, padding: '24px 0' }}>
                  Sin pedidos para esta área.
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                    gap: '16px',
                    width: '100%',
                  }}
                >
                  {comandas.map((k) => (
                    <div
                      key={k.id}
                      style={{
                        background: 'var(--cp-cream)',
                        color: 'var(--cp-navy)',
                        borderRadius: '14px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'Montserrat, sans-serif',
                            fontWeight: 800,
                            fontSize: '22px',
                          }}
                        >
                          {k.ticket || k.codigo}
                          {k.cliente && (
                            <span style={{ marginLeft: 8, fontSize: '12px', fontWeight: 600, color: 'var(--cp-soft)' }}>
                              {k.cliente}
                            </span>
                          )}
                        </span>
                        <span
                          style={{
                            fontSize: '15px',
                            fontWeight: 800,
                            borderRadius: '9999px',
                            padding: '3px 12px',
                            background:
                              (k.minutos ?? 0) >= 50
                                ? 'var(--cp-rust)'
                                : (k.minutos ?? 0) >= 35
                                ? 'var(--cp-orange)'
                                : 'var(--cp-line)',
                            color:
                              (k.minutos ?? 0) >= 50
                                ? 'var(--cp-white)'
                                : 'var(--cp-navy)',
                          }}
                        >
                          {k.minutos ?? 0} min
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 800,
                          color: 'var(--cp-rust)',
                        }}
                      >
                        {k.modalidad || 'Para llevar'}
                      </div>

                      {k.despejada && (
                        <div
                          role="status"
                          style={{
                            border: '1.5px solid #2F7A45',
                            borderRadius: '8px',
                            padding: '6px 10px',
                            fontSize: '13px',
                            fontWeight: 700,
                          }}
                        >
                          Tu área ya está lista
                          {areasQueFaltan(k).length > 0
                            ? `, falta: ${areasQueFaltan(k).join(', ')}`
                            : ''}
                        </div>
                      )}

                      <LineasComanda comanda={k} />

                      {k.nota && (
                        <div
                          style={{
                            border: '1.5px dashed var(--cp-rust)',
                            borderRadius: '8px',
                            padding: '6px 10px',
                            fontSize: '13px',
                            fontWeight: 700,
                          }}
                        >
                          Nota: {k.nota}
                        </div>
                      )}

                      {puedeDespejar && !k.despejada && (
                        <button
                          type="button"
                          onClick={() => setComandaParaDespejar(k)}
                          style={{
                            minHeight: '48px',
                            marginTop: 'auto',
                            border: 0,
                            borderRadius: '12px',
                            background: 'var(--cp-orange)',
                            color: 'var(--cp-navy)',
                            fontWeight: 800,
                            fontSize: '15px',
                            cursor: 'pointer',
                          }}
                        >
                          Despejar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmación Sí/No de Despeje */}
      <Confirmar
        abierto={!!comandaParaDespejar}
        titulo={`¿Despejar comanda ${
          comandaParaDespejar?.ticket || comandaParaDespejar?.codigo
        }?`}
        mensaje="Tu área quedará lista. El pedido sale de cocina cuando todas sus áreas estén listas."
        textoConfirmar="Sí, despejar"
        textoNo="No, cancelar"
        alConfirmar={ejecutarDespeje}
        alCancelar={() => setComandaParaDespejar(null)}
      />

      {/* Modales conectados con la API */}
      <ModalAgotados
        abierto={modalAgotadosAbierto}
        alCerrar={() => setModalAgotadosAbierto(false)}
      />
      <ModalMerma
        abierto={modalMermaAbierto}
        alCerrar={() => setModalMermaAbierto(false)}
        alGuardar={async (lineas, codigoSupervisor) => {
          try {
            if (lineas.length === 1) {
              const l = lineas[0];
              await registrarMermaIndividual({
                insumoId: l.insumoId,
                cantidad: l.cantidad,
                origen: l.origen,
                motivo: l.motivo,
              }, codigoSupervisor);
              setMensajeAccion(`Merma registrada: ${l.cantidad} ${l.unidad} de ${l.insumoNombre}.`);
            } else {
              await registrarMermaMultiple({
                motivoGlobal: 'Desecho',
                lineas: lineas.map((l) => ({
                  insumoId: l.insumoId,
                  cantidad: l.cantidad,
                  origen: l.origen,
                  destino: l.destino,
                })),
              }, codigoSupervisor);
              setMensajeAccion(`Merma múltiple registrada para ${lineas.length} líneas.`);
            }
          } catch (err: any) {
            setError(err?.message || 'Error al registrar merma');
            throw err;
          }
        }}
      />
      <ModalPedirAlmacen
        abierto={modalPedirAlmacenAbierto}
        alCerrar={() => setModalPedirAlmacenAbierto(false)}
        alEnviar={async (datos) => {
          try {
            await pedirInsumosAlmacen({
              items: datos.items,
              nota: datos.nota,
              area: 'Cocina',
            });
            setMensajeAccion('Pedido de insumos enviado al almacén con éxito.');
          } catch (err: any) {
            setError(err?.message || 'Error al enviar pedido al almacén');
            throw err;
          }
        }}
      />
    </div>
  );
}
