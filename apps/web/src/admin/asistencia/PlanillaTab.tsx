import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { Insignia } from '../../comun/Insignia';
import { Paginacion } from '../../comun/Paginacion';
import { ETIQUETAS_ROLES } from '../usuarios/roles';
import { jornadaActual, useUltimaPeticion } from './jornada';
import { coincide } from './buscar';
import { DatosPago } from './DatosPago';
import { PlanillaPersona } from './PlanillaPersona';
import { SECCIONES, SeccionPlanilla } from './PlanillaPersonaTipos';
import { ETIQUETA_VINCULO } from './vinculoApi';
import { ETIQUETA_CATEGORIA, FilaPlanilla, listarPlanilla, soles } from './planillaApi';
import { ModoPeriodo, ModoVista, errorRango, etiquetaPeriodo, etiquetaRango, moverPeriodo, presetsRango, rangoDe } from './periodoVista';
import './planilla.css';

type Avisar = (m: string | null) => void;
type FiltroEstado = 'TODOS' | 'ABIERTO' | 'PAGADO' | 'REVISAR';
type Orden = 'NOMBRE' | 'NETO' | 'ALERTAS';
const mensajeDe = (e: unknown, fallback: string) => (e as any)?.mensaje ?? (e as any)?.message ?? fallback;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const POR_PAGINA = 12;

const penalidadDe = (f: FilaPlanilla) => f.excel?.penalidadTardanza ?? f.penalidad ?? 0;
const prestamosDe = (f: FilaPlanilla) => f.excel?.descuentosPorCategoria?.PRESTAMO ?? 0;
const adelantoDe = (f: FilaPlanilla) => f.excel?.adelanto ?? f.adelantos ?? 0;
const totalDe = (f: FilaPlanilla) => f.excel?.total ?? f.ganado ?? 0;
const netoDe = (f: FilaPlanilla) => f.excel?.diferencia ?? f.neto ?? 0;
const pagadoDe = (f: FilaPlanilla) => f.netoPagado ?? (f.estado === 'PAGADO' ? netoDe(f) : 0);
const suma = (filas: FilaPlanilla[], g: (f: FilaPlanilla) => number) => filas.reduce((s, f) => s + (g(f) || 0), 0);
const alertasDe = (f: FilaPlanilla) => (f.pendientes ?? 0) + (f.consumosAnterioresPendiente ? 1 : 0) + (f.sueldo ? 0 : 1);
const iniciales = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
const nombreRol = (r: string) => (ETIQUETAS_ROLES[r] ?? r).replace(/ \(.*\)$/, '');

/**
 * Planilla del personal (solo ADMIN). Con `?persona=` muestra la PÁGINA de esa persona (ruta propia); si no, la lista con totales,
 * filtros, orden y tarjetas. Período, filtros, búsqueda, orden y página viven en la URL: «Atrás» y los enlaces conservan todo.
 */
