import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  AltaDemandaEstado,
  AreaCocina,
  Comanda,
  HistorialComanda,
  PedidoDespacho,
} from './cocinaTipos';
import {
  despejarComanda,
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
import { HistorialView } from './HistorialView';
import { DespachoView } from './DespachoView';
import { Confirmar } from '../../comun/Confirmar';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { EstadoError } from '../../comun/EstadoError';
import { useEventos } from '../../comun/socket';
import { useSesion } from '../../comun/sesion';

export type ModoCocina = 'comandas' | 'historial' | 'despacho';

export function CocinaAdminView() {
  const navigate = useNavigate();
  const { tiene } = useSesion();

  // Permisos requeridos
  const puedeVer = tiene('cocina/ver');
  const puedeDespejar = tiene('cocina/despejar');

  // Estado de navegación
  const [modo, setModo] = useState<ModoCocina>('comandas');
  const [areas, setAreas] = useState<AreaCocina[]>([]);
  const [areaSeleccionada, setAreaSeleccionada] = useState<string>(''); // '' = Todas las áreas

  // Estado de datos
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [historial, setHistorial] = useState<HistorialComanda[]>([]);
  const [despacho, setDespacho] = useState<PedidoDespacho[]>([]);
  const [altaDemanda, setAltaDemanda] = useState<AltaDemandaEstado>({
    activa: false,
    minutos: 0,
    pausa: false,
  });

  // Estados de carga y error
  const [cargandoInicial, setCargandoInicial] = useState<boolean>(true);
  const [cargandoDatos, setCargandoDatos] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Audio y notificaciones en vivo
  const [silenciado, setSilenciadoEstado] = useState<boolean>(estaSilenciado());
  const [avisoVisual, setAvisoVisual] = useState<string | null>(null);

  // Modal Agotados ("Se acabó algo")
  const [modalAgotadosAbierto, setModalAgotadosAbierto] = useState<boolean>(false);

  // Confirmación de Despeje
  const [comandaParaDespejar, setComandaParaDespejar] = useState<Comanda | null>(null);
  const [despejando, setDespejando] = useState<boolean>(false);

  // 1. Cargar áreas de cocina
  const cargarAreas = useCallback(async () => {
    try {
      const res = await listarAreasCocina();
      setAreas(res);
      if (!areaSeleccionada && res.length > 0) {
        setAreaSeleccionada(res[0].id);
      }
      return res;
    } catch (err: any) {
      setError(err?.message || 'Error al cargar áreas de cocina');
      return [];
    }
  }, [areaSeleccionada]);

  // 2. Cargar comandas activas
  const cargarComandas = useCallback(async (areaId: string) => {
    try {
      setCargandoDatos(true);
      setError(null);
      const res = await listarComandasArea(areaId);
      setComandas(res);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar comandas de cocina');
    } finally {
      setCargandoDatos(false);
    }
  }, []);

  // 3. Cargar historial
  const cargarHistorial = useCallback(async (areaId: string) => {
    try {
      setCargandoDatos(true);
      setError(null);
      const res = await listarHistorialCocina(areaId);
      setHistorial(res);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar historial de cocina');
    } finally {
      setCargandoDatos(false);
    }
  }, []);

  // 4. Cargar despacho
  const cargarDespacho = useCallback(async () => {
    try {
      setCargandoDatos(true);
      setError(null);
      const res = await listarDespacho();
      setDespacho(res);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar vista de despacho');
    } finally {
      setCargandoDatos(false);
    }
  }, []);

  // 5. Cargar estado de alta demanda
  const cargarAltaDemanda = useCallback(async () => {
    try {
      const estado = await obtenerAltaDemanda();
      setAltaDemanda(estado);
    } catch {
      // No bloquear pantalla si falla alta demanda
    }
  }, []);

  // Inicialización
  useEffect(() => {
    if (!puedeVer) {
      setCargandoInicial(false);
      return;
    }

    const inicializar = async () => {
      try {
        setCargandoInicial(true);
        const listaAreas = await listarAreasCocina();
        setAreas(listaAreas);
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

  // Recargar según modo y área activa
  useEffect(() => {
    if (cargandoInicial || !puedeVer) return;

    if (modo === 'comandas') {
      cargarComandas(areaSeleccionada);
    } else if (modo === 'historial') {
      cargarHistorial(areaSeleccionada);
    } else if (modo === 'despacho') {
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

  // Sincronizaciones Socket.IO en vivo
  useEventos('pedido:nuevo', (datos: any) => {
    reproducirCampanaCocina();

    const codigoTicket = datos?.codigo || datos?.ticket || 'Nuevo';
    setAvisoVisual(`¡Nuevo pedido en cocina! (${codigoTicket})`);
    setTimeout(() => setAvisoVisual(null), 6000);

    cargarAreas();
    if (modo === 'comandas') cargarComandas(areaSeleccionada);
    if (modo === 'despacho') cargarDespacho();
  });

  useEventos('cocina:comanda', () => {
    cargarAreas();
    if (modo === 'comandas') cargarComandas(areaSeleccionada);
    if (modo === 'historial') cargarHistorial(areaSeleccionada);
    if (modo === 'despacho') cargarDespacho();
  });

  useEventos('pedido:estado', () => {
    cargarAreas();
    if (modo === 'comandas') cargarComandas(areaSeleccionada);
    if (modo === 'despacho') cargarDespacho();
  });

  useEventos('cocina:alta-demanda', (datos: AltaDemandaEstado) => {
    setAltaDemanda(datos);
    if (datos.activa) {
      setAvisoVisual(
        `Alta demanda activada (+${datos.minutos} min)${
          datos.mensaje ? ` · ${datos.mensaje}` : ''
        }`,
      );
    } else {
      setAvisoVisual(
        `Alta demanda desactivada${datos.mensaje ? ` · ${datos.mensaje}` : ''}`,
      );
    }
    setTimeout(() => setAvisoVisual(null), 6000);
  });

  // Alternar sonido activado / silenciado
  const alternarSonido = () => {
    const nuevo = !silenciado;
    setSilenciadoEstado(nuevo);
    setSilenciado(nuevo);
  };

  const probarSonido = () => {
    reproducirCampanaCocina(true);
  };

  // Ejecución de Despeje con confirmación Sí/No
  const ejecutarDespeje = async () => {
    if (!comandaParaDespejar) return;
    try {
      setDespejando(true);
      await despejarComanda(
        comandaParaDespejar.pedidoId,
        comandaParaDespejar.areaId,
      );
      setComandaParaDespejar(null);
      await Promise.all([cargarComandas(areaSeleccionada), cargarAreas()]);
    } catch (err: any) {
      setError(err?.message || 'Error al despejar la comanda');
      setComandaParaDespejar(null);
    } finally {
      setDespejando(false);
    }
  };

  const nombreAreaActual =
    areas.find((a) => a.id === areaSeleccionada)?.nombre ||
    (areaSeleccionada === '' ? 'Todas las áreas' : 'Área');

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
        gap: '14px',
        padding: '16px',
        maxWidth: '1600px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Banner de aviso visual en vivo si llega un evento */}
      {avisoVisual && (
        <div
          role="status"
          style={{
            background: 'var(--cp-navy)',
            color: 'var(--cp-cream)',
            border: '2px solid var(--cp-gold)',
            borderRadius: '12px',
            padding: '10px 16px',
            fontSize: '14px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 6px 18px rgba(11, 44, 62, 0.3)',
          }}
        >
          <span>{avisoVisual}</span>
          <button
            onClick={() => setAvisoVisual(null)}
            aria-label="Cerrar aviso"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--cp-cream)',
              fontWeight: 800,
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Tiempos de referencia (los umbrales vienen de la configuración) */}
      <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
        Tiempos desde que el cliente terminó su pedido: 25 min lo ideal, naranja desde 35
        (retraso) y rojo desde 50 (crítico). Cada área ve solo lo suyo y lo despeja con un
        toque cuando lo terminó.
      </div>

      {/* Barra superior de acciones rápidas */}
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
            padding: '0 16px',
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

        <button
          type="button"
          onClick={() => navigate('/pantalla/cocina')}
          style={{
            minHeight: '44px',
            padding: '0 16px',
            borderRadius: '12px',
            border: 0,
            background: 'var(--cp-orange)',
            color: 'var(--cp-navy)',
            fontWeight: 800,
            fontSize: '13px',
            marginLeft: 'auto',
            cursor: 'pointer',
          }}
        >
          Pantalla completa (Modo TV)
        </button>
      </div>

      {/* Panel de Alta demanda */}
      <PanelAltaDemanda
        estado={altaDemanda}
        alCambiarEstado={(nuevo) => setAltaDemanda(nuevo)}
      />

      {/* Selector de Áreas */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--cp-navy)' }}>
          Área:
        </span>

        {areas.map((a) => {
          const seleccionada = areaSeleccionada === a.id;
          const conteo = a.comandasPendientes ?? a.comandas_pendientes ?? 0;

          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setAreaSeleccionada(a.id)}
              style={{
                minHeight: '44px',
                padding: '0 14px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                background: seleccionada ? 'var(--cp-navy)' : 'transparent',
                color: seleccionada ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>{a.nombre}</span>
              <span
                style={{
                  background: seleccionada ? 'var(--cp-orange)' : 'var(--cp-sand)',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  fontSize: '11px',
                  borderRadius: '9999px',
                  padding: '1px 7px',
                }}
              >
                {conteo}
              </span>
            </button>
          );
        })}

        {/* Vista general opcional con todas las áreas (RQ-COC-01-09) */}
        <button
          type="button"
          onClick={() => setAreaSeleccionada('')}
          style={{
            minHeight: '44px',
            padding: '0 14px',
            borderRadius: '9999px',
            border: '1.5px solid var(--cp-navy)',
            background: areaSeleccionada === '' ? 'var(--cp-navy)' : 'transparent',
            color: areaSeleccionada === '' ? 'var(--cp-cream)' : 'var(--cp-navy)',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Todas las áreas
        </button>
      </div>

      {/* Selector de Modos de Cocina: Comandas / Historial / Despacho */}
      <div
        role="group"
        aria-label="Vista de cocina"
        style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--cp-line)',
          paddingBottom: '10px',
        }}
      >
        <button
          type="button"
          onClick={() => setModo('comandas')}
          style={{
            minHeight: '44px',
            padding: '0 16px',
            borderRadius: '12px',
            border: '1.5px solid var(--cp-navy)',
            background: modo === 'comandas' ? 'var(--cp-navy)' : 'transparent',
            color: modo === 'comandas' ? 'var(--cp-cream)' : 'var(--cp-navy)',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          En cocina
        </button>

        <button
          type="button"
          onClick={() => setModo('historial')}
          style={{
            minHeight: '44px',
            padding: '0 16px',
            borderRadius: '12px',
            border: '1.5px solid var(--cp-navy)',
            background: modo === 'historial' ? 'var(--cp-navy)' : 'transparent',
            color: modo === 'historial' ? 'var(--cp-cream)' : 'var(--cp-navy)',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Historial del día
        </button>

        <button
          type="button"
          onClick={() => setModo('despacho')}
          style={{
            minHeight: '44px',
            padding: '0 16px',
            borderRadius: '12px',
            border: '1.5px solid var(--cp-navy)',
            background: modo === 'despacho' ? 'var(--cp-navy)' : 'transparent',
            color: modo === 'despacho' ? 'var(--cp-cream)' : 'var(--cp-navy)',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Vista de despacho
        </button>
      </div>

      {/* Manejo de error general */}
      {error && (
        <EstadoError
          mensaje={error}
          alReintentar={() => {
            if (modo === 'comandas') cargarComandas(areaSeleccionada);
            if (modo === 'historial') cargarHistorial(areaSeleccionada);
            if (modo === 'despacho') cargarDespacho();
          }}
        />
      )}

      {/* 1. MODO: COMANDAS EN COCINA */}
      {modo === 'comandas' && (
        <section aria-label="Comandas en cocina">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '16px',
                letterSpacing: '0.04em',
                color: 'var(--cp-navy)',
              }}
            >
              EN COCINA · {comandas.length}
            </h3>
          </div>

          {cargandoDatos && <Cargando mensaje="Actualizando comandas..." />}

          {!cargandoDatos && comandas.length === 0 && (
            <EstadoVacio
              titulo="Sin pedidos pendientes"
              mensaje={`No hay pedidos en cola para ${nombreAreaActual}.`}
            />
          )}

          {!cargandoDatos && comandas.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '12px',
                alignItems: 'start',
                width: '100%',
              }}
            >
              {comandas.map((cmd) => (
                <ComandaTarjeta
                  key={cmd.id}
                  comanda={cmd}
                  onDespejar={puedeDespejar ? setComandaParaDespejar : undefined}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* 2. MODO: HISTORIAL DEL DÍA */}
      {modo === 'historial' && (
        <HistorialView
          historial={historial}
          nombreAreaActual={nombreAreaActual}
          alDevolverExito={() => cargarHistorial(areaSeleccionada)}
          error={error}
          alReintentar={() => cargarHistorial(areaSeleccionada)}
        />
      )}

      {/* 3. MODO: VISTA DE DESPACHO */}
      {modo === 'despacho' && (
        <DespachoView
          pedidos={despacho}
          error={error}
          alReintentar={cargarDespacho}
        />
      )}

      {/* Modal de confirmación para Despejar comanda */}
      <Confirmar
        abierto={Boolean(comandaParaDespejar)}
        titulo={`¿Despejar comanda ${comandaParaDespejar?.ticket || comandaParaDespejar?.codigo}?`}
        mensaje={`Se marcará como completada para el área ${
          comandaParaDespejar?.areaNombre || nombreAreaActual
        }. Si todas las áreas del pedido ya despejaron, el pedido pasará automáticamente a estado LISTO.`}
        textoSi="Sí, despejar"
        textoNo="No, cancelar"
        cargando={despejando}
        alConfirmar={ejecutarDespeje}
        alCancelar={() => setComandaParaDespejar(null)}
      />

      {/* Diálogo modal "Se acabó algo" */}
      <ModalAgotados
        abierto={modalAgotadosAbierto}
        alCerrar={() => setModalAgotadosAbierto(false)}
      />
    </div>
  );
}
