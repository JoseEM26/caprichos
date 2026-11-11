import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { Confirmar } from '../../comun/Confirmar';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { Insignia, type VarianteInsignia } from '../../comun/Insignia';
import { ModalConPestanas, type PestanaModal } from '../../comun/ModalConPestanas';
import { ETIQUETAS_ROLES } from '../usuarios/roles';
import { ETIQUETA_ESTADO } from './asistenciaApi';
import { coincide } from './buscar';
import { DiaResumen, ETIQUETA_TIPO_CAL, FilaCal, RegistroCal, csvDeRegistro, esARevisar, esPresente, totalesDe } from './calendarioApi';
import { ResultadoLote, loteCorrecciones } from './correccionesApi';
import { etiquetaDia, sumarDias } from './CronogramaTab';
import { useDetalleDia } from './DetalleDiaPersona';

type Avisar = (m: string | null) => void;
const mensajeDe = (e: unknown, fallback: string) => (e as any)?.mensaje ?? (e as any)?.message ?? fallback;
const nombreRol = (r: string) => (ETIQUETAS_ROLES[r] ?? r).replace(/ \(.*\)$/, '');
const hh = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
const MAX_LOTE = 200;
const POR_PAGINA = 100;
const DIAS_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

const VARIANTE: Record<string, VarianteInsignia> = {
  CUMPLIO: 'exito', TARDANZA: 'aviso', SALIO_ANTES: 'aviso', SALIO_DESPUES: 'neutro', FALTA: 'peligro', INCOMPLETO: 'peligro', A_REVISAR: 'acento', DESCANSO: 'neutro', SIN_EVALUAR: 'neutro',
};

const tienePendiente = (f: FilaCal) => f.solicitudes.some((s) => s.estado === 'PENDIENTE');
const marcasPorRevisar = (f: FilaCal) => f.marcas.filter((m) => m.estado === 'A_REVISAR');
const clave = (f: FilaCal) => `${f.partyId}|${f.fecha}`;

/** Filtros rápidos por estado (uno a la vez; «Todos» los quita). */
const RAPIDOS: Array<[string, string, (f: FilaCal) => boolean]> = [
  ['TODOS', 'Todos', () => true],
  ['PRESENTE', 'Presentes', (f) => esPresente(f.estado)],
  ['TARDANZA', 'Tardanzas', (f) => f.estado === 'TARDANZA'],
  ['FALTA', 'Faltas', (f) => f.estado === 'FALTA'],
  ['A_REVISAR', 'A revisar', (f) => esARevisar(f.estado) || marcasPorRevisar(f).length > 0],
  ['SOLICITUD', 'Con solicitud', (f) => f.solicitudes.length > 0],
];

const fechasDe = (desde: string, hasta: string) => {
  const r: string[] = [];
  for (let j = desde; j <= hasta; j = sumarDias(j, 1)) r.push(j);
  return r;
};

/** Resumen de uno o varios días: usa el del calendario del mes y, si falta, lo arma con las filas. */
function resumenDe(dias: string[], resumen: DiaResumen[], filas: FilaCal[]) {
  const r = { presentes: 0, tardanzas: 0, faltas: 0, aRevisar: 0, solicitudes: 0, feriados: [] as string[] };
  for (const fecha of dias) {
    const d = resumen.find((x) => x.fecha === fecha);
    if (d) {
      r.presentes += d.presentes; r.tardanzas += d.tardanzas; r.faltas += d.faltas; r.aRevisar += d.aRevisar; r.solicitudes += d.solicitudesPendientes;
      if (d.feriado) r.feriados.push(d.feriado);
    } else {
      const f = filas.filter((x) => x.fecha === fecha && x.estado !== 'DESCANSO');
      r.presentes += f.filter((x) => esPresente(x.estado)).length;
      r.tardanzas += f.filter((x) => x.estado === 'TARDANZA').length;
      r.faltas += f.filter((x) => x.estado === 'FALTA').length;
      r.aRevisar += f.filter((x) => esARevisar(x.estado) || marcasPorRevisar(x).length > 0).length;
      r.solicitudes += f.reduce((s, x) => s + x.solicitudes.filter((y) => y.estado === 'PENDIENTE').length, 0);
    }
  }
  return r;
}

