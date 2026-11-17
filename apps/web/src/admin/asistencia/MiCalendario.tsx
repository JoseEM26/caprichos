import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Insignia, type VarianteInsignia } from '../../comun/Insignia';
import { Cargando } from '../../comun/Cargando';
import { jornadaActual } from './jornada';
import { miCalendario, miPlanilla, type DiaCalendario, type EstadoRespuesta, type MiCalendario as Datos } from './miCalendarioApi';
import { ETIQUETA_LINEA, horasMin, normalizarTipo } from './tiposMarca';
import type { PedidoCorreccion } from './CorreccionesAsistencia';
import { BloqueTipoDia } from './BloqueTipoDia';
import { LeyendaCalendario } from './LeyendaCalendario';
import { ResumenMesCalendario } from './ResumenMesCalendario';
import { ESTADO_DIA, MESES, TIPO_DIA, diaSemanaLun, etiquetaFecha, iso, marcaDia, parse, sumarDias, textoRecargo } from './calendarioDia';
import './miAsistencia.css';

const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const estadoDe = (e: string) => ESTADO_DIA[e] ?? { icono: '•', texto: e, clase: 'neutro' };
const sinEstadoFuturo = (e?: string) => e === 'SIN_EVALUAR' || e === 'POR_EMPEZAR';

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

/** Lo que pagó la planilla ese día (de «Mis pagos»: mismo cálculo que el pago). */
export interface PagoDia { ganado: number; penalidadTardanza: number; extraAprobada: boolean; extraMin: number; tarifaEspecial?: { desdeHora: string; tarifaHora: number } | null }

