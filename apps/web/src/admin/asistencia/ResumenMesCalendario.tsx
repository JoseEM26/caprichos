import type { Proximos, ResumenCalendario } from './miCalendarioApi';
import { textoProximos } from './calendarioDia';
import { horasMin } from './tiposMarca';

/** Resumen del mes arriba del calendario y, debajo, el próximo descanso y el próximo feriado (desde hoy). */
export function ResumenMesCalendario({ resumen: r, proximos }: { resumen: ResumenCalendario; proximos?: Proximos | null }) {
  const t = textoProximos(proximos);
  return (
    <>
      <dl className="mc-resumen" aria-label="Resumen del mes" data-testid="resumen-mes">
        <div><dt>Días trabajados</dt><dd>{r.diasTrabajados ?? '—'}</dd></div>
        <div><dt>Horas</dt><dd>{r.horasTrabajadasMin != null ? (r.horasTrabajadasMin / 60).toFixed(1) : '—'}</dd></div>
        <div><dt>Tardanzas</dt><dd>{r.tardanzaMin != null ? `${r.tardanzaMin} min` : '—'}</dd></div>
        <div><dt>Faltas</dt><dd>{r.faltas ?? '—'}</dd></div>
        <div><dt>Extras aprobadas</dt><dd>{horasMin(r.extraAprobadaMin ?? 0)}</dd></div>
        <div><dt>Extras pendientes</dt><dd>{horasMin(r.extraPendienteMin ?? 0)}</dd></div>
        <div><dt>Días con turno</dt><dd>{r.diasProgramados ?? '—'}</dd></div>
        <div><dt>Descansos</dt><dd>{r.diasDescanso ?? '—'}</dd></div>
        <div><dt>Feriados con recargo</dt><dd>{r.feriadosConRecargo ?? '—'}</dd></div>
        <div><dt>Horas programadas</dt><dd>{r.horasProgramadasMin != null ? horasMin(r.horasProgramadasMin) : '—'}</dd></div>
      </dl>
      <p className="mc-proximos" data-testid="proximos-calendario">
        <span>{t.descanso}</span> <span>· {t.feriado}</span>
      </p>
    </>
  );
}
