import { useEffect, useMemo, useState } from 'react';
import { Confirmar } from '../../../comun/Confirmar';
import { PisoPlano, PisoSalon } from '../tipos';
import { hoyLima, isoLima } from '../fechaLima';
import { OcupacionMesa, SelectorMesasCroquis, resumenMesas } from './SelectorMesasCroquis';

export interface SolicitudAprobable {
  nombre: string;
  personas: number;
  /** Instante original de la solicitud (ISO). */
  horaIso: string;
  /** Fecha y hora de la solicitud en Lima. */
  fecha: string;
  hora: string;
  mesasIds?: string[];
}

export interface ConfirmarAprobacionSolicitudProps {
  solicitud: SolicitudAprobable;
  /** Plano del salón: el croquis elige una o varias mesas. */
  pisos: PisoSalon[];
  /** Dibujo del plano (paredes, barra, cocina...) por piso. */
  planos?: PisoPlano[];
  /** Mesas que otras reservas ocupan a esa fecha y hora (para marcarlas y no dejarlas elegir). */
  obtenerOcupadas?: (
    fecha: string,
    hora: string,
  ) => Promise<Array<{ mesa_id: string; reserva_id: string; nombre: string; hora: string; motivo?: string }>>;
  /** Avisos suaves de las mesas elegidas (no bloquean): otra reserva de la mesa menos de 2 horas antes. */
  obtenerAvisos?: (fecha: string, hora: string, mesaIds: string[]) => Promise<string[]>;
  /** Debe lanzar el error del API para que se muestre dentro del diálogo. */
  alAprobar: (datos: { mesas: string[]; hora: string; confirmarCapacidad: boolean }) => Promise<void>;
  alCancelar: () => void;
}

