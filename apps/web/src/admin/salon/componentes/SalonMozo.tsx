import { useCallback, useEffect, useState } from 'react';
import { Cargando } from '../../../comun/Cargando';
import { useEventos } from '../../../comun/socket';
import { salonApi } from '../api';
import type { MesaSalon, MiPedido, PisoPlano, PisoSalon } from '../tipos';
import { CuadriculaPlano } from './CuadriculaPlano';
import { ModalNuevoPedidoMesa } from './ModalNuevoPedidoMesa';
import { ModalPrecuenta } from './ModalPrecuenta';
import { VistaPreviaMesa } from './VistaPreviaMesa';
import { ListaEsperaMesa, useListaEspera } from './ListaEsperaMesa';
import { nombreMesaSalon, useCambioDeMesa, useSumarMesas } from './CambioDeMesa';
import { useSesion } from '../../../comun/sesion';
import { MesasOcupadas, progresoDeMesa } from './MesasOcupadas';
import type { ProgresoPiezas } from '../progresoMesa';

export interface SalonMozoProps {
  /** Permiso mesas/liberar: la vista previa ofrece «Forzar liberación» */
  puedeForzar: boolean;
  /** Permiso cocina/despachar: la vista previa despacha lo listo */
  puedeDespachar?: boolean;
}

const PISOS_VACIOS: PisoSalon[] = [];

/**
 * Pestaña «Salón» de «Mis pedidos»: el croquis del local en vivo.
 * Tocar una libre abre Nuevo pedido con esa mesa; una ocupada, su cuenta; mantener 1 s, la vista previa.
 */