function DetalleDia({ dia, pago, alCerrar, alPedirCorreccion, alJustificar }: { dia: DiaCalendario; pago?: PagoDia | null; alCerrar: () => void; alPedirCorreccion?: (fecha: string) => void; alJustificar?: (p: PedidoCorreccion) => void }) {
  const e = estadoDe(dia.estado);
  const pasos = pasosDelDia(dia);
  const extra = dia.extraMin ?? 0;
  return (
    <section className="mc-detalle" aria-label={`Detalle de ${etiquetaFecha(dia.fecha)}`} data-testid="detalle-dia">
      <header className="mc-detalle-cab">
        <div>
          <h4>{etiquetaFecha(dia.fecha)}</h4>
          <span className={`mc-chip mc-${e.clase}`}><span aria-hidden="true">{e.icono}</span> {e.texto}</span>
        </div>
        <button type="button" className="mc-cerrar" onClick={alCerrar} aria-label="Cerrar detalle">×</button>
      </header>
      <BloqueTipoDia dia={dia} />
      {pasos.length === 0
        ? <p className="mc-sub" data-testid="sin-marcas">{dia.programado ? 'No hay marcas este día.' : 'Sin turno ni marcas este día.'}</p>
        : (
          <>
            <h5 className="mc-subtitulo">Tus marcas</h5>
            <ol className="mc-linea" aria-label="Línea de tiempo del día">
              {pasos.map((p) => (
                <li key={p.clave}>
                  <b>{p.hora}</b> {p.texto}{p.nota && <small> ({p.nota})</small>}
                </li>
              ))}
            </ol>
          </>
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
      {pago && (
        <dl className="mp-dia-pago" aria-label="Lo que se paga este día" data-testid="pago-dia">
          <div><dt>Lo que ganas este día</dt><dd>{s(pago.ganado)}</dd></div>
          {pago.tarifaEspecial && <div><dt>Tarifa especial</dt><dd>{s(pago.tarifaEspecial.tarifaHora)} por hora desde las {pago.tarifaEspecial.desdeHora}. Las horas anteriores siguen a valor hora normal.</dd></div>}
          {pago.penalidadTardanza > 0 && <div><dt>Descuento por tardanza</dt><dd>- {s(pago.penalidadTardanza)}</dd></div>}
          {pago.extraMin > 0 && <div><dt>Extra {pago.extraAprobada ? 'aprobada (se paga)' : 'sin aprobar (no se paga aún)'}</dt><dd>{horasMin(pago.extraMin)}</dd></div>}
        </dl>
      )}
      {alJustificar && (dia.tardanzaMin ?? 0) > 0 && dia.entradaMarcaId && dia.programado && (!dia.solicitud || dia.solicitud.estado === 'RECHAZADA') && (
        <button type="button" className="mc-atajo-corr" onClick={() => alJustificar({ jornada: dia.fecha, justificar: { marcaId: dia.entradaMarcaId!, horaTurno: dia.programado!.entrada, tardanzaMin: dia.tardanzaMin! } })}>
          ¿Quieres justificar esta tardanza?
        </button>
      )}
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

const s = (n: number) => `S/ ${n.toFixed(2)}`;

/** Texto de la celda para lectores de pantalla: fecha, tipo, feriado, turno, estado y horas. */
function etiquetaDia(f: string, d: DiaCalendario | undefined, e: { texto: string } | null, futuro: boolean): string {
  const tipo = d?.tipoDia;
  const tipoTexto = tipo && tipo !== 'TRABAJA' && tipo !== 'FERIADO' ? TIPO_DIA[tipo]?.texto.toLowerCase() : null;
  return [
    etiquetaFecha(f),
    tipoTexto,
    d?.feriado ? `feriado ${d.feriado}` : null,
    d?.pagaRecargo && d.recargo ? `se paga ${textoRecargo(d.recargo)}` : null,
    d?.programado ? `turno ${d.programado.entrada} a ${d.programado.salida}` : null,
    e && !(futuro && sinEstadoFuturo(d?.estado)) ? e.texto : futuro ? 'aún no llega' : 'sin registro',
    d?.entrada ? `entrada ${d.entrada}` : null,
    d?.salida ? `salida ${d.salida}` : null,
  ].filter(Boolean).join(', ');
}

/** Historial propio en calendario mensual: tipo de día, horario, feriados con recargo y detalle al tocar. */
export function MiCalendario({ alPedirCorreccion, alJustificar }: { alPedirCorreccion?: (fecha: string) => void; alJustificar?: (p: PedidoCorreccion) => void } = {}) {
  const hoy = jornadaActual();
  const inicial = parse(hoy);
  const [mes, setMes] = useState({ a: inicial.a, m0: inicial.m0 });
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);
  const [elegido, setElegido] = useState<string | null>(null);
  const [semana, setSemana] = useState<string | null>(null); // lunes de la semana resaltada
  const [pagoDe, setPagoDe] = useState<{ fecha: string; pago: PagoDia | null } | null>(null);

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
  }, [desde, hasta, intento]);

  // Al elegir un día, se pide la planilla del período que lo contiene (si hay sueldo) para mostrar lo que se paga.
  useEffect(() => {
    if (!elegido) return;
    let vigente = true;
    (async () => {
      let pago: PagoDia | null = null;
      try {
        const pl = await miPlanilla(elegido);
        const x = pl?.dias?.find((d) => d.fecha === elegido);
        if (x) pago = { ganado: x.ganado, penalidadTardanza: x.penalidadTardanza, extraAprobada: x.extraAprobada, extraMin: x.extraMin, tarifaEspecial: x.tarifaEspecial ?? null };
      } catch { /* sin planilla: el detalle sigue, sin cifras de pago */ }
      if (vigente) setPagoDe({ fecha: elegido, pago });
    })();
    return () => { vigente = false; };
  }, [elegido]);

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

      {r && <ResumenMesCalendario resumen={r} proximos={datos?.proximos} />}

      {cargando && <Cargando mensaje="Cargando tu calendario…" />}
      {error && !cargando && <p role="alert" className="as-aviso as-aviso--alerta">No pudimos cargar tu calendario. Intenta otra vez.</p>}
      {error && !cargando && <button type="button" className="mc-atajo-corr" onClick={() => setIntento((n) => n + 1)}>Reintentar</button>}

      {!error && (
        <div className="mc-grilla" role="group" aria-label={`Días de ${MESES[mes.m0]} ${mes.a}`} aria-busy={cargando}>
          {DIAS_SEMANA.map((n, i) => <span key={i} className="mc-cab" aria-hidden="true">{n}</span>)}
          {celdas.map((f, i) => {
            if (!f) return <span key={`v${i}`} />;
            const d = porFecha.get(f);
            const e = d ? estadoDe(d.estado) : null;
            const marca = d ? marcaDia(d) : null;
            const futuro = f > hoy;
            const enSemana = semana !== null && f >= semana && f <= sumarDias(semana, 6);
            return (
              <button
                key={f}
                type="button"
                data-fecha={f}
                className={`mc-dia mc-${futuro && sinEstadoFuturo(d?.estado) ? 'futuro' : e?.clase ?? 'vacio'}${f === hoy ? ' mc-hoy' : ''}${enSemana ? ' mc-semana' : ''}`}
                aria-label={etiquetaDia(f, d, e, futuro)}
                aria-pressed={elegido === f}
                aria-current={f === hoy ? 'date' : undefined}
                onClick={() => setElegido(elegido === f ? null : f)}
                onKeyDown={(ev) => teclas(ev, f)}
              >
                <span className="mc-num">{parse(f).d}</span>
                {d?.feriado && marca?.clase !== 'feriado' && <span className="mc-fer" title={d.feriado}>★</span>}
                {marca && (
                  <span className={`mc-tipo mc-tipo-${marca.clase}`}><span aria-hidden="true">{marca.icono}</span> <span className="mc-tipo-texto">{marca.texto}</span></span>
                )}
                {e && !(futuro && sinEstadoFuturo(d?.estado)) && (
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

      <LeyendaCalendario />

      {!cargando && !error && (datos?.dias ?? []).length === 0 && !dia && (
        <p className="as-ayuda">Aún no hay registros en este mes. Toca un día para ver su detalle.</p>
      )}
      {dia && <DetalleDia dia={dia} pago={pagoDe?.fecha === dia.fecha ? pagoDe.pago : null} alCerrar={() => setElegido(null)} alPedirCorreccion={alPedirCorreccion} alJustificar={alJustificar} />}
    </section>
  );
}
