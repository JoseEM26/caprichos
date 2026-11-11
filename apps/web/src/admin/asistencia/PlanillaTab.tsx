import { useCallback, useEffect, useMemo, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { Insignia } from '../../comun/Insignia';
import { jornadaActual, useUltimaPeticion } from './jornada';
import { coincide } from './buscar';
import { DatosPago } from './DatosPago';
import { PlanillaDetalle } from './PlanillaDetalle';
import { ETIQUETA_VINCULO } from './vinculoApi';
import { ETIQUETA_CATEGORIA, FilaPlanilla, listarPlanilla, soles } from './planillaApi';
import { ModoPeriodo, etiquetaPeriodo, moverPeriodo, rangoDe } from './periodoVista';
import './planilla.css';

type Avisar = (m: string | null) => void;
type FiltroEstado = 'TODOS' | 'ABIERTO' | 'PAGADO' | 'REVISAR';
const mensajeDe = (e: unknown, fallback: string) => (e as any)?.mensaje ?? (e as any)?.message ?? fallback;

const penalidadDe = (f: FilaPlanilla) => f.excel?.penalidadTardanza ?? f.penalidad ?? 0;
const prestamosDe = (f: FilaPlanilla) => f.excel?.descuentosPorCategoria?.PRESTAMO ?? 0;
const adelantoDe = (f: FilaPlanilla) => f.excel?.adelanto ?? f.adelantos ?? 0;
const totalDe = (f: FilaPlanilla) => f.excel?.total ?? f.ganado ?? 0;
const netoDe = (f: FilaPlanilla) => f.excel?.diferencia ?? f.neto ?? 0;
const pagadoDe = (f: FilaPlanilla) => f.netoPagado ?? (f.estado === 'PAGADO' ? netoDe(f) : 0);
const suma = (filas: FilaPlanilla[], g: (f: FilaPlanilla) => number) => filas.reduce((s, f) => s + (g(f) || 0), 0);

/** Planilla del personal (solo ADMIN): totales, una tarjeta compacta por persona y, al abrirla, el detalle con secciones plegables. */
export function PlanillaTab({ onError, onOk }: { onError: Avisar; onOk: Avisar }) {
  const [modo, setModo] = useState<ModoPeriodo>('SEMANA');
  const [fecha, setFecha] = useState(jornadaActual());
  const [filas, setFilas] = useState<FilaPlanilla[] | null>(null);
  const [abierta, setAbierta] = useState<{ fila: FilaPlanilla; fecha: string } | null>(null);
  const [verFiltros, setVerFiltros] = useState(false);
  const [estado, setEstado] = useState<FiltroEstado>('TODOS');
  const [texto, setTexto] = useState('');

  const nueva = useUltimaPeticion();
  const cargar = useCallback(async () => {
    const vigente = nueva();
    try {
      const r = await listarPlanilla(fecha, modo);
      if (!vigente()) return;
      setFilas(r.filas);
      onError(null);
    } catch (e) {
      if (vigente()) onError(mensajeDe(e, 'No pudimos cargar la planilla.'));
    }
  }, [fecha, modo, onError, nueva]);
  useEffect(() => { void cargar(); }, [cargar]);

  const visibles = useMemo(() => (filas ?? []).filter((f) =>
    (estado === 'TODOS' || (estado === 'PAGADO' ? f.estado === 'PAGADO' : estado === 'REVISAR' ? !!f.pendientes : f.estado !== 'PAGADO'))
    && (!texto.trim() || coincide(f.nombre, texto))), [filas, estado, texto]);

  if (!filas) return <Cargando mensaje="Cargando planilla" />;
  const hoy = jornadaActual();
  const vista = rangoDe(modo, fecha);
  const esActual = rangoDe(modo, hoy).desde === vista.desde;
  const presets: Array<[string, string]> = modo === 'SEMANA'
    ? [['Esta semana', hoy], ['Semana pasada', moverPeriodo('SEMANA', hoy, -1)]]
    : [['Este mes', hoy], ['Mes pasado', moverPeriodo('MES', hoy, -1)]];
  const nombreModo = modo === 'SEMANA' ? 'semana' : 'mes';
  // las personas que se pagan por el otro período se ven, pero no suman en los totales (se contarían dos veces)
  const enTotales = visibles.filter((f) => !f.fueraDeModalidad);
  const pagados = enTotales.filter((f) => f.estado === 'PAGADO').length;
  const hayFiltro = estado !== 'TODOS' || texto.trim() !== '';
  const totales: Array<[string, string, boolean?]> = [
    ['Ganado', soles(suma(enTotales, totalDe))],
    ['Penalidad', soles(suma(enTotales, penalidadDe))],
    ['Préstamos', soles(suma(enTotales, prestamosDe))],
    ['Adelantos', soles(suma(enTotales, adelantoDe))],
    ['Descuentos', soles(suma(enTotales, (f) => f.excel?.descuentos ?? f.descuentos ?? 0))],
    ['A pagar', soles(suma(enTotales, netoDe)), true],
    ['Pagado', soles(suma(enTotales, pagadoDe))],
    ['Pendiente', soles(suma(enTotales, (f) => netoDe(f) - pagadoDe(f)))],
  ];

  return (
    <>
      <div className="pl-periodo" role="group" aria-label="Período de la planilla">
        <div className="pl-modo" role="group" aria-label="Ver por">
          {(['SEMANA', 'MES'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={modo === m} className={modo === m ? 'activo' : undefined} onClick={() => setModo(m)}>{m === 'SEMANA' ? 'Semana' : 'Mes'}</button>
          ))}
        </div>
        <div className="pl-nav">
          <button type="button" aria-label={`${modo === 'SEMANA' ? 'Semana' : 'Mes'} anterior`} onClick={() => setFecha(moverPeriodo(modo, fecha, -1))}>‹</button>
          <strong aria-live="polite" className="pl-etiqueta">{etiquetaPeriodo(modo, fecha)}</strong>
          <button type="button" aria-label={`${modo === 'SEMANA' ? 'Semana' : 'Mes'} siguiente`} onClick={() => setFecha(moverPeriodo(modo, fecha, 1))}>›</button>
        </div>
        <div className="pl-presets">
          {presets.map(([t, f]) => (
            <button key={t} type="button" aria-pressed={rangoDe(modo, f).desde === vista.desde} onClick={() => setFecha(f)}>{t}</button>
          ))}
        </div>
      </div>
      <div className="pl-barra">
        <span className="as-nota">{vista.desde} a {vista.hasta}{esActual ? ' · en curso' : ''} · {pagados} de {enTotales.length} pagados</span>
        <Boton type="button" variante="secundario" tamano="pequeno" aria-expanded={verFiltros} aria-controls="pl-filtros" onClick={() => setVerFiltros((v) => !v)}>
          {verFiltros ? 'Ocultar filtros' : hayFiltro ? 'Filtros (activos)' : 'Filtros'}
        </Boton>
      </div>
      {verFiltros && (
        <div id="pl-filtros" className="pl-filtros">
          <label className="as-campo">Día del período
            <input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
            <small>Cada persona se paga por su semana (lunes a domingo) o por su mes. Si la vista no coincide con su modalidad se avisa en su tarjeta.</small>
          </label>
          <label className="as-campo">Estado
            <select value={estado} onChange={(e) => setEstado(e.target.value as FiltroEstado)}>
              <option value="TODOS">Todos</option>
              <option value="ABIERTO">Abiertos</option>
              <option value="REVISAR">Por revisar</option>
              <option value="PAGADO">Pagados</option>
            </select>
          </label>
          <label className="as-campo">Persona <input type="search" placeholder="Buscar por nombre" value={texto} onChange={(e) => setTexto(e.target.value)} /></label>
        </div>
      )}
      <dl className="pl-totales" aria-label="Totales de la planilla">
        {totales.map(([t, v, fuerte]) => (
          <div key={t} className={`pl-total${fuerte ? ' pl-total--fuerte' : ''}`}><dt>{t}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      {filas.length === 0 ? (
        <EstadoVacio titulo="Sin personal" descripcion="Cuando haya usuarios activos, aparecerán aquí." />
      ) : visibles.length === 0 ? (
        <EstadoVacio titulo="Nadie con ese filtro" descripcion="Cambia el estado o el nombre en «Filtros»." />
      ) : (
        <ul className="pl-lista">
          {visibles.map((f) => (
            <li key={f.partyId} className="pl-tarjeta">
              <div className="pl-tarjeta-cab">
                <div>
                  <div className="pl-nombre">{f.nombre}</div>
                  <small className="as-nota">
                    {f.vinculo ? ETIQUETA_VINCULO[f.vinculo.tipo] : 'Sin vínculo'} · {f.sueldo ? (f.sueldo.metodo === 'TARIFA_HORA' ? 'Por hora' : `${soles(f.sueldo.mensual)} al mes`) : 'Sin sueldo'}
                  </small>
                </div>
                <div className="pl-neto"><small>{f.fueraDeModalidad ? 'Su mes' : 'A pagar'}</small>{soles(netoDe(f))}</div>
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
                      <button type="button" aria-label={`Abrir la semana del ${w.desde} de ${f.nombre}`} onClick={() => setAbierta({ fila: f, fecha: w.desde })}>
                        {w.desde.slice(8)}/{w.desde.slice(5, 7)} · {soles(w.neto)} {w.estado === 'PAGADO' ? '· Pagada' : ''}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="pl-tarjeta-pie">
                <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {f.estado === 'PAGADO' ? <Insignia variante="exito">LIQUIDADO</Insignia> : f.estado ? (
                    f.pendientes ? <Insignia variante="aviso">{f.pendientes} por revisar</Insignia> : <Insignia variante="neutro">Abierto</Insignia>
                  ) : null}
                  {f.pago && <DatosPago pago={f.pago} onOk={onOk} />}
                </span>
                {f.sueldo ? <Boton type="button" variante="secundario" tamano="pequeno" aria-label={`Abrir la planilla de ${f.nombre}`} onClick={() => setAbierta({ fila: f, fecha: f.abrirFecha ?? f.periodo?.desde ?? fecha })}>Abrir</Boton>
                  : <small className="as-nota">Pon su sueldo en Usuarios, pestaña Horario</small>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {abierta && (
        <PlanillaDetalle fila={abierta.fila} fecha={abierta.fecha} alCerrar={() => { setAbierta(null); void cargar(); }} onError={onError} onOk={onOk} />
      )}
    </>
  );
}

