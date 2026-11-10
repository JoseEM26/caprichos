import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { Confirmar } from '../../comun/Confirmar';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { Insignia, type VarianteInsignia } from '../../comun/Insignia';
import { ETIQUETAS_ROLES } from '../usuarios/roles';
import { ETIQUETA_ESTADO } from './asistenciaApi';
import { coincide } from './buscar';
import {
  CalendarioMes, DiaResumen, ETIQUETA_TIPO_CAL, FilaCal, RegistroCal, calendario, calendarioFilas, csvDeRegistro, esARevisar, esPresente, totalesDe,
} from './calendarioApi';
import { ResultadoLote, cronograma, Cronograma, loteCorrecciones } from './correccionesApi';
import { VistaDia, etiquetaDia, rangoMes, sumarDias } from './CronogramaTab';
import { DetalleDiaPersona } from './DetalleDiaPersona';
import { jornadaActual, useUltimaPeticion } from './jornada';
import './cronograma.css';
import './calendario.css';

type Avisar = (m: string | null) => void;
const mensajeDe = (e: unknown, fallback: string) => (e as any)?.mensaje ?? (e as any)?.message ?? fallback;
const NOMBRE_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const MAX_DIAS = 62;
const MAX_PROGRAMAR = 7;
const MAX_LOTE = 200;
const POR_PAGINA = 100;

const VARIANTE: Record<string, VarianteInsignia> = {
  CUMPLIO: 'exito', TARDANZA: 'aviso', SALIO_ANTES: 'aviso', SALIO_DESPUES: 'neutro', FALTA: 'peligro', INCOMPLETO: 'peligro', A_REVISAR: 'acento', DESCANSO: 'neutro', SIN_EVALUAR: 'neutro',
};
const ESTADOS_FILTRO = [
  ['PRESENTE', 'Presente'], ['TARDANZA', 'Tarde'], ['FALTA', 'Falta'], ['A_REVISAR', 'A revisar'], ['CON_SOLICITUD', 'Con solicitud'],
] as const;
const ETIQUETA_FILTRO: Record<string, string> = Object.fromEntries(ESTADOS_FILTRO);
const ROLES_FILTRO = Object.keys(ETIQUETAS_ROLES).filter((r) => r !== 'CALLCENTER');
const nombreRol = (r: string) => (ETIQUETAS_ROLES[r] ?? r).replace(/ \(.*\)$/, '');

const hh = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
const dif = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000) + 1;
const ordenar = (a: string, b: string): [string, string] => (a <= b ? [a, b] : [b, a]);
const lunesDe = (iso: string) => sumarDias(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7));

interface Filtros { q: string; roles: string[]; estados: string[]; soloSol: boolean }
const SIN_FILTROS: Filtros = { q: '', roles: [], estados: [], soloSol: false };

const tienePendiente = (f: FilaCal) => f.solicitudes.some((s) => s.estado === 'PENDIENTE');
const marcasPorRevisar = (f: FilaCal) => f.marcas.filter((m) => m.estado === 'A_REVISAR');

function coincideFiltros(f: FilaCal, x: Filtros) {
  if (!coincide(f.nombre, x.q)) return false;
  if (x.roles.length && !x.roles.includes(f.rol)) return false;
  if (x.soloSol && !tienePendiente(f)) return false;
  if (x.estados.length) {
    const ok = x.estados.some((e) =>
      e === 'PRESENTE' ? esPresente(f.estado) : e === 'TARDANZA' ? f.estado === 'TARDANZA' : e === 'FALTA' ? f.estado === 'FALTA'
        : e === 'A_REVISAR' ? esARevisar(f.estado) || marcasPorRevisar(f).length > 0 : f.solicitudes.length > 0);
    if (!ok) return false;
  }
  return true;
}

function tonoDe(d: DiaResumen) {
  return d.faltas ? 'falta' : d.aRevisar || d.solicitudesPendientes ? 'revisar' : d.tardanzas ? 'tarde' : d.presentes ? 'ok' : 'vacio';
}

