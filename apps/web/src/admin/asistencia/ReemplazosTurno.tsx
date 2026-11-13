import { useCallback, useEffect, useMemo, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia, type VarianteInsignia } from '../../comun/Insignia';
import { ModalPorPasos } from '../../comun/ModalPorPasos';
import { useSesion } from '../../comun/sesion';
import { jornadaActual } from './jornada';
import { miCalendario } from './miCalendarioApi';
import { PorAprobarTurnos } from './PorAprobarTurnos';
import {
  aceptarTurno, cancelarTurno, candidatosTurno, crearTurno, ETIQUETA_ESTADO_TURNO, misTurnos, rechazarTurno, turnosParaDevolver,
  type Candidato, type Candidatos, type EstadoTurno, type SolicitudTurno, type TipoTurno, type TurnoDevolver,
} from './turnosApi';
import './turnos.css';

const mensajeDe = (e: unknown, f: string) => (e as any)?.mensaje ?? (e as any)?.message ?? f;
const VARIANTE: Record<EstadoTurno, VarianteInsignia> = {
  PENDIENTE_ACEPTA: 'aviso', PENDIENTE_APRUEBA: 'aviso', APROBADA: 'exito', RECHAZADA: 'peligro', CANCELADA: 'neutro', VENCIDA: 'neutro', SIN_MARCA: 'peligro',
};
const ACTIVA = (e: EstadoTurno) => e === 'PENDIENTE_ACEPTA' || e === 'PENDIENTE_APRUEBA';
const MAX_DIAS = 30;
const sumarDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

function usarPuedeAprobar(): boolean {
  try { return useSesion().tiene('asistencia/aprobar_reemplazos'); } catch { return false; }
}

// ---------------------------------------------------------------------------
// Pasos del asistente
// ---------------------------------------------------------------------------

interface Datos {
  tipo: TipoTurno; fecha: string; desde: string; hasta: string; motivo: string;
  elegido: Candidato | null; devolver: TurnoDevolver | null;
}

function PasoQue({ d, cambiar, aviso }: { d: Datos; cambiar: (p: Partial<Datos>) => void; aviso: string | null }) {
  const hoy = jornadaActual();
  return (
    <div className="tu-form">
      <fieldset className="tu-opciones">
        <legend className="as-sub">¿Qué necesitas?</legend>
        <label className="tu-opcion">
          <input type="radio" name="tipo-turno" checked={d.tipo === 'REEMPLAZO'} onChange={() => cambiar({ tipo: 'REEMPLAZO', elegido: null, devolver: null })} />
          <span><b>Que alguien me cubra</b><small>Otra persona hace mi turno ese día y yo no voy.</small></span>
        </label>
        <label className="tu-opcion">
          <input type="radio" name="tipo-turno" checked={d.tipo === 'CAMBIO_TURNO'} onChange={() => cambiar({ tipo: 'CAMBIO_TURNO', devolver: null })} />
          <span><b>Cambiar de turno</b><small>Yo hago el turno de la otra persona y ella hace el mío.</small></span>
        </label>
      </fieldset>
      <label className="as-campo">Día de mi turno
        <input type="date" value={d.fecha} min={hoy} max={sumarDias(hoy, MAX_DIAS)} onChange={(e) => cambiar({ fecha: e.target.value, elegido: null, devolver: null })} />
      </label>
      {aviso && <div role="status" className="as-aviso as-aviso--alerta">{aviso}</div>}
      <div className="tu-horas">
        <label className="as-campo">Desde
          <input type="time" value={d.desde} onChange={(e) => cambiar({ desde: e.target.value, elegido: null, devolver: null })} />
        </label>
        <label className="as-campo">Hasta
          <input type="time" value={d.hasta} onChange={(e) => cambiar({ hasta: e.target.value, elegido: null, devolver: null })} />
        </label>
      </div>
      <small>Puedes pedir solo una parte: desde el inicio de tu turno o hasta el final.</small>
      <label className="as-campo">Motivo
        <input value={d.motivo} maxLength={300} onChange={(e) => cambiar({ motivo: e.target.value })} placeholder="Ej.: cita médica" />
      </label>
    </div>
  );
}