export function PlanillaTab({ onError, onOk }: { onError: Avisar; onOk: Avisar }) {
  const [params, setParams] = useSearchParams();
  const vistaModo: ModoVista = params.get('modo') === 'MES' ? 'MES' : params.get('modo') === 'RANGO' ? 'RANGO' : 'SEMANA';
  const enRango = vistaModo === 'RANGO';
  const modo: ModoPeriodo = vistaModo === 'MES' ? 'MES' : 'SEMANA';
  const fecha = ISO.test(params.get('fecha') ?? '') ? params.get('fecha')! : jornadaActual();
  // rango libre: vive en la URL (?modo=RANGO&rd=…&rh=…); sin fechas parte de la semana en curso
  const semanaActual = rangoDe('SEMANA', jornadaActual());
  const rd = ISO.test(params.get('rd') ?? '') ? params.get('rd')! : semanaActual.desde;
  const rh = ISO.test(params.get('rh') ?? '') ? params.get('rh')! : semanaActual.hasta;
  const fallaRango = enRango ? errorRango(rd, rh) : null;
  const estado = (['ABIERTO', 'PAGADO', 'REVISAR'].includes(params.get('estado') ?? '') ? params.get('estado') : 'TODOS') as FiltroEstado;
  const rol = params.get('rol') ?? '';
  const texto = params.get('q') ?? '';
  const orden = (['NETO', 'ALERTAS'].includes(params.get('orden') ?? '') ? params.get('orden') : 'NOMBRE') as Orden;
  const pagina = Math.max(1, Number(params.get('pag')) || 1);
  const personaParam = Number(params.get('persona')) || 0;
  const desdeParam = ISO.test(params.get('desde') ?? '') ? params.get('desde')! : fecha;
  const seccion = (SECCIONES.includes(params.get('seccion') as SeccionPlanilla) ? params.get('seccion') : 'resumen') as SeccionPlanilla;

  /** Cambia partes de la URL (null borra). `replace`: los ajustes de la misma pantalla no llenan el historial. */
  const poner = useCallback((cambios: Record<string, string | null>, replace = true) => {
    setParams((prev) => {
      const n = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(cambios)) { if (v === null || v === '') n.delete(k); else n.set(k, v); }
      return n;
    }, { replace });
  }, [setParams]);
  const filtrar = (cambios: Record<string, string | null>) => poner({ pag: null, ...cambios });

  const [filas, setFilas] = useState<FilaPlanilla[] | null>(null);
  const [errorLista, setErrorLista] = useState<string | null>(null);

  const nueva = useUltimaPeticion();
  const cargar = useCallback(async () => {
    const vigente = nueva();
    try {
      if (enRango && fallaRango) { setFilas([]); return; }
      const r = enRango ? await listarPlanilla(undefined, 'RANGO', { desde: rd, hasta: rh }) : await listarPlanilla(fecha, modo);
      if (!vigente()) return;
      setFilas(r.filas);
      setErrorLista(null);
      onError(null);
    } catch (e) {
      if (vigente()) setErrorLista(mensajeDe(e, 'No pudimos cargar la planilla.'));
    }
  }, [fecha, modo, enRango, rd, rh, fallaRango, onError, nueva]);
  useEffect(() => { void cargar(); }, [cargar]);

  // al volver de la página de una persona la lista se refresca (pudo pagarse o cambiar)
  const estabaEnPersona = useRef(personaParam > 0);
  useEffect(() => {
    if (estabaEnPersona.current && personaParam === 0) void cargar();
    estabaEnPersona.current = personaParam > 0;
  }, [personaParam, cargar]);

  const roles = useMemo(() => [...new Set((filas ?? []).map((f) => f.rol).filter((x): x is string => !!x))].sort(), [filas]);
  const visibles = useMemo(() => (filas ?? []).filter((f) =>
    (estado === 'TODOS' || (estado === 'PAGADO' ? f.estado === 'PAGADO' : estado === 'REVISAR' ? !!f.pendientes : f.estado !== 'PAGADO'))
    && (!rol || f.rol === rol)
    && (!texto.trim() || coincide(f.nombre, texto)))
    .sort((a, b) => (orden === 'NETO' ? netoDe(b) - netoDe(a) : orden === 'ALERTAS' ? alertasDe(b) - alertasDe(a) : 0) || a.nombre.localeCompare(b.nombre)),
  [filas, estado, rol, texto, orden]);

  if (personaParam > 0) {
    return (
      <PlanillaPersona
        partyId={personaParam}
        fecha={desdeParam}
        seccion={seccion}
        onSeccion={(s) => poner({ seccion: s === 'resumen' ? null : s })}
        onFecha={(f) => poner({ desde: f })}
        volver={() => {
          // si se llegó desde la lista, «Atrás» del navegador; si se abrió el enlace directo, se quita la persona de la URL
          if ((window.history.state as { idx?: number } | null)?.idx) window.history.back();
          else poner({ persona: null, desde: null, seccion: null });
        }}
        onError={onError}
        onOk={onOk}
      />
    );
  }

  if (!filas) {
    return errorLista ? <EstadoError titulo="No pudimos cargar la planilla" mensaje={errorLista} alReintentar={() => void cargar()} /> : <Cargando mensaje="Cargando planilla" />;
  }
  const abrir = (f: FilaPlanilla, desde: string) => poner({ persona: String(f.partyId), desde, seccion: null }, false);
  const quitarFiltros = () => filtrar({ estado: null, rol: null, q: null });
  const hoy = jornadaActual();
  const vista = enRango ? { desde: rd, hasta: rh } : rangoDe(modo, fecha);
  const esActual = !enRango && rangoDe(modo, hoy).desde === vista.desde;
  const presets: Array<[string, string]> = modo === 'SEMANA'
    ? [['Esta semana', hoy], ['Semana pasada', moverPeriodo('SEMANA', hoy, -1)]]
    : [['Este mes', hoy], ['Mes pasado', moverPeriodo('MES', hoy, -1)]];
  // las personas que se pagan por el otro período se ven, pero no suman en los totales (se contarían dos veces)
  const enTotales = visibles.filter((f) => !f.fueraDeModalidad);
  const pagados = enTotales.filter((f) => f.estado === 'PAGADO').length;
  const hayFiltro = estado !== 'TODOS' || texto.trim() !== '' || rol !== '';
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA));
  const paginaOk = Math.min(pagina, totalPaginas);
  const enPagina = visibles.slice((paginaOk - 1) * POR_PAGINA, paginaOk * POR_PAGINA);
  const totales: Array<[string, string, boolean?]> = [
    ['Ganado', soles(suma(enTotales, totalDe))],
    ['Penalidad', soles(suma(enTotales, penalidadDe))],
    ['Préstamos', soles(suma(enTotales, prestamosDe))],
    ['Adelantos', soles(suma(enTotales, adelantoDe))],
    ['Descuentos', soles(suma(enTotales, (f) => f.excel?.descuentos ?? f.descuentos ?? 0))],
    [enRango ? 'Estimado a pagar' : 'A pagar', soles(suma(enTotales, netoDe)), true],
    ...(enRango ? [] : [['Pagado', soles(suma(enTotales, pagadoDe))], ['Pendiente', soles(suma(enTotales, (f) => netoDe(f) - pagadoDe(f)))]] as Array<[string, string, boolean?]>),
  ];
  const estados: Array<[FiltroEstado, string]> = [['TODOS', 'Todos'], ['ABIERTO', 'Abiertos'], ['REVISAR', 'Por revisar'], ['PAGADO', 'Pagados']];

  return (
    <>
      <div className="pl-periodo" role="group" aria-label="Período de la planilla">
        <div className="pl-modo" role="group" aria-label="Ver por">
          {(['SEMANA', 'MES', 'RANGO'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={vistaModo === m} className={vistaModo === m ? 'activo' : undefined}
              onClick={() => filtrar({ modo: m === 'SEMANA' ? null : m, ...(m === 'RANGO' ? { rd: vista.desde, rh: vista.hasta } : {}) })}>
              {m === 'SEMANA' ? 'Semana' : m === 'MES' ? 'Mes' : 'Rango libre'}
            </button>
          ))}
        </div>
        {!enRango && (
          <div className="pl-nav">
            <button type="button" aria-label={`${modo === 'SEMANA' ? 'Semana' : 'Mes'} anterior`} onClick={() => filtrar({ fecha: moverPeriodo(modo, fecha, -1) })}>‹</button>
            <strong aria-live="polite" className="pl-etiqueta">{etiquetaPeriodo(modo, fecha)}</strong>
            <button type="button" aria-label={`${modo === 'SEMANA' ? 'Semana' : 'Mes'} siguiente`} onClick={() => filtrar({ fecha: moverPeriodo(modo, fecha, 1) })}>›</button>
          </div>
        )}
        {!enRango && (
          <div className="pl-presets">
            {presets.map(([t, f]) => (
              <button key={t} type="button" aria-pressed={rangoDe(modo, f).desde === vista.desde} onClick={() => filtrar({ fecha: f })}>{t}</button>
            ))}
          </div>
        )}
      </div>
      {enRango && (
        <div className="pl-rango" role="group" aria-label="Rango libre de fechas">
          <label className="as-campo">Desde <input type="date" value={rd} max={rh} onChange={(e) => e.target.value && filtrar({ modo: 'RANGO', rd: e.target.value })} /></label>
          <label className="as-campo">Hasta <input type="date" value={rh} min={rd} onChange={(e) => e.target.value && filtrar({ modo: 'RANGO', rh: e.target.value })} /></label>
          <div className="pl-presets" role="group" aria-label="Atajos de fechas">
            {presetsRango(hoy).map((p) => (
              <button key={p.id} type="button" aria-pressed={p.desde === rd && p.hasta === rh} onClick={() => filtrar({ modo: 'RANGO', rd: p.desde, rh: p.hasta })}>{p.etiqueta}</button>
            ))}
          </div>
          <strong className="pl-etiqueta" aria-live="polite">{fallaRango ? '' : etiquetaRango(rd, rh)}</strong>
          {fallaRango && <div role="alert" className="as-aviso as-aviso--error">{fallaRango}</div>}
        </div>
      )}
      <div className="pl-barra">
        <span className="as-nota">{vista.desde} a {vista.hasta}{esActual ? ' · en curso' : ''} · {enRango ? `${enTotales.length} personas` : `${pagados} de ${enTotales.length} pagados`}</span>
        {!enRango && (
          <label className="as-campo pl-dia">Día del período
            <input type="date" value={fecha} onChange={(e) => e.target.value && filtrar({ fecha: e.target.value })} />
          </label>
        )}
      </div>
      <small className="as-nota">{enRango ? 'Rango libre: todas las cifras (horas, ganado, penalidad, bonos, descuentos y adelantos del rango) son un estimado para consultar. Para pagar, abre la semana o el mes de cada persona.' : 'Cada persona se paga por su semana (lunes a domingo) o por su mes. Si la vista no coincide con su modalidad se avisa en su tarjeta.'}</small>
      <dl className="pl-totales" aria-label="Totales de la planilla">
        {totales.map(([t, v, fuerte]) => (
          <div key={t} className={`pl-total${fuerte ? ' pl-total--fuerte' : ''}`}><dt>{t}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      <div className="pl-filtros" role="search" aria-label="Filtros de la planilla">
        <div className="pl-chips" role="group" aria-label="Estado">
          {estados.map(([k, t]) => <button key={k} type="button" className="pl-chip" aria-pressed={estado === k} onClick={() => filtrar({ estado: k === 'TODOS' ? null : k })}>{t}</button>)}
        </div>
        <label className="as-campo">Rol
          <select value={rol} onChange={(e) => filtrar({ rol: e.target.value })}>
            <option value="">Todos</option>
            {roles.map((x) => <option key={x} value={x}>{nombreRol(x)}</option>)}
          </select>
        </label>
        <label className="as-campo">Ordenar por
          <select value={orden} onChange={(e) => filtrar({ orden: e.target.value === 'NOMBRE' ? null : e.target.value })}>
            <option value="NOMBRE">Nombre</option>
            <option value="NETO">Neto a pagar (mayor primero)</option>
            <option value="ALERTAS">Más alertas primero</option>
          </select>
        </label>
        <label className="as-campo pl-buscar">Persona <input type="search" placeholder="Buscar por nombre" value={texto} onChange={(e) => filtrar({ q: e.target.value })} /></label>
        {hayFiltro && <Boton type="button" variante="texto" tamano="pequeno" onClick={quitarFiltros}>Quitar filtros</Boton>}
      </div>
      {errorLista && <EstadoError titulo="No pudimos actualizar la planilla" mensaje={errorLista} alReintentar={() => void cargar()} />}
      {filas.length === 0 ? (
        <EstadoVacio titulo="Sin personal" descripcion="Cuando haya usuarios activos, aparecerán aquí." />
      ) : visibles.length === 0 ? (
        <EstadoVacio titulo="Nadie con ese filtro" descripcion="Cambia el estado, el rol o el nombre." accion={<Boton type="button" variante="secundario" tamano="pequeno" onClick={quitarFiltros}>Quitar filtros</Boton>} />
      ) : (
        <ul className="pl-lista">
          {enPagina.map((f) => (
            <li key={f.partyId} className="pl-tarjeta">
              <div className="pl-tarjeta-cab">
                <span className="pp-avatar" aria-hidden="true">{iniciales(f.nombre)}</span>
                <div className="pl-tarjeta-id">
                  <div className="pl-nombre">{f.nombre}</div>
                  <small className="as-nota">
                    {f.rol ? `${nombreRol(f.rol)} · ` : ''}{f.vinculo ? ETIQUETA_VINCULO[f.vinculo.tipo] : 'Sin vínculo'} · {f.sueldo ? (f.sueldo.metodo === 'TARIFA_HORA' ? 'Por hora' : `${soles(f.sueldo.mensual)} al mes`) : 'Sin sueldo'}
                  </small>
                </div>
                <div className="pl-neto"><small>{f.fueraDeModalidad ? 'Su mes' : enRango ? 'Estimado' : 'A pagar'}</small>{soles(netoDe(f))}</div>
              </div>
              {f.aviso && <small className={`pl-aviso${f.fueraDeModalidad ? ' pl-aviso--fuera' : ''}`}>{f.aviso}</small>}
              <dl className="pl-cifras">
                <div><dt>Horas</dt><dd>{f.excel ? `${f.excel.horasLaboradas} h ${f.excel.minutosLaborados} min` : f.trabajadasH !== undefined ? `${f.trabajadasH} h` : '—'}</dd></div>
                <div><dt>Extras</dt><dd>{f.excel ? `${f.excel.horasExtra} h` : '—'}</dd></div>
                <div><dt>Ganado</dt><dd>{soles(totalDe(f))}</dd></div>
                <div><dt>Adelantos</dt><dd>{soles(adelantoDe(f))}</dd></div>
                <div><dt>Descuentos</dt><dd>{soles(f.excel?.descuentos ?? f.descuentos)}</dd></div>
                <div className={penalidadDe(f) > 0 ? 'pl-malo' : undefined}><dt>Penalidad</dt><dd>{soles(penalidadDe(f))}</dd></div>
                <div><dt>Préstamos</dt><dd>{soles(prestamosDe(f))}</dd></div>
              </dl>
              {f.excel && Object.keys(f.excel.descuentosPorCategoria).length > 0 && (
                <small className="as-nota">{Object.entries(f.excel.descuentosPorCategoria).map(([c, m]) => `${ETIQUETA_CATEGORIA[c] ?? c}: ${soles(m)}`).join(' · ')}</small>
              )}
              {!!f.consumosAnterioresPendiente && <small className="as-nota">Consumos de períodos anteriores sin cobrar: {soles(f.consumosAnterioresPendiente)}</small>}
              {f.semanas && f.semanas.length > 1 && (
                <ul className="pl-semanas" aria-label={`Semanas de ${f.nombre}`}>
                  {f.semanas.map((w) => (
                    <li key={w.desde}>
                      <button type="button" aria-label={`Abrir la semana del ${w.desde} de ${f.nombre}`} onClick={() => abrir(f, w.desde)}>
                        {w.desde.slice(8)}/{w.desde.slice(5, 7)} · {soles(w.neto)} {w.estado === 'PAGADO' ? '· Pagada' : ''}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="pl-tarjeta-pie">
                <span className="pl-insignias">
                  {f.estado === 'PAGADO' ? <Insignia variante="exito">LIQUIDADO</Insignia> : f.estado ? (
                    f.pendientes ? <Insignia variante="aviso">{f.pendientes} por revisar</Insignia> : <Insignia variante="neutro">Abierto</Insignia>
                  ) : null}
                  {!!f.consumosAnterioresPendiente && <Insignia variante="peligro">Créditos pendientes</Insignia>}
                  {!f.sueldo && <Insignia variante="aviso">Sin sueldo</Insignia>}
                  {f.pago && <DatosPago pago={f.pago} onOk={onOk} />}
                </span>
                {f.sueldo ? <Boton type="button" variante="secundario" tamano="pequeno" aria-label={`Abrir la planilla de ${f.nombre}`} onClick={() => abrir(f, f.abrirFecha ?? f.periodo?.desde ?? fecha)}>Abrir</Boton>
                  : <small className="as-nota">Pon su sueldo en Usuarios, pestaña Horario</small>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Paginacion pagina={paginaOk} totalPaginas={totalPaginas} alCambiarPagina={(p) => poner({ pag: p > 1 ? String(p) : null })} totalRegistros={visibles.length} tamanoPagina={POR_PAGINA} />
    </>
  );
}
