import { useState } from 'react';
import { Confirmar } from '../../../comun/Confirmar';
import { MesaSalon } from '../tipos';
import { hoyLima, isoLima } from '../fechaLima';

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
  mesas: MesaSalon[];
  /** Debe lanzar el error del API para que se muestre dentro del diálogo. */
  alAprobar: (datos: { mesas: string[]; hora: string }) => Promise<void>;
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
 * Aprobar una solicitud de WhatsApp: elegir mesa(s) y confirmar la hora.
 * No asigna mesa por su cuenta: sin mesa elegida el botón queda deshabilitado.
 */
export function ConfirmarAprobacionSolicitud({
  solicitud,
  mesas,
  alAprobar,
  alCancelar,
}: ConfirmarAprobacionSolicitudProps) {
  const [mesasIds, setMesasIds] = useState<string[]>(() =>
    (solicitud.mesasIds ?? []).filter((id) => mesas.some((m) => m.id === id)),
  );
  const [fecha, setFecha] = useState(solicitud.fecha);
  const [hora, setHora] = useState(solicitud.hora);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const hoy = hoyLima();
  const horaSolicitadaPasada = Date.parse(solicitud.horaIso) <= Date.now();
  const instanteElegido = Date.parse(isoLima(fecha, hora));
  const horaFutura = !Number.isNaN(instanteElegido) && instanteElegido > Date.now();

  const asientos = mesasIds.reduce(
    (suma, id) => suma + (mesas.find((m) => m.id === id)?.asientos ?? 4),
    0,
  );
  const faltan = Math.max(0, solicitud.personas - asientos);

  const motivoBloqueo =
    mesasIds.length === 0
      ? 'Elige una mesa'
      : !horaFutura
        ? 'Elige una hora futura'
        : faltan > 0
          ? `Faltan ${faltan} asientos`
          : null;

  const alternarMesa = (id: string) => {
    setError(null);
    setMesasIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const aprobar = async () => {
    setError(null);
    setCargando(true);
    try {
      await alAprobar({ mesas: mesasIds, hora: isoLima(fecha, hora) });
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={estiloEtiqueta}>Mesa(s) a asignar</div>
        {mesas.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--cp-rust)' }}>
            No hay mesas activas en el salón.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))',
              gap: '8px',
              maxHeight: '200px',
              overflowY: 'auto',
            }}
          >
            {mesas.map((m) => {
              const elegida = mesasIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={elegida}
                  onClick={() => alternarMesa(m.id)}
                  style={{
                    minHeight: '56px',
                    borderRadius: '12px',
                    border: '1.5px solid var(--cp-navy)',
                    background: elegida ? 'var(--cp-navy)' : 'var(--cp-white)',
                    color: elegida ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontWeight: 800,
                  }}
                >
                  <span>{m.nombre || `Mesa ${m.numero}`}</span>
                  <span style={{ fontSize: '11px', opacity: 0.8 }}>{m.asientos || 4} asientos</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

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

      {error && (
        <div role="alert" style={{ fontSize: '13px', color: 'var(--cp-rust)', fontWeight: 700 }}>
          {error}
        </div>
      )}
    </Confirmar>
  );
}
