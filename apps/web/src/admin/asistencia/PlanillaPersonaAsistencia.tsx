import { useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Insignia, type VarianteInsignia } from '../../comun/Insignia';
import { ModalConPestanas } from '../../comun/ModalConPestanas';
import { ETIQUETA_ESTADO } from './asistenciaApi';
import { ETIQUETA_ROL } from './correccionesApi';
import { useDetalleDia } from './DetalleDiaPersona';
import { Plegable } from './Plegable';
import { Confirmar } from '../../comun/Confirmar';
import { aprobarExtra, soles } from './planillaApi';
import type { CtlPlanilla } from './PlanillaPersonaTipos';
import type { FilaCal } from './calendarioApi';

const horas = (min: number) => (min / 60).toFixed(2);
const VARIANTE: Record<string, VarianteInsignia> = {
  CUMPLIO: 'exito', TARDANZA: 'aviso', SALIO_ANTES: 'aviso', SALIO_DESPUES: 'neutro', FALTA: 'peligro', INCOMPLETO: 'peligro', A_REVISAR: 'acento', DESCANSO: 'neutro', SIN_EVALUAR: 'neutro', POR_EMPEZAR: 'neutro', SIN_MARCAR_ENTRADA: 'aviso', SIN_SALIDA: 'peligro',
};
const Fila = ({ t, v, fuerte }: { t: string; v: string; fuerte?: boolean }) => (
  <li className={`pl-fila${fuerte ? ' pl-fila--total' : ''}`}><span>{t}</span><span className="as-num">{v}</span></li>
);

/** Detalle de UN día (marcas, solicitudes, cambiar hora) en una ventana: no ensancha ni satura la página. Mismo contenido del modal del calendario. */
function PanelDia({ c, fila, jornada, cerrar }: { c: CtlPlanilla; fila: FilaCal | null; jornada: string; cerrar: () => void }) {
  const det = useDetalleDia(fila, { onCambio: () => { void c.cargar(); void c.recargarCal(); }, onError: c.onError, onOk: c.onOk });
  const sinDatos = {
    id: 'sin-datos',
    etiqueta: 'Día',
    contenido: (
      <div role="status" className="as-aviso as-aviso--alerta" data-testid="panel-dia">
        {c.errorCal ? 'No pudimos cargar las marcas de ese día.' : 'Ese día no tiene registro de marcas (descanso o sin horario).'}{' '}
        {c.errorCal && <Boton type="button" variante="secundario" tamano="pequeno" onClick={() => void c.recargarCal()}>Reintentar</Boton>}
      </div>
    ),
  };
  return (
    <ModalConPestanas
      titulo={det ? det.titulo : `Día ${jornada}`}
      subtitulo={det?.subtitulo}
      pestanas={det ? det.pestanas : [sinDatos]}
      alCerrar={cerrar}
      ancho={1040}
    />
  );
}