export function SalonMozo({ puedeForzar, puedeDespachar = false }: SalonMozoProps) {
  const [pisos, setPisos] = useState<PisoSalon[]>(PISOS_VACIOS);
  const [planos, setPlanos] = useState<PisoPlano[] | null>(null);
  const [pisoId, setPisoId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [cuentaId, setCuentaId] = useState<string | null>(null);
  const [vistaId, setVistaId] = useState<string | null>(null);
  const [nuevoEnId, setNuevoEnId] = useState<string | null>(null);
  // Mesa libre tocada con lista de espera: elegir entre pedido nuevo o uno de la lista
  const [decidirMesaId, setDecidirMesaId] = useState<string | null>(null);
  // Mesa ocupada tocada con lista de espera: ver su cuenta o darle la mesa a alguien de la lista
  const [decidirOcupadaId, setDecidirOcupadaId] = useState<string | null>(null);
  const [ofrecidaId, setOfrecidaId] = useState<string | null>(null);
  const [extras, setExtras] = useState<MiPedido[]>([]);
  const espera = useListaEspera();

  const cargar = useCallback(async () => {
    try {
      const res = await salonApi.obtenerMesas();
      setPisos(res.pisos || []);
      setError(false);
      // Pedidos extra de las mesas (mismo refresco por sockets); si falla, solo se pierde el desglose
      salonApi
        .misPedidos('hoy')
        .then((r) => setExtras((r?.pedidos ?? []).filter((p) => p.pedidoOrigenId)))
        .catch(() => undefined);
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
  useEventos('pedido:editado', cargar);
  useEventos('cocina:comanda', cargar);
  useEventos('pedido:progreso', cargar);
  useEventos('plano:cambio', cargarPlano);

  const cambio = useCambioDeMesa(() => void cargar());
  const sumar = useSumarMesas(() => void cargar());
  const { tiene } = useSesion();
  const puedeAbrirMesas = tiene('mesas/abrir');
  const [extraMesa, setExtraMesa] = useState<MesaSalon | null>(null);

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

  const progresoMesas: Record<string, ProgresoPiezas> = {};
  for (const m of mesas) if (m.estado === 'OCUPADA' && m.pedido) progresoMesas[m.id] = progresoDeMesa(m, extras);

  const buscarMesa = (id: string | null) => mesas.find((m) => m.id === id) ?? null;
  const cuenta = buscarMesa(cuentaId);
  const vista = buscarMesa(vistaId);

  // Mesas del mismo pedido que esta (la vista previa y «Quitar mesa» las necesitan)
  const mesasDelPedidoDe = (m: MesaSalon): MesaSalon[] =>
    m.pedido ? mesas.filter((x) => x.pedido?.id === m.pedido?.id) : [];

  const tocarMesa = (mesa: MesaSalon) => {
    if (sumar.tocarMesa(mesa)) return;
    if (cambio.tocarMesa(mesa)) return;
    if (mesa.estado === 'OCUPADA' && mesa.pedido) {
      if (espera.total > 0) setDecidirOcupadaId(mesa.id);
      else setCuentaId(mesa.id);
    }
    else if (mesa.estado === 'LIBRE') {
      if (espera.total > 0) setDecidirMesaId(mesa.id);
      else setNuevoEnId(mesa.id);
    }
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

      <ListaEsperaMesa
        espera={espera}
        pisos={pisos}
        planos={planos}
        alAsignado={() => void cargar()}
        mesaOfrecida={ofrecidaId}
        alCerrarOferta={() => setOfrecidaId(null)}
      />

      {decidirOcupadaId && (
        <div className="le-fondo" role="dialog" aria-modal="true" aria-label="¿Qué hacer con la mesa ocupada?">
          <div className="le-modal">
            <h3 className="le-titulo">{buscarMesa(decidirOcupadaId) ? nombreMesaSalon(buscarMesa(decidirOcupadaId)!) : 'La mesa'} está ocupada</h3>
            <button
              type="button"
              className="le-btn le-btn--principal"
              onClick={() => {
                setCuentaId(decidirOcupadaId);
                setDecidirOcupadaId(null);
              }}
            >
              Ver su cuenta
            </button>
            <button
              type="button"
              className="le-btn"
              onClick={() => {
                setOfrecidaId(decidirOcupadaId);
                setDecidirOcupadaId(null);
              }}
            >
              Asignar pedido de la lista de espera aquí ({espera.total})
            </button>
            <button type="button" className="le-btn" onClick={() => setDecidirOcupadaId(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {decidirMesaId && (
        <div className="le-fondo" role="dialog" aria-modal="true" aria-label="¿Qué hacer con la mesa libre?">
          <div className="le-modal">
            <h3 className="le-titulo">{buscarMesa(decidirMesaId) ? nombreMesaSalon(buscarMesa(decidirMesaId)!) : 'La mesa'} está libre</h3>
            <button
              type="button"
              className="le-btn le-btn--principal"
              onClick={() => {
                setOfrecidaId(decidirMesaId);
                setDecidirMesaId(null);
              }}
            >
              Asignar pedido de la lista de espera ({espera.total})
            </button>
            <button
              type="button"
              className="le-btn"
              onClick={() => {
                setNuevoEnId(decidirMesaId);
                setDecidirMesaId(null);
              }}
            >
              Tomar pedido nuevo
            </button>
            <button type="button" className="le-btn" onClick={() => setDecidirMesaId(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {cambio.ui}
      {sumar.ui}

      {cargando && <Cargando mensaje="Cargando el salón" />}
      {!cargando && error && <p role="alert" className="mpv-ayuda">No pudimos cargar el salón. Revisa la conexión.</p>}

      {!cargando && pisoActual && (
        <>
          <p className="smz-ayuda">
            Toca una mesa libre para tomar pedido. Toca una ocupada para ver su cuenta. Mantenla 1 segundo para ver
            qué pidió.
          </p>
          <CuadriculaPlano
            columnas={columnas}
            filas={filas}
            elementos={elementos}
            modoSalon
            modoDestino={cambio.modoDestino || sumar.modoDestino}
            mesasSeleccionadasIds={sumar.seleccionadas}
            mesasSalon={mesas}
            onSeleccionarMesaSalon={tocarMesa}
            alMantenerMesaSalon={(m) => setVistaId(m.id)}
            progresoMesas={progresoMesas}
          />
          <MesasOcupadas
            mesas={mesas}
            extras={extras}
            alAbrirCuenta={(m) => setCuentaId(m.id)}
            alAgregarExtra={tiene('pedidos/extra') ? (m) => setExtraMesa(m) : undefined}
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
          descuentos={cuenta.pedido.descuentos}
          subtotal={cuenta.pedido.subtotal}
          envio={cuenta.pedido.envio}
          notaPedido={cuenta.pedido.nota}
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
          puedeDespachar={puedeDespachar}
          alCerrar={() => setVistaId(null)}
          alAbrirCuenta={(m) => {
            setVistaId(null);
            setCuentaId(m.id);
          }}
          alCambiarMesa={(m) => {
            setVistaId(null);
            if (m.pedido) cambio.iniciar({ pedidoId: m.pedido.id, codigo: m.pedido.codigo, mesa: m });
          }}
          puedeAbrirMesas={puedeAbrirMesas}
          mesasDelPedido={mesasDelPedidoDe(vista)}
          alAgregarMesa={(m) => {
            setVistaId(null);
            if (m.pedido) sumar.iniciar({ pedidoId: m.pedido.id, codigo: m.pedido.codigo, mesa: m, mesasEnPedido: mesasDelPedidoDe(m).length });
          }}
          alAgregarExtra={tiene('pedidos/extra') ? (m) => { setVistaId(null); setExtraMesa(m); } : undefined}
          alCambiar={() => void cargar()}
        />
      )}

      {extraMesa?.pedido && (
        <ModalNuevoPedidoMesa
          abierto
          pasoInicial="modal"
          canal="MOZO"
          pisos={pisos}
          extra={{ id: extraMesa.pedido.id, codigo: extraMesa.pedido.codigo, modalidad: 'MESA', mesa_nombre: nombreMesaSalon(extraMesa), cliente_nombre: extraMesa.pedido.cliente }}
          alCerrar={() => setExtraMesa(null)}
          alExitoPedido={() => void cargar()}
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
