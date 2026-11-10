import { useCallback, useEffect, useMemo, useState } from 'react';
import { obtenerBlobAutenticado } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { Insignia, type VarianteInsignia } from '../../comun/Insignia';
import { ETIQUETA_ESTADO, TipoMarca, revisarMarca } from './asistenciaApi';
import {
  CronoDia,
  CronoMarca,
  CronoPersona,
  Cronograma,
  ETIQUETA_ROL,
  cronograma,
  horaDe,
  loteCorrecciones,
  reasignarMarca,
  separarMarca,
} from './correccionesApi';
import { jornadaActual, useUltimaPeticion } from './jornada';
import './cronograma.css';

type Avisar = (m: string | null) => void;
const mensajeDe = (e: unknown, fallback: string) => (e as any)?.mensaje ?? (e as any)?.message ?? fallback;
const NOMBRE_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const VARIANTE_ESTADO: Record<string, VarianteInsignia> = {
  CUMPLIO: 'exito', TARDANZA: 'aviso', SALIO_ANTES: 'aviso', SALIO_DESPUES: 'neutro',
  FALTA: 'peligro', INCOMPLETO: 'peligro', A_REVISAR: 'acento', DESCANSO: 'neutro', SIN_EVALUAR: 'neutro',
};
const ETIQUETA_ORIGEN: Record<string, string> = { CELULAR: 'QR en el celular', WEB: 'Usuario y contraseña', CORRECCION: 'Corrección del admin' };

const sumarDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const rangoMes = (anio: number, mes: number) => {
  const dias = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const mm = String(mes).padStart(2, '0');
  return { desde: `${anio}-${mm}-01`, hasta: `${anio}-${mm}-${String(dias).padStart(2, '0')}` };
};
const etiquetaDia = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${DIAS_CORTOS[(d.getUTCDay() + 6) % 7]} ${d.getUTCDate()} de ${NOMBRE_MES[d.getUTCMonth()]}`;
};

/** Resumen del día para el calendario, a partir de las personas ya filtradas. */
function resumenDe(personas: CronoPersona[], jornada: string) {
  const r = { total: 0, cumplieron: 0, tardanzas: 0, aRevisar: 0, faltas: 0, solicitudes: 0 };
  for (const p of personas) {
    const d = p.dias.find((x) => x.jornada === jornada);
    if (!d) continue;
    r.solicitudes += d.solicitudes.length;
    if (d.estado === 'DESCANSO') continue;
    r.total++;
    if (['CUMPLIO', 'SALIO_ANTES', 'SALIO_DESPUES'].includes(d.estado)) r.cumplieron++;
    if (d.estado === 'TARDANZA') r.tardanzas++;
    if (['A_REVISAR', 'INCOMPLETO'].includes(d.estado) || d.marcas.some((m) => m.estado === 'A_REVISAR')) r.aRevisar++;
    if (d.estado === 'FALTA') r.faltas++;
  }
  return r;
}

/** Cronograma de asistencia (ADMIN): calendario del mes y línea de tiempo por persona con el horario, las marcas y las solicitudes. */
export function CronogramaTab({ onError, onOk }: { onError: Avisar; onOk: Avisar }) {
  const [dia, setDia] = useState(() => jornadaActual());
  const [vista, setVista] = useState<'dia' | 'mes'>('dia');
  const [data, setData] = useState<Cronograma | null>(null);
  const [persona, setPersona] = useState('');
  const [rol, setRol] = useState('');
  const mesActual = dia.slice(0, 7);

  const nueva = useUltimaPeticion();
  const cargar = useCallback(async () => {
    const [a, m] = mesActual.split('-').map(Number);
    const { desde, hasta } = rangoMes(a, m);
    const vigente = nueva();
    try {
      const r = await cronograma(desde, hasta);
      if (!vigente()) return;
      setData(r);
      onError(null);
    } catch (e) {
      if (vigente()) onError(mensajeDe(e, 'No pudimos cargar el cronograma.'));
    }
  }, [mesActual, onError, nueva]);
  useEffect(() => { setData(null); void cargar(); }, [cargar]);
  // Si la persona o el rol elegidos no existen en el mes nuevo, se limpian (el select y la lista no se desfasan)
  useEffect(() => {
    if (!data) return;
    if (persona && !data.personas.some((p) => String(p.partyId) === persona)) setPersona('');
    if (rol && !data.personas.some((p) => p.roles.includes(rol))) setRol('');
  }, [data, persona, rol]);

  const personas = useMemo(
    () => (data?.personas ?? []).filter((p) => (!persona || String(p.partyId) === persona) && (!rol || p.roles.includes(rol))),
    [data, persona, rol],
  );
  const roles = useMemo(() => [...new Set((data?.personas ?? []).flatMap((p) => p.roles))].sort(), [data]);

  const mover = (n: number) => setDia((d) => sumarDias(d, n));
  const moverMes = (n: number) => {
    const [a, m] = mesActual.split('-').map(Number);
    const f = new Date(Date.UTC(a, m - 1 + n, 1));
    setDia(f.toISOString().slice(0, 10));
  };

  return (
    <div className="cr-vista">
      <div className="cr-barra" role="group" aria-label="Navegación del cronograma">
        <div className="cr-grupo">
          <Boton type="button" variante={vista === 'dia' ? 'primario' : 'secundario'} onClick={() => setVista('dia')}>Día</Boton>
          <Boton type="button" variante={vista === 'mes' ? 'primario' : 'secundario'} onClick={() => setVista('mes')}>Mes</Boton>
        </div>
        <div className="cr-grupo">
          <Boton type="button" variante="secundario" aria-label="Mes anterior" onClick={() => moverMes(-1)}>« Mes</Boton>
          <Boton type="button" variante="secundario" aria-label="Semana anterior" onClick={() => mover(-7)}>‹ Semana</Boton>
          <Boton type="button" variante="secundario" aria-label="Día anterior" onClick={() => mover(-1)}>‹ Día</Boton>
          <input type="date" aria-label="Elegir día" value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} />
          <Boton type="button" variante="secundario" aria-label="Día siguiente" onClick={() => mover(1)}>Día ›</Boton>
          <Boton type="button" variante="secundario" aria-label="Semana siguiente" onClick={() => mover(7)}>Semana ›</Boton>
          <Boton type="button" variante="secundario" aria-label="Mes siguiente" onClick={() => moverMes(1)}>Mes »</Boton>
          <Boton type="button" variante="texto" onClick={() => setDia(jornadaActual())}>Hoy</Boton>
        </div>
        <div className="cr-grupo">
          <label className="as-campo">Persona
            <select value={persona} onChange={(e) => setPersona(e.target.value)}>
              <option value="">Todas</option>
              {(data?.personas ?? []).map((p) => <option key={p.partyId} value={p.partyId}>{p.nombre}</option>)}
            </select>
          </label>
          <label className="as-campo">Rol
            <select value={rol} onChange={(e) => setRol(e.target.value)}>
              <option value="">Todos</option>
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        </div>
      </div>

      {!data ? <Cargando mensaje="Cargando cronograma" /> : vista === 'mes' ? (
        <Calendario
          anio={Number(mesActual.slice(0, 4))}
          mes={Number(mesActual.slice(5))}
          personas={personas}
          seleccionado={dia}
          alElegir={(j) => { setDia(j); setVista('dia'); }}
        />
      ) : (
        <VistaDia personas={personas} jornada={dia} onError={onError} onOk={onOk} recargar={cargar} />
      )}
    </div>
  );
}

function Calendario({ anio, mes, personas, seleccionado, alElegir }: { anio: number; mes: number; personas: CronoPersona[]; seleccionado: string; alElegir: (j: string) => void }) {
  const { desde, hasta } = rangoMes(anio, mes);
  const huecos = (new Date(`${desde}T00:00:00Z`).getUTCDay() + 6) % 7; // lunes = 0
  const dias: string[] = [];
  for (let j = desde; j <= hasta; j = sumarDias(j, 1)) dias.push(j);
  return (
    <section aria-label={`Calendario de ${NOMBRE_MES[mes - 1]} ${anio}`}>
      <h3 className="as-sub">{NOMBRE_MES[mes - 1]} {anio}</h3>
      <div className="cr-cal" role="grid">
        {DIAS_CORTOS.map((d) => <div key={d} className="cr-cal-cab" role="columnheader">{d}</div>)}
        {Array.from({ length: huecos }).map((_, i) => <div key={`h${i}`} role="gridcell" aria-hidden />)}
        {dias.map((j) => {
          const r = resumenDe(personas, j);
          const tono = r.faltas ? 'falta' : r.aRevisar ? 'revisar' : r.tardanzas ? 'tarde' : r.total ? 'ok' : 'vacio';
          const texto = r.total === 0 && r.solicitudes === 0
            ? 'sin jornadas'
            : `${r.cumplieron} cumplieron, ${r.tardanzas} con tardanza, ${r.aRevisar} por revisar, ${r.faltas} faltas, ${r.solicitudes} solicitudes`;
          return (
            <button key={j} type="button" role="gridcell" className={`cr-celda cr-celda--${tono}`} aria-current={j === seleccionado ? 'date' : undefined} aria-label={`${etiquetaDia(j)}: ${texto}`} onClick={() => alElegir(j)}>
              <b>{Number(j.slice(8))}</b>
              {r.total > 0 && (
                <span className="cr-ind">
                  {r.cumplieron > 0 && <span title="Cumplieron">✓ {r.cumplieron}</span>}
                  {r.tardanzas > 0 && <span title="Con tardanza">⏱ {r.tardanzas}</span>}
                  {r.aRevisar > 0 && <span title="Por revisar">⚠ {r.aRevisar}</span>}
                  {r.faltas > 0 && <span title="Faltas">✗ {r.faltas}</span>}
                  {r.solicitudes > 0 && <span title="Solicitudes de corrección">✉ {r.solicitudes}</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="as-ayuda cr-leyenda">✓ cumplieron · ⏱ con tardanza · ⚠ marcas por revisar · ✗ faltas · ✉ solicitudes de corrección. Toca un día para ver la línea de tiempo.</p>
    </section>
  );
}

interface Seleccion { partyId: number; jornada: string; marcaId: number }

function VistaDia({ personas, jornada, onError, onOk, recargar }: { personas: CronoPersona[]; jornada: string; onError: Avisar; onOk: Avisar; recargar: () => Promise<void> }) {
  const [sel, setSel] = useState<Seleccion | null>(null);
  const filas = personas.map((p) => ({ p, d: p.dias.find((x) => x.jornada === jornada) })).filter((x): x is { p: CronoPersona; d: CronoDia } => Boolean(x.d));
  return (
    <section aria-label={`Línea de tiempo del ${etiquetaDia(jornada)}`}>
      <h3 className="as-sub">{etiquetaDia(jornada)}</h3>
      <p className="as-ayuda cr-leyenda">
        Franja clara = horario programado · barra llena = trabajo · barra rayada = break · ● marca · ◇ corrección del admin · ■ por revisar · ○ doble marca (tachada) · ┆ solicitud propuesta (punteada).
      </p>
      {filas.length === 0 ? (
        <EstadoVacio titulo="Sin jornadas ese día" descripcion="Nadie tenía horario ni marcas con los filtros elegidos." />
      ) : filas.map(({ p, d }) => (
        <LineaTiempo
          key={p.partyId}
          persona={p}
          dia={d}
          seleccionada={sel && sel.partyId === p.partyId && sel.jornada === d.jornada ? sel.marcaId : null}
          alElegir={(marcaId) => setSel(marcaId === null ? null : { partyId: p.partyId, jornada: d.jornada, marcaId })}
          onError={onError}
          onOk={onOk}
          recargar={async () => { setSel(null); await recargar(); }}
        />
      ))}
    </section>
  );
}

function LineaTiempo({ persona, dia, seleccionada, alElegir, onError, onOk, recargar }: {
  persona: CronoPersona; dia: CronoDia; seleccionada: number | null; alElegir: (id: number | null) => void; onError: Avisar; onOk: Avisar; recargar: () => Promise<void>;
}) {
  const puntos = [
    ...dia.marcas.map((m) => m.minutos),
    ...dia.solicitudes.flatMap((s) => s.items.map((i) => minutosDe(i.hora))),
    ...(dia.turno ? [dia.turno.entrada, dia.turno.salida] : []),
  ];
  const ini = Math.max(0, Math.floor(((puntos.length ? Math.min(...puntos) : 8 * 60) - 30) / 60) * 60);
  const fin = Math.min(28 * 60, Math.max(ini + 6 * 60, Math.ceil(((puntos.length ? Math.max(...puntos) : 20 * 60) + 30) / 60) * 60));
  const pct = (m: number) => `${Math.min(100, Math.max(0, ((m - ini) / (fin - ini)) * 100))}%`;
  const ancho = (a: number, b: number) => `${Math.max(0.5, ((Math.min(fin, b) - Math.max(ini, a)) / (fin - ini)) * 100)}%`;
  const horasEje: number[] = [];
  for (let h = ini; h <= fin; h += 60) horasEje.push(h);
  const marca = dia.marcas.find((m) => m.id === seleccionada) ?? null;
  const horaFinTramo = (t: { desde: number; hasta: number | null }) => t.hasta ?? Math.min(fin, t.desde + 30);

  return (
    <article className="cr-fila" aria-label={`${persona.nombre}, ${ETIQUETA_ESTADO[dia.estado] ?? dia.estado}`}>
      <header className="cr-fila-cab">
        <strong>{persona.nombre}</strong>
        <small>{persona.roles.join(' · ')}</small>
        <Insignia variante={VARIANTE_ESTADO[dia.estado] ?? 'neutro'}>{ETIQUETA_ESTADO[dia.estado] ?? dia.estado}</Insignia>
        {dia.turno && <small>Horario {horaDe(dia.turno.entrada)}–{horaDe(dia.turno.salida)}</small>}
        {dia.trabajadaMin > 0 && <small>Trabajó {(dia.trabajadaMin / 60).toFixed(2)} h</small>}
        {dia.tardanzaMin > 0 && <small>Tardanza {dia.tardanzaMin} min</small>}
      </header>
      <div className="cr-scroll">
        <div className="cr-pista" role="group" aria-label={`Línea de tiempo de ${persona.nombre}`}>
          {dia.turno && <div className="cr-turno" style={{ left: pct(dia.turno.entrada), width: ancho(dia.turno.entrada, dia.turno.salida) }} title={`Horario ${horaDe(dia.turno.entrada)}–${horaDe(dia.turno.salida)}`} />}
          {dia.tramos.map((t, i) => (
            <div
              key={i}
              className={`cr-tramo cr-tramo--${t.tipo === 'BREAK' ? 'break' : 'trabajo'}${t.hasta === null ? ' cr-tramo--abierto' : ''}`}
              style={{ left: pct(t.desde), width: ancho(t.desde, horaFinTramo(t)) }}
              title={`${t.tipo === 'BREAK' ? 'Break' : 'Trabajo'} ${horaDe(t.desde)}–${t.hasta === null ? 'en curso' : horaDe(t.hasta)}`}
            >
              <span>{t.tipo === 'BREAK' ? 'Break' : 'Trabajo'}</span>
            </div>
          ))}
          {dia.marcas.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`cr-punto${m.duplicada ? ' cr-punto--dup' : ''}${m.estado === 'A_REVISAR' ? ' cr-punto--rev' : ''}${m.origen === 'CORRECCION' ? ' cr-punto--corr' : ''}${seleccionada === m.id ? ' cr-punto--sel' : ''}`}
              style={{ left: pct(m.minutos) }}
              aria-pressed={seleccionada === m.id}
              aria-label={`${m.hora} ${m.rol ? ETIQUETA_ROL[m.rol] : 'marca'}${m.duplicada ? ' (doble marca, tachada)' : ''}, ${ETIQUETA_ORIGEN[m.origen ?? ''] ?? 'origen desconocido'}, ${m.estado === 'A_REVISAR' ? 'por revisar' : m.estado === 'APROBADA' ? 'aprobada' : 'válida'}`}
              title={`${m.hora} · ${m.rol ? ETIQUETA_ROL[m.rol] : 'marca'} · ${ETIQUETA_ORIGEN[m.origen ?? ''] ?? ''}`}
              onClick={() => alElegir(seleccionada === m.id ? null : m.id)}
            >
              <span className={`cr-hora${m.duplicada ? ' cr-hora--dup' : ''}`}>{m.hora}</span>
            </button>
          ))}
          {dia.solicitudes.flatMap((s) => s.items.map((i, n) => (
            <span key={`${s.id}-${n}`} className="cr-punto cr-punto--sol" style={{ left: pct(minutosDe(i.hora)) }} title={`Solicitud #${s.id}: ${i.hora} ${ETIQUETA_ROL[i.tipo]} (propuesta, no cuenta)`} role="img" aria-label={`Solicitud pendiente: ${i.hora} ${ETIQUETA_ROL[i.tipo]}`}>
              <span className="cr-hora">{i.hora}</span>
            </span>
          )))}
        </div>
        <div className="cr-eje" aria-hidden>
          {horasEje.map((h) => <span key={h} style={{ left: pct(h) }}>{horaDe(h)}</span>)}
        </div>
      </div>
      {(dia.alertas.length > 0 || dia.inconsistencia) && (
        <ul className="cr-alertas">
          {dia.alertas.map((a, i) => <li key={i}>⚠ {a}</li>)}
          {dia.inconsistencia?.sinSolicitud && <li>✉ Sin solicitud de corrección todavía: {dia.inconsistencia.texto}</li>}
        </ul>
      )}
      {dia.solicitudes.length > 0 && <SolicitudesDelDia dia={dia} onError={onError} onOk={onOk} recargar={recargar} />}
      {marca && <DetalleMarca marca={marca} dia={dia} onError={onError} onOk={onOk} recargar={recargar} />}
    </article>
  );
}