/** Pestaña «Asistencia»: banner de dudosas, resumen del período, penalidad y la tabla por día; un clic en el día abre su detalle en una ventana. */
export function PestanaAsistencia({ c, diaInicial }: { c: CtlPlanilla; diaInicial?: string | null }) {
  const { d, r, pagado, ocupado } = c;
  const [dia, setDia] = useState<string | null>(diaInicial ?? null);
  const [extraPorConfirmar, setExtraPorConfirmar] = useState<{ jornada: string; aprobar: boolean; min: number; descanso: boolean } | null>(null);
  const [extraResultado, setExtraResultado] = useState<string | null>(null);
  // Todos los días del período (los descansos sin marcas salen en gris, para que la semana se vea completa)
  const dias = d.dias;
  const esDescansoVacio = (x: (typeof dias)[number]) => x.estado === 'DESCANSO' && x.extraMin === 0 && (x.marcas ?? []).length === 0;
  const faltas = d.dias.filter((x) => x.estado === 'FALTA').length;
  const abrirDia = (j: string) => {
    setDia(j);
  };
  return (
    <div className="pp-seccion">
      {c.faltan > 0 && (
        <div role="alert" className="as-aviso as-aviso--alerta" data-testid="banner-por-revisar">
          <strong>{c.faltan} {c.faltan === 1 ? 'jornada por revisar' : 'jornadas por revisar o sin evaluar'}</strong>: no se puede pagar hasta corregirlas.{' '}
          {c.porRevisar.map((j) => <button key={j} type="button" className="pp-enlace" onClick={() => abrirDia(j)}>{j}</button>)}
          <div style={{ marginTop: 6 }}>
            <Boton type="button" variante="secundario" disabled={ocupado} onClick={() => c.setConfirmaSimples(true)}>Aprobar todas las marcas dudosas del período</Boton>
            <small style={{ display: 'block' }}>Solo las simples (marcas manuales y solicitudes pendientes). Las jornadas con cantidades raras de marcas se corrigen una por una en el detalle del día.</small>
          </div>
        </div>
      )}
      {c.resSimples && (
        <div role="status" className={`as-aviso ${c.resSimples.fallidas ? 'as-aviso--alerta' : 'as-aviso--ok'}`}>
          Aprobadas {c.resSimples.ok} de {c.resSimples.total}{c.resSimples.omitidas ? ` · ${c.resSimples.omitidas} marca(s) de jornadas con cantidades raras requieren corrección explícita` : ''}.
          {c.resSimples.resultados.filter((x) => !x.ok).map((x) => <div key={`${x.tipo}${x.id}`}>✗ {x.tipo === 'MARCA' ? 'Marca' : 'Solicitud'} #{x.id}: {x.mensaje}</div>)}
        </div>
      )}
      <ul className="pl-filas">
        <Fila t="Horas programadas" v={`${horas(r.programadaMin)} h`} />
        <Fila t="Horas trabajadas (el break se paga)" v={`${horas(r.trabajadaMin)} h → ${soles(r.pagoTrabajado)}`} />
        <Fila t={`Horas extra aprobadas (de ${horas(r.extraMin)} h)`} v={`${horas(r.extraAprobadaMin)} h → ${soles(r.pagoExtra)}`} />
        <Fila t="Faltas del período" v={String(faltas)} />
      </ul>

      <Plegable titulo="Penalidad por tardanza" resumen={c.penal > 0 ? `− ${soles(c.penal)}` : 'Sin penalidad'} abierta={c.penal > 0}>
        <p className="as-ayuda">La hora tarde no se paga y además se cobra una penalidad según su valor (el factor se cambia en Configuración).</p>
        {c.detallePenal.length === 0 ? <small className="as-nota">No hay tardanzas con penalidad en este período.</small> : (
          <ul className="pl-filas">
            {c.detallePenal.map((x) => <Fila key={x.fecha} t={`${x.fecha} · ${x.minutos} min de tardanza`} v={`− ${soles(x.monto)}`} />)}
            <Fila t="Total de la penalidad" v={`− ${soles(c.penal)}`} fuerte />
          </ul>
        )}
      </Plegable>

      <div className={`pp-asist${dia ? ' pp-asist--con-panel' : ''}`}>
        <section aria-label="Asistencia del período" className="pp-asist-tabla">
          <p className="as-ayuda">Cada sol sale de aquí: horario, marcas interpretadas, horas pagadas y recargos. Las dobles marcas aparecen tachadas y no cuentan. Pulsa «Ver detalle» para ver y corregir las marcas del día.</p>
          <div className="as-tabla-wrap">
            <table className="as-tabla as-tabla--tarjetas">
              <thead><tr><th>Jornada</th><th>Estado</th><th>Marcas</th><th>Horas (pagadas / prog.)</th><th>Tardanza (min)</th><th>Extra (min)</th><th>Aprobar extra</th><th>Ganado</th><th>Detalle</th></tr></thead>
              <tbody>
                {dias.map((x) => (
                  <tr key={x.jornada} id={`dia-${x.jornada}`} className={[dia === x.jornada ? 'pp-fila-sel' : '', esDescansoVacio(x) ? 'pp-fila-descanso' : ''].filter(Boolean).join(' ') || undefined} style={esDescansoVacio(x) ? { opacity: 0.6 } : undefined}>
                    <td data-label="Jornada" className="as-num">{x.jornada}{x.feriado && x.recargo && x.recargo !== 1 ? <> <Insignia variante="acento">{x.trabajadaMin > 0 ? 'Feriado trabajado' : 'Feriado'} ×{x.recargo}</Insignia></> : null}{x.descansoTrabajado ? <> <Insignia variante="aviso">Descanso trabajado</Insignia></> : null}{x.vacacion ? <> <Insignia variante="neutro">Vacación</Insignia></> : null}
                      <small style={{ display: 'block' }}>{x.horario ? `Horario ${x.horario.entrada}–${x.horario.salida}` : 'Sin horario'}{x.breakMin ? ` · break ${x.breakMin} min` : ''}</small>
                    </td>
                    <td data-label="Estado">
                      <Insignia variante={VARIANTE[x.estado] ?? 'neutro'}>{ETIQUETA_ESTADO[x.estado] ?? x.estado}</Insignia>
                      {(x.alertas ?? []).map((a, i) => <small key={i} style={{ display: 'block' }}>⚠ {a}</small>)}
                    </td>
                    <td data-label="Marcas">
                      {(x.marcas ?? []).length === 0 ? '—' : (x.marcas ?? []).map((m, i) => (
                        <span key={m.id ?? i} style={{ display: 'block', textDecoration: m.duplicada ? 'line-through' : undefined }}>
                          {m.hora} {m.rol ? ETIQUETA_ROL[m.rol as keyof typeof ETIQUETA_ROL] : ''}{m.duplicada ? ' (doble)' : ''}{m.estado === 'A_REVISAR' ? ' ⚠ por revisar' : ''}
                        </span>
                      ))}
                    </td>
                    <td data-label="Horas (pagadas / prog.)" className="as-num">{horas(x.trabajadaMin)} / {horas(x.programadaMin)}</td>
                    <td data-label="Tardanza (min)" className="as-num">{x.tardanzaMin}</td>
                    <td data-label="Extra (min)" className="as-num">{x.extraMin}{x.extraPendiente ? <small style={{ display: 'block' }}>pendiente de aprobar</small> : null}</td>
                    <td data-label="Aprobar extra">
                      {x.extraMin > 0 ? (
                        <label style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44 }}>
                          <input type="checkbox" checked={x.extraAprobada} disabled={pagado || ocupado} aria-label={x.descansoTrabajado ? `Aprobar el descanso trabajado del ${x.jornada}` : `Aprobar las horas extra del ${x.jornada}`}
                            onChange={(e) => setExtraPorConfirmar({ jornada: x.jornada, aprobar: e.target.checked, min: x.extraMin, descanso: !!x.descansoTrabajado })} />
                          {x.extraAprobada ? 'Aprobada' : x.descansoTrabajado ? 'Aprobar descanso trabajado' : 'Sin aprobar'}
                        </label>
                      ) : '—'}
                    </td>
                    <td data-label="Ganado" className="as-num">{soles(x.ganado)}</td>
                    <td data-label="Detalle">
                      <Boton type="button" variante="secundario" tamano="pequeno" aria-label={`Ver el detalle del día ${x.jornada}`} aria-current={dia === x.jornada ? 'true' : undefined} onClick={() => abrirDia(x.jornada)}>Ver detalle</Boton>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><th colSpan={7} scope="row">Total ganado del período</th><td className="as-num" colSpan={2}><strong>{soles(r.ganado)}</strong></td></tr></tfoot>
            </table>
          </div>
        </section>
        <Confirmar
          abierto={extraPorConfirmar !== null}
          titulo={extraPorConfirmar?.aprobar ? 'Aprobar horas extra' : 'Quitar la aprobación'}
          mensaje={extraPorConfirmar
            ? extraPorConfirmar.aprobar
              ? `Se aprobarán ${extraPorConfirmar.min} min ${extraPorConfirmar.descanso ? 'de descanso trabajado' : 'de horas extra'} del ${extraPorConfirmar.jornada} y se sumarán al sueldo.`
              : `Se quitará la aprobación de los ${extraPorConfirmar.min} min del ${extraPorConfirmar.jornada}: dejarán de pagarse.`
            : ''}
          textoConfirmar={extraPorConfirmar?.aprobar ? 'Sí, aprobar' : 'Sí, quitar'}
          cargando={ocupado}
          alCancelar={() => setExtraPorConfirmar(null)}
          alConfirmar={() => {
            const e = extraPorConfirmar;
            if (!e) return;
            setExtraPorConfirmar(null);
            void c.ejecutar(async () => {
              await aprobarExtra(d.partyId, e.jornada, e.aprobar);
              setExtraResultado(e.aprobar ? `✓ Horas extra aprobadas correctamente (${e.min} min del ${e.jornada}). Ya cuentan en el sueldo.` : `Aprobación quitada (${e.min} min del ${e.jornada}). Ya no se pagan.`);
            }, e.aprobar ? 'Horas extra aprobadas.' : 'Aprobación de horas extra quitada.');
          }}
        />
        <Confirmar abierto={extraResultado !== null} titulo="Listo" mensaje={extraResultado ?? ''} textoConfirmar="Entendido" textoNo="Cerrar"
          alConfirmar={() => setExtraResultado(null)} alCancelar={() => setExtraResultado(null)} />
        {dia && (
          <PanelDia key={dia} c={c} jornada={dia} fila={c.filasCal?.find((f) => f.fecha === dia) ?? null} cerrar={() => setDia(null)} />
        )}
      </div>
    </div>
  );
}
