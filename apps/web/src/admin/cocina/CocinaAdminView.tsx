import { useCallback, useEffect, useState } from 'react';
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
} from './cocinaApi';
import {
  estaSilenciado,
  reproducirCampanaCocina,
  setSilenciado,
} from './audioAlerta';
import { ComandaTarjeta } from './ComandaTarjeta';
import { PanelAltaDemanda } from './PanelAltaDemanda';
import { ModalAgotados } from './ModalAgotados';
import { ModalMermaIndividual } from './ModalMermaIndividual';
import { ModalMermaVarios } from './ModalMermaVarios';
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

export function CocinaAdminView() {
  const { tiene } = useSesion();

  const puedeVer = tiene('cocina/ver');
  const puedeDespejar = tiene('cocina/despejar');

  // Modo de pestañas: 'area' (Pantalla del área), 'hist' (Historial), 'desp' (Despacho)
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

  // Estados de carga / error
  const [cargandoInicial, setCargandoInicial] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Audio
  const [silenciado, setSilenciadoEstado] = useState<boolean>(estaSilenciado());

  // Modales
  const [modalAgotadosAbierto, setModalAgotadosAbierto] = useState<boolean>(false);
  const [modalMermaIndAbierto, setModalMermaIndAbierto] = useState<boolean>(false);
  const [modalMermaVariosAbierto, setModalMermaVariosAbierto] = useState<boolean>(false);
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
      setAreasApi(res);
      return res;
    } catch {
      return [];
    }
  }, []);

  const cargarComandas = useCallback(async (areaId: string) => {
    try {
      setError(null);
      const res = await listarComandasArea(areaId);
      setComandas(res);
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

  const probarSonido = () => {
    reproducirCampanaCocina(true);
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
      {/* 1. Texto de referencia Kevin literal del mockup */}
      <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
        Tiempos de Kevin, desde que el cliente terminó su pedido: 25 min lo ideal,
        naranja desde 35 (retraso) y rojo desde 50 (crítico). Cada área ve solo lo
        suyo y lo despeja con un toque cuando lo terminó (acta 03).
      </div>

      {/* 2. Barra de botones superiores */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          onClick={() => setModalAgotadosAbierto(true)}
          style={{
            minHeight: '44px',
            padding: '0 14px',
            borderRadius: '12px',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            border: 0,
            background: 'var(--cp-rust)',
            color: 'var(--cp-white)',
          }}
        >
          Se acabó algo
        </button>

        <button
          type="button"
          onClick={() => setModalMermaIndAbierto(true)}
          style={{
            minHeight: '44px',
            padding: '0 14px',
            borderRadius: '12px',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            border: '1.5px solid var(--cp-navy)',
            background: 'transparent',
            color: 'var(--cp-navy)',
          }}
        >
          Registrar merma
        </button>

        <button
          type="button"
          onClick={() => setModalMermaVariosAbierto(true)}
          style={{
            minHeight: '44px',
            padding: '0 14px',
            borderRadius: '12px',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            border: '1.5px solid var(--cp-navy)',
            background: 'var(--cp-sand)',
            color: 'var(--cp-navy)',
          }}
        >
          Merma de varios productos
        </button>

        <button
          type="button"
          onClick={() => setModalPedirAlmacenAbierto(true)}
          style={{
            minHeight: '44px',
            padding: '0 14px',
            borderRadius: '12px',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            border: '1.5px solid var(--cp-navy)',
            background: 'transparent',
            color: 'var(--cp-navy)',
          }}
        >
          Pedir al almacén
        </button>

        <button
          type="button"
          onClick={alternarSonido}
          style={{
            minHeight: '44px',
            padding: '0 14px',
            borderRadius: '12px',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            border: '1.5px solid var(--cp-navy)',
            background: 'transparent',
            color: 'var(--cp-navy)',
          }}
        >
          {silenciado ? 'Sonido: silenciado' : 'Sonido: activado'}
        </button>

        <button
          type="button"
          onClick={probarSonido}
          style={{
            minHeight: '44px',
            padding: '0 14px',
            borderRadius: '12px',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            border: '1.5px dashed var(--cp-soft)',
            background: 'transparent',
            color: 'var(--cp-soft)',
          }}
        >
          Probar sonido
        </button>
      </div>

      {/* 3. Panel de Alta demanda */}
      <PanelAltaDemanda
        estado={altaDemanda}
        alCambiarEstado={(nuevo) => setAltaDemanda(nuevo)}
      />

      {/* 4. Selector de Área y Pantalla completa */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 700 }}>Área</span>

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
                border: '1.5px solid var(--cp-navy)',
                background: activa ? 'var(--cp-navy)' : 'transparent',
                color: activa ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
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
            padding: '0 14px',
            borderRadius: '12px',
            border: 0,
            background: 'var(--cp-orange)',
            color: 'var(--cp-navy)',
            fontWeight: 800,
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          Pantalla completa, sin desplazar
        </button>
      </div>

      {/* 5. Selector de Pestañas: Pantalla del área / Historial / Despacho */}
      <div
        role="group"
        aria-label="Vista de cocina"
        style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}
      >
        <button
          type="button"
          onClick={() => setModo('area')}
          style={{
            minHeight: '44px',
            padding: '0 16px',
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
          type="button"
          onClick={() => setModo('hist')}
          style={{
            minHeight: '44px',
            padding: '0 16px',
            borderRadius: '12px',
            border: '1.5px solid var(--cp-navy)',
            background: modo === 'hist' ? 'var(--cp-navy)' : 'transparent',
            color: modo === 'hist' ? 'var(--cp-cream)' : 'var(--cp-navy)',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Historial
        </button>
        <button
          type="button"
          onClick={() => setModo('desp')}
          style={{
            minHeight: '44px',
            padding: '0 16px',
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

      {/* 6. Contenido según la pestaña activa */}
      {modo === 'area' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '15px',
              letterSpacing: '0.04em',
            }}
          >
            EN COCINA · {comandas.length}
          </div>

          {comandas.length === 0 ? (
            <div style={{ color: 'var(--cp-soft)', fontSize: '13px' }}>
              Sin pedidos para esta área.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '12px',
                alignItems: 'start',
              }}
            >
              {comandas.map((c) => (
                <ComandaTarjeta
                  key={c.id}
                  comanda={c}
                  mostrarArea={areaActiva === 'todas'}
                  onDespejar={puedeDespejar ? (com) => setComandaParaDespejar(com) : undefined}
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
          alDevolverExito={() => cargarHistorial(areaSeleccionada)}
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
            zIndex: 95,
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

      {/* Modal Pantalla Completa (isKfull) */}
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
            padding: '12px',
            gap: '10px',
            boxSizing: 'border-box',
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
            <span
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '22px',
                letterSpacing: '0.05em',
              }}
            >
              {areaActiva === 'todas'
                ? 'TODAS LAS ÁREAS'
                : nombreAreaActual.toUpperCase()}
            </span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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

          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: '10px' }}>
            <div
              style={{
                flex: '1 1 0',
                minWidth: 0,
                minHeight: 0,
                overflowY: 'auto',
                background: '#14405A',
                borderRadius: '14px',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: '18px',
                }}
              >
                EN COCINA · {comandas.length}
              </div>

              {comandas.length === 0 ? (
                <div style={{ fontSize: '16px', opacity: 0.8 }}>Sin pedidos.</div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '10px',
                  }}
                >
                  {comandas.map((k) => (
                    <div
                      key={k.id}
                      style={{
                        background: 'var(--cp-cream)',
                        color: 'var(--cp-navy)',
                        borderRadius: '12px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
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
                        </span>
                        <span
                          style={{
                            fontSize: '16px',
                            fontWeight: 800,
                            borderRadius: '9999px',
                            padding: '2px 12px',
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
                          fontSize: '15px',
                          fontWeight: 800,
                          color: 'var(--cp-rust)',
                        }}
                      >
                        {k.modalidad || 'Para llevar'}
                      </div>

                      {(k.lineas || []).map((it, idx) => {
                        const opcStr = (it.opciones || [])
                          .map((o: any) => (typeof o === 'string' ? o : o?.nombre || o?.texto || ''))
                          .filter(Boolean)
                          .join(' · ');
                        return (
                          <div
                            key={it.id || idx}
                            style={{ fontSize: '16px', lineHeight: '20px' }}
                          >
                            <b>{it.cantidad}×</b> {it.nombre}{' '}
                            {opcStr && (
                              <span
                                style={{
                                  fontSize: '13px',
                                  color: 'var(--cp-soft)',
                                }}
                              >
                                {opcStr}
                              </span>
                            )}
                          </div>
                        );
                      })}

                      {k.nota && (
                        <div
                          style={{
                            border: '2px dashed var(--cp-rust)',
                            borderRadius: '8px',
                            padding: '4px 8px',
                            fontSize: '14px',
                            fontWeight: 700,
                          }}
                        >
                          Nota: {k.nota}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setComandaParaDespejar(k)}
                        style={{
                          minHeight: '52px',
                          marginTop: 'auto',
                          border: 0,
                          borderRadius: '12px',
                          background: 'var(--cp-orange)',
                          color: 'var(--cp-navy)',
                          fontWeight: 800,
                          fontSize: '17px',
                          cursor: 'pointer',
                        }}
                      >
                        Despejar
                      </button>
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
        mensaje="Saldrá de la vista de preparación y quedará en el historial del día."
        textoConfirmar="Sí, despejar"
        textoNo="No, cancelar"
        alConfirmar={ejecutarDespeje}
        alCancelar={() => setComandaParaDespejar(null)}
      />

      {/* Modales */}
      <ModalAgotados
        abierto={modalAgotadosAbierto}
        alCerrar={() => setModalAgotadosAbierto(false)}
      />
      <ModalMermaIndividual
        abierto={modalMermaIndAbierto}
        alCerrar={() => setModalMermaIndAbierto(false)}
      />
      <ModalMermaVarios
        abierto={modalMermaVariosAbierto}
        alCerrar={() => setModalMermaVariosAbierto(false)}
      />
      <ModalPedirAlmacen
        abierto={modalPedirAlmacenAbierto}
        alCerrar={() => setModalPedirAlmacenAbierto(false)}
      />
    </div>
  );
}
