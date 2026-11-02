import { useCallback, useEffect, useState } from 'react';
import { Cargando } from '../../../comun/Cargando';
import { useEventos } from '../../../comun/socket';
import { salonApi } from '../api';
import type { MesaSalon, PisoPlano, PisoSalon } from '../tipos';
import { CuadriculaPlano } from './CuadriculaPlano';
import { ModalNuevoPedidoMesa } from './ModalNuevoPedidoMesa';
import { ModalPrecuenta } from './ModalPrecuenta';
import { VistaPreviaMesa } from './VistaPreviaMesa';
import { nombreMesaSalon, useCambioDeMesa } from './CambioDeMesa';

export interface SalonMozoProps {
  /** Permiso mesas/liberar: la vista previa ofrece «Forzar liberación» */
  puedeForzar: boolean;
}

const PISOS_VACIOS: PisoSalon[] = [];

/**
 * Pestaña «Salón» de «Mis pedidos»: el croquis del local en vivo.
 * Tocar una libre abre Nuevo pedido con esa mesa; una ocupada, su cuenta; mantener 2 s, la vista previa.
 */
export function SalonMozo({ puedeForzar }: SalonMozoProps) {
  const [pisos, setPisos] = useState<PisoSalon[]>(PISOS_VACIOS);
  const [planos, setPlanos] = useState<PisoPlano[] | null>(null);
  const [pisoId, setPisoId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [cuentaId, setCuentaId] = useState<string | null>(null);
  const [vistaId, setVistaId] = useState<string | null>(null);
  const [nuevoEnId, setNuevoEnId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await salonApi.obtenerMesas();
      setPisos(res.pisos || []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  }, []);

  // El plano (paredes, cocina, barra) puede no estar permitido para el rol: sin él, se dibujan solo las mesas
  const cargarPlano = useCallback(async () => {
    try {
      setPlanos(await salonApi.obtenerPlano());
    } catch {
      setPlanos(null);
    }
  }, []);

  useEffect(() => {
    void cargar();
    void cargarPlano();
    const cada = setInterval(() => void cargar(), 30000);
    return () => clearInterval(cada);
  }, [cargar, cargarPlano]);

  useEventos('salon:mesa', cargar);
  useEventos('pedido:estado', cargar);
  useEventos('cocina:comanda', cargar);
  useEventos('pedido:progreso', cargar);
  useEventos('plano:cambio', cargarPlano);

  const cambio = useCambioDeMesa(() => void cargar());

  const pisoActual = pisos.find((p) => p.id === pisoId) ?? pisos[0];
  const mesas: MesaSalon[] = pisoActual?.mesas ?? [];
  const planoActual = planos?.find((p) => p.id === pisoActual?.id) ?? null;
  // Sin plano: las propias mesas hacen de elementos
  const elementos = planoActual?.elementos ?? mesas.map((m) => ({
    id: m.id,
    pisoId: m.pisoId,
    tipo: 'MESA',
    nombre: m.nombre,
    x: m.x,
    y: m.y,
    ancho: m.ancho,
    alto: m.alto,
    numero: m.numero,
    asientos: m.asientos,
    activo: m.activo,
  }));
  const columnas = planoActual?.cuadriculaAncho ?? pisoActual?.cuadriculaAncho ?? 20;
  const filas = planoActual?.cuadriculaAlto ?? pisoActual?.cuadriculaAlto ?? 12;

  const buscarMesa = (id: string | null) => mesas.find((m) => m.id === id) ?? null;
  const cuenta = buscarMesa(cuentaId);
  const vista = buscarMesa(vistaId);

  const tocarMesa = (mesa: MesaSalon) => {
    if (cambio.tocarMesa(mesa)) return;
    if (mesa.estado === 'OCUPADA' && mesa.pedido) setCuentaId(mesa.id);
    else if (mesa.estado === 'LIBRE') setNuevoEnId(mesa.id);
  };

  return (
    <section className="smz" aria-label="Salón">
      {pisos.length > 1 && (
        <div className="smz-pisos" role="group" aria-label="Piso">
          {pisos.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={p.id === pisoActual?.id}
              className={p.id === pisoActual?.id ? 'smz-piso smz-piso--activo' : 'smz-piso'}
              onClick={() => setPisoId(p.id)}
            >
              {p.nombre}
            </button>
          ))}
        </div>
      )}

      {cambio.ui}

      {cargando && <Cargando mensaje="Cargando el salón" />}
      {!cargando && error && <p role="alert" className="mpv-ayuda">No pudimos cargar el salón. Revisa la conexión.</p>}

      {!cargando && pisoActual && (
        <>
          <p className="smz-ayuda">
            Toca una mesa libre para tomar pedido. Toca una ocupada para ver su cuenta. Mantenla 2 segundos para ver
            qué pidió.
          </p>
          <CuadriculaPlano
            columnas={columnas}
            filas={filas}
            elementos={elementos}
            modoSalon
            modoDestino={cambio.modoDestino}
            mesasSalon={mesas}
            onSeleccionarMesaSalon={tocarMesa}
            alMantenerMesaSalon={(m) => setVistaId(m.id)}
          />
        </>
      )}

      {!cargando && !error && pisos.length === 0 && (
        <p className="mpv-ayuda">No hay pisos activos en el salón.</p>
      )}

      {cuenta?.pedido && (
        <ModalPrecuenta
          abierto
          alCerrar={() => {
            setCuentaId(null);
            void cargar();
          }}
          mesa={nombreMesaSalon(cuenta)}
          lineas={cuenta.pedido.lineas || []}
          total={Number(cuenta.pedido.total || 0)}
          mozo={cuenta.pedido.mozo}
          pedidoId={cuenta.pedido.id}
          alCambiarMesa={() => {
            cambio.iniciar({ pedidoId: cuenta.pedido!.id, codigo: cuenta.pedido!.codigo, mesa: cuenta });
            setCuentaId(null);
          }}
        />
      )}

      {vista && (
        <VistaPreviaMesa
          mesa={vista}
          puedeForzar={puedeForzar}
          alCerrar={() => setVistaId(null)}
          alAbrirCuenta={(m) => {
            setVistaId(null);
            setCuentaId(m.id);
          }}
          alCambiarMesa={(m) => {
            setVistaId(null);
            if (m.pedido) cambio.iniciar({ pedidoId: m.pedido.id, codigo: m.pedido.codigo, mesa: m });
          }}
          alCambiar={() => void cargar()}
        />
      )}

      {nuevoEnId && pisoActual && (
        <ModalNuevoPedidoMesa
          abierto
          alCerrar={() => setNuevoEnId(null)}
          pisos={pisos}
          mesaPreseleccionadaId={nuevoEnId}
          canal="MOZO"
          puedeForzarLiberacion={puedeForzar}
          alExitoPedido={() => void cargar()}
          alRefrescarMesas={cargar}
        />
      )}
    </section>
  );
}
