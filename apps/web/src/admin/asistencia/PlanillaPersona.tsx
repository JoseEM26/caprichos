import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { Confirmar } from '../../comun/Confirmar';
import type { FilaPlanilla } from './planillaApi';
import { EstadoError } from '../../comun/EstadoError';
import { Insignia } from '../../comun/Insignia';
import { BarraPestanas, PanelesPestanas, type PestanaModal } from '../../comun/ModalConPestanas';
import { ETIQUETAS_ROLES } from '../usuarios/roles';
import { FilaCal, calendarioFilas } from './calendarioApi';
import { ResultadoLote, aprobarSimplesPeriodo } from './correccionesApi';
import { DatosPago } from './DatosPago';
import { useUltimaPeticion } from './jornada';
import { ModoPeriodo, etiquetaPeriodo, moverPeriodo } from './periodoVista';
import { Plegable } from './Plegable';
import { DetallePlanilla, PagoHistorial, TipoSeleccion, claveSeleccion, detallePlanilla, historialPagos, pagarPlanilla, reabrirPlanilla, seleccionarPlanilla, soles, totalPenalidad } from './planillaApi';
import { formulaNeto, lineasAdelanto, lineasDescuento, motivoNeto, resumenCalculo } from './planillaExplicacion';
import { PestanaAsistencia } from './PlanillaPersonaAsistencia';
import { PestanaDescuentos } from './PlanillaPersonaDescuentos';
import { PestanaHistorial } from './PlanillaPersonaHistorial';
import { SeccionTarifasEspeciales } from './PlanillaPersonaTarifas';
import { Avisar, CtlPlanilla, SECCIONES, SeccionPlanilla } from './PlanillaPersonaTipos';
import { PestanaVinculoVacaciones } from './VinculoVacaciones';
import './planilla.css';

const mensajeDe = (e: unknown, fallback: string) => (e as any)?.mensaje ?? (e as any)?.message ?? fallback;
const horas = (min: number) => (min / 60).toFixed(2);
const nombreRol = (r?: string | null) => (r ? (ETIQUETAS_ROLES[r] ?? r).replace(/ \(.*\)$/, '') : '');
const iniciales = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima' });

