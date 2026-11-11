import { ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';
import { useDialogoAccesible } from '../../comun/useDialogoAccesible';
import '../../comun/modal-pestanas.css';
import { ETIQUETA_ESTADO } from './asistenciaApi';
import { jornadaActual, useUltimaPeticion } from './jornada';
import { ETIQUETA_ROL, ResultadoLote, aprobarSimplesPeriodo } from './correccionesApi';
import { Plegable } from './Plegable';
import { PrestamosPersona, ServiciosExtraPersona } from './PrestamosPersona';
import { PestanaVinculoVacaciones } from './VinculoVacaciones';
import { DatosPago } from './DatosPago';
import {
  CATEGORIAS_DESCUENTO,
  DetallePlanilla,
  ETIQUETA_CATEGORIA,
  FilaPlanilla,
  anularAjuste,
  aprobarExtra,
  crearAjuste,
  detallePlanilla,
  pagarPlanilla,
  reabrirPlanilla,
  soles,
  totalPenalidad,
} from './planillaApi';
import './planilla.css';

type Avisar = (m: string | null) => void;
const mensajeDe = (e: unknown, fallback: string) => (e as any)?.mensaje ?? (e as any)?.message ?? fallback;
const horas = (min: number) => (min / 60).toFixed(2);
const Fila = ({ t, v, fuerte }: { t: ReactNode; v: ReactNode; fuerte?: boolean }) => (
  <li className={`pl-fila${fuerte ? ' pl-fila--total' : ''}`}><span>{t}</span><span className="as-num">{v}</span></li>
);

/** Detalle de una persona: panel con secciones plegables (Pago, Asistencia, Penalidad, Adelantos, Descuentos, Préstamos, Servicios extra). */
export function PlanillaDetalle({ fila, fecha, alCerrar, onError, onOk }: { fila: FilaPlanilla; fecha: string; alCerrar: () => void; onError: Avisar; onOk: Avisar }) {
  const [d, setD] = useState<DetallePlanilla | null>(null);
  const [excluidos, setExcluidos] = useState<string[]>([]);
  const [omitCuotas, setOmitCuotas] = useState<string[]>([]);
  const [omitRec, setOmitRec] = useState<string[]>([]);
  // consumos de períodos anteriores que se marcan para cobrar en este pago (por defecto pasan al siguiente)
  const [incluirAnt, setIncluirAnt] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [confirmaPago, setConfirmaPago] = useState(false);
  const [reabrir, setReabrir] = useState<string | null>(null);
  const [aj, setAj] = useState({ tipo: 'DESCUENTO' as 'ADELANTO' | 'DESCUENTO' | 'BONO', categoria: 'OTRO', fecha: jornadaActual(), monto: '', motivo: '' });
  const [anulando, setAnulando] = useState<{ id: number; motivo: string } | null>(null);
  const [resaltar, setResaltar] = useState<string | null>(null);
  const [confirmaSimples, setConfirmaSimples] = useState(false);
  const [resSimples, setResSimples] = useState<ResultadoLote | null>(null);
  const [asistAbierta, setAsistAbierta] = useState(false);

  const base = useId();
  const dialogoRef = useRef<HTMLDivElement>(null);
  const alTeclear = useDialogoAccesible(dialogoRef, alCerrar, ocupado);

  const nueva = useUltimaPeticion();
  const cargar = useCallback(async () => {
    const vigente = nueva();
    try {
      const r = await detallePlanilla(fila.partyId, fecha, excluidos, omitCuotas, omitRec, incluirAnt);
      if (vigente()) setD(r);
    } catch (e) {
      if (vigente()) onError(mensajeDe(e, 'No pudimos cargar el detalle.'));
    }
  }, [fila.partyId, fecha, excluidos, omitCuotas, omitRec, incluirAnt, onError, nueva]);
  useEffect(() => { void cargar(); }, [cargar]);

  const ejecutar = async (fn: () => Promise<unknown>, ok: string) => {
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
  };

  const pagado = d?.estado === 'PAGADO';
  const porRevisar = d?.jornadasPorRevisar ?? [];
  const r = d?.resultado;
  const penal = d ? (d.penalidadTardanza ? totalPenalidad(d.penalidadTardanza) : r?.penalidadTardanza ?? 0) : 0;
  const detallePenal = d?.penalidadTardanza?.detalle ?? r?.penalidadTardanzaDetalle ?? [];
  const adelantos = d?.ajustes.filter((a) => a.tipo === 'ADELANTO') ?? [];
  const descuentos = d?.ajustes.filter((a) => a.tipo !== 'ADELANTO') ?? [];
  const irAlDia = (j: string) => {
    setResaltar(j);
    setAsistAbierta(true);
    setTimeout(() => document.getElementById(`dia-${j}`)?.scrollIntoView?.({ block: 'center' }), 50);
  };

  const formAjuste = (tipos: Array<'ADELANTO' | 'DESCUENTO' | 'BONO'>) => d && !pagado && (
    <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'grid', gap: 10 }}>
      <legend className="as-ayuda">{tipos[0] === 'ADELANTO' ? 'Nuevo adelanto' : 'Nuevo descuento (producto dañado, merma o responsabilidad) o bono'}</legend>
      <div className="as-form">
        {tipos.length > 1 && (
          <label className="as-campo">Tipo
            <select value={aj.tipo} onChange={(e) => setAj({ ...aj, tipo: e.target.value as 'DESCUENTO' | 'BONO' })}>
              <option value="DESCUENTO">Descuento</option>
              <option value="BONO">Bono (adicional)</option>
            </select>
          </label>
        )}
        {tipos.length > 1 && aj.tipo === 'DESCUENTO' && (
          <label className="as-campo">Etiqueta
            <select value={aj.categoria} onChange={(e) => setAj({ ...aj, categoria: e.target.value })}>
              {CATEGORIAS_DESCUENTO.filter((c) => c !== 'CONSUMO').map((c) => <option key={c} value={c}>{ETIQUETA_CATEGORIA[c]}</option>)}
            </select>
          </label>
        )}
        <label className="as-campo">Fecha <input type="date" value={aj.fecha} min={d.periodo.desde} max={d.periodo.hasta} onChange={(e) => setAj({ ...aj, fecha: e.target.value })} /></label>
        <label className="as-campo">Monto (S/) <input type="number" min="0.01" step="0.01" inputMode="decimal" value={aj.monto} onChange={(e) => setAj({ ...aj, monto: e.target.value })} /></label>
      </div>
      <label className="as-campo">{tipos[0] === 'ADELANTO' || aj.tipo === 'BONO' ? 'Nota' : 'Motivo'}
        <textarea style={{ minHeight: 56 }} placeholder="Mínimo 3 caracteres" value={aj.motivo} onChange={(e) => setAj({ ...aj, motivo: e.target.value })} />
      </label>
      <div className="as-acciones">
        <Boton
          type="button"
          disabled={ocupado || !(Number(aj.monto) > 0) || aj.motivo.trim().length < 3 || !aj.fecha}
          onClick={() => {
            const tipo = tipos.length === 1 ? tipos[0] : aj.tipo;
            void ejecutar(async () => { await crearAjuste(tipo, { partyId: d.partyId, fecha: aj.fecha, monto: Number(aj.monto), motivo: aj.motivo.trim(), ...(tipo === 'DESCUENTO' ? { categoria: aj.categoria } : {}) }); setAj({ ...aj, monto: '', motivo: '' }); }, tipo === 'ADELANTO' ? 'Adelanto registrado.' : tipo === 'BONO' ? 'Bono registrado.' : 'Descuento registrado.');
          }}
        >
          Registrar {tipos[0] === 'ADELANTO' ? 'adelanto' : aj.tipo === 'BONO' ? 'bono' : 'descuento'}
        </Boton>
      </div>
    </fieldset>
  );

  const listaAjustes = (lista: DetallePlanilla['ajustes'], vacio: string) => lista.length === 0 ? <small className="as-nota">{vacio}</small> : (
    <ul className="pl-filas">
      {lista.map((a) => (
        <li key={a.id} className="pl-fila" style={{ display: 'grid', justifyItems: 'stretch', opacity: a.anulado ? 0.6 : 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span><Insignia variante={a.tipo === 'ADELANTO' ? 'neutro' : a.tipo === 'BONO' ? 'exito' : 'aviso'}>{a.tipo === 'ADELANTO' ? 'Adelanto' : a.tipo === 'BONO' ? 'Bono' : `Descuento · ${ETIQUETA_CATEGORIA[a.categoria ?? 'OTRO'] ?? 'Otro'}`}</Insignia> {a.fecha}</span>
            <strong style={{ textDecoration: a.anulado ? 'line-through' : 'none' }}>{soles(a.monto)}</strong>
          </div>
          <div>{a.motivo}</div>
          {a.anulado && <small className="as-nota">Anulado: {a.anuladoMotivo}</small>}
          {!a.anulado && !pagado && (
            anulando?.id === a.id ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <label className="as-campo">Motivo de la anulación
                  <input value={anulando.motivo} onChange={(e) => setAnulando({ id: a.id, motivo: e.target.value })} />
                </label>
                <div className="as-acciones">
                  <Boton type="button" variante="secundario" tamano="pequeno" onClick={() => setAnulando(null)}>Cancelar</Boton>
                  <Boton type="button" variante="peligro" tamano="pequeno" disabled={ocupado || anulando.motivo.trim().length < 3} onClick={() => void ejecutar(async () => { await anularAjuste(a.id, anulando.motivo.trim()); setAnulando(null); }, 'Ajuste anulado.')}>Anular</Boton>
                </div>
              </div>
            ) : <div><Boton type="button" variante="texto" tamano="pequeno" onClick={() => setAnulando({ id: a.id, motivo: '' })}>Anular</Boton></div>
          )}
        </li>
      ))}
    </ul>
  );

  const cuotas = d?.cuotas ?? [];
  const recurrentes = d?.recurrentes ?? [];
  const cuerpo = !d || !r ? <Cargando mensaje="Cargando" /> : (
    <div style={{ display: 'grid', gap: 8 }}>
      {pagado && <div role="status" className="as-aviso as-aviso--ok">Período pagado el {new Date(d.pagadoEn!).toLocaleString('es-PE', { timeZone: 'America/Lima' })}. Las cifras están congeladas.</div>}
      {r.neto < 0 && <div role="alert" className="as-aviso as-aviso--alerta">El neto es negativo: los descuentos superan lo ganado.</div>}
      {!pagado && porRevisar.length > 0 && (
        <div role="alert" className="as-aviso as-aviso--alerta" data-testid="banner-por-revisar">
          <strong>{porRevisar.length} {porRevisar.length === 1 ? 'jornada por revisar' : 'jornadas por revisar'}</strong>: no se puede marcar pagado hasta corregirlas.{' '}
          {porRevisar.map((j) => <button key={j} type="button" className="as-enlace" style={{ background: 'none', border: 0, cursor: 'pointer', padding: '0 6px', minHeight: 32 }} onClick={() => irAlDia(j)}>{j}</button>)}
          <div style={{ marginTop: 6 }}>
            <Boton type="button" variante="secundario" disabled={ocupado} onClick={() => setConfirmaSimples(true)}>Aprobar todas las marcas dudosas del período</Boton>
            <small style={{ display: 'block' }}>Solo las simples (marcas manuales y solicitudes pendientes). Las jornadas con cantidades raras de marcas se corrigen una por una en «Calendario».</small>
          </div>
        </div>
      )}
      {resSimples && (
        <div role="status" className={`as-aviso ${resSimples.fallidas ? 'as-aviso--alerta' : 'as-aviso--ok'}`}>
          Aprobadas {resSimples.ok} de {resSimples.total}{resSimples.omitidas ? ` · ${resSimples.omitidas} marca(s) de jornadas con cantidades raras requieren corrección explícita` : ''}.
          {resSimples.resultados.filter((x) => !x.ok).map((x) => <div key={`${x.tipo}${x.id}`}>✗ {x.tipo === 'MARCA' ? 'Marca' : 'Solicitud'} #{x.id}: {x.mensaje}</div>)}
        </div>
      )}

      <Plegable titulo="Pago" resumen={`Neto ${soles(r.neto)}`} abierta>
        <p className="as-ayuda">
          Período {d.periodo.desde} a {d.periodo.hasta} · Sueldo {d.sueldo.modalidad === 'SEMANAL' ? 'semanal' : 'mensual'} {soles(d.sueldo.modalidad === 'SEMANAL' ? d.sueldo.semanal : d.sueldo.mensual)} · Valor hora {soles(r.valorHora)}
          {d.tercerizado && <> · <Insignia variante="acento">Tercerizado: sin feriado ×2 ni vacaciones</Insignia></>}
        </p>
        <ul className="pl-filas">
          <Fila t="Horas programadas" v={`${horas(r.programadaMin)} h`} />
          <Fila t="Horas trabajadas (el break se paga)" v={`${horas(r.trabajadaMin)} h → ${soles(r.pagoTrabajado)}`} />
          <Fila t={`Horas extra aprobadas (de ${horas(r.extraMin)} h)`} v={`${horas(r.extraAprobadaMin)} h → ${soles(r.pagoExtra)}`} />
          {!!r.pagoVacaciones && <Fila t="Vacaciones pagadas en dinero" v={soles(r.pagoVacaciones)} />}
          {!!r.adicional && <Fila t="Adicional (bonos)" v={`+ ${soles(r.adicional)}`} />}
          <Fila t="Ganado" v={soles(r.ganado)} fuerte />
          <Fila t="Penalidad por tardanza" v={`− ${soles(penal)}`} />
          <Fila t="Consumos cobrados" v={`− ${soles(r.consumosCobrados)}`} />
          <Fila t="Descuentos" v={`− ${soles(r.descuentos)}`} />
          <Fila t="Adelantos" v={`− ${soles(r.adelantos)}`} />
          <Fila t="Neto a pagar" v={soles(r.neto)} fuerte />
        </ul>
        {r.descuentosPorCategoria && Object.keys(r.descuentosPorCategoria).length > 0 && (
          <small className="as-nota">Se descuenta: {Object.entries(r.descuentosPorCategoria).map(([c, m]) => `${ETIQUETA_CATEGORIA[c] ?? (c === 'TARDANZA' ? 'Tardanza' : c)}: ${soles(m)}`).join(' · ')}</small>
        )}
        {r.consumosPendientes > 0 && <small className="as-nota">Consumos que pasan al siguiente período: {soles(r.consumosPendientes)}</small>}
        {!!d.consumosAnterioresPendiente && <small className="as-nota">Consumos de períodos anteriores sin cobrar: {soles(d.consumosAnterioresPendiente)} (se marcan en «Descuentos y consumos»).</small>}
        {d.pago && <p className="as-ayuda">Pagar a: <DatosPago pago={d.pago} onOk={onOk} /></p>}
        <p className="as-ayuda">Marcar como pagado no mueve la caja: solo congela esta planilla y deja los consumos cobrados como «descontados por planilla».</p>
      </Plegable>

      <Plegable titulo="Penalidad por tardanza" resumen={penal > 0 ? `− ${soles(penal)}` : 'Sin penalidad'} abierta={penal > 0}>
        <p className="as-ayuda">La hora tarde no se paga y además se cobra una penalidad según su valor (el factor se cambia en Configuración).</p>
        {detallePenal.length === 0 ? <small className="as-nota">No hay tardanzas con penalidad en este período.</small> : (
          <ul className="pl-filas">
            {detallePenal.map((x) => <Fila key={x.fecha} t={<>{x.fecha} · {x.minutos} min de tardanza</>} v={`− ${soles(x.monto)}`} />)}
            <Fila t="Total de la penalidad" v={`− ${soles(penal)}`} fuerte />
          </ul>
        )}
      </Plegable>

      <Plegable titulo="Asistencia del período" resumen={`${horas(r.trabajadaMin)} h de ${horas(r.programadaMin)} h`} abierta={asistAbierta} key={asistAbierta ? 'a1' : 'a0'}>
        <p className="as-ayuda">Cada sol sale de aquí: horario, marcas interpretadas, horas pagadas y recargos. Las dobles marcas aparecen tachadas y no cuentan.</p>
        <div className="as-tabla-wrap">
          <table className="as-tabla as-tabla--tarjetas">
            <thead><tr><th>Jornada</th><th>Horario</th><th>Marcas</th><th>Estado</th><th>Prog. (h)</th><th>Pagadas (h)</th><th>Break (min)</th><th>Tardanza (min)</th><th>Extra (min)</th><th>Aprobar extra</th><th>Ganado</th></tr></thead>
            <tbody>
              {d.dias.filter((x) => x.estado !== 'DESCANSO' || x.extraMin > 0 || (x.marcas ?? []).length > 0).map((x) => (
                <tr key={x.jornada} id={`dia-${x.jornada}`} style={resaltar === x.jornada ? { outline: '3px solid var(--cp-gold)' } : undefined}>
                  <td data-label="Jornada" className="as-num">{x.jornada}{x.feriado && x.recargo && x.recargo !== 1 ? <> <Insignia variante="acento">Feriado ×{x.recargo}</Insignia></> : null}{x.vacacion ? <> <Insignia variante="neutro">Vacación</Insignia></> : null}</td>
                  <td data-label="Horario" className="as-num">{x.horario ? `${x.horario.entrada}–${x.horario.salida}` : '—'}</td>
                  <td data-label="Marcas">
                    {(x.marcas ?? []).length === 0 ? '—' : (x.marcas ?? []).map((m, i) => (
                      <span key={m.id ?? i} style={{ display: 'block', textDecoration: m.duplicada ? 'line-through' : undefined }}>
                        {m.hora} {m.rol ? ETIQUETA_ROL[m.rol as keyof typeof ETIQUETA_ROL] : ''}{m.duplicada ? ' (doble)' : ''}{m.estado === 'A_REVISAR' ? ' ⚠ por revisar' : ''}
                      </span>
                    ))}
                  </td>
                  <td data-label="Estado">
                    {ETIQUETA_ESTADO[x.estado] ?? x.estado}
                    {(x.alertas ?? []).map((a, i) => <small key={i} style={{ display: 'block' }}>⚠ {a}</small>)}
                  </td>
                  <td data-label="Prog. (h)" className="as-num">{horas(x.programadaMin)}</td>
                  <td data-label="Pagadas (h)" className="as-num">{horas(x.trabajadaMin)}</td>
                  <td data-label="Break (min)" className="as-num">{x.breakMin ?? 0}</td>
                  <td data-label="Tardanza (min)" className="as-num">{x.tardanzaMin}</td>
                  <td data-label="Extra (min)" className="as-num">{x.extraMin}{x.extraPendiente ? <small style={{ display: 'block' }}>pendiente de aprobar</small> : null}</td>
                  <td data-label="Aprobar extra">
                    {x.extraMin > 0 ? (
                      <label style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44 }}>
                        <input type="checkbox" checked={x.extraAprobada} disabled={pagado || ocupado} aria-label={`Aprobar las horas extra del ${x.jornada}`}
                          onChange={(e) => void ejecutar(() => aprobarExtra(d.partyId, x.jornada, e.target.checked), e.target.checked ? 'Horas extra aprobadas.' : 'Aprobación de horas extra quitada.')} />
                        {x.extraAprobada ? 'Aprobada' : 'Sin aprobar'}
                      </label>
                    ) : '—'}
                  </td>
                  <td data-label="Ganado" className="as-num">{soles(x.ganado)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><th colSpan={10} scope="row">Total ganado del período</th><td className="as-num"><strong>{soles(r.ganado)}</strong></td></tr></tfoot>
          </table>
        </div>
      </Plegable>

      <Plegable titulo="Adelantos" resumen={r.adelantos > 0 ? `− ${soles(r.adelantos)}` : 'Sin adelantos'}>
        {formAjuste(['ADELANTO'])}
        {listaAjustes(adelantos, 'En este período no hay adelantos.')}
      </Plegable>

      <Plegable titulo="Descuentos y consumos" resumen={`− ${soles(r.descuentos + r.consumosCobrados)}`}>
        {d.consumos.length > 0 && (() => {
          const filaC = (c: DetallePlanilla['consumos'][number]) => (
            <label key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, border: '1px solid var(--cp-line)', borderRadius: 12, padding: '4px 10px' }}>
              <input type="checkbox" checked={c.cobrar} disabled={pagado || ocupado} aria-label={`Cobrar en este pago el consumo ${c.pedido}`}
                onChange={(e) => (c.anterior
                  ? setIncluirAnt((x) => (e.target.checked ? [...x, c.id] : x.filter((i) => i !== c.id)))
                  : setExcluidos((x) => (e.target.checked ? x.filter((i) => i !== c.id) : [...x, c.id])))} />
              <span style={{ flex: 1, minWidth: 0 }}>
                {c.pedido} · {c.fecha}
                {c.productos && c.productos.length > 0 && <small className="as-nota" style={{ display: 'block' }}>{c.productos.join(', ')}</small>}
              </span>
              <strong>{soles(c.monto)}</strong>
            </label>
          );
          const delPeriodo = d.consumos.filter((c) => !c.anterior);
          const anteriores = d.consumos.filter((c) => c.anterior);
          return (
            <div style={{ display: 'grid', gap: 6 }}>
              <p className="as-ayuda">Consumos del personal (los mismos de Admin › Créditos): marca los que se cobran en este pago. Los del período vienen marcados; los que dejes sin marcar pasan al siguiente. Al marcar pagado quedan como «Cobrado» en Créditos.</p>
              {delPeriodo.map(filaC)}
              {anteriores.length > 0 && (
                <>
                  <strong style={{ fontSize: 13 }}>Consumos de períodos anteriores sin cobrar · {soles(anteriores.reduce((a, c) => a + c.monto, 0))}</strong>
                  <small className="as-nota">Marca los que también quieres descontar en este pago.</small>
                  {anteriores.map(filaC)}
                </>
              )}
            </div>
          );
        })()}
        {d.consumos.length === 0 && <small className="as-nota">No tiene consumos del personal por cobrar.</small>}
        {formAjuste(['DESCUENTO', 'BONO'])}
        {listaAjustes(descuentos, 'En este período no hay descuentos ni bonos.')}
      </Plegable>

      <Plegable titulo="Préstamos" resumen={cuotas.length > 0 ? `${cuotas.length} cuota(s) este pago · ${soles(cuotas.filter((c) => c.cobrar).reduce((s, c) => s + c.monto, 0))}` : 'Sin cuota este pago'}>
        {(vista) => (<>
        {cuotas.length > 0 && (
          <div style={{ display: 'grid', gap: 4 }}>
            <small className="as-nota">Cuotas de este pago. Desmarca una para saltarla: pasa al final del plan.</small>
            {cuotas.map((c) => (
              <label key={`c${c.id}`} style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}>
                <input type="checkbox" checked={c.cobrar} disabled={pagado || ocupado} aria-label={`Cobrar la cuota ${c.numero} del préstamo`} onChange={(e) => setOmitCuotas((x) => (e.target.checked ? x.filter((i) => i !== c.id) : [...x, c.id]))} />
                <span style={{ flex: 1 }}>Cuota {c.numero} de {c.numCuotas}{(c.interesCuota ?? c.interes) ? <small className="as-nota">capital {soles(c.capitalCuota ?? c.capital)} + interés {soles(c.interesCuota ?? c.interes)}</small> : null}</span>
                <strong>{soles(c.monto)}</strong>
              </label>
            ))}
          </div>
        )}
        {vista && <PrestamosPersona partyId={fila.partyId} alCambiar={() => void cargar()} />}
        </>)}
      </Plegable>

      <Plegable titulo="Servicios extra" resumen={recurrentes.length > 0 ? `${recurrentes.length} en este pago · ${soles(recurrentes.filter((c) => c.cobrar).reduce((s, c) => s + c.monto, 0))}` : 'Ninguno este pago'}>
        {(vista) => (<>
        {recurrentes.length > 0 && (
          <div style={{ display: 'grid', gap: 4 }}>
            <small className="as-nota">Descuentos de este pago. Desmarca para no cobrarlo solo esta vez.</small>
            {recurrentes.map((c) => (
              <label key={`r${c.id}`} style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}>
                <input type="checkbox" checked={c.cobrar} disabled={pagado || ocupado} aria-label={`Cobrar ${c.nombre} en este pago`} onChange={(e) => setOmitRec((x) => (e.target.checked ? x.filter((i) => i !== c.id) : [...x, c.id]))} />
                <span style={{ flex: 1 }}>{c.nombre}</span>
                <strong>{soles(c.monto)}</strong>
              </label>
            ))}
          </div>
        )}
        {vista && <ServiciosExtraPersona partyId={fila.partyId} alCambiar={() => void cargar()} />}
        </>)}
      </Plegable>

      <Plegable titulo="Vínculo y vacaciones" perezoso>
        <PestanaVinculoVacaciones partyId={fila.partyId} alCambiar={() => void cargar()} />
      </Plegable>
    </div>
  );

  const pie = d && (
    <>
      <Boton type="button" variante="secundario" tamano="grande" onClick={alCerrar}>Cerrar</Boton>
      {pagado ? (
        reabrir === null
          ? <Boton type="button" variante="peligro" tamano="grande" onClick={() => setReabrir('')}>Reabrir período</Boton>
          : (
            <>
              <input aria-label="Motivo para reabrir (mínimo 10 caracteres)" placeholder="Motivo para reabrir (mín. 10 caracteres)" value={reabrir} onChange={(e) => setReabrir(e.target.value)} style={{ minHeight: 44, flex: 1, minWidth: 160, borderRadius: 8, border: '1.5px solid var(--cp-line)', padding: '0 8px' }} />
              <Boton type="button" variante="peligro" tamano="grande" disabled={ocupado || reabrir.trim().length < 10} onClick={() => void ejecutar(async () => { await reabrirPlanilla(d.periodoId!, reabrir.trim()); setReabrir(null); }, 'Período reabierto.')}>Confirmar</Boton>
            </>
          )
      ) : confirmaPago ? (
        <>
          <span style={{ fontWeight: 700 }}>¿Pagar {soles(d.resultado.neto)}? Se congela.</span>
          <Boton type="button" variante="secundario" tamano="grande" onClick={() => setConfirmaPago(false)}>No</Boton>
          <Boton type="button" tamano="grande" disabled={ocupado || d.pendientes > 0} onClick={() => void ejecutar(async () => { await pagarPlanilla(d.partyId, fecha, excluidos, omitCuotas, omitRec, incluirAnt); setConfirmaPago(false); setExcluidos([]); setOmitCuotas([]); setOmitRec([]); setIncluirAnt([]); }, 'Período marcado como pagado.')}>Sí, marcar pagado</Boton>
        </>
      ) : (
        <Boton type="button" tamano="grande" disabled={ocupado || d.pendientes > 0} onClick={() => setConfirmaPago(true)}>Marcar pagado</Boton>
      )}
    </>
  );

  const tituloId = `${base}-titulo`;
  return createPortal(
    <>
      <div className="mcp-fondo" onClick={ocupado ? undefined : alCerrar} />
      <div ref={dialogoRef} role="dialog" aria-modal="true" aria-labelledby={tituloId} className="mcp-dialogo" style={{ maxWidth: 820 }} onKeyDown={alTeclear} tabIndex={-1}>
        <div className="mcp-cabecera">
          <div className="mcp-titulos">
            <h2 id={tituloId} className="mcp-titulo">Planilla de {fila.nombre}</h2>
            {d && <div className="mcp-subtitulo">{d.periodo.desde} a {d.periodo.hasta}{pagado ? ' · Pagado' : ''}</div>}
          </div>
          <button type="button" className="mcp-cerrar" aria-label="Cerrar" disabled={ocupado} onClick={alCerrar}>×</button>
        </div>
        <div className="mcp-cuerpo">{cuerpo}</div>
        {pie && <div className="mcp-pie">{pie}</div>}
        <Confirmar
          abierto={confirmaSimples}
          titulo="¿Aprobar todas las marcas dudosas del período?"
          mensaje={`Se aprobarán las marcas manuales por revisar y las solicitudes de corrección pendientes de ${fila.nombre} del ${d?.periodo.desde} al ${d?.periodo.hasta}. Revisa antes las cámaras.`}
          textoSi="Sí, aprobar"
          textoNo="No"
          cargando={ocupado}
          alConfirmar={async () => {
            if (!d) return;
            setOcupado(true);
            try {
              setResSimples(await aprobarSimplesPeriodo(d.partyId, d.periodo.desde, d.periodo.hasta));
              setConfirmaSimples(false);
              onError(null);
              await cargar();
            } catch (e) {
              onError(mensajeDe(e, 'No se pudo aprobar en lote.'));
            } finally {
              setOcupado(false);
            }
          }}
          alCancelar={() => setConfirmaSimples(false)}
        />
      </div>
    </>,
    document.body,
  );
}
