import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Insignia, type VarianteInsignia } from '../../comun/Insignia';
import { Cargando } from '../../comun/Cargando';
import { jornadaActual } from './jornada';
import { miCalendario, type DiaCalendario, type EstadoRespuesta, type MiCalendario as Datos } from './miCalendarioApi';
import { ETIQUETA_LINEA, horasMin, normalizarTipo } from './tiposMarca';
import './miAsistencia.css';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Cada estado lleva color + icono + texto (nunca solo color). */
export const ESTADO_DIA: Record<string, { icono: string; texto: string; clase: string }> = {
  CUMPLIO: { icono: '✓', texto: 'Cumplió', clase: 'ok' },
  SALIO_DESPUES: { icono: '✓', texto: 'Salió después', clase: 'ok' },
  TARDANZA: { icono: '⏱', texto: 'Tardanza', clase: 'aviso' },
  SALIO_ANTES: { icono: '↩', texto: 'Salió antes', clase: 'aviso' },
  FALTA: { icono: '✕', texto: 'Falta', clase: 'mal' },
  INCOMPLETO: { icono: '!', texto: 'Incompleto', clase: 'mal' },
  A_REVISAR: { icono: '?', texto: 'En revisión', clase: 'rev' },
  DESCANSO: { icono: '–', texto: 'Descanso', clase: 'neutro' },
  VACACIONES: { icono: '☀', texto: 'Vacaciones', clase: 'vac' },
  SIN_EVALUAR: { icono: '•', texto: 'En curso', clase: 'neutro' },
};
const estadoDe = (e: string) => ESTADO_DIA[e] ?? { icono: '•', texto: e, clase: 'neutro' };

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (a: number, m0: number, d: number) => `${a}-${pad(m0 + 1)}-${pad(d)}`;
const parse = (f: string) => { const [a, m, d] = f.split('-').map(Number); return { a, m0: m - 1, d }; };
const sumarDias = (f: string, n: number) => {
  const { a, m0, d } = parse(f);
  return new Date(Date.UTC(a, m0, d + n)).toISOString().slice(0, 10);
};
const diaSemanaLun = (f: string) => { const { a, m0, d } = parse(f); return (new Date(Date.UTC(a, m0, d)).getUTCDay() + 6) % 7; };
const etiquetaFecha = (f: string) => {
  const { a, m0, d } = parse(f);
  return `${DIAS_LARGOS[new Date(Date.UTC(a, m0, d)).getUTCDay()]} ${d} de ${MESES[m0]} de ${a}`;
};

const VAR_SOLICITUD: Record<EstadoRespuesta, VarianteInsignia> = { PENDIENTE: 'aviso', APROBADA: 'exito', RECHAZADA: 'peligro' };
const TXT_RESPUESTA: Record<EstadoRespuesta, string> = { PENDIENTE: 'Pendiente', APROBADA: 'Aprobada', RECHAZADA: 'Rechazada' };

interface Paso { clave: string; texto: string; hora: string | null; nota?: string }

/** Línea de tiempo del día: usa los campos del API y, si faltan, las marcas (las viejas sin tipo salen como «Marca»). */
export function pasosDelDia(d: DiaCalendario): Paso[] {
  const campos: [string, string, string | null | undefined][] = [
    ['ENTRADA', ETIQUETA_LINEA.ENTRADA, d.entrada],
    ['ALMUERZO_SALIDA', ETIQUETA_LINEA.ALMUERZO_SALIDA, d.almuerzoSalida],
    ['ALMUERZO_VUELTA', ETIQUETA_LINEA.ALMUERZO_VUELTA, d.almuerzoVuelta],
    ['SALIDA', ETIQUETA_LINEA.SALIDA, d.salida],
  ];
  const deCampos = campos.filter(([, , h]) => h).map(([clave, texto, hora]) => ({
    clave, texto, hora: hora as string,
    nota: clave === 'ALMUERZO_VUELTA' && d.almuerzoMin != null ? `almuerzo ${d.almuerzoMin} min, pagado` : undefined,
  }));
  const sinTipo = (d.marcas ?? []).filter((m) => normalizarTipo(m.tipo) === null)
    .map((m, i) => ({ clave: `marca-${i}`, texto: 'Marca', hora: m.hora }));
  if (deCampos.length > 0) return [...deCampos, ...sinTipo].sort((x, y) => (x.hora ?? '').localeCompare(y.hora ?? ''));
  return (d.marcas ?? []).map((m, i) => {
    const t = normalizarTipo(m.tipo);
    return { clave: `m-${i}`, texto: t ? ETIQUETA_LINEA[t] : 'Marca', hora: m.hora };
  });
}