/** Calendario de asistencia: resumen del mes, rango de días, registro de todos, detalle por persona y modo «Programar». */
export function CalendarioTab({ onError, onOk, alCambiar }: { onError: Avisar; onOk: Avisar; alCambiar?: () => void }) {
  const hoy = jornadaActual();
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [modo, setModo] = useState<'ver' | 'programar'>('ver');
  const [resumen, setResumen] = useState<CalendarioMes | null>(null);
  const [registro, setRegistro] = useState<RegistroCal | null>(null);
  const [cargando, setCargando] = useState(false);
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [detalle, setDetalle] = useState<{ partyId: string; fecha: string } | null>(null);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [confirmar, setConfirmar] = useState<'APROBAR' | 'RECHAZAR' | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [errorLote, setErrorLote] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoLote | null>(null);
  const [visibles, setVisibles] = useState(POR_PAGINA);
  const [personalizado, setPersonalizado] = useState(false);
  const arrastre = useRef<{ ancla: string; movio: boolean } | null>(null);
  const nuevaMes = useUltimaPeticion();
  const nuevaFilas = useUltimaPeticion();

  const rangoOk = desde <= hasta && dif(desde, hasta) <= MAX_DIAS;
  const nDias = desde <= hasta ? dif(desde, hasta) : 0;

  const cargarMes = useCallback(async () => {
    const [a, m] = mes.split('-').map(Number);
    const r = rangoMes(a, m);
    const vigente = nuevaMes();
    try {
      const x = await calendario(r.desde, r.hasta);
      if (vigente()) setResumen(x);
    } catch (e) {
      if (vigente()) onError(mensajeDe(e, 'No pudimos cargar el calendario.'));
    }
  }, [mes, onError, nuevaMes]);
  useEffect(() => { setResumen(null); void cargarMes(); }, [cargarMes]);

  const cargarFilas = useCallback(async () => {
    if (!rangoOk || modo !== 'ver') return;
    const vigente = nuevaFilas();
    setCargando(true);
    try {
      const x = await calendarioFilas({ desde, hasta });
      if (!vigente()) return;
      setRegistro(x);
      onError(null);
    } catch (e) {
      if (vigente()) onError(mensajeDe(e, 'No pudimos cargar el registro.'));
    } finally {
      if (vigente()) setCargando(false);
    }
  }, [desde, hasta, rangoOk, modo, onError, nuevaFilas]);
  useEffect(() => { setRegistro(null); setElegidas(new Set()); setDetalle(null); setVisibles(POR_PAGINA); void cargarFilas(); }, [cargarFilas]);

  const recargar = async () => { await Promise.all([cargarFilas(), cargarMes()]); alCambiar?.(); };

  const elegirRango = (a: string, b: string) => { const [d, h] = ordenar(a, b); setDesde(d); setHasta(h); setPersonalizado(false); };
  const [anio, mesN] = mes.split('-').map(Number);
  const moverMes = (n: number) => setMes(new Date(Date.UTC(anio, mesN - 1 + n, 1)).toISOString().slice(0, 7));
  const diasDelMes: string[] = [];
  const rm = rangoMes(anio, mesN);
  for (let j = rm.desde; j <= rm.hasta; j = sumarDias(j, 1)) diasDelMes.push(j);
  const huecos = (new Date(`${rm.desde}T00:00:00Z`).getUTCDay() + 6) % 7;
  const porDia = useMemo(() => new Map((resumen?.dias ?? []).map((d) => [d.fecha, d])), [resumen]);

  const filas = useMemo(() => (registro?.filas ?? []).filter((f) => coincideFiltros(f, filtros)), [registro, filtros]);
  const totales = useMemo(() => totalesDe(filas), [filas]);
  const nFiltros = (filtros.q ? 1 : 0) + filtros.roles.length + filtros.estados.length + (filtros.soloSol ? 1 : 0);
  const chips: Array<[string, string, () => void]> = [
    ...(filtros.q ? [['q', `Persona: ${filtros.q}`, () => setFiltros({ ...filtros, q: '' })] as [string, string, () => void]] : []),
    ...filtros.roles.map((r) => [`r${r}`, `Rol: ${nombreRol(r)}`, () => setFiltros({ ...filtros, roles: filtros.roles.filter((x) => x !== r) })] as [string, string, () => void]),
    ...filtros.estados.map((e) => [`e${e}`, `Estado: ${ETIQUETA_FILTRO[e]}`, () => setFiltros({ ...filtros, estados: filtros.estados.filter((x) => x !== e) })] as [string, string, () => void]),
    ...(filtros.soloSol ? [['s', 'Solo con solicitudes pendientes', () => setFiltros({ ...filtros, soloSol: false })] as [string, string, () => void]] : []),
  ];
  const alternar = <K extends 'roles' | 'estados'>(k: K, v: string) =>
    setFiltros((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }));

  // Selección para el lote: solo filas con algo que aprobar (solicitudes pendientes o marcas por revisar)
  const clave = (f: FilaCal) => `${f.partyId}|${f.fecha}`;
  const aprobables = filas.filter((f) => tienePendiente(f) || marcasPorRevisar(f).length > 0);
  const elegidasVisibles = aprobables.filter((f) => elegidas.has(clave(f)));
  const itemsLote = elegidasVisibles.flatMap((f) => [
    ...f.solicitudes.filter((s) => s.estado === 'PENDIENTE').map((s) => ({ tipo: 'SOLICITUD' as const, id: s.id })),
    ...marcasPorRevisar(f).map((m) => ({ tipo: 'MARCA' as const, id: m.id })),
  ]);
  const alternarFila = (f: FilaCal) => setElegidas((s) => { const n = new Set(s); const k = clave(f); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const todas = aprobables.length > 0 && elegidasVisibles.length === aprobables.length;

  const ejecutar = async () => {
    if (!confirmar) return;
    setOcupado(true);
    setErrorLote(null);
    try {
      const r = await loteCorrecciones({ accion: confirmar, ...(confirmar === 'RECHAZAR' ? { motivo: motivo.trim() } : {}), items: itemsLote });
      setResultado(r);
      setConfirmar(null);
      setMotivo('');
      setElegidas(new Set());
      onOk(`${confirmar === 'APROBAR' ? 'Aprobadas' : 'Rechazadas/anuladas'}: ${r.ok} de ${r.total}.${r.fallidas ? ` ${r.fallidas} no se pudieron procesar (ver abajo).` : ''}`);
      await recargar();
    } catch (e) {
      setErrorLote(mensajeDe(e, 'No se pudo procesar el lote.'));
    } finally {
      setOcupado(false);
    }
  };

  const descargar = async () => {
    try {
      const blob = new Blob([csvDeRegistro(filas)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `asistencia-${desde}${hasta !== desde ? `_a_${hasta}` : ''}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      onError(mensajeDe(e, 'No se pudo exportar.'));
    }
  };

  const filaDetalle = detalle ? registro?.filas.find((f) => f.partyId === detalle.partyId && f.fecha === detalle.fecha) ?? null : null;

  return (
    <div className="ca-vista">
      <div className="ca-barra">
        <div className="ca-grupo" role="group" aria-label="Modo del calendario">
          <button type="button" className="ca-modo" aria-pressed={modo === 'ver'} onClick={() => setModo('ver')}>Ver</button>
          <button type="button" className="ca-modo" aria-pressed={modo === 'programar'} onClick={() => setModo('programar')}>Programar</button>
        </div>
        <p className="as-ayuda ca-modo-ayuda">
          {modo === 'ver' ? 'Elige un día o un rango y mira el registro de todos.' : 'Turnos programados y línea de tiempo por persona (hasta 7 días).'}
        </p>
      </div>

      <section className="ca-mes" aria-label={`Calendario de ${NOMBRE_MES[mesN - 1]} ${anio}`}>
        <div className="ca-mes-cab">
          <Boton type="button" variante="secundario" tamano="pequeno" aria-label="Mes anterior" onClick={() => moverMes(-1)}>‹</Boton>
          <h3 className="as-sub ca-mes-titulo" aria-live="polite">{NOMBRE_MES[mesN - 1]} {anio}</h3>
          <Boton type="button" variante="secundario" tamano="pequeno" aria-label="Mes siguiente" onClick={() => moverMes(1)}>›</Boton>
          <Boton type="button" variante="texto" tamano="pequeno" onClick={() => { setMes(hoy.slice(0, 7)); elegirRango(hoy, hoy); }}>Hoy</Boton>
        </div>
        <div className="ca-cal" role="group" aria-label="Días del mes. Toca un día; arrastra o usa Mayús para elegir varios" onPointerUp={() => { setTimeout(() => { arrastre.current = null; }, 0); }}>
          {DIAS_CORTOS.map((d) => <div key={d} className="ca-cab" aria-hidden>{d}</div>)}
          {Array.from({ length: huecos }).map((_, i) => <div key={`h${i}`} aria-hidden />)}
          {diasDelMes.map((j) => {
            const d = porDia.get(j);
            const dentro = j >= desde && j <= hasta;
            const texto = !d ? 'sin datos'
              : `${d.presentes} presentes, ${d.tardanzas} tardanzas, ${d.faltas} faltas, ${d.aRevisar} a revisar, ${d.solicitudesPendientes} solicitudes pendientes${d.feriado ? `, feriado: ${d.feriado}` : ''}`;
            return (
              <button
                key={j}
                type="button"
                className={`ca-dia ca-dia--${d ? tonoDe(d) : 'vacio'}${dentro ? ' ca-dia--sel' : ''}${j === hoy ? ' ca-dia--hoy' : ''}${d?.feriado ? ' ca-dia--feriado' : ''}`}
                aria-pressed={dentro}
                aria-label={`${etiquetaDia(j)}: ${texto}`}
                title={d?.feriado ?? undefined}
                onPointerDown={() => { arrastre.current = { ancla: j, movio: false }; }}
                onPointerEnter={(e) => {
                  if (arrastre.current && e.buttons === 1 && arrastre.current.ancla !== j) { arrastre.current.movio = true; elegirRango(arrastre.current.ancla, j); }
                }}
                onClick={(e) => {
                  if (arrastre.current?.movio) return;
                  if (e.shiftKey && desde) elegirRango(desde, j); else elegirRango(j, j);
                }}
              >
                <b>{Number(j.slice(8))}</b>
                {d?.feriado && <span className="ca-feriado" aria-hidden>Feriado</span>}
                {d && (d.presentes + d.tardanzas + d.faltas + d.aRevisar + d.solicitudesPendientes) > 0 && (
                  <span className="ca-ind" aria-hidden>
                    {d.presentes > 0 && <span className="ca-i ca-i--ok" title="Presentes">{d.presentes}</span>}
                    {d.tardanzas > 0 && <span className="ca-i ca-i--tarde" title="Tardanzas">{d.tardanzas}</span>}
                    {d.faltas > 0 && <span className="ca-i ca-i--falta" title="Faltas">{d.faltas}</span>}
                    {d.aRevisar > 0 && <span className="ca-i ca-i--rev" title="A revisar">{d.aRevisar}</span>}
                    {d.solicitudesPendientes > 0 && <span className="ca-i ca-i--sol" title="Solicitudes pendientes">✉{d.solicitudesPendientes}</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="as-ayuda ca-leyenda">
          <span className="ca-i ca-i--ok">1</span> presentes · <span className="ca-i ca-i--tarde">1</span> tardanzas · <span className="ca-i ca-i--falta">1</span> faltas · <span className="ca-i ca-i--rev">1</span> a revisar · <span className="ca-i ca-i--sol">✉</span> solicitudes pendientes
        </p>
      </section>

      <div className="ca-rango" role="group" aria-label="Rango de días">
        <strong className="ca-rango-txt" role="status">
          {desde === hasta ? etiquetaDia(desde) : `${etiquetaDia(desde)} al ${etiquetaDia(hasta)}`} · {nDias} {nDias === 1 ? 'día' : 'días'}
        </strong>
        <Boton type="button" variante="secundario" tamano="pequeno" onClick={() => elegirRango(desde, desde)}>1 día</Boton>
        <Boton type="button" variante="secundario" tamano="pequeno" onClick={() => elegirRango(desde, sumarDias(desde, 2))}>3 días</Boton>
        <Boton type="button" variante="secundario" tamano="pequeno" onClick={() => elegirRango(lunesDe(desde), sumarDias(lunesDe(desde), 6))}>Semana</Boton>
        <Boton type="button" variante="secundario" tamano="pequeno" onClick={() => elegirRango(rm.desde, rm.hasta)}>Mes</Boton>
        <Boton type="button" variante={personalizado ? 'primario' : 'secundario'} tamano="pequeno" aria-expanded={personalizado} onClick={() => setPersonalizado((v) => !v)}>Rango personalizado</Boton>
      </div>
      {personalizado && (
        <div className="ca-personalizado">
          <label className="as-campo">Desde <input type="date" value={desde} onChange={(e) => e.target.value && setDesde(e.target.value)} /></label>
          <label className="as-campo">Hasta <input type="date" value={hasta} onChange={(e) => e.target.value && setHasta(e.target.value)} /></label>
          {!rangoOk && <p role="alert" className="as-ayuda">{desde > hasta ? '«Desde» no puede ser posterior a «Hasta».' : `El rango puede ser de 1 a ${MAX_DIAS} días.`}</p>}
        </div>
      )}
      {!rangoOk && !personalizado && <p role="alert" className="as-ayuda">El rango puede ser de 1 a {MAX_DIAS} días.</p>}

      <div className="ca-herramientas">
        <Boton type="button" variante={nFiltros ? 'primario' : 'secundario'} aria-expanded={filtrosAbiertos} aria-controls="ca-panel-filtros" onClick={() => setFiltrosAbiertos((v) => !v)}>
          Filtros{nFiltros > 0 ? ` (${nFiltros})` : ''}
        </Boton>
        {chips.map(([k, t, quitar]) => (
          <button key={k} type="button" className="ca-chip" aria-label={`Quitar filtro ${t}`} onClick={quitar}>{t} <span aria-hidden>✕</span></button>
        ))}
        {chips.length > 0 && <Boton type="button" variante="texto" tamano="pequeno" onClick={() => setFiltros(SIN_FILTROS)}>Limpiar</Boton>}
        {modo === 'ver' && <Boton type="button" variante="secundario" tamano="pequeno" className="ca-csv" disabled={filas.length === 0} onClick={() => void descargar()}>Exportar CSV</Boton>}
      </div>
      {filtrosAbiertos && (
        <div id="ca-panel-filtros" className="ca-filtros" role="region" aria-label="Filtros del registro">
          <label className="as-campo">Persona
            <input type="search" value={filtros.q} placeholder="Nombre (sin tildes)" onChange={(e) => setFiltros({ ...filtros, q: e.target.value })} />
          </label>
          <fieldset><legend>Rol</legend>
            {ROLES_FILTRO.map((r) => (
              <label key={r} className="ca-check"><input type="checkbox" checked={filtros.roles.includes(r)} onChange={() => alternar('roles', r)} /> {nombreRol(r)}</label>
            ))}
          </fieldset>
          <fieldset><legend>Estado</legend>
            {ESTADOS_FILTRO.map(([k, t]) => (
              <label key={k} className="ca-check"><input type="checkbox" checked={filtros.estados.includes(k)} onChange={() => alternar('estados', k)} /> {t}</label>
            ))}
            <label className="ca-check"><input type="checkbox" checked={filtros.soloSol} onChange={(e) => setFiltros({ ...filtros, soloSol: e.target.checked })} /> Solo con solicitudes pendientes</label>
          </fieldset>
          <div className="as-acciones">
            <Boton type="button" variante="texto" onClick={() => setFiltros(SIN_FILTROS)}>Limpiar filtros</Boton>
            <Boton type="button" onClick={() => setFiltrosAbiertos(false)}>Listo</Boton>
          </div>
        </div>
      )}

      {modo === 'programar' ? (
        <Programar desde={desde} hasta={hasta} filtros={filtros} onError={onError} onOk={onOk} />
      ) : !rangoOk ? null : !registro ? (
        cargando ? <Cargando mensaje="Cargando registro" /> : null
      ) : filas.length === 0 ? (
        <EstadoVacio titulo="Sin registros" descripcion={registro.filas.length ? 'Ninguna fila cumple los filtros. Quita alguno para ver más.' : 'Ese rango no tiene turnos ni marcas.'} />
      ) : (
        <>
          <div className="as-tabla-wrap ca-tabla-wrap" tabIndex={0} aria-label="Registro por días">
            <table className="as-tabla as-tabla--tarjetas ca-tabla">
              <thead>
                <tr>
                  <th>
                    <label className="ca-check">
                      <input type="checkbox" disabled={aprobables.length === 0} checked={todas} onChange={(e) => setElegidas(e.target.checked ? new Set(aprobables.map(clave)) : new Set())} aria-label="Seleccionar todo lo que se puede aprobar" />
                    </label>
                  </th>
                  <th>Persona</th><th>Día</th><th>Turno</th><th>Entrada</th><th>Sal. almorzar</th><th>Vuelta</th><th>Almuerzo (min)</th><th>Salida</th>
                  <th>Trabajado</th><th>Tardanza</th><th>Extra</th><th>Estado</th><th>Marcas</th><th><span className="ca-sr">Detalle</span></th>
                </tr>
              </thead>
              <tbody>
                {filas.slice(0, visibles).map((f) => {
                  const pend = f.solicitudes.filter((s) => s.estado === 'PENDIENTE').length;
                  return (
                    <tr key={clave(f)} className={detalle && detalle.partyId === f.partyId && detalle.fecha === f.fecha ? 'ca-fila--sel' : undefined}>
                      <td data-label="">
                        {(pend > 0 || marcasPorRevisar(f).length > 0) && (
                          <label className="ca-check"><input type="checkbox" checked={elegidas.has(clave(f))} onChange={() => alternarFila(f)} aria-label={`Elegir ${f.nombre} del ${f.fecha}`} /></label>
                        )}
                      </td>
                      <td data-label="Persona" className="as-nombre">{f.nombre}<small className="as-nota">{nombreRol(f.rol)}</small></td>
                      <td data-label="Día" className="as-num">{f.fecha.slice(5).split('-').reverse().join('/')}</td>
                      <td data-label="Turno" className="as-num">{f.turno ? `${f.turno.entrada}-${f.turno.salida}` : '—'}</td>
                      <td data-label="Entrada" className="as-num">{f.entrada ?? '—'}</td>
                      <td data-label="Sal. almorzar" className="as-num">{f.almuerzoSalida ?? '—'}</td>
                      <td data-label="Vuelta" className="as-num">{f.almuerzoVuelta ?? '—'}</td>
                      <td data-label="Almuerzo (min)" className="as-num">{f.almuerzoMin ?? '—'}</td>
                      <td data-label="Salida" className="as-num">{f.salida ?? '—'}</td>
                      <td data-label="Trabajado" className="as-num">{f.trabajadaMin ? hh(f.trabajadaMin) : '—'}</td>
                      <td data-label="Tardanza" className="as-num">{f.tardanzaMin ? `${f.tardanzaMin} min` : '—'}</td>
                      <td data-label="Extra" className="as-num">{f.extraMin ? `${f.extraMin} min` : '—'}</td>
                      <td data-label="Estado">
                        <span className="ca-estado">
                          <Insignia variante={VARIANTE[f.estado] ?? 'neutro'}>{ETIQUETA_ESTADO[f.estado] ?? f.estado}</Insignia>
                          {f.solicitudes.length > 0 && <Insignia variante="acento" title="Solicitudes de corrección">✉ {f.solicitudes.length} {pend ? 'pendiente' + (pend > 1 ? 's' : '') : 'resuelta' + (f.solicitudes.length > 1 ? 's' : '')}</Insignia>}
                          {f.inconsistencias.length > 0 && <Insignia variante="aviso" title={f.inconsistencias.join('; ')}>⚠ {f.inconsistencias.length}</Insignia>}
                        </span>
                      </td>
                      <td data-label="Marcas">
                        {f.marcas.length === 0 ? '—' : <div className="ca-marcas">{f.marcas.map((m) => (
                          <span key={m.id} className={`ca-marca${m.estado === 'A_REVISAR' ? ' ca-marca--rev' : ''}`} title={m.tipo ? ETIQUETA_TIPO_CAL[m.tipo] : 'Sin tipo'}>
                            {m.tipo ? ETIQUETA_TIPO_CAL[m.tipo].split(' ')[0] : '?'} {m.hora}
                          </span>
                        ))}</div>}
                      </td>
                      <td data-label="">
                        <Boton type="button" variante="secundario" tamano="pequeno" aria-label={`Detalle de ${f.nombre} del ${f.fecha}`} onClick={() => setDetalle({ partyId: f.partyId, fecha: f.fecha })}>Detalle</Boton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filas.length > visibles && (
            <Boton type="button" variante="secundario" onClick={() => setVisibles((v) => v + POR_PAGINA)}>Mostrar {Math.min(POR_PAGINA, filas.length - visibles)} más ({filas.length - visibles} sin mostrar)</Boton>
          )}
          <div className="ca-totales" role="status" aria-label="Totales del rango">
            <span><b>{filas.length}</b> {filas.length === 1 ? 'registro' : 'registros'}</span>
            <span>Trabajado <b>{hh(totales.trabajadaMin)}</b></span>
            <span>Tardanza <b>{totales.tardanzaMin} min</b></span>
            <span>Extra <b>{totales.extraMin} min</b></span>
            <span>Faltas <b>{totales.faltas}</b></span>
          </div>
        </>
      )}

      {filaDetalle && <DetalleDiaPersona fila={filaDetalle} onCerrar={() => setDetalle(null)} onCambio={() => void recargar()} onError={onError} onOk={onOk} />}

      {modo === 'ver' && (elegidasVisibles.length > 0) && (
        <div className="cr-lote" role="region" aria-label="Acciones en lote">
          <strong>{elegidasVisibles.length} {elegidasVisibles.length === 1 ? 'día seleccionado' : 'días seleccionados'} ({itemsLote.length} {itemsLote.length === 1 ? 'ítem' : 'ítems'})</strong>
          {itemsLote.length > MAX_LOTE && <span role="alert">Máximo {MAX_LOTE} por vez: quita algunas.</span>}
          <Boton type="button" disabled={itemsLote.length === 0 || itemsLote.length > MAX_LOTE} onClick={() => { setErrorLote(null); setConfirmar('APROBAR'); }}>Aprobar seleccionadas</Boton>
          <Boton type="button" variante="peligro" disabled={itemsLote.length === 0 || itemsLote.length > MAX_LOTE} onClick={() => { setErrorLote(null); setConfirmar('RECHAZAR'); }}>Rechazar/anular seleccionadas</Boton>
          <Boton type="button" variante="texto" onClick={() => setElegidas(new Set())}>Quitar selección</Boton>
        </div>
      )}
      {resultado && (
        <section className="ca-resultado" aria-label="Resultado del lote">
          <strong>Resultado: {resultado.ok} de {resultado.total}{resultado.fallidas ? ` (${resultado.fallidas} no se pudieron procesar)` : ''}</strong>
          <ul className="cr-resultado cr-alertas">
            {resultado.resultados.map((r) => <li key={`${r.tipo}${r.id}`} className={r.ok ? 'ok' : 'mal'}>{r.tipo === 'MARCA' ? 'Marca' : 'Solicitud'} #{r.id}: {r.ok ? 'listo' : r.mensaje}</li>)}
          </ul>
          <Boton type="button" variante="texto" onClick={() => setResultado(null)}>Cerrar resultado</Boton>
        </section>
      )}
      <Confirmar
        abierto={confirmar !== null}
        titulo={confirmar === 'APROBAR' ? '¿Aprobar las seleccionadas?' : '¿Rechazar/anular las seleccionadas?'}
        mensaje={`${itemsLote.length} ${itemsLote.length === 1 ? 'ítem' : 'ítems'} de ${[...new Set(elegidasVisibles.map((f) => f.nombre))].join(', ')}`}
        textoSi={confirmar === 'APROBAR' ? 'Sí, aprobar' : 'Sí, rechazar'}
        textoNo="No"
        peligro={confirmar === 'RECHAZAR'}
        cargando={ocupado}
        error={errorLote}
        deshabilitarConfirmar={confirmar === 'RECHAZAR' && motivo.trim().length < 10}
        alConfirmar={ejecutar}
        alCancelar={() => setConfirmar(null)}
      >
        {confirmar === 'APROBAR' && <p className="as-ayuda">Las solicitudes crean sus marcas; las marcas por revisar pasan a contar. Lo que no se pueda (período pagado, ya resuelta) se te dirá por cada ítem.</p>}
        {confirmar === 'RECHAZAR' && (
          <label className="as-campo">Un solo motivo para todas (mínimo 10 caracteres)
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} />
          </label>
        )}
      </Confirmar>
    </div>
  );
}

/** Modo «Programar»: turno programado y línea de tiempo por persona y día (lo que antes era la pestaña Cronograma). */
function Programar({ desde, hasta, filtros, onError, onOk }: { desde: string; hasta: string; filtros: Filtros; onError: Avisar; onOk: Avisar }) {
  const [data, setData] = useState<Cronograma | null>(null);
  const n = desde <= hasta ? dif(desde, hasta) : 0;
  const nueva = useUltimaPeticion();
  const cargar = useCallback(async () => {
    if (n < 1 || n > MAX_PROGRAMAR) return;
    const vigente = nueva();
    try {
      const r = await cronograma(desde, hasta);
      if (vigente()) { setData(r); onError(null); }
    } catch (e) {
      if (vigente()) onError(mensajeDe(e, 'No pudimos cargar el cronograma.'));
    }
  }, [desde, hasta, n, onError, nueva]);
  useEffect(() => { setData(null); void cargar(); }, [cargar]);
  if (n > MAX_PROGRAMAR) return <EstadoVacio titulo="Rango muy largo para programar" descripcion={`Elige hasta ${MAX_PROGRAMAR} días (por ejemplo «Semana») para ver los turnos y la línea de tiempo.`} />;
  if (!data) return <Cargando mensaje="Cargando turnos" />;
  const personas = data.personas.filter((p) => coincide(p.nombre, filtros.q) && (!filtros.roles.length || p.roles.some((r) => filtros.roles.includes(r))));
  const dias: string[] = [];
  for (let j = desde; j <= hasta; j = sumarDias(j, 1)) dias.push(j);
  return (
    <div className="ca-programar">
      <p className="as-ayuda">Los horarios fijos de cada persona se cambian en Usuarios › Horario. Aquí ves el turno programado de cada día y lo que marcó.</p>
      {dias.map((j) => <VistaDia key={j} personas={personas} jornada={j} onError={onError} onOk={onOk} recargar={cargar} />)}
    </div>
  );
}