const estiloEtiqueta = { fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' } as const;
const estiloCampo = {
  minHeight: '44px',
  borderRadius: '10px',
  border: '1.5px solid var(--cp-navy)',
  padding: '0 10px',
  background: 'var(--cp-white)',
  color: 'var(--cp-navy)',
  fontSize: '14px',
} as const;

/**
 * Aprobar una solicitud de WhatsApp: elegir una o varias mesas en el croquis y confirmar la hora.
 * Si las mesas suman menos asientos que personas, avisa y pide confirmar (no bloquea para siempre).
 */
export function ConfirmarAprobacionSolicitud({
  solicitud,
  pisos,
  planos,
  obtenerOcupadas,
  obtenerAvisos,
  alAprobar,
  alCancelar,
}: ConfirmarAprobacionSolicitudProps) {
  const todasLasMesas = useMemo(() => pisos.flatMap((p) => p.mesas || []), [pisos]);
  const [mesasIds, setMesasIds] = useState<string[]>(() =>
    (solicitud.mesasIds ?? []).filter((id) => todasLasMesas.some((m) => m.id === id)),
  );
  const [fecha, setFecha] = useState(solicitud.fecha);
  const [hora, setHora] = useState(solicitud.hora);
  const [confirmarCapacidad, setConfirmarCapacidad] = useState(false);
  const [ocupadas, setOcupadas] = useState<Record<string, OcupacionMesa>>({});
  const [avisos, setAvisos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const hoy = hoyLima();
  const horaSolicitadaPasada = Date.parse(solicitud.horaIso) <= Date.now();
  const instanteElegido = Date.parse(isoLima(fecha, hora));
  const horaFutura = !Number.isNaN(instanteElegido) && instanteElegido > Date.now();

  // Mesas ocupadas a la fecha y hora elegidas (las que ya tienen otra reserva que se cruza)
  useEffect(() => {
    if (!obtenerOcupadas || !fecha || !hora) return;
    let vigente = true;
    obtenerOcupadas(fecha, hora)
      .then((lista) => {
        if (vigente) {
          setOcupadas(
            Object.fromEntries(
              lista.map((o) => [o.mesa_id, { reservaId: o.reserva_id, nombre: o.nombre, hora: o.hora }]),
            ),
          );
        }
      })
      .catch(() => {
        if (vigente) setOcupadas({});
      });
    return () => {
      vigente = false;
    };
  }, [obtenerOcupadas, fecha, hora]);

  // Aviso suave (no bloquea): otra reserva de alguna mesa elegida a menos de 2 horas antes
  const mesasKey = mesasIds.join(',');
  useEffect(() => {
    if (!obtenerAvisos || !fecha || !hora || !mesasKey) {
      setAvisos([]);
      return;
    }
    let vigente = true;
    obtenerAvisos(fecha, hora, mesasKey.split(','))
      .then((lista) => {
        if (vigente) setAvisos(lista);
      })
      .catch(() => {
        if (vigente) setAvisos([]);
      });
    return () => {
      vigente = false;
    };
  }, [obtenerAvisos, fecha, hora, mesasKey]);

  const elegidas = todasLasMesas.filter((m) => mesasIds.includes(m.id));
  const { faltan } = resumenMesas(elegidas, solicitud.personas);
  const choqueConOcupada = mesasIds.some((id) => ocupadas[id]);

  const motivoBloqueo =
    mesasIds.length === 0
      ? 'Elige una mesa'
      : !horaFutura
        ? 'Elige una hora futura'
        : choqueConOcupada
          ? 'Hay mesas ocupadas a esa hora'
          : faltan > 0 && !confirmarCapacidad
            ? 'Confirma la capacidad'
            : null;

  const aprobar = async () => {
    setError(null);
    setCargando(true);
    try {
      await alAprobar({
        mesas: mesasIds,
        hora: isoLima(fecha, hora),
        confirmarCapacidad: faltan > 0 && confirmarCapacidad,
      });
    } catch (err: any) {
      setError(err?.message || 'No fue posible aprobar la solicitud.');
      setCargando(false);
    }
  };

  return (
    <Confirmar
      abierto={true}
      titulo={`¿Aprobar la reserva de ${solicitud.nombre}?`}
      mensaje={`Se guarda la reserva para ${solicitud.personas} persona(s) y se le avisa al cliente por WhatsApp.`}
      textoConfirmar={motivoBloqueo ?? 'Sí, aprobar'}
      textoNo="No, cancelar"
      deshabilitarConfirmar={motivoBloqueo !== null}
      cargando={cargando}
      alConfirmar={aprobar}
      alCancelar={alCancelar}
    >
      {horaSolicitadaPasada && (
        <div role="status" style={{ fontSize: '13px', color: 'var(--cp-rust)', fontWeight: 700 }}>
          La hora solicitada ya pasó. Elige una hora nueva para aprobar o rechaza la solicitud.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={estiloEtiqueta}>Fecha</span>
          <input
            type="date"
            value={fecha}
            min={hoy}
            onChange={(e) => {
              setError(null);
              setFecha(e.target.value);
            }}
            style={estiloCampo}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={estiloEtiqueta}>Hora (Lima)</span>
          <input
            type="time"
            value={hora}
            onChange={(e) => {
              setError(null);
              setHora(e.target.value);
            }}
            style={estiloCampo}
          />
        </label>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={estiloEtiqueta}>Mesa(s) a asignar</div>
        {todasLasMesas.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--cp-rust)' }}>No hay mesas activas en el salón.</div>
        ) : (
          <SelectorMesasCroquis
            pisos={pisos}
            planos={planos}
            seleccionadas={mesasIds}
            personas={solicitud.personas}
            ocupadas={ocupadas}
            onCambio={(ids) => {
              setError(null);
              setMesasIds(ids);
            }}
          />
        )}
      </div>

      {avisos.map((aviso) => (
        <div key={aviso} role="status" style={{ fontSize: '13px', color: 'var(--cp-navy)', fontWeight: 600 }}>
          {aviso}
        </div>
      ))}

      {faltan > 0 && (
        <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)' }}>
          <input
            type="checkbox"
            checked={confirmarCapacidad}
            onChange={(e) => setConfirmarCapacidad(e.target.checked)}
          />
          Confirmo que la reserva es igual aunque falten asientos
        </label>
      )}

      {error && (
        <div role="alert" style={{ fontSize: '13px', color: 'var(--cp-rust)', fontWeight: 700 }}>
          {error}
        </div>
      )}
    </Confirmar>
  );
}
