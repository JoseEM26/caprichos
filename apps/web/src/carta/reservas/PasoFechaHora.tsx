import type { OpcionesReserva } from './reservasCartaApi';
import { ahoraLima, diaYNumero, fechaLegible, horaPasada, horarioDelDia, horaLegible, horasDelDia, sumarDias } from './fechasReserva';
import { estiloChip, etiquetaReserva, filaChips } from './estilosReserva';

interface PasoFechaHoraProps {
  opciones: OpcionesReserva;
  fecha: string;
  hora: string;
  onFecha: (fecha: string) => void;
  onHora: (hora: string) => void;
  ahora?: Date;
}

const DIAS_A_MOSTRAR = 14;

/** Paso 2: día (solo los que hay atención) y hora (cada 30 min dentro del horario; las pasadas de hoy, deshabilitadas). */
export function PasoFechaHora({ opciones, fecha, hora, onFecha, onHora, ahora = new Date() }: PasoFechaHoraProps) {
  const hoy = ahoraLima(ahora).fechaIso;
  const dias = Array.from({ length: Math.min(DIAS_A_MOSTRAR - 1, opciones.diasMax) + 1 }, (_, i) => sumarDias(hoy, i))
    .filter((iso) => horarioDelDia(iso, opciones) !== null);

  const horario = fecha ? horarioDelDia(fecha, opciones) : null;
  const horas = horario ? horasDelDia(horario.abre, horario.cierra) : [];

  const elegirDia = (iso: string) => {
    onFecha(iso);
    // si la hora elegida antes ya no vale para ese día, se limpia
    const nuevo = horarioDelDia(iso, opciones);
    if (!nuevo || horaPasada(iso, hora, ahora) || !horasDelDia(nuevo.abre, nuevo.cierra).includes(hora)) onHora('');
  };

  if (dias.length === 0) {
    return (
      <p role="status" style={{ fontSize: 14, color: 'var(--cp-navy)', margin: 0 }}>
        Por ahora no hay días con atención para reservar desde la carta. Escríbenos o llámanos al local.
      </p>
    );
  }

  return (
    <div>
      <h3 id="reserva-paso-dia" style={{ ...etiquetaReserva, fontSize: 16, margin: '0 0 12px' }}>
        ¿Qué día?
      </h3>
      <div style={filaChips} role="group" aria-labelledby="reserva-paso-dia">
        {dias.map((iso, i) => {
          const texto = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : diaYNumero(iso);
          return (
            <button
              key={iso}
              type="button"
              aria-pressed={fecha === iso}
              aria-label={`${texto}, ${fechaLegible(iso)}`}
              onClick={() => elegirDia(iso)}
              style={estiloChip(fecha === iso)}
            >
              {texto}
            </button>
          );
        })}
      </div>

      {fecha && (
        <>
          <h3 id="reserva-paso-hora" style={{ ...etiquetaReserva, fontSize: 16, margin: '20px 0 12px' }}>
            ¿A qué hora?
          </h3>
          <div style={filaChips} role="group" aria-labelledby="reserva-paso-hora">
            {horas.map((h) => {
              const pasada = horaPasada(fecha, h, ahora);
              return (
                <button
                  key={h}
                  type="button"
                  aria-pressed={hora === h}
                  aria-label={pasada ? `${horaLegible(h)}, ya pasó` : horaLegible(h)}
                  disabled={pasada}
                  onClick={() => onHora(h)}
                  style={estiloChip(hora === h, pasada)}
                >
                  {horaLegible(h)}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
