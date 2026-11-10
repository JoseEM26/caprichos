import { useCallback, useEffect, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { Confirmar } from '../../comun/Confirmar';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { Insignia } from '../../comun/Insignia';
import { ModalConPestanas } from '../../comun/ModalConPestanas';
import { Tarjeta } from '../../comun/Tarjeta';
import { ETIQUETA_ESTADO } from './asistenciaApi';
import { jornadaActual, useUltimaPeticion } from './jornada';
import { ETIQUETA_ROL, ResultadoLote, aprobarSimplesPeriodo } from './correccionesApi';
import { PestanaVinculoVacaciones } from './VinculoVacaciones';
import { ETIQUETA_VINCULO } from './vinculoApi';
import {
  DetallePlanilla,
  FilaPlanilla,
  anularAjuste,
  aprobarExtra,
  crearAjuste,
  detallePlanilla,
  listarPlanilla,
  pagarPlanilla,
  reabrirPlanilla,
  soles,
} from './planillaApi';

type Avisar = (m: string | null) => void;
const mensajeDe = (e: unknown, fallback: string) => (e as any)?.mensaje ?? (e as any)?.message ?? fallback;
const horas = (min: number) => (min / 60).toFixed(2);

/** Planilla del personal (solo ADMIN): una fila por persona y, al abrirla, el detalle con consumos, ajustes y pago. */
export function PlanillaTab({ onError, onOk }: { onError: Avisar; onOk: Avisar }) {
  const [fecha, setFecha] = useState(jornadaActual());
  const [filas, setFilas] = useState<FilaPlanilla[] | null>(null);
  const [abierta, setAbierta] = useState<FilaPlanilla | null>(null);

  const nueva = useUltimaPeticion();
  const cargar = useCallback(async () => {
    const vigente = nueva();
    try {
      const r = await listarPlanilla(fecha);
      if (!vigente()) return;
      setFilas(r.filas);
      onError(null);
    } catch (e) {
      if (vigente()) onError(mensajeDe(e, 'No pudimos cargar la planilla.'));
    }
  }, [fecha, onError, nueva]);
  useEffect(() => { void cargar(); }, [cargar]);

  if (!filas) return <Cargando mensaje="Cargando planilla" />;
  return (
    <>
      <Tarjeta titulo="Planilla" subtitulo="Cada persona se paga por su período: la semana (lunes a domingo) o el mes. Elige cualquier día del período que quieres ver.">
        <label className="as-campo">Día del período
          <input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
        </label>
      </Tarjeta>
      {filas.length === 0 ? (
        <EstadoVacio titulo="Sin personal" descripcion="Cuando haya usuarios activos, aparecerán aquí." />
      ) : (
        <div className="as-tabla-wrap">
          <table className="as-tabla as-tabla--tarjetas">
            <thead>
              <tr><th>Persona</th><th>Vínculo</th><th>Modalidad</th><th>Sueldo semanal</th><th>Sueldo mensual</th><th>Período</th><th>Horas prog.</th><th>Horas trab.</th><th>Ganado</th><th>Consumos</th><th>Descuentos</th><th>Adelantos</th><th>Neto</th><th>Estado</th><th /></tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.partyId}>
                  <td data-label="Persona" className="as-nombre">{f.nombre}</td>
                  <td data-label="Vínculo">{f.vinculo ? ETIQUETA_VINCULO[f.vinculo.tipo] : '—'}</td>
                  <td data-label="Modalidad">{f.sueldo ? (f.sueldo.modalidad === 'SEMANAL' ? 'Semanal' : 'Mensual') : <Insignia variante="aviso">Sin sueldo</Insignia>}</td>
                  <td data-label="Sueldo semanal" className="as-num">{soles(f.sueldo?.semanal)}</td>
                  <td data-label="Sueldo mensual" className="as-num">{soles(f.sueldo?.mensual)}</td>
                  <td data-label="Período" className="as-num">{f.periodo ? `${f.periodo.desde} a ${f.periodo.hasta}` : '—'}</td>
                  <td data-label="Horas prog." className="as-num">{f.programadasH ?? '—'}</td>
                  <td data-label="Horas trab." className="as-num">{f.trabajadasH ?? '—'}</td>
                  <td data-label="Ganado" className="as-num">{soles(f.ganado)}</td>
                  <td data-label="Consumos" className="as-num">{soles(f.consumos)}</td>
                  <td data-label="Descuentos" className="as-num">{soles(f.descuentos)}</td>
                  <td data-label="Adelantos" className="as-num">{soles(f.adelantos)}</td>
                  <td data-label="Neto" className="as-num"><strong>{soles(f.neto)}</strong></td>
                  <td data-label="Estado">
                    {f.estado === 'PAGADO' ? <Insignia variante="exito">Pagado</Insignia> : f.estado ? (
                      f.pendientes ? <Insignia variante="aviso">{f.pendientes} por revisar</Insignia> : <Insignia variante="neutro">Abierto</Insignia>
                    ) : '—'}
                  </td>
                  <td data-label="">
                    {f.sueldo ? <Boton type="button" variante="secundario" tamano="pequeno" onClick={() => setAbierta(f)}>Abrir</Boton>
                      : <small className="as-nota">Pon su sueldo en Usuarios, pestaña Horario</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {abierta && (
        <DetalleModal
          fila={abierta}
          fecha={fecha}
          alCerrar={() => { setAbierta(null); void cargar(); }}
          onError={onError}
          onOk={onOk}
        />
      )}
    </>
  );
}

function DetalleModal({ fila, fecha, alCerrar, onError, onOk }: { fila: FilaPlanilla; fecha: string; alCerrar: () => void; onError: Avisar; onOk: Avisar }) {
  const [d, setD] = useState<DetallePlanilla | null>(null);
  // Consumos que pasan al siguiente período (el resto se cobra en este pago)
  const [excluidos, setExcluidos] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [confirmaPago, setConfirmaPago] = useState(false);
  const [reabrir, setReabrir] = useState<string | null>(null);
  const [aj, setAj] = useState({ tipo: 'ADELANTO' as 'ADELANTO' | 'DESCUENTO', fecha: jornadaActual(), monto: '', motivo: '' });
  const [anulando, setAnulando] = useState<{ id: number; motivo: string } | null>(null);
  const [tab, setTab] = useState('resumen');
  const [resaltar, setResaltar] = useState<string | null>(null);
  const [confirmaSimples, setConfirmaSimples] = useState(false);
  const [resSimples, setResSimples] = useState<ResultadoLote | null>(null);

  const nueva = useUltimaPeticion();
  const cargar = useCallback(async () => {
    const vigente = nueva();
    try {
      const r = await detallePlanilla(fila.partyId, fecha, excluidos);
      if (vigente()) setD(r);
    } catch (e) {
      if (vigente()) onError(mensajeDe(e, 'No pudimos cargar el detalle.'));
    }
  }, [fila.partyId, fecha, excluidos, onError, nueva]);
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
  // Del banner a la jornada: abre la pestaña de jornadas y la resalta
  useEffect(() => {
    if (tab === 'jornadas' && resaltar) document.getElementById(`dia-${resaltar}`)?.scrollIntoView?.({ block: 'center' });
  }, [tab, resaltar, d]);
  const irAlDia = (j: string) => { setResaltar(j); setTab('jornadas'); };
  const porRevisar = d?.jornadasPorRevisar ?? [];
  const banner = d && !pagado && porRevisar.length > 0 ? (
    <div role="alert" className="as-aviso as-aviso--alerta" data-testid="banner-por-revisar">
      <strong>{porRevisar.length} {porRevisar.length === 1 ? 'jornada por revisar' : 'jornadas por revisar'}</strong>: no se puede marcar pagado hasta corregirlas.{' '}
      {porRevisar.map((j) => <button key={j} type="button" className="as-enlace" style={{ background: 'none', border: 0, cursor: 'pointer', padding: '0 6px', minHeight: 32 }} onClick={() => irAlDia(j)}>{j}</button>)}
      <div style={{ marginTop: 6 }}>
        <Boton type="button" variante="secundario" disabled={ocupado} onClick={() => setConfirmaSimples(true)}>Aprobar todas las marcas dudosas del período</Boton>
        <small style={{ display: 'block' }}>Solo las simples (marcas manuales y solicitudes pendientes). Las jornadas con cantidades raras de marcas se corrigen una por una en «Cronograma».</small>
      </div>
    </div>
  ) : null;
  const r = d?.resultado;

  const resumen = d && r && (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="as-aviso">
        Período {d.periodo.desde} a {d.periodo.hasta} · Sueldo {d.sueldo.modalidad === 'SEMANAL' ? 'semanal' : 'mensual'}: <strong>{soles(d.sueldo.modalidad === 'SEMANAL' ? d.sueldo.semanal : d.sueldo.mensual)}</strong>{' '}
        (semanal {soles(d.sueldo.semanal)} · mensual {soles(d.sueldo.mensual)}) · Valor hora {soles(r.valorHora)}
      </div>
      {pagado && <div role="status" className="as-aviso as-aviso--ok">Período pagado el {new Date(d.pagadoEn!).toLocaleString('es-PE', { timeZone: 'America/Lima' })}. Las cifras están congeladas: ya no le debemos nada de este período.</div>}
      <dl className="as-resumen-planilla" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8, margin: 0 }}>
        <Dato t="Horas programadas" v={`${horas(r.programadaMin)} h`} />
        <Dato t="Horas trabajadas válidas" v={`${horas(r.trabajadaMin)} h → ${soles(r.pagoTrabajado)}`} />
        <Dato t={`Tardanza (${r.tardanzaMin} min al ${d.pctTardanza} %)`} v={soles(r.pagoTardanza)} />
        <Dato t="Salidas anticipadas (no se pagan)" v={`${r.salidaAnticipadaMin} min`} />
        <Dato t={`Horas extra aprobadas (de ${horas(r.extraMin)} h)`} v={`${horas(r.extraAprobadaMin)} h → ${soles(r.pagoExtra)}`} />
        {!!r.pagoVacaciones && <Dato t="Vacaciones pagadas (en dinero)" v={soles(r.pagoVacaciones)} />}
        <Dato t="Ganado" v={soles(r.ganado)} fuerte />
        <Dato t="Consumos cobrados" v={`− ${soles(r.consumosCobrados)}`} />
        <Dato t="Descuentos" v={`− ${soles(r.descuentos)}`} />
        <Dato t="Adelantos" v={`− ${soles(r.adelantos)}`} />
        <Dato t="Neto a pagar" v={soles(r.neto)} fuerte />
      </dl>
      {r.consumosPendientes > 0 && <small className="as-nota">Consumos que pasan al siguiente período: {soles(r.consumosPendientes)}</small>}
      {r.neto < 0 && <div role="alert" className="as-aviso as-aviso--alerta">El neto es negativo: los descuentos superan lo ganado.</div>}
      <p className="as-ayuda">Marcar como pagado no mueve la caja: solo congela esta planilla y deja los consumos cobrados como «descontados por planilla».</p>
    </div>
  );

  const jornadas = d && (
    <div className="as-tabla-wrap">
      <p className="as-ayuda">Cada sol sale de aquí: horario, marcas interpretadas (por orden y pares), horas pagadas y recargos. Las dobles marcas aparecen tachadas y no cuentan.</p>
      <table className="as-tabla as-tabla--tarjetas">
        <thead><tr><th>Jornada</th><th>Horario</th><th>Marcas interpretadas</th><th>Estado</th><th>Prog. (h)</th><th>Pagadas (h)</th><th>Break (min)</th><th>Tardanza (min)</th><th>Extra (min)</th><th>Aprobar extra</th><th>Ganado</th></tr></thead>
        <tbody>
          {d.dias.filter((x) => x.estado !== 'DESCANSO' || x.extraMin > 0 || (x.marcas ?? []).length > 0).map((x) => (
            <tr key={x.jornada} id={`dia-${x.jornada}`} style={resaltar === x.jornada ? { outline: '3px solid var(--cp-gold)' } : undefined}>
              <td data-label="Jornada" className="as-num">{x.jornada}{x.feriado && x.recargo && x.recargo !== 1 ? <> <Insignia variante="acento">Feriado ×{x.recargo}</Insignia></> : null}{x.vacacion ? <> <Insignia variante="neutro">Vacación</Insignia></> : null}</td>
              <td data-label="Horario" className="as-num">{x.horario ? `${x.horario.entrada}–${x.horario.salida}` : '—'}</td>
              <td data-label="Marcas interpretadas">
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
                    <input
                      type="checkbox"
                      checked={x.extraAprobada}
                      disabled={pagado || ocupado}
                      aria-label={`Aprobar las horas extra del ${x.jornada}`}
                      onChange={(e) => void ejecutar(() => aprobarExtra(d.partyId, x.jornada, e.target.checked), e.target.checked ? 'Horas extra aprobadas.' : 'Aprobación de horas extra quitada.')}
                    />
                    {x.extraAprobada ? 'Aprobada' : 'Sin aprobar'}
                  </label>
                ) : '—'}
              </td>
              <td data-label="Ganado" className="as-num">{soles(x.ganado)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><th colSpan={10} scope="row">Total ganado del período</th><td className="as-num"><strong>{soles(d.resultado.ganado)}</strong></td></tr></tfoot>
      </table>
    </div>
  );

  const consumos = d && (
    d.consumos.length === 0 ? <EstadoVacio titulo="Sin consumos pendientes" descripcion="No tiene consumos del personal por cobrar." /> : (
      <div style={{ display: 'grid', gap: 8 }}>
        <p className="as-ayuda">Marca los que se cobran en este pago. Los que dejes sin marcar pasan al siguiente período.</p>
        {d.consumos.map((c) => (
          <label key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, border: '1px solid var(--cp-line)', borderRadius: 12, padding: '4px 10px' }}>
            <input
              type="checkbox"
              checked={c.cobrar}
              disabled={pagado || ocupado}
              aria-label={`Cobrar en este pago el consumo ${c.pedido}`}
              onChange={(e) => setExcluidos((x) => (e.target.checked ? x.filter((i) => i !== c.id) : [...x, c.id]))}
            />
            <span style={{ flex: 1 }}>{c.pedido} · {c.fecha}</span>
            <strong>{soles(c.monto)}</strong>
          </label>
        ))}
      </div>
    )
  );

  const ajustes = d && (
    <div style={{ display: 'grid', gap: 12 }}>
      {!pagado && (
        <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'grid', gap: 10 }}>
          <legend className="as-ayuda">Nuevo adelanto o descuento (producto dañado, roto o responsabilidad)</legend>
          <div className="as-form">
            <label className="as-campo">Tipo
              <select value={aj.tipo} onChange={(e) => setAj({ ...aj, tipo: e.target.value as 'ADELANTO' | 'DESCUENTO' })}>
                <option value="ADELANTO">Adelanto</option>
                <option value="DESCUENTO">Descuento</option>
              </select>
            </label>
            <label className="as-campo">Fecha <input type="date" value={aj.fecha} min={d.periodo.desde} max={d.periodo.hasta} onChange={(e) => setAj({ ...aj, fecha: e.target.value })} /></label>
            <label className="as-campo">Monto (S/) <input type="number" min="0.01" step="0.01" inputMode="decimal" value={aj.monto} onChange={(e) => setAj({ ...aj, monto: e.target.value })} /></label>
          </div>
          <label className="as-campo">{aj.tipo === 'ADELANTO' ? 'Nota' : 'Motivo'}
            <textarea placeholder="Mínimo 3 caracteres" value={aj.motivo} onChange={(e) => setAj({ ...aj, motivo: e.target.value })} />
          </label>
          <div className="as-acciones">
            <Boton
              type="button"
              disabled={ocupado || !(Number(aj.monto) > 0) || aj.motivo.trim().length < 3 || !aj.fecha}
              onClick={() => void ejecutar(async () => { await crearAjuste(aj.tipo, { partyId: d.partyId, fecha: aj.fecha, monto: Number(aj.monto), motivo: aj.motivo.trim() }); setAj({ ...aj, monto: '', motivo: '' }); }, aj.tipo === 'ADELANTO' ? 'Adelanto registrado.' : 'Descuento registrado.')}
            >
              Registrar {aj.tipo === 'ADELANTO' ? 'adelanto' : 'descuento'}
            </Boton>
          </div>
        </fieldset>
      )}
      {d.ajustes.length === 0 ? <EstadoVacio titulo="Sin adelantos ni descuentos" descripcion="En este período no hay ajustes." /> : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
          {d.ajustes.map((a) => (
            <li key={a.id} style={{ border: '1px solid var(--cp-line)', borderRadius: 12, padding: '8px 10px', opacity: a.anulado ? 0.6 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <span><Insignia variante={a.tipo === 'ADELANTO' ? 'neutro' : 'aviso'}>{a.tipo === 'ADELANTO' ? 'Adelanto' : 'Descuento'}</Insignia> {a.fecha}</span>
                <strong style={{ textDecoration: a.anulado ? 'line-through' : 'none' }}>{soles(a.monto)}</strong>
              </div>
              <div>{a.motivo}</div>
              {a.anulado && <small className="as-nota">Anulado: {a.anuladoMotivo}</small>}
              {!a.anulado && !pagado && (
                anulando?.id === a.id ? (
                  <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                    <label className="as-campo">Motivo de la anulación
                      <input value={anulando.motivo} onChange={(e) => setAnulando({ id: a.id, motivo: e.target.value })} />
                    </label>
                    <div className="as-acciones">
                      <Boton type="button" variante="secundario" tamano="pequeno" onClick={() => setAnulando(null)}>Cancelar</Boton>
                      <Boton type="button" variante="peligro" tamano="pequeno" disabled={ocupado || anulando.motivo.trim().length < 3} onClick={() => void ejecutar(async () => { await anularAjuste(a.id, anulando.motivo.trim()); setAnulando(null); }, 'Ajuste anulado.')}>Anular</Boton>
                    </div>
                  </div>
                ) : (
                  <Boton type="button" variante="texto" tamano="pequeno" onClick={() => setAnulando({ id: a.id, motivo: '' })}>Anular</Boton>
                )
              )}
            </li>
          ))}
        </ul>
      )}
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
          <Boton type="button" tamano="grande" disabled={ocupado || d.pendientes > 0} onClick={() => void ejecutar(async () => { await pagarPlanilla(d.partyId, fecha, excluidos); setConfirmaPago(false); setExcluidos([]); }, 'Período marcado como pagado.')}>Sí, marcar pagado</Boton>
        </>
      ) : (
        <Boton type="button" tamano="grande" disabled={ocupado || d.pendientes > 0} onClick={() => setConfirmaPago(true)}>Marcar pagado</Boton>
      )}
    </>
  );

  return (
    <ModalConPestanas
      titulo={`Planilla de ${fila.nombre}`}
      subtitulo={d ? `${d.periodo.desde} a ${d.periodo.hasta}${pagado ? ' · Pagado' : ''}` : undefined}
      ancho={820}
      alCerrar={alCerrar}
      bloquearCierre={ocupado}
      pestanaActiva={tab}
      alCambiarPestana={setTab}
      bajoPestanas={<>
        {banner}
        {resSimples && (
          <div role="status" className={`as-aviso ${resSimples.fallidas ? 'as-aviso--alerta' : 'as-aviso--ok'}`}>
            Aprobadas {resSimples.ok} de {resSimples.total}{resSimples.omitidas ? ` · ${resSimples.omitidas} marca(s) de jornadas con cantidades raras requieren corrección explícita` : ''}.
            {resSimples.resultados.filter((r) => !r.ok).map((r) => <div key={`${r.tipo}${r.id}`}>✗ {r.tipo === 'MARCA' ? 'Marca' : 'Solicitud'} #{r.id}: {r.mensaje}</div>)}
          </div>
        )}
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
      </>}
      pie={pie}
      pestanas={[
        { id: 'resumen', etiqueta: 'Resumen', contenido: resumen ?? <Cargando mensaje="Cargando" /> },
        { id: 'jornadas', etiqueta: 'Calendario y pago por día', insignia: porRevisar.length || null, insigniaError: porRevisar.length > 0, contenido: jornadas ?? <Cargando mensaje="Cargando" /> },
        { id: 'consumos', etiqueta: 'Consumos', insignia: d?.consumos.length || null, contenido: consumos ?? <Cargando mensaje="Cargando" /> },
        { id: 'ajustes', etiqueta: 'Adelantos y descuentos', insignia: d?.ajustes.filter((a) => !a.anulado).length || null, contenido: ajustes ?? <Cargando mensaje="Cargando" /> },
        { id: 'vinculo', etiqueta: 'Vínculo y vacaciones', contenido: <PestanaVinculoVacaciones partyId={fila.partyId} alCambiar={() => void cargar()} />, persistente: false },
      ]}
    />
  );
}

function Dato({ t, v, fuerte }: { t: string; v: string; fuerte?: boolean }) {
  return (
    <div style={{ border: '1px solid var(--cp-line)', borderRadius: 12, padding: '8px 10px' }}>
      <dt style={{ fontSize: 12, color: 'var(--cp-soft)' }}>{t}</dt>
      <dd style={{ margin: 0, fontWeight: fuerte ? 900 : 700, fontSize: fuerte ? 18 : 14 }}>{v}</dd>
    </div>
  );
}