function DetalleDia({ dia, alCerrar, alPedirCorreccion }: { dia: DiaCalendario; alCerrar: () => void; alPedirCorreccion?: (fecha: string) => void }) {
  const e = estadoDe(dia.estado);
  const pasos = pasosDelDia(dia);
  const extra = dia.extraMin ?? 0;
  return (
    <section className="mc-detalle" aria-label={`Detalle de ${etiquetaFecha(dia.fecha)}`} data-testid="detalle-dia">
      <header className="mc-detalle-cab">
        <div>
          <h4>{etiquetaFecha(dia.fecha)}</h4>
          <span className={`mc-chip mc-${e.clase}`}><span aria-hidden="true">{e.icono}</span> {e.texto}</span>
          {dia.feriado && <span className="mc-chip mc-vac">Feriado: {dia.feriado}</span>}
        </div>
        <button type="button" className="mc-cerrar" onClick={alCerrar} aria-label="Cerrar detalle">×</button>
      </header>
      {dia.programado && <p className="mc-sub">Tu horario: {dia.programado.entrada} a {dia.programado.salida}</p>}
      {pasos.length === 0
        ? <p className="mc-sub" data-testid="sin-marcas">{dia.programado ? 'No hay marcas este día.' : 'Sin turno ni marcas este día.'}</p>
        : (
          <ol className="mc-linea" aria-label="Línea de tiempo del día">
            {pasos.map((p) => (
              <li key={p.clave}>
                <b>{p.hora}</b> {p.texto}{p.nota && <small> ({p.nota})</small>}
              </li>
            ))}
          </ol>
        )}
      <dl className="mc-datos">
        <div><dt>Horas trabajadas</dt><dd>{horasMin(dia.trabajadaMin)}</dd></div>
        {(dia.tardanzaMin ?? 0) > 0 && <div><dt>Tardanza</dt><dd>{dia.tardanzaMin} min</dd></div>}
        {(dia.salioAntesMin ?? 0) > 0 && <div><dt>Salió antes</dt><dd>{dia.salioAntesMin} min</dd></div>}
        {extra > 0 && (
          <div>
            <dt>Horas extra</dt>
            <dd>{horasMin(extra)} <Insignia variante={dia.extraEstado ? VAR_SOLICITUD[dia.extraEstado] : 'neutro'}>{dia.extraEstado ? TXT_RESPUESTA[dia.extraEstado] : 'Sin decidir'}</Insignia></dd>
          </div>
        )}
      </dl>
      {dia.solicitud && (
        <div className="mc-solicitud" data-testid="solicitud-dia">
          <strong>Tu solicitud de {dia.solicitud.tipo.toLowerCase().replace(/_/g, ' ')}</strong>{' '}
          <Insignia variante={VAR_SOLICITUD[dia.solicitud.estado]}>{TXT_RESPUESTA[dia.solicitud.estado]}</Insignia>
          {dia.solicitud.motivo && <p>Motivo: {dia.solicitud.motivo}</p>}
          {dia.solicitud.respuesta && <p>Respuesta: {dia.solicitud.respuesta}</p>}
        </div>
      )}
      {alPedirCorreccion && dia.estado !== 'DESCANSO' && dia.fecha <= jornadaActual() && !dia.solicitud && (
        <button type="button" className="mc-atajo-corr" onClick={() => alPedirCorreccion(dia.fecha)}>Pedir corrección de este día</button>
      )}
    </section>
  );
}

