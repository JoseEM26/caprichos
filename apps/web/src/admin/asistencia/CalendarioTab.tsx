import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { ETIQUETAS_ROLES } from '../usuarios/roles';
import { coincide } from './buscar';
import { CalendarioMes, DiaResumen, FilaCal, RegistroCal, calendario, calendarioFilas, esARevisar, esPresente } from './calendarioApi';
import { cronograma, Cronograma } from './correccionesApi';
import { VistaDia, etiquetaDia, rangoMes, sumarDias } from './CronogramaTab';
import { ModalDiaCalendario } from './ModalDiaCalendario';
import { jornadaActual, useUltimaPeticion } from './jornada';
import './cronograma.css';
import './calendario.css';

type Avisar = (m: string | null) => void;
const mensajeDe = (e: unknown, fallback: string) => (e as any)?.mensaje ?? (e as any)?.message ?? fallback;
const NOMBRE_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const MAX_DIAS = 62;
const MAX_PROGRAMAR = 7;

const ESTADOS_FILTRO = [
  ['PRESENTE', 'Presente'], ['TARDANZA', 'Tarde'], ['FALTA', 'Falta'], ['A_REVISAR', 'A revisar'], ['CON_SOLICITUD', 'Con solicitud'],
] as const;
const ETIQUETA_FILTRO: Record<string, string> = Object.fromEntries(ESTADOS_FILTRO);
const ROLES_FILTRO = Object.keys(ETIQUETAS_ROLES).filter((r) => r !== 'CALLCENTER');
const nombreRol = (r: string) => (ETIQUETAS_ROLES[r] ?? r).replace(/ \(.*\)$/, '');

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
  const [modalAbierto, setModalAbierto] = useState(false);
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
    if (!rangoOk || modo !== 'ver' || !modalAbierto) return;
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
  }, [desde, hasta, rangoOk, modo, modalAbierto, onError, nuevaFilas]);
  useEffect(() => { setRegistro(null); void cargarFilas(); }, [cargarFilas]);

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
  const nFiltros = (filtros.q ? 1 : 0) + filtros.roles.length + filtros.estados.length + (filtros.soloSol ? 1 : 0);
  const chips: Array<[string, string, () => void]> = [
    ...(filtros.q ? [['q', `Persona: ${filtros.q}`, () => setFiltros({ ...filtros, q: '' })] as [string, string, () => void]] : []),
    ...filtros.roles.map((r) => [`r${r}`, `Rol: ${nombreRol(r)}`, () => setFiltros({ ...filtros, roles: filtros.roles.filter((x) => x !== r) })] as [string, string, () => void]),
    ...filtros.estados.map((e) => [`e${e}`, `Estado: ${ETIQUETA_FILTRO[e]}`, () => setFiltros({ ...filtros, estados: filtros.estados.filter((x) => x !== e) })] as [string, string, () => void]),
    ...(filtros.soloSol ? [['s', 'Solo con solicitudes pendientes', () => setFiltros({ ...filtros, soloSol: false })] as [string, string, () => void]] : []),
  ];
  const alternar = <K extends 'roles' | 'estados'>(k: K, v: string) =>
    setFiltros((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }));

  return (
    <div className="ca-vista">
      <div className="ca-barra">
        <div className="ca-grupo" role="group" aria-label="Modo del calendario">
          <button type="button" className="ca-modo" aria-pressed={modo === 'ver'} onClick={() => setModo('ver')}>Ver</button>
          <button type="button" className="ca-modo" aria-pressed={modo === 'programar'} onClick={() => setModo('programar')}>Programar</button>
        </div>
        <p className="as-ayuda ca-modo-ayuda">
          {modo === 'ver' ? 'Toca un día (o arrastra para varios) y se abre todo lo que pasó ese día.' : 'Turnos programados y línea de tiempo por persona (hasta 7 días).'}
        </p>
      </div>

      <section className="ca-mes" aria-label={`Calendario de ${NOMBRE_MES[mesN - 1]} ${anio}`}>
        <div className="ca-mes-cab">
          <Boton type="button" variante="secundario" aria-label="Mes anterior" onClick={() => moverMes(-1)}>‹</Boton>
          <h3 className="as-sub ca-mes-titulo" aria-live="polite">{NOMBRE_MES[mesN - 1]} {anio}</h3>
          <Boton type="button" variante="secundario" aria-label="Mes siguiente" onClick={() => moverMes(1)}>›</Boton>
          <Boton type="button" variante="secundario" onClick={() => { setMes(hoy.slice(0, 7)); elegirRango(hoy, hoy); }}>Hoy</Boton>
        </div>
        <div className="ca-cal" role="group" aria-label="Días del mes. Toca un día; arrastra o usa Mayús para elegir varios" onPointerUp={() => { if (arrastre.current?.movio && modo === 'ver') setModalAbierto(true); setTimeout(() => { arrastre.current = null; }, 0); }}>
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
                  if (modo === 'ver') setModalAbierto(true); // un día (o un rango) abre el modal con todos sus movimientos
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
        <Boton type="button" variante="secundario" onClick={() => elegirRango(desde, desde)}>1 día</Boton>
        <Boton type="button" variante="secundario" onClick={() => elegirRango(desde, sumarDias(desde, 2))}>3 días</Boton>
        <Boton type="button" variante="secundario" onClick={() => elegirRango(lunesDe(desde), sumarDias(lunesDe(desde), 6))}>Semana</Boton>
        <Boton type="button" variante="secundario" onClick={() => elegirRango(rm.desde, rm.hasta)}>Mes</Boton>
        <Boton type="button" variante={personalizado ? 'primario' : 'secundario'} aria-expanded={personalizado} onClick={() => setPersonalizado((v) => !v)}>Rango personalizado</Boton>
        {modo === 'ver' && <Boton type="button" className="ca-ver-mov" disabled={!rangoOk} onClick={() => setModalAbierto(true)}>Ver movimientos</Boton>}
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
        {chips.length > 0 && <Boton type="button" variante="texto" onClick={() => setFiltros(SIN_FILTROS)}>Limpiar</Boton>}
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
      ) : (
        <p className="as-ayuda ca-pista">{rangoOk ? 'Toca un día del calendario o pulsa «Ver movimientos» para abrir el registro de ese rango.' : ''}</p>
      )}

      {modalAbierto && modo === 'ver' && rangoOk && (
        <ModalDiaCalendario
          desde={desde} hasta={hasta} registro={registro} cargando={cargando} filasBase={filas} resumen={resumen?.dias ?? []}
          onCerrar={() => setModalAbierto(false)} recargar={recargar} onError={onError} onOk={onOk}
        />
      )}
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