const minutosDe = (hora: string) => {
  const [h, m] = hora.split(':').map(Number);
  const hm = h * 60 + m;
  return hm < 240 ? hm + 1440 : hm;
};

function SolicitudesDelDia({ dia, onError, onOk, recargar }: { dia: CronoDia; onError: Avisar; onOk: Avisar; recargar: () => Promise<void> }) {
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const resolver = async (id: number, accion: 'APROBAR' | 'RECHAZAR') => {
    setOcupado(true);
    try {
      const r = await loteCorrecciones({ accion, motivo, items: [{ tipo: 'SOLICITUD', id }] });
      if (r.fallidas) throw { mensaje: r.resultados[0]?.mensaje ?? 'No se pudo resolver.' };
      onError(null);
      onOk(accion === 'APROBAR' ? 'Solicitud aprobada: se crearon las marcas.' : 'Solicitud rechazada.');
      await recargar();
    } catch (e) {
      onError(mensajeDe(e, 'No se pudo resolver la solicitud.'));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div className="cr-sols" aria-label="Solicitudes de corrección pendientes de este día">
      {dia.solicitudes.map((s) => (
        <div key={s.id} className="cr-sol">
          <span>✉ <b>Solicitud #{s.id}</b>: {s.items.map((i) => `${i.hora} ${ETIQUETA_ROL[i.tipo]}`).join(', ')} — «{s.motivo}»</span>
          <Boton type="button" tamano="pequeno" disabled={ocupado} onClick={() => void resolver(s.id, 'APROBAR')}>Aprobar</Boton>
          <Boton type="button" tamano="pequeno" variante="peligro" disabled={ocupado || motivo.trim().length < 10} onClick={() => void resolver(s.id, 'RECHAZAR')}>Rechazar</Boton>
        </div>
      ))}
      <input aria-label="Motivo para rechazar (mínimo 10 caracteres)" placeholder="Motivo para rechazar (mín. 10 caracteres)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
    </div>
  );
}

function DetalleMarca({ marca, dia, onError, onOk, recargar }: { marca: CronoMarca; dia: CronoDia; onError: Avisar; onOk: Avisar; recargar: () => Promise<void> }) {
  const [motivo, setMotivo] = useState('');
  const [nuevoRol, setNuevoRol] = useState<TipoMarca>(marca.rol ?? 'SALIDA');
  const [foto, setFoto] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const valido = motivo.trim().length >= 10;
  const hacer = async (fn: () => Promise<unknown>, ok: string) => {
    setOcupado(true);
    try {
      await fn();
      onError(null);
      onOk(ok);
      await recargar();
    } catch (e) {
      onError(mensajeDe(e, 'No se pudo completar la acción.'));
    } finally {
      setOcupado(false);
    }
  };
  const verFoto = async () => {
    try {
      setFoto(await obtenerBlobAutenticado(`/admin/asistencia/marcas/${marca.id}/selfie`));
    } catch (e) {
      onError(mensajeDe(e, 'La foto ya no está disponible.'));
    }
  };
  return (
    <div className="cr-detalle" role="region" aria-label={`Detalle de la marca de las ${marca.hora}`}>
      <dl>
        <div><dt>Hora exacta</dt><dd>{marca.momento ? new Date(marca.momento).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour12: false }) : marca.hora}</dd></div>
        <div><dt>Interpretada como</dt><dd>{marca.rol ? ETIQUETA_ROL[marca.rol] : 'sin rol'}{marca.duplicada ? ' (doble marca: no cuenta)' : ''}</dd></div>
        <div><dt>Origen</dt><dd>{ETIQUETA_ORIGEN[marca.origen ?? ''] ?? '—'}</dd></div>
        <div><dt>Estado</dt><dd>{marca.estado === 'A_REVISAR' ? 'Por revisar' : marca.estado === 'APROBADA' ? 'Aprobada' : 'Válida'}</dd></div>
        {(marca.alertas || marca.motivo) && <div><dt>Notas</dt><dd>{marca.alertas ?? marca.motivo}</dd></div>}
      </dl>
      {marca.tieneSelfie && <Boton type="button" variante="secundario" onClick={() => void verFoto()}>Ver selfie</Boton>}
      {foto && <img src={foto} alt={`Selfie de la marca de las ${marca.hora}`} className="as-selfie" style={{ maxWidth: 160 }} />}
      <label className="as-campo">Motivo (mínimo 10 caracteres)
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} />
      </label>
      <div className="cr-acciones">
        {marca.estado === 'A_REVISAR' && <Boton type="button" tamano="pequeno" disabled={!valido || ocupado} onClick={() => void hacer(() => revisarMarca(marca.id, 'aprobar', motivo.trim()), 'Marca aprobada.')}>Aprobar</Boton>}
        {marca.duplicada && marca.estado === 'VALIDA' && <Boton type="button" tamano="pequeno" disabled={!valido || ocupado} onClick={() => void hacer(() => separarMarca(marca.id, motivo.trim()), 'Marca separada: cuenta como marca propia.')}>Separar (marca propia)</Boton>}
        <Boton type="button" tamano="pequeno" variante="peligro" disabled={!valido || ocupado} onClick={() => void hacer(() => revisarMarca(marca.id, 'anular', motivo.trim()), 'Marca anulada: ya no cuenta. El registro se conserva.')}>Anular</Boton>
        <label className="as-campo cr-rol">Cambiar rol a
          <select value={nuevoRol} onChange={(e) => setNuevoRol(e.target.value as TipoMarca)}>
            {(Object.keys(ETIQUETA_ROL) as TipoMarca[]).map((t) => <option key={t} value={t}>{ETIQUETA_ROL[t]}</option>)}
          </select>
        </label>
        <Boton type="button" tamano="pequeno" variante="secundario" disabled={!valido || ocupado || marca.rol === nuevoRol} onClick={() => void hacer(() => reasignarMarca(marca.id, nuevoRol, motivo.trim()), 'Rol reasignado (la marca original queda anulada y se crea una corrección).')}>Reasignar</Boton>
      </div>
      <small className="as-ayuda">Para agregar una marca que falta, usa «Marcas y selfies» › corrección manual o pide a la persona que envíe su solicitud ({dia.jornada}).</small>
    </div>
  );
}