/** Desglose visual del neto: cuánto suma, cuánto se descuenta y a cuánto se llega. Las barras son decorativas; las cifras van en texto. */
function CascadaNeto({ c }: { c: CtlPlanilla }) {
  const { r, penal } = c;
  const sumas: Array<[string, number]> = [
    ['Sueldo por horas trabajadas', r.pagoTrabajado],
    ['Horas extra aprobadas', r.pagoExtra],
    ...(r.pagoVacaciones ? [['Vacaciones pagadas en dinero', r.pagoVacaciones] as [string, number]] : []),
    ...(r.adicional ? [['Bonos (adicional)', r.adicional] as [string, number]] : []),
  ];
  const restas: Array<[string, number]> = [
    ['Penalidad por tardanza', penal],
    ['Adelantos', r.adelantos],
    ['Descuentos, cuotas de préstamo y servicios', r.descuentos],
    ['Consumos y créditos cobrados', r.consumosCobrados],
  ];
  const tope = Math.max(r.ganado, ...restas.map(([, v]) => v), ...sumas.map(([, v]) => v), 1);
  const fila = (t: string, v: number, signo: '+' | '−' | '=', tono: 'mas' | 'menos' | 'neto') => (
    <li key={t} className={`pp-cascada-fila pp-cascada-fila--${tono}`}>
      <span className="pp-cascada-t">{t}</span>
      <span className="pp-cascada-barra" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.max(2, (Math.abs(v) / tope) * 100))}%` }} /></span>
      <span className="pp-cascada-v as-num">{signo === '=' ? '' : `${signo} `}{soles(v)}</span>
    </li>
  );
  return (
    <ul className="pp-cascada" aria-label="Cómo se llega al neto a pagar" data-testid="cascada-neto">
      {sumas.map(([t, v]) => fila(t, v, '+', 'mas'))}
      {fila('Ganado', r.ganado, '=', 'neto')}
      {restas.map(([t, v]) => fila(t, v, '−', 'menos'))}
      {fila('Neto a pagar', r.neto, '=', 'neto')}
    </ul>
  );
}

/**
 * Página de la planilla de UNA persona en UN período (ruta propia, ya no un modal): franja fija con la persona, el período y las cifras,
 * y pestañas Resumen · Asistencia · Descuentos y créditos · Pago · Historial. Toda la lógica de pago es la de antes.
 */
export interface VecinosPersona { posicion: number; total: number; anterior: FilaPlanilla | null; siguiente: FilaPlanilla | null }

export function PlanillaPersona({ partyId, fecha, seccion, onSeccion, onFecha, volver, onError, onOk, vecinos, irAPersona }: {
  partyId: number; fecha: string; seccion: SeccionPlanilla; onSeccion: (s: SeccionPlanilla) => void; onFecha: (f: string) => void; volver: () => void; onError: Avisar; onOk: Avisar;
  /** Lista visible alrededor de esta persona (undefined si no está en la lista filtrada). */
  vecinos?: VecinosPersona; irAPersona?: (f: FilaPlanilla) => void;
}) {
  const [d, setD] = useState<DetallePlanilla | null>(null);
  // formulario con texto sin guardar (adelanto/descuento): cambiar de persona pide confirmación
  const [borradorSucio, setBorradorSucio] = useState(false);
  const [pendienteIr, setPendienteIr] = useState<FilaPlanilla | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  // checks del pago (consumos, cuotas y descuentos personalizados) viven en el servidor; aquí solo cuál se está guardando
  const [guardando, setGuardando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmaPago, setConfirmaPago] = useState(false);
  const [reabrir, setReabrir] = useState<string | null>(null);
  // el admin confirma pagar sin descontar los créditos de días anteriores sin cerrar
  const [sinDescontarAnt, setSinDescontarAnt] = useState(false);
  // «Pagar igual» (solo administrador): motivo ya confirmado (null = no se usa) y borrador mientras se escribe
  const [pagarIgual, setPagarIgual] = useState<string | null>(null);
  const [borradorIgual, setBorradorIgual] = useState<string | null>(null);
  const [confirmaSimples, setConfirmaSimples] = useState(false);
  const [resSimples, setResSimples] = useState<ResultadoLote | null>(null);
  const [filasCal, setFilasCal] = useState<FilaCal[] | null>(null);
  const [errorCal, setErrorCal] = useState(false);
  const [pagos, setPagos] = useState<PagoHistorial[] | null>(null);
  const [errorPagos, setErrorPagos] = useState(false);
  const base = useId();

  // al cambiar de período se descartan las selecciones del anterior
  const fechaPrevia = useRef(fecha);
  useEffect(() => {
    if (fechaPrevia.current === fecha) return;
    fechaPrevia.current = fecha;
    setSinDescontarAnt(false); setPagarIgual(null); setBorradorIgual(null); setResSimples(null); setReabrir(null);
  }, [fecha]);

  const tieneD = useRef(false);
  const nueva = useUltimaPeticion();
  const cargar = useCallback(async () => {
    const vigente = nueva();
    try {
      const r = await detallePlanilla(partyId, fecha);
      if (vigente()) { tieneD.current = true; setD(r); setFallo(null); }
    } catch (e) {
      if (!vigente()) return;
      const m = mensajeDe(e, 'No pudimos cargar el detalle.');
      setFallo(m);
      if (tieneD.current) onError(m); // sin datos todavía, el error se muestra en la propia página con «Reintentar»
    }
  }, [partyId, fecha, onError, nueva]);
  useEffect(() => { void cargar(); }, [cargar]);

  // Cada check se guarda en el servidor al marcarlo; mientras guarda se deshabilita ese check y al terminar se recarga el cálculo
  const seleccionar = useCallback(async (tipo: TipoSeleccion, refId: string, activo: boolean) => {
    setGuardando(claveSeleccion(tipo, refId));
    try {
      await seleccionarPlanilla(partyId, fecha, tipo, refId, activo);
      onError(null);
      onOk('Guardado ✓ — el descuento se actualizó.');
      await cargar();
    } catch (e) {
      onError(mensajeDe(e, 'No se pudo guardar el cambio. Intenta de nuevo.'));
    } finally {
      setGuardando(null);
    }
  }, [partyId, fecha, cargar, onError, onOk]);

  // marcas del período (rol de la persona y detalle de cada día): una sola pregunta por período
  const desdeP = d?.periodo.desde;
  const hastaP = d?.periodo.hasta;
  const recargarCal = useCallback(async () => {
    if (!desdeP || !hastaP) return;
    try { setFilasCal((await calendarioFilas({ desde: desdeP, hasta: hastaP, partyId: String(partyId) })).filas); setErrorCal(false); } catch { setErrorCal(true); }
  }, [desdeP, hastaP, partyId]);
  useEffect(() => { void recargarCal(); }, [recargarCal]);

  const cargarPagos = useCallback(() => {
    setErrorPagos(false);
    historialPagos(partyId).then(setPagos).catch(() => setErrorPagos(true));
  }, [partyId]);
  useEffect(() => { cargarPagos(); }, [cargarPagos]);

  const ejecutar = useCallback(async (fn: () => Promise<unknown>, ok: string) => {
    setOcupado(true);
    try {
      await fn();
      onError(null);
      onOk(ok);
      await cargar();
    } catch (e) {
      onError(mensajeDe(e, 'No se pudo completar la acción.'));
    } finally {
      setOcupado(false);
    }
  }, [cargar, onError, onOk]);

  const pagado = d?.estado === 'PAGADO';
  const r = d?.resultado;
  const porRevisar = d?.jornadasPorRevisar ?? [];
  const faltan = !pagado && d && pagarIgual === null ? Math.max(porRevisar.length, d.pendientes) : 0;
  const antSinCobrar = useMemo(() => (!pagado && d ? d.consumos.filter((c) => c.anterior && !c.cobrar) : []), [pagado, d]);
  const antTotal = antSinCobrar.reduce((a, c) => a + c.monto, 0);
  const faltaCredito = antSinCobrar.length > 0 && !sinDescontarAnt;
  const penal = d ? (d.penalidadTardanza ? totalPenalidad(d.penalidadTardanza) : r?.penalidadTardanza ?? 0) : 0;
  const detallePenal = d?.penalidadTardanza?.detalle ?? r?.penalidadTardanzaDetalle ?? [];

  const seccionActiva: SeccionPlanilla = SECCIONES.includes(seccion) ? seccion : 'resumen';
  const irA = useCallback((s: SeccionPlanilla) => onSeccion(s), [onSeccion]);

  // ← → pasan a la vecina, salvo que el foco esté en un campo de texto
  const irVecino = useCallback((f: FilaPlanilla) => {
    if (borradorSucio) { setPendienteIr(f); return; }
    window.scrollTo?.(0, 0);
    irAPersona?.(f);
  }, [borradorSucio, irAPersona]);
  useEffect(() => {
    if (!vecinos) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      if (e.key === 'ArrowLeft' && vecinos.anterior) irVecino(vecinos.anterior);
      if (e.key === 'ArrowRight' && vecinos.siguiente) irVecino(vecinos.siguiente);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [vecinos, irVecino]);

  if (!d || !r) {
    return (
      <div className="pp-pagina">
        <Boton type="button" variante="secundario" onClick={volver}>← Volver a la planilla</Boton>
        {fallo ? <EstadoError titulo="No pudimos abrir la planilla" mensaje={fallo} alReintentar={() => void cargar()} /> : <Cargando mensaje="Cargando planilla" />}
      </div>
    );
  }

  const bloqueo: CtlPlanilla['bloqueo'] = faltan > 0
    ? { seccion: 'asistencia', texto: `Falta resolver ${faltan} ${faltan === 1 ? 'jornada' : 'jornadas'} por revisar o sin evaluar${porRevisar.length ? ` (${porRevisar.join(', ')})` : ''}. Usa «Aprobar todas las marcas dudosas» o corrígelas en el detalle del día.` }
    : faltaCredito
      ? { seccion: 'descuentos', texto: `Tiene ${antSinCobrar.length} ${antSinCobrar.length === 1 ? 'crédito sin cerrar' : 'créditos sin cerrar'} de días anteriores por ${soles(antTotal)}. Márcalos para descontarlos en este pago o confirma pagar sin descontarlos.` }
      : null;

  const c: CtlPlanilla = {
    d, r, pagado, ocupado, ejecutar, cargar, recargarCal, filasCal, errorCal, irA, onError, onOk,
    porRevisar, faltan, penal, detallePenal, setConfirmaSimples, resSimples,
    pagarIgual, setPagarIgual, borradorIgual, setBorradorIgual,
    antSinCobrar, antTotal, sinDescontarAnt, setSinDescontarAnt, faltaCredito,
    seleccionar, guardando, bloqueo, alPagar: () => setConfirmaPago(true),
  };

  const nombre = d.nombre;
  const res = resumenCalculo(d);
  const lineasFranja = [...lineasDescuento(d), ...lineasAdelanto(d)];
  const rol = nombreRol(filasCal?.[0]?.rol);
  const modo: ModoPeriodo = d.sueldo.modalidad === 'SEMANAL' ? 'SEMANA' : 'MES';
  const unidad = modo === 'SEMANA' ? 'Semana' : 'Mes';
  const estado = pagado ? { t: 'Pagado', v: 'exito' as const } : (faltan > 0 || d.pendientes > 0) ? { t: 'Por revisar', v: 'aviso' as const } : { t: 'Abierto', v: 'neutro' as const };
  const cuotasCobrar = (d.cuotas ?? []).filter((x) => x.cobrar).length + (d.recurrentes ?? []).filter((x) => x.cobrar).length;
  const pagoRegistrado = pagado ? pagos?.find((p) => p.estado === 'PAGADO' && p.desde === d.periodo.desde) : undefined;

  const checklist: Array<{ id: string; ok: boolean; bien: string; mal: string; a: SeccionPlanilla }> = [
    { id: 'asistencia', ok: faltan === 0, bien: pagarIgual !== null ? 'Asistencia: se pagará igual (con motivo)' : 'Asistencia revisada', mal: `Asistencia: ${faltan} por revisar`, a: 'asistencia' },
    { id: 'descuentos', ok: r.neto >= 0, bien: 'Descuentos revisados', mal: 'Descuentos: el neto es negativo', a: 'descuentos' },
    { id: 'creditos', ok: !faltaCredito, bien: 'Créditos anteriores', mal: `Créditos anteriores: ${antSinCobrar.length} sin cerrar`, a: 'descuentos' },
  ];
  const listo = checklist.every((x) => x.ok);

  const resumen = (
    <div className="pp-seccion pp-seccion--2col" data-testid="resumen-planilla">
      <section aria-label="Lista de cierre" className="pp-bloque">
        <h3 className="as-sub">Lista de cierre</h3>
        <ul className="pp-check">
          {pagado
            ? <li className="pp-check-ok"><span aria-hidden="true">✔</span> Período pagado: solo lectura</li>
            : (
              <>
                {checklist.map((x) => (
                  <li key={x.id} className={x.ok ? 'pp-check-ok' : 'pp-check-mal'}>
                    <span aria-hidden="true">{x.ok ? '✔' : '✖'}</span> {x.ok ? x.bien : x.mal}
                    {!x.ok && <> · <button type="button" className="pp-enlace" onClick={() => irA(x.a)}>Ir a resolverlo</button></>}
                  </li>
                ))}
                <li className={listo ? 'pp-check-ok' : 'pp-check-mal'}><span aria-hidden="true">{listo ? '✔' : '✖'}</span> {listo ? 'Listo para pagar' : 'Todavía no está listo para pagar'}{listo && <> · <button type="button" className="pp-enlace" onClick={() => irA('pago')}>Ir a Pago</button></>}</li>
              </>
            )}
        </ul>
      </section>
      <section aria-label="Cómo se llega al neto" className="pp-bloque">
        <h3 className="as-sub">Cómo se llega al neto a pagar</h3>
        <CascadaNeto c={c} />
        <small className="as-nota">{horas(r.trabajadaMin)} h trabajadas de {horas(r.programadaMin)} h programadas · {cuotasCobrar} cuota(s) de préstamo y servicio(s) extra en este pago.</small>
        <details className="pp-explica" data-testid="como-se-calcula">
          <summary>¿Cómo se calcula?</summary>
          <ol className="pp-explica-pasos">
            <li>Bruto (lo ganado): horas trabajadas a {soles(r.valorHora)} la hora = {soles(r.pagoTrabajado)}{r.pagoExtra > 0 ? `, más horas extra aprobadas ${soles(r.pagoExtra)}` : ''}{(r.pagoVacaciones ?? 0) > 0 ? `, más vacaciones pagadas ${soles(r.pagoVacaciones ?? 0)}` : ''}. Bruto: {soles(res.bruto)}.</li>
            {res.bonos > 0 && <li>Más bonos: {soles(res.bonos)}.</li>}
            {res.descuentos.length > 0 && <li>Se descuenta: {res.descuentos.map((x) => `${x.concepto} ${soles(x.monto)}`).join(' + ')} = {soles(res.totalDescuentos)}.</li>}
            {res.adelantos.length > 0 && <li>Adelantos: {soles(res.totalAdelantos)}.</li>}
            <li>Neto a pagar = bruto{res.bonos > 0 ? ' + bonos' : ''} − descuentos{res.adelantos.length > 0 ? ' − adelantos' : ''}.</li>
            <li className="pp-formula"><strong>{formulaNeto(d)}</strong></li>
          </ol>
        </details>
        {r.consumosPendientes > 0 && <small className="as-nota">Consumos que pasan al siguiente período: {soles(r.consumosPendientes)}</small>}
        {!!d.consumosAnterioresPendiente && <small className="as-nota">Consumos de períodos anteriores sin cobrar: {soles(d.consumosAnterioresPendiente)} (se marcan en «Descuentos y créditos»).</small>}
      </section>
    </div>
  );

  const pago = (
    <div className="pp-seccion">
      {motivoNeto(d) && <div role="alert" className="as-aviso as-aviso--alerta" data-testid="aviso-neto-negativo">{motivoNeto(d)}</div>}
      <p className="as-ayuda">
        Período {d.periodo.desde} a {d.periodo.hasta} · Sueldo {d.sueldo.modalidad === 'SEMANAL' ? 'semanal' : 'mensual'} {soles(d.sueldo.modalidad === 'SEMANAL' ? d.sueldo.semanal : d.sueldo.mensual)} · Valor hora {soles(r.valorHora)}
        {d.tercerizado && <> · <Insignia variante="acento">Tercerizado: sin feriado ×2 ni vacaciones</Insignia></>}
      </p>
      <div className="pp-neto-grande"><span>Neto a pagar</span><strong>{soles(r.neto)}</strong></div>
      {d.pago && <p className="as-ayuda">Pagar a: <DatosPago pago={d.pago} onOk={onOk} /></p>}
      <p className="as-ayuda">Marcar como pagado no mueve la caja: solo congela esta planilla y deja los consumos cobrados como «descontados por planilla».</p>

      {!pagado && pagarIgual !== null && (
        <div role="status" className="as-aviso as-aviso--alerta" data-testid="aviso-pagar-igual">
          Se pagará igual con jornadas pendientes. Motivo: {pagarIgual}{' '}
          <button type="button" className="pp-enlace" onClick={() => setPagarIgual(null)}>Quitar</button>
        </div>
      )}
      {!pagado && bloqueo && (
        <div role="alert" className="as-aviso as-aviso--alerta" id={`${base}-bloqueo`} data-testid="bloqueo-pago">
          <strong>No se puede marcar pagado todavía.</strong> {bloqueo.texto}{' '}
          <button type="button" className="pp-enlace" onClick={() => irA(bloqueo.seccion)}>{bloqueo.seccion === 'asistencia' ? 'Ir a Asistencia' : 'Ir a Descuentos y créditos'}</button>
        </div>
      )}
      {!pagado && pagarIgual === null && (d.pendientes > 0 || porRevisar.length > 0) && (
        borradorIgual === null
          ? <div><Boton type="button" variante="texto" onClick={() => setBorradorIgual('')}>Pagar igual (solo administrador)</Boton></div>
          : (
            <div style={{ display: 'grid', gap: 6 }}>
              <label className="as-campo">Motivo para pagar con jornadas pendientes (mínimo 10 caracteres)
                <input value={borradorIgual} onChange={(e) => setBorradorIgual(e.target.value)} maxLength={300} />
              </label>
              <small className="as-nota">Queda guardado en el pago y en la auditoría. Las jornadas pendientes se pagan como están (sin horas).</small>
              <div className="as-acciones">
                <Boton type="button" variante="secundario" tamano="pequeno" onClick={() => setBorradorIgual(null)}>Cancelar</Boton>
                <Boton type="button" tamano="pequeno" disabled={borradorIgual.trim().length < 10} onClick={() => { setPagarIgual(borradorIgual.trim()); setBorradorIgual(null); }}>Dejar avanzar</Boton>
              </div>
            </div>
          )
      )}
      {!pagado && (
        <div className="as-acciones">
          <Boton type="button" disabled={ocupado || !!bloqueo} aria-describedby={bloqueo ? `${base}-bloqueo` : undefined} onClick={() => setConfirmaPago(true)}>Marcar pagado</Boton>
        </div>
      )}
      <SeccionTarifasEspeciales partyId={partyId} onCambio={() => void cargar()} onError={onError} onOk={onOk} />
      <Plegable titulo="Vínculo y vacaciones" resumen="Más" perezoso>
        <PestanaVinculoVacaciones partyId={partyId} alCambiar={() => void cargar()} />
      </Plegable>
    </div>
  );

  const pestanas: PestanaModal[] = [
    { id: 'resumen', etiqueta: 'Resumen', insignia: pagado ? null : listo ? '✔' : '!', insigniaError: !pagado && !listo, contenido: resumen },
    { id: 'asistencia', etiqueta: 'Asistencia', insignia: faltan || null, insigniaError: faltan > 0, contenido: <PestanaAsistencia c={c} diaInicial={null} /> },
    { id: 'descuentos', etiqueta: 'Descuentos y créditos', insignia: antSinCobrar.length || null, insigniaError: antSinCobrar.length > 0, contenido: <PestanaDescuentos c={c} alCambiarBorrador={setBorradorSucio} /> },
    { id: 'pago', etiqueta: 'Pago', contenido: pago },
    { id: 'historial', etiqueta: 'Historial', insignia: pagos?.length || null, contenido: <PestanaHistorial c={c} pagos={pagos} errorPagos={errorPagos} reintentarPagos={cargarPagos} abrirPeriodo={onFecha} /> },
  ];

  return (
    <div className="pp-pagina" data-testid="pagina-planilla-persona">
      <header className="pp-franja">
        <div className="pp-franja-fila">
          <nav aria-label="Migas de pan" className="pp-migas">
            <button type="button" className="pp-enlace" onClick={volver}>Planilla</button> › <span>{nombre}</span> › <span aria-current="page">{d.periodo.desde} a {d.periodo.hasta}</span>
          </nav>
          <Boton type="button" variante="secundario" tamano="pequeno" onClick={volver}>← Volver a la planilla</Boton>
        </div>
        {vecinos && (
          <div className="pp-vecinos" role="group" aria-label="Pasar a otra persona de la lista">
            <button type="button" disabled={!vecinos.anterior} aria-label={vecinos.anterior ? `Anterior: ${vecinos.anterior.nombre}` : 'Anterior: no hay'} title={vecinos.anterior ? `Anterior: ${vecinos.anterior.nombre}` : undefined} onClick={() => vecinos.anterior && irVecino(vecinos.anterior)}>‹</button>
            <span aria-live="polite">{vecinos.posicion} de {vecinos.total}</span>
            <button type="button" disabled={!vecinos.siguiente} aria-label={vecinos.siguiente ? `Siguiente: ${vecinos.siguiente.nombre}` : 'Siguiente: no hay'} title={vecinos.siguiente ? `Siguiente: ${vecinos.siguiente.nombre}` : undefined} onClick={() => vecinos.siguiente && irVecino(vecinos.siguiente)}>›</button>
          </div>
        )}
        <div className="pp-franja-fila">
          <div className="pp-persona">
            <span className="pp-avatar" aria-hidden="true">{iniciales(nombre)}</span>
            <div>
              <h2 className="pp-nombre">{nombre}</h2>
              <small className="as-nota">{rol || 'Personal'} · <Insignia variante={estado.v}>{estado.t}</Insignia></small>
            </div>
          </div>
          <div className="pl-nav pp-periodo" role="group" aria-label="Período de la planilla">
            <button type="button" aria-label={`${unidad} anterior`} onClick={() => onFecha(moverPeriodo(modo, d.periodo.desde, -1))}>‹</button>
            <strong aria-live="polite" className="pl-etiqueta">{etiquetaPeriodo(modo, d.periodo.desde)}</strong>
            <button type="button" aria-label={`${unidad} siguiente`} onClick={() => onFecha(moverPeriodo(modo, d.periodo.desde, 1))}>›</button>
            <input type="date" aria-label="Día del período" value={fecha} onChange={(e) => e.target.value && onFecha(e.target.value)} />
          </div>
        </div>
        <dl className="pp-cifras" aria-label="Cifras del período">
          <div><dt>Horas trabajadas / programadas</dt><dd>{horas(r.trabajadaMin)} h de {horas(r.programadaMin)} h</dd></div>
          <div><dt>Bruto (ganado)</dt><dd>{soles(r.ganado)}</dd></div>
          <div><dt>Descuentos</dt><dd>− {soles(res.totalRestas)}{lineasFranja.length > 0 && <small className="pp-desglose" data-testid="desglose-descuentos">{lineasFranja.map((x) => `${x.concepto}: ${soles(x.monto)}`).join(' · ')}</small>}</dd></div>
          <div className="pp-cifra-neto"><dt>Neto a pagar</dt><dd>{soles(r.neto)}</dd></div>
        </dl>
        {pagado && d.pagadoEn && (
          <div role="status" className="as-aviso as-aviso--ok pp-sello">
            <span>Pagado el {fechaHora(d.pagadoEn)}{pagoRegistrado?.pagadoPorNombre ? ` por ${pagoRegistrado.pagadoPorNombre}` : ''}. Las cifras están congeladas (solo lectura).</span>
            {reabrir === null
              ? <Boton type="button" variante="peligro" onClick={() => setReabrir('')}>Reabrir período</Boton>
              : (
                <>
                  <input aria-label="Motivo para reabrir (mínimo 10 caracteres)" placeholder="Motivo para reabrir (mín. 10 caracteres)" value={reabrir} onChange={(e) => setReabrir(e.target.value)} className="pp-motivo" />
                  <Boton type="button" variante="peligro" disabled={ocupado || reabrir.trim().length < 10} onClick={() => void ejecutar(async () => { await reabrirPlanilla(d.periodoId!, reabrir.trim()); setReabrir(null); }, 'Período reabierto.')}>Confirmar</Boton>
                  <Boton type="button" variante="secundario" onClick={() => setReabrir(null)}>Cancelar</Boton>
                </>
              )}
          </div>
        )}
        <BarraPestanas pestanas={pestanas} activa={seccionActiva} alCambiar={(id) => onSeccion(id as SeccionPlanilla)} base={base} etiqueta="Secciones de la planilla" />
      </header>
      <PanelesPestanas pestanas={pestanas} activa={seccionActiva} base={base} />
      <Confirmar
        abierto={pendienteIr !== null}
        titulo="¿Cambiar de persona sin guardar?"
        mensaje="El formulario de esta persona tiene texto sin guardar. Si cambias de persona, se pierde."
        textoSi="Sí, cambiar"
        textoNo="No, quedarme"
        alConfirmar={() => { const f = pendienteIr!; setPendienteIr(null); setBorradorSucio(false); irAPersona?.(f); }}
        alCancelar={() => setPendienteIr(null)}
      />

      <Confirmar
        abierto={confirmaPago}
        titulo={`¿Pagar ${soles(r.neto)}? Se congela.`}
        mensaje="Se congela la planilla de este período."
        textoSi="Sí, marcar pagado"
        textoNo="No"
        cargando={ocupado}
        alConfirmar={() => void ejecutar(async () => { await pagarPlanilla(d.partyId, fecha, [], [], [], [], { ...(pagarIgual !== null ? { pagarIgualMotivo: pagarIgual } : {}), ...(sinDescontarAnt && antSinCobrar.length > 0 ? { sinDescontarAnteriores: true } : {}) }); setConfirmaPago(false); cargarPagos(); }, 'Período marcado como pagado.')}
        alCancelar={() => setConfirmaPago(false)}
      />
      <Confirmar
        abierto={confirmaSimples}
        titulo="¿Aprobar todas las marcas dudosas del período?"
        mensaje={`Se aprobarán las marcas manuales por revisar y las solicitudes de corrección pendientes de ${nombre} del ${d.periodo.desde} al ${d.periodo.hasta}. Revisa antes las cámaras.`}
        textoSi="Sí, aprobar"
        textoNo="No"
        cargando={ocupado}
        alConfirmar={async () => {
          setOcupado(true);
          try {
            setResSimples(await aprobarSimplesPeriodo(d.partyId, d.periodo.desde, d.periodo.hasta));
            setConfirmaSimples(false);
            onError(null);
            await cargar();
            void recargarCal();
          } catch (e) {
            onError(mensajeDe(e, 'No se pudo aprobar en lote.'));
          } finally {
            setOcupado(false);
          }
        }}
        alCancelar={() => setConfirmaSimples(false)}
      />
    </div>
  );
}