/** Historial propio en calendario mensual: estado por día, entrada/salida chicas, feriados y detalle al tocar. */
export function MiCalendario({ alPedirCorreccion }: { alPedirCorreccion?: (fecha: string) => void } = {}) {
  const hoy = jornadaActual();
  const inicial = parse(hoy);
  const [mes, setMes] = useState({ a: inicial.a, m0: inicial.m0 });
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [elegido, setElegido] = useState<string | null>(null);
  const [semana, setSemana] = useState<string | null>(null); // lunes de la semana resaltada

  const diasMes = new Date(Date.UTC(mes.a, mes.m0 + 1, 0)).getUTCDate();
  const desde = iso(mes.a, mes.m0, 1);
  const hasta = iso(mes.a, mes.m0, diasMes);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(false);
    miCalendario(desde, hasta)
      .then((d) => vigente && setDatos(d))
      .catch(() => vigente && (setDatos(null), setError(true)))
      .finally(() => vigente && setCargando(false));
    return () => { vigente = false; };
  }, [desde, hasta]);

  const porFecha = useMemo(() => new Map((datos?.dias ?? []).map((d) => [d.fecha, d])), [datos]);
  const mover = (delta: number) => {
    const t = mes.a * 12 + mes.m0 + delta;
    setMes({ a: Math.floor(t / 12), m0: t % 12 });
    setElegido(null);
    setSemana(null);
  };
  const irA = (fecha: string, resaltarSemana: boolean) => {
    const { a, m0 } = parse(fecha);
    setMes({ a, m0 });
    setElegido(fecha);
    setSemana(resaltarSemana ? sumarDias(fecha, -diaSemanaLun(fecha)) : null);
  };

  const celdas: (string | null)[] = [
    ...Array(diaSemanaLun(desde)).fill(null),
    ...Array.from({ length: diasMes }, (_, i) => iso(mes.a, mes.m0, i + 1)),
  ];

  const teclas = (ev: KeyboardEvent<HTMLButtonElement>, fecha: string) => {
    const paso = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[ev.key];
    if (!paso) return;
    ev.preventDefault();
    const destino = sumarDias(fecha, paso);
    (ev.currentTarget.closest('.mc-grilla')?.querySelector(`[data-fecha="${destino}"]`) as HTMLButtonElement | null)?.focus();
  };

  const r = datos?.resumen;
  const dia = elegido ? porFecha.get(elegido) ?? { fecha: elegido, estado: 'SIN_EVALUAR' } : null;

  return (
    <section className="mc" aria-label="Mi calendario de asistencia">
      <h3 className="as-sub">Mi calendario</h3>
      <div className="mc-atajos">
        <button type="button" onClick={() => irA(hoy, true)}>Esta semana</button>
        <button type="button" onClick={() => irA(sumarDias(hoy, -7), true)}>Semana pasada</button>
        <button type="button" onClick={() => { const p = parse(hoy); const t = p.a * 12 + p.m0 - 1; irA(iso(Math.floor(t / 12), t % 12, Math.min(p.d, new Date(Date.UTC(Math.floor(t / 12), (t % 12) + 1, 0)).getUTCDate())), false); }}>Hace un mes</button>
      </div>
      <div className="mc-nav">
        <button type="button" onClick={() => mover(-1)} aria-label="Mes anterior">‹</button>
        <strong aria-live="polite">{MESES[mes.m0]} {mes.a}</strong>
        <button type="button" onClick={() => mover(1)} aria-label="Mes siguiente">›</button>
      </div>

      {r && (
        <dl className="mc-resumen" aria-label="Resumen del mes" data-testid="resumen-mes">
          <div><dt>Días trabajados</dt><dd>{r.diasTrabajados ?? '—'}</dd></div>
          <div><dt>Horas</dt><dd>{r.horasTrabajadasMin != null ? (r.horasTrabajadasMin / 60).toFixed(1) : '—'}</dd></div>
          <div><dt>Tardanzas</dt><dd>{r.tardanzaMin != null ? `${r.tardanzaMin} min` : '—'}</dd></div>
          <div><dt>Faltas</dt><dd>{r.faltas ?? '—'}</dd></div>
          <div><dt>Extras aprobadas</dt><dd>{horasMin(r.extraAprobadaMin ?? 0)}</dd></div>
          <div><dt>Extras pendientes</dt><dd>{horasMin(r.extraPendienteMin ?? 0)}</dd></div>
        </dl>
      )}

      {cargando && <Cargando mensaje="Cargando tu calendario…" />}
      {error && !cargando && <p role="alert" className="as-aviso as-aviso--alerta">No pudimos cargar tu calendario. Intenta otra vez.</p>}

      {!error && (
        <div className="mc-grilla" role="group" aria-label={`Días de ${MESES[mes.m0]} ${mes.a}`} aria-busy={cargando}>
          {DIAS_SEMANA.map((n, i) => <span key={i} className="mc-cab" aria-hidden="true">{n}</span>)}
          {celdas.map((f, i) => {
            if (!f) return <span key={`v${i}`} />;
            const d = porFecha.get(f);
            const e = d ? estadoDe(d.estado) : null;
            const futuro = f > hoy;
            const enSemana = semana !== null && f >= semana && f <= sumarDias(semana, 6);
            const etiqueta = [
              etiquetaFecha(f),
              d?.feriado ? `feriado ${d.feriado}` : null,
              e && !(futuro && d?.estado === 'SIN_EVALUAR') ? e.texto : futuro ? 'aún no llega' : 'sin registro',
              d?.entrada ? `entrada ${d.entrada}` : null,
              d?.salida ? `salida ${d.salida}` : null,
            ].filter(Boolean).join(', ');
            return (
              <button
                key={f}
                type="button"
                data-fecha={f}
                className={`mc-dia mc-${futuro && d?.estado === 'SIN_EVALUAR' ? 'futuro' : e?.clase ?? 'vacio'}${f === hoy ? ' mc-hoy' : ''}${enSemana ? ' mc-semana' : ''}`}
                aria-label={etiqueta}
                aria-pressed={elegido === f}
                onClick={() => setElegido(elegido === f ? null : f)}
                onKeyDown={(ev) => teclas(ev, f)}
              >
                <span className="mc-num">{parse(f).d}</span>
                {d?.feriado && <span className="mc-fer" title={d.feriado}>★</span>}
                {e && !(futuro && d?.estado === 'SIN_EVALUAR') && (
                  <span className="mc-estado"><span aria-hidden="true">{e.icono}</span><span className="mc-txt">{e.texto}</span></span>
                )}
                {(d?.entrada || d?.salida) && (
                  <span className="mc-horas">{d.entrada ?? '··'}<br />{d.salida ?? '··'}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <ul className="mc-leyenda" aria-label="Leyenda">
        {['CUMPLIO', 'TARDANZA', 'FALTA', 'A_REVISAR', 'DESCANSO', 'VACACIONES'].map((k) => (
          <li key={k}><span className={`mc-chip mc-${ESTADO_DIA[k].clase}`}><span aria-hidden="true">{ESTADO_DIA[k].icono}</span> {ESTADO_DIA[k].texto}</span></li>
        ))}
        <li><span className="mc-chip mc-vac"><span aria-hidden="true">★</span> Feriado</span></li>
      </ul>

      {!cargando && !error && (datos?.dias ?? []).length === 0 && !dia && (
        <p className="as-ayuda">Aún no hay registros en este mes. Toca un día para ver su detalle.</p>
      )}
      {dia && <DetalleDia dia={dia} alCerrar={() => setElegido(null)} alPedirCorreccion={alPedirCorreccion} />}
    </section>
  );
}