function PasoQuien({ d, cambiar }: { d: Datos; cambiar: (p: Partial<Datos>) => void }) {
  const [res, setRes] = useState<Candidatos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buscar, setBuscar] = useState('');
  const [turnos, setTurnos] = useState<TurnoDevolver[] | null>(null);

  useEffect(() => {
    let vigente = true;
    candidatosTurno(d.fecha, d.desde, d.hasta)
      .then((r) => vigente && setRes(r))
      .catch((e) => vigente && setError(mensajeDe(e, 'No pudimos buscar personas.')));
    return () => { vigente = false; };
  }, [d.fecha, d.desde, d.hasta]);

  const partyElegido = d.elegido?.partyId;
  useEffect(() => {
    if (d.tipo !== 'CAMBIO_TURNO' || partyElegido === undefined) { setTurnos(null); return; }
    let vigente = true;
    setTurnos(null);
    turnosParaDevolver(partyElegido)
      .then((t) => vigente && setTurnos(t))
      .catch((e) => vigente && setError(mensajeDe(e, 'No pudimos cargar sus turnos.')));
    return () => { vigente = false; };
  }, [d.tipo, partyElegido]);

  const lista = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return (res?.candidatos ?? []).filter((c) => !q || c.nombre.toLowerCase().includes(q));
  }, [res, buscar]);

  if (error) return <div role="alert" className="as-aviso as-aviso--error">{error}</div>;
  if (!res) return <p aria-live="polite">Buscando personas disponibles…</p>;
  if (res.aviso) return <div role="alert" className="as-aviso as-aviso--alerta">{res.aviso}. Vuelve atrás y revisa el día y las horas.</div>;
  if (res.candidatos.length === 0) {
    return (
      <div data-testid="sin-candidatos" className="tu-form">
        <div role="status" className="as-aviso as-aviso--alerta"><b>Nadie está disponible para ese horario.</b></div>
        {res.descartados.length > 0 && (
          <ul aria-label="Por qué nadie está disponible">
            {res.descartados.map((x) => <li key={x.motivo}>{x.motivo}: {x.cantidad} {x.cantidad === 1 ? 'persona' : 'personas'}</li>)}
          </ul>
        )}
        <small>Prueba con otro día u otras horas, o avisa a Supervisión.</small>
      </div>
    );
  }
  return (
    <div className="tu-form">
      <label className="as-campo">Buscar por nombre
        <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      </label>
      <fieldset className="tu-opciones">
        <legend className="as-sub">Personas disponibles</legend>
        {lista.length === 0 && <p className="tu-vacio">Nadie coincide con esa búsqueda.</p>}
        {lista.map((c) => (
          <label key={c.partyId} className="tu-opcion">
            <input type="radio" name="quien-turno" checked={d.elegido?.partyId === c.partyId} onChange={() => cambiar({ elegido: c, devolver: null })} />
            <span>
              <b>{c.nombre}</b>
              <span className="tu-chips">{c.motivos.map((m) => <Insignia key={m} variante="exito">{m}</Insignia>)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {d.tipo === 'CAMBIO_TURNO' && d.elegido && (
        <fieldset className="tu-opciones">
          <legend className="as-sub">Turno de {d.elegido.nombre} que tú harás a cambio</legend>
          {turnos === null && <p aria-live="polite">Cargando sus turnos…</p>}
          {turnos?.length === 0 && <div role="status" className="as-aviso as-aviso--alerta">No tiene turnos próximos en los que tú estés libre.</div>}
          {turnos?.map((t) => (
            <label key={`${t.fecha}${t.desde}`} className="tu-opcion">
              <input type="radio" name="devolver-turno" checked={d.devolver?.fecha === t.fecha} onChange={() => cambiar({ devolver: t })} />
              <span><b>{t.etiqueta}</b><small>{t.desde} a {t.hasta}</small></span>
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}

function Resumen({ d }: { d: Datos }) {
  return (
    <dl className="tu-resumen" aria-label="Resumen del pedido">
      <dt>Pedido</dt><dd>{d.tipo === 'CAMBIO_TURNO' ? 'Cambio de turno' : 'Reemplazo'}</dd>
      <dt>Mi turno</dt><dd>{d.fecha} · {d.desde} a {d.hasta}</dd>
      <dt>Persona</dt><dd>{d.elegido?.nombre}</dd>
      {d.devolver && <><dt>Yo haré</dt><dd>{d.devolver.etiqueta} ({d.devolver.fecha}) · {d.devolver.desde} a {d.devolver.hasta}</dd></>}
      <dt>Motivo</dt><dd>{d.motivo}</dd>
    </dl>
  );
}

function PedirTurno({ alCerrar, alEnviado }: { alCerrar: () => void; alEnviado: () => void }) {
  const [d, setD] = useState<Datos>({ tipo: 'REEMPLAZO', fecha: '', desde: '', hasta: '', motivo: '', elegido: null, devolver: null });
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cambiar = useCallback((p: Partial<Datos>) => setD((x) => ({ ...x, ...p })), []);

  // Al elegir el día se propone mi turno de ese día (editable)
  useEffect(() => {
    if (!d.fecha) return;
    let vigente = true;
    setAviso(null);
    miCalendario(d.fecha, d.fecha)
      .then((c) => {
        if (!vigente) return;
        const p = c.dias.find((x) => x.fecha === d.fecha)?.programado;
        if (p) { cambiar({ desde: p.entrada, hasta: p.salida }); setAviso(`Tu turno ese día: ${p.entrada} a ${p.salida}.`); }
        else setAviso('Ese día no tienes turno programado.');
      })
      .catch(() => undefined);
    return () => { vigente = false; };
  }, [d.fecha, cambiar]);

  const hoy = jornadaActual();
  const validarQue = () => {
    if (!d.fecha) return 'Elige el día de tu turno';
    if (d.fecha < hoy) return 'Ese día ya pasó';
    if (d.fecha > sumarDias(hoy, MAX_DIAS)) return `Solo puedes pedir hasta ${MAX_DIAS} días adelante`;
    if (!d.desde || !d.hasta) return 'Escribe desde qué hora y hasta qué hora';
    if (d.desde === d.hasta) return 'La hora de inicio y la de fin no pueden ser iguales';
    if (d.motivo.trim().length < 5) return 'Escribe el motivo (mínimo 5 letras)';
    return null;
  };
  const validarQuien = () => {
    if (!d.elegido) return 'Elige a la persona';
    if (d.tipo === 'CAMBIO_TURNO' && !d.devolver) return 'Elige el turno que tú harás a cambio';
    return null;
  };

  const enviar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await crearTurno({
        tipo: d.tipo, reemplazoPartyId: d.elegido!.partyId, fecha: d.fecha, desde: d.desde, hasta: d.hasta, motivo: d.motivo.trim(),
        ...(d.tipo === 'CAMBIO_TURNO' && d.devolver ? { fechaDevolucion: d.devolver.fecha, desdeDevolucion: d.devolver.desde, hastaDevolucion: d.devolver.hasta } : {}),
      });
      setConfirmando(false);
      alEnviado();
    } catch (e) {
      setError(mensajeDe(e, 'No se pudo enviar el pedido.'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <ModalPorPasos
        titulo="Pedir reemplazo o cambio de turno"
        pasos={[
          { id: 'que', titulo: '¿Qué y cuándo?', contenido: <PasoQue d={d} cambiar={cambiar} aviso={aviso} />, validar: validarQue },
          { id: 'quien', titulo: '¿Quién?', contenido: <PasoQuien d={d} cambiar={cambiar} />, validar: validarQuien },
        ]}
        resumen={<Resumen d={d} />}
        textoFinalizar="Enviar pedido"
        alCerrar={alCerrar}
        alFinalizar={() => { setError(null); setConfirmando(true); }}
      />
      <Confirmar
        abierto={confirmando}
        titulo="¿Enviar el pedido?"
        mensaje={`${d.elegido?.nombre ?? 'La persona'} recibirá el aviso y, si acepta, Supervisión lo aprobará.`}
        textoSi="Sí, enviar"
        textoNo="No"
        cargando={enviando}
        error={error}
        alConfirmar={enviar}
        alCancelar={() => setConfirmando(false)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Sección de Mi asistencia
// ---------------------------------------------------------------------------

type Accion = { tipo: 'aceptar' | 'rechazar' | 'cancelar'; s: SolicitudTurno };
const TEXTO_ACCION: Record<Accion['tipo'], { titulo: string; si: string; ok: string; peligro: boolean }> = {
  aceptar: { titulo: '¿Aceptar cubrir este turno?', si: 'Sí, acepto', ok: 'Aceptaste. Ahora lo aprueba Supervisión.', peligro: false },
  rechazar: { titulo: '¿Rechazar este pedido?', si: 'Sí, rechazar', ok: 'Pedido rechazado.', peligro: true },
  cancelar: { titulo: '¿Cancelar tu pedido?', si: 'Sí, cancelar', ok: 'Pedido cancelado.', peligro: true },
};

const detalle = (s: SolicitudTurno) =>
  `${s.etiqueta} · ${s.desde} a ${s.hasta}${s.devolucion ? ` — a cambio, ${s.devolucion.etiqueta} · ${s.devolucion.desde} a ${s.devolucion.hasta}` : ''}`;

export function ReemplazosTurno() {
  const puedeAprobar = usarPuedeAprobar();
  const [lista, setLista] = useState<SolicitudTurno[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pidiendo, setPidiendo] = useState(false);
  const [accion, setAccion] = useState<Accion | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setLista(await misTurnos());
      setError(null);
    } catch (e) {
      setError(mensajeDe(e, 'No pudimos cargar tus pedidos de turno.'));
    }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const ejecutar = async () => {
    if (!accion) return;
    setOcupado(true);
    setErrorAccion(null);
    try {
      const f = { aceptar: aceptarTurno, rechazar: rechazarTurno, cancelar: cancelarTurno }[accion.tipo];
      await f(accion.s.id);
      setOk(TEXTO_ACCION[accion.tipo].ok);
      setAccion(null);
      await cargar();
    } catch (e) {
      setErrorAccion(mensajeDe(e, 'No se pudo completar.'));
      void cargar();
    } finally {
      setOcupado(false);
    }
  };

  const meCubren = (lista ?? []).filter((s) => s.soyYoSolicitante);
  const teRuegan = (lista ?? []).filter((s) => !s.soyYoSolicitante && s.estado === 'PENDIENTE_ACEPTA');
  const otros = (lista ?? []).filter((s) => !s.soyYoSolicitante && s.estado !== 'PENDIENTE_ACEPTA');

  return (
    <section className="tu-seccion" aria-label="Reemplazos y cambios de turno">
      {error && <div role="alert" className="as-aviso as-aviso--error">{error}</div>}
      {ok && <div role="status" className="as-aviso as-aviso--ok">{ok}</div>}
      <Boton type="button" onClick={() => { setOk(null); setPidiendo(true); }}>Pedir reemplazo o cambio de turno</Boton>

      {teRuegan.length > 0 && (
        <div className="tu-seccion" role="region" aria-label="Te piden cubrir">
          <h3 className="as-sub">Te piden cubrir…</h3>
          {teRuegan.map((s) => (
            <article key={s.id} className="ma-card tu-card">
              <b>{s.solicitante.nombre} {s.tipo === 'CAMBIO_TURNO' ? 'te propone cambiar un turno' : 'te pide cubrir su turno'}</b>
              <div>{detalle(s)}</div>
              <small>Área: {s.area} · Motivo: «{s.motivo}»</small>
              <div className="tu-acciones">
                <Boton type="button" onClick={() => { setErrorAccion(null); setAccion({ tipo: 'aceptar', s }); }}>Aceptar</Boton>
                <Boton type="button" variante="peligro" onClick={() => { setErrorAccion(null); setAccion({ tipo: 'rechazar', s }); }}>Rechazar</Boton>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="tu-seccion" role="region" aria-label="Mis pedidos de turno">
        <h3 className="as-sub">Mis pedidos</h3>
        {lista && meCubren.length === 0 && <p className="tu-vacio">Todavía no pediste ningún reemplazo ni cambio.</p>}
        {meCubren.map((s) => (
          <div key={s.id} className="ma-item">
            <span>
              <b>{s.tipo === 'CAMBIO_TURNO' ? 'Cambio con' : 'Te cubre'} {s.reemplazo.nombre}</b>
              <small>{detalle(s)}</small>
              {s.motivoResolucion && <small>Respuesta: {s.motivoResolucion}</small>}
            </span>
            <Insignia variante={VARIANTE[s.estado]}>{ETIQUETA_ESTADO_TURNO[s.estado]}</Insignia>
            {ACTIVA(s.estado) && <Boton type="button" variante="texto" onClick={() => { setErrorAccion(null); setAccion({ tipo: 'cancelar', s }); }}>Cancelar pedido</Boton>}
          </div>
        ))}
      </div>

      {otros.length > 0 && (
        <div className="tu-seccion" role="region" aria-label="Turnos que cubro">
          <h3 className="as-sub">Turnos que cubro</h3>
          {otros.map((s) => (
            <div key={s.id} className="ma-item">
              <span><b>Cubres a {s.solicitante.nombre}</b><small>{detalle(s)}</small></span>
              <Insignia variante={VARIANTE[s.estado]}>{ETIQUETA_ESTADO_TURNO[s.estado]}</Insignia>
            </div>
          ))}
        </div>
      )}

      {puedeAprobar && <PorAprobarTurnos />}

      {pidiendo && <PedirTurno alCerrar={() => setPidiendo(false)} alEnviado={() => { setPidiendo(false); setOk('Pedido enviado. Te avisamos cuando respondan.'); void cargar(); }} />}
      <Confirmar
        abierto={accion !== null}
        titulo={accion ? TEXTO_ACCION[accion.tipo].titulo : ''}
        mensaje={accion ? detalle(accion.s) : ''}
        textoSi={accion ? TEXTO_ACCION[accion.tipo].si : 'Sí'}
        textoNo="No"
        peligro={accion ? TEXTO_ACCION[accion.tipo].peligro : false}
        cargando={ocupado}
        error={errorAccion}
        alConfirmar={ejecutar}
        alCancelar={() => setAccion(null)}
      />
    </section>
  );
}
