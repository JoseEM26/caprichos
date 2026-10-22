import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  AltaDemandaEstado,
  AreaCocina,
  Comanda,
} from '../admin/cocina/cocinaTipos';
import {
  listarAreasCocina,
  listarComandasArea,
  obtenerAltaDemanda,
} from '../admin/cocina/cocinaApi';
import {
  estaSilenciado,
  reproducirCampanaCocina,
  setSilenciado,
} from '../admin/cocina/audioAlerta';
import { ComandaTarjeta } from '../admin/cocina/ComandaTarjeta';
import { Cargando } from '../comun/Cargando';
import { EstadoError } from '../comun/EstadoError';
import { useEventos } from '../comun/socket';

export function PantallaCocinaView() {
  const navigate = useNavigate();

  const [areas, setAreas] = useState<AreaCocina[]>([]);
  const [areaSeleccionada, setAreaSeleccionada] = useState<string>(''); // '' = Todas las áreas
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [altaDemanda, setAltaDemanda] = useState<AltaDemandaEstado>({
    activa: false,
    minutos: 0,
    pausa: false,
  });

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [silenciado, setSilenciadoEstado] = useState<boolean>(estaSilenciado());
  const [horaActual, setHoraActual] = useState<string>('');

  // Reloj digital para la TV
  useEffect(() => {
    const tick = () => {
      const ahora = new Date();
      setHoraActual(
        ahora.toLocaleTimeString('es-PE', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const cargarAreas = useCallback(async () => {
    try {
      const res = await listarAreasCocina();
      setAreas(res);
      return res;
    } catch {
      return [];
    }
  }, []);

  const cargarComandas = useCallback(async (areaId: string) => {
    try {
      const res = await listarComandasArea(areaId);
      setComandas(res);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Error al actualizar comandas en TV');
    }
  }, []);

  const cargarAltaDemanda = useCallback(async () => {
    try {
      const ad = await obtenerAltaDemanda();
      setAltaDemanda(ad);
    } catch {
      // Ignorar fallo secundario
    }
  }, []);

  // Carga inicial
  useEffect(() => {
    const iniciar = async () => {
      try {
        setCargando(true);
        await Promise.all([cargarAreas(), cargarAltaDemanda()]);
        await cargarComandas(areaSeleccionada);
      } catch (err: any) {
        setError(err?.message || 'Error de conexión');
      } finally {
        setCargando(false);
      }
    };

    iniciar();
  }, [areaSeleccionada, cargarAreas, cargarComandas, cargarAltaDemanda]);

  // Recarga automática periódica cada 30 segundos como fallback
  useEffect(() => {
    const timer = setInterval(() => {
      cargarComandas(areaSeleccionada);
      cargarAreas();
    }, 30000);
    return () => clearInterval(timer);
  }, [areaSeleccionada, cargarComandas, cargarAreas]);

  // Eventos Socket.IO en tiempo real
  useEventos('pedido:nuevo', () => {
    reproducirCampanaCocina();
    cargarComandas(areaSeleccionada);
    cargarAreas();
  });

  useEventos('cocina:comanda', () => {
    cargarComandas(areaSeleccionada);
    cargarAreas();
  });

  useEventos('pedido:estado', () => {
    cargarComandas(areaSeleccionada);
    cargarAreas();
  });

  useEventos('cocina:alta-demanda', (datos: AltaDemandaEstado) => {
    setAltaDemanda(datos);
  });

  const alternarSonido = () => {
    const nuevo = !silenciado;
    setSilenciadoEstado(nuevo);
    setSilenciado(nuevo);
  };

  const nombreAreaActual =
    areas.find((a) => a.id === areaSeleccionada)?.nombre ||
    (areaSeleccionada === '' ? 'Todas las áreas' : 'Cocina');

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--cp-navy)',
        color: 'var(--cp-cream)',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 24px',
        boxSizing: 'border-box',
        gap: '16px',
        fontFamily: 'var(--fuente-texto)',
      }}
    >
      {/* Cabecera para TV */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1.5px solid rgba(251, 244, 236, 0.2)',
          paddingBottom: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <h1
              style={{
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '26px',
                color: 'var(--cp-cream)',
                letterSpacing: '0.04em',
                margin: 0,
              }}
            >
              Caprichos · {nombreAreaActual}
            </h1>
            <div style={{ fontSize: '13px', color: 'var(--cp-line2)', marginTop: '2px' }}>
              Modo monitor TV · Solo lectura · En vivo
            </div>
          </div>

          {altaDemanda.activa && (
            <div
              style={{
                background: 'var(--cp-rust)',
                color: 'var(--cp-white)',
                padding: '4px 12px',
                borderRadius: '9999px',
                fontWeight: 800,
                fontSize: '13px',
                border: '1.5px solid var(--cp-gold)',
              }}
            >
              Alta demanda +{altaDemanda.minutos} min
              {altaDemanda.pausa ? ' (pedidos en pausa)' : ''}
            </div>
          )}
        </div>

        {/* Selector de área y controles de cabecera */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setAreaSeleccionada('')}
              style={{
                minHeight: '44px',
                padding: '0 14px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-cream)',
                background: areaSeleccionada === '' ? 'var(--cp-cream)' : 'transparent',
                color: areaSeleccionada === '' ? 'var(--cp-navy)' : 'var(--cp-cream)',
                fontWeight: 800,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Todas
            </button>

            {areas.map((a) => {
              const activa = areaSeleccionada === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAreaSeleccionada(a.id)}
                  style={{
                    minHeight: '44px',
                    padding: '0 14px',
                    borderRadius: '9999px',
                    border: '1.5px solid var(--cp-cream)',
                    background: activa ? 'var(--cp-cream)' : 'transparent',
                    color: activa ? 'var(--cp-navy)' : 'var(--cp-cream)',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  {a.nombre}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={alternarSonido}
            style={{
              minHeight: '44px',
              padding: '0 12px',
              borderRadius: '12px',
              border: '1px solid rgba(251, 244, 236, 0.4)',
              background: 'transparent',
              color: 'var(--cp-cream)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {silenciado ? 'Sonido: off' : 'Sonido: on'}
          </button>

          {/* Reloj digital */}
          <div
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '22px',
              color: 'var(--cp-gold)',
              minWidth: '100px',
              textAlign: 'right',
            }}
          >
            {horaActual}
          </div>

          <button
            type="button"
            onClick={() => navigate('/admin/cocina')}
            style={{
              minHeight: '44px',
              padding: '0 14px',
              borderRadius: '12px',
              border: '1.5px solid var(--cp-cream)',
              background: 'transparent',
              color: 'var(--cp-cream)',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Volver al admin
          </button>
        </div>
      </header>

      {/* Alerta de error si aplica */}
      {error && (
        <EstadoError
          mensaje={error}
          alReintentar={() => cargarComandas(areaSeleccionada)}
        />
      )}

      {/* Contenido principal */}
      {cargando ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Cargando mensaje="Cargando comandas..." />
        </div>
      ) : comandas.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            color: 'var(--cp-line2)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '24px',
              color: 'var(--cp-cream)',
            }}
          >
            Sin pedidos en cola
          </div>
          <div style={{ fontSize: '16px' }}>
            No hay comandas pendientes para {nombreAreaActual}.
          </div>
        </div>
      ) : (
        <main
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px',
            alignItems: 'start',
            width: '100%',
          }}
        >
          {comandas.map((cmd) => (
            <ComandaTarjeta
              key={cmd.id}
              comanda={cmd}
              soloLectura={true}
            />
          ))}
        </main>
      )}
    </div>
  );
}