/**
 * Modal grande con TODOS los movimientos de un día (o de un rango de días): resumen, búsqueda por nombre, filtros rápidos
 * por estado, marcas de cada persona y aprobación en lote. Un rango muestra una pestaña «Todo el rango» (agrupada por fecha)
 * y una pestaña por día. «Ver detalle» cambia ESTE MISMO modal al detalle de la persona (nunca hay dos modales a la vez);
 * «← Volver al día» o Esc regresan a la lista tal como estaba (búsqueda, filtros, selección, pestaña, scroll y foco).
 */
export function ModalDiaCalendario({ desde, hasta, registro, cargando, filasBase, resumen, onCerrar, recargar, onError, onOk }: {
  desde: string; hasta: string; registro: RegistroCal | null; cargando: boolean; filasBase: FilaCal[]; resumen: DiaResumen[];
  onCerrar: () => void; recargar: () => Promise<void>; onError: Avisar; onOk: Avisar;
}) {
  const dias = useMemo(() => fechasDe(desde, hasta), [desde, hasta]);
  const rango = dias.length > 1;
  const [activa, setActiva] = useState(rango ? 'todos' : dias[0]);
  const [texto, setTexto] = useState('');
  const [rapido, setRapido] = useState('TODOS');
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [visibles, setVisibles] = useState(POR_PAGINA);
  const [detalle, setDetalle] = useState<FilaCal | null>(null);
  const [pestDet, setPestDet] = useState('resumen');
  const retorno = useRef<{ clave: string; scroll: number } | null>(null);
  const [confirmar, setConfirmar] = useState<'APROBAR' | 'RECHAZAR' | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [errorLote, setErrorLote] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoLote | null>(null);

  // Detalle de la persona dentro de este mismo modal; usa la fila fresca si el calendario se recargó
  const filaDetalle = detalle ? filasBase.find((f) => clave(f) === clave(detalle)) ?? detalle : null;
  const det = useDetalleDia(filaDetalle, { onCambio: () => void recargar(), onError, onOk });
  const abrirDetalle = (f: FilaCal, el: HTMLElement) => {
    retorno.current = { clave: clave(f), scroll: el.closest('.mcp-cuerpo')?.scrollTop ?? 0 };
    setPestDet('resumen');
    setDetalle(f);
  };
  const volverAlDia = () => setDetalle(null);
  // Al entrar al detalle: cuerpo arriba y foco en su pestaña. Al volver: scroll y foco en el «Ver detalle» de esa persona.
  useLayoutEffect(() => {
    const cuerpo = document.querySelector<HTMLElement>('.mcp-dialogo .mcp-cuerpo');
    if (detalle) {
      if (cuerpo) cuerpo.scrollTop = 0;
      document.querySelector<HTMLElement>('.mcp-dialogo [role="tab"][aria-selected="true"]')?.focus();
    } else if (retorno.current) {
      const { clave: k, scroll } = retorno.current;
      retorno.current = null;
      const b = document.querySelector<HTMLElement>(`[data-detalle-clave="${k}"]`);
      b?.focus({ preventScroll: true });
      if (cuerpo) cuerpo.scrollTop = scroll;
    }
  }, [detalle]);

  const filaActual = rapido === 'TODOS' ? () => true : RAPIDOS.find((r) => r[0] === rapido)![2];
  const filtradas = (lista: FilaCal[]) => lista.filter((f) => coincide(f.nombre, texto) && filaActual(f));
  const fechaActiva = activa === 'todos' ? null : activa;
  const delTab = filasBase.filter((f) => !fechaActiva || f.fecha === fechaActiva);
  const filas = filtradas(delTab);
  const diasActivos = fechaActiva ? [fechaActiva] : dias;
  const res = resumenDe(diasActivos, resumen, delTab);
  const tot = totalesDe(filas);

  // Selección para el lote: solo filas con algo que aprobar (solicitudes pendientes o marcas por revisar)
  const aprobables = filas.filter((f) => tienePendiente(f) || marcasPorRevisar(f).length > 0);
  const elegidasVisibles = filasBase.filter((f) => elegidas.has(clave(f)) && (tienePendiente(f) || marcasPorRevisar(f).length > 0));
  const itemsLote = elegidasVisibles.flatMap((f) => [
    ...f.solicitudes.filter((s) => s.estado === 'PENDIENTE').map((s) => ({ tipo: 'SOLICITUD' as const, id: s.id })),
    ...marcasPorRevisar(f).map((m) => ({ tipo: 'MARCA' as const, id: m.id })),
  ]);
  const alternarFila = (f: FilaCal) => setElegidas((s) => { const n = new Set(s); const k = clave(f); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const todas = aprobables.length > 0 && aprobables.every((f) => elegidas.has(clave(f)));

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

  const descargar = () => {
    try {
      const url = URL.createObjectURL(new Blob([csvDeRegistro(filas)], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `asistencia-${desde}${hasta !== desde ? `_a_${hasta}` : ''}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      onError(mensajeDe(e, 'No se pudo exportar.'));
    }
  };

  const contenido = (agrupar: boolean) => {
    if (!registro) return cargando ? <Cargando mensaje="Cargando movimientos" /> : <EstadoVacio titulo="Sin datos" descripcion="No pudimos cargar los movimientos. Cierra y vuelve a intentar." />;
    if (filas.length === 0) return <EstadoVacio titulo="Sin movimientos" descripcion={delTab.length ? 'Ninguna fila cumple la búsqueda o el filtro. Quítalos para ver más.' : 'Ese día no tiene turnos ni marcas.'} />;
    const mostradas = filas.slice(0, visibles);
    return (
      <>
        <div className="as-tabla-wrap ca-tabla-wrap" tabIndex={0} aria-label="Movimientos por persona">
          <table className="as-tabla as-tabla--tarjetas ca-tabla">
            <thead>
              <tr>
                <th><label className="ca-check"><input type="checkbox" disabled={aprobables.length === 0} checked={todas} aria-label="Seleccionar todo lo que se puede aprobar"
                  onChange={(e) => setElegidas(e.target.checked ? new Set(aprobables.map(clave)) : new Set())} /></label></th>
                <th>Persona</th>{agrupar && <th>Día</th>}<th className="ca-col-sec">Turno</th><th>Entrada</th><th className="ca-col-sec">Sal. almorzar</th><th className="ca-col-sec">Vuelta</th><th>Salida</th>
                <th>Trabajado</th><th>Tardanza</th><th>Extra</th><th>Estado</th><th>Marcas</th><th><span className="ca-sr">Detalle</span></th>
              </tr>
            </thead>
            <tbody>
              {mostradas.map((f, i) => {
                const pend = f.solicitudes.filter((s) => s.estado === 'PENDIENTE').length;
                const nuevoDia = agrupar && (i === 0 || mostradas[i - 1].fecha !== f.fecha);
                return (
                  <FilaMov key={clave(f)} f={f} pend={pend} agrupar={agrupar} nuevoDia={nuevoDia} elegida={elegidas.has(clave(f))} alElegir={() => alternarFila(f)} alDetalle={(el) => abrirDetalle(f, el)} />
                );
              })}
            </tbody>
          </table>
        </div>
        {filas.length > visibles && (
          <Boton type="button" variante="secundario" onClick={() => setVisibles((v) => v + POR_PAGINA)}>Mostrar {Math.min(POR_PAGINA, filas.length - visibles)} más ({filas.length - visibles} sin mostrar)</Boton>
        )}
      </>
    );
  };

  const pestanas: PestanaModal[] = rango
    ? [
      { id: 'todos', etiqueta: 'Todo el rango', insignia: filasBase.length, persistente: false, contenido: contenido(true) },
      ...dias.map((j): PestanaModal => {
        const n = filasBase.filter((f) => f.fecha === j && (tienePendiente(f) || marcasPorRevisar(f).length > 0)).length;
        return {
          id: j, etiqueta: `${DIAS_CORTOS[(new Date(`${j}T00:00:00Z`).getUTCDay() + 6) % 7]} ${Number(j.slice(8))}`, insignia: n || null, insigniaError: n > 0,
          persistente: false, contenido: contenido(false),
        };
      }),
    ]
    : [{ id: dias[0], etiqueta: 'Movimientos', insignia: filasBase.length || null, persistente: false, contenido: contenido(false) }];

  const titulo = rango ? `Movimientos del ${etiquetaDia(desde)} al ${etiquetaDia(hasta)}` : `Movimientos del ${etiquetaDia(desde)}`;
  const resumenTxt: Array<[string, number, string]> = [
    ['Presentes', res.presentes, 'ok'], ['Tardanzas', res.tardanzas, 'tarde'], ['Faltas', res.faltas, 'falta'], ['A revisar', res.aRevisar, 'rev'], ['Solicitudes pendientes', res.solicitudes, 'sol'],
  ];

  return (
    <>
      <ModalConPestanas
        titulo={det ? det.titulo : titulo}
        subtitulo={det ? det.subtitulo : res.feriados.length > 0 ? <Insignia variante="acento">Feriado: {[...new Set(res.feriados)].join(', ')}</Insignia> : undefined}
        pestanas={det ? det.pestanas : pestanas}
        pestanaActiva={det ? pestDet : activa}
        alCambiarPestana={det ? setPestDet : (id) => { setActiva(id); setVisibles(POR_PAGINA); }}
        alCerrar={det ? volverAlDia : onCerrar}
        ancho={det ? 860 : 1180}
        bajoPestanas={det ? undefined : (
          <div className="ca-modal-franja">
            <ul className="ca-modal-resumen" aria-label="Resumen" >
              {resumenTxt.map(([t, n, k]) => <li key={t} className={`ca-modal-res ca-modal-res--${k}`}><b>{n}</b> {t}</li>)}
            </ul>
            <div className="ca-modal-busca">
              <label className="as-campo ca-modal-q">Buscar persona
                <input type="search" value={texto} placeholder="Nombre (sin tildes)" onChange={(e) => { setTexto(e.target.value); setVisibles(POR_PAGINA); }} />
              </label>
              <div className="ca-modal-rapidos" role="group" aria-label="Filtrar por estado">
                {RAPIDOS.map(([k, t, fn]) => (
                  <button key={k} type="button" className="ca-rapido" aria-pressed={rapido === k} onClick={() => { setRapido(k); setVisibles(POR_PAGINA); }}>
                    {t}{k !== 'TODOS' ? ` ${delTab.filter(fn).length}` : ''}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        pie={det ? (
          <Boton type="button" variante="secundario" onClick={volverAlDia}>← Volver al día</Boton>
        ) : elegidasVisibles.length > 0 ? (
          <div className="ca-modal-lote" role="region" aria-label="Acciones en lote">
            <strong>{elegidasVisibles.length} {elegidasVisibles.length === 1 ? 'día seleccionado' : 'días seleccionados'} ({itemsLote.length} {itemsLote.length === 1 ? 'ítem' : 'ítems'})</strong>
            {itemsLote.length > MAX_LOTE && <span role="alert">Máximo {MAX_LOTE} por vez: quita algunas.</span>}
            <Boton type="button" disabled={itemsLote.length === 0 || itemsLote.length > MAX_LOTE} onClick={() => { setErrorLote(null); setConfirmar('APROBAR'); }}>Aprobar seleccionadas</Boton>
            <Boton type="button" variante="peligro" disabled={itemsLote.length === 0 || itemsLote.length > MAX_LOTE} onClick={() => { setErrorLote(null); setConfirmar('RECHAZAR'); }}>Rechazar/anular seleccionadas</Boton>
            <Boton type="button" variante="texto" onClick={() => setElegidas(new Set())}>Quitar selección</Boton>
          </div>
        ) : (
          <>
            <span className="ca-modal-tot" role="status" aria-label="Totales del rango">
              <b>{filas.length}</b> {filas.length === 1 ? 'registro' : 'registros'} · Trabajado <b>{hh(tot.trabajadaMin)}</b> · Tardanza <b>{tot.tardanzaMin} min</b> · Extra <b>{tot.extraMin} min</b> · Faltas <b>{tot.faltas}</b>
            </span>
            <Boton type="button" variante="secundario" disabled={filas.length === 0} onClick={descargar}>Exportar CSV</Boton>
            <Boton type="button" onClick={onCerrar}>Cerrar</Boton>
          </>
        )}
      />
      {resultado && (
        <ModalResultado r={resultado} onCerrar={() => setResultado(null)} />
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
    </>
  );
}

function FilaMov({ f, pend, agrupar, nuevoDia, elegida, alElegir, alDetalle }: {
  f: FilaCal; pend: number; agrupar: boolean; nuevoDia: boolean; elegida: boolean; alElegir: () => void; alDetalle: (el: HTMLElement) => void;
}) {
  return (
    <tr>
      <td data-label="">
        {(pend > 0 || marcasPorRevisar(f).length > 0) && (
          <label className="ca-check"><input type="checkbox" checked={elegida} onChange={alElegir} aria-label={`Elegir ${f.nombre} del ${f.fecha}`} /></label>
        )}
      </td>
      <td data-label="Persona" className="as-nombre">{f.nombre}<small className="as-nota">{nombreRol(f.rol)}</small></td>
      {agrupar && <td data-label="Día" className={`as-num${nuevoDia ? ' ca-nuevo-dia' : ''}`}>{etiquetaDia(f.fecha)}</td>}
      <td data-label="Turno" className="as-num ca-col-sec">{f.turno ? `${f.turno.entrada}-${f.turno.salida}` : '—'}</td>
      <td data-label="Entrada" className="as-num">{f.entrada ?? '—'}</td>
      <td data-label="Sal. almorzar" className="as-num ca-col-sec">{f.almuerzoSalida ?? '—'}</td>
      <td data-label="Vuelta" className="as-num ca-col-sec">{f.almuerzoVuelta ?? '—'}</td>
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
        <Boton type="button" variante="secundario" tamano="pequeno" aria-label={`Detalle de ${f.nombre} del ${f.fecha}`} data-detalle-clave={clave(f)} onClick={(e) => alDetalle(e.currentTarget)}>Ver detalle</Boton>
      </td>
    </tr>
  );
}

/** Resultado de la aprobación en lote: ventana encima del modal, con un renglón por ítem. */
function ModalResultado({ r, onCerrar }: { r: ResultadoLote; onCerrar: () => void }) {
  return (
    <ModalConPestanas
      titulo={`Resultado: ${r.ok} de ${r.total}${r.fallidas ? ` (${r.fallidas} no se pudieron procesar)` : ''}`}
      pestanas={[{
        id: 'r', etiqueta: 'Detalle',
        contenido: (
          <section aria-label="Resultado del lote">
            <ul className="cr-resultado cr-alertas">
              {r.resultados.map((x) => <li key={`${x.tipo}${x.id}`} className={x.ok ? 'ok' : 'mal'}>{x.tipo === 'MARCA' ? 'Marca' : 'Solicitud'} #{x.id}: {x.ok ? 'listo' : x.mensaje}</li>)}
            </ul>
          </section>
        ),
      }]}
      alCerrar={onCerrar}
      ancho={560}
      pie={<Boton type="button" onClick={onCerrar}>Cerrar resultado</Boton>}
    />
  );
}
