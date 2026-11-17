import { useCallback, useEffect, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { Insignia } from '../../comun/Insignia';
import { type PestanaModal } from '../../comun/ModalConPestanas';
import { ETIQUETA_ESTADO, ETIQUETA_TIPO, TipoMarca, corregirMarca } from './asistenciaApi';
import { type FilaCal } from './calendarioApi';
import { Cronograma, ajustarDia, cronograma } from './correccionesApi';
import { SolicitudesDelDia, etiquetaDia, sumarDias } from './CronogramaTab';
import { TarjetasMarcas } from './TarjetasMarcas';
import { DetallePlanilla, detallePlanilla, soles } from './planillaApi';

type Avisar = (m: string | null) => void;
const mensajeDe = (e: unknown, fallback: string) => (e as any)?.mensaje ?? (e as any)?.message ?? fallback;
const hh = (min: number) => (min ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min` : '—');

/**
 * Detalle de UNA persona en UN día. NO es un modal: devuelve el título, el subtítulo y las pestañas
 * (Resumen · Marcas · Solicitudes · Pago del período) para que el MISMO modal del día los muestre en su lugar.
 * Sin `fila` no pide nada (el modal está en la vista del día).
 */
export function useDetalleDia(fila: FilaCal | null, { onCambio, onError, onOk }: { onCambio: () => void; onError: Avisar; onOk: Avisar }) {
  const [data, setData] = useState<Cronograma | null>(null);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState(false);
  const fecha = fila?.fecha;
  const cargar = useCallback(async () => {
    if (!fecha) return;
    try {
      setData(await cronograma(fecha, fecha));
      setFallo(false);
    } catch (e) {
      setFallo(true);
      onError(mensajeDe(e, 'No pudimos cargar el detalle del día.'));
    } finally {
      setCargando(false);
    }
  }, [fecha, onError]);
  useEffect(() => { if (fecha) { setCargando(true); void cargar(); } }, [fecha, cargar]);
  if (!fila) return null;
  const persona = data?.personas.find((p) => String(p.partyId) === fila.partyId);
  const dia = persona?.dias.find((d) => d.jornada === fila.fecha) ?? null;
  const recargar = async () => { await cargar(); onCambio(); };
  const pendientes = dia?.solicitudes.length ?? fila.solicitudes.filter((s) => s.estado === 'PENDIENTE').length;

  const pestanas: PestanaModal[] = [
    { id: 'resumen', etiqueta: 'Resumen', contenido: <ResumenDia fila={fila} /> },
    {
      id: 'marcas', etiqueta: 'Marcas', insignia: fila.marcas.length || null,
      contenido: (
        <div className="ca-detalle-sec">
          <TarjetasMarcas fila={fila} dia={dia} cargando={cargando} error={fallo || (!cargando && !dia)} reintentar={() => { setCargando(true); void cargar(); }} onError={onError} onOk={onOk} recargar={recargar} />
          <AjustarIngresoSalida fila={fila} onCambio={recargar} onError={onError} onOk={onOk} />
          <CorreccionManual fila={fila} onCambio={recargar} onError={onError} onOk={onOk} />
        </div>
      ),
    },
    {
      id: 'solicitudes', etiqueta: 'Solicitudes', insignia: pendientes || null,
      contenido: cargando ? <Cargando mensaje="Cargando solicitudes" /> : (
        <div className="ca-detalle-sec">
          {fila.inconsistencias.length > 0 && <ul className="cr-alertas">{fila.inconsistencias.map((t, i) => <li key={i}>⚠ {t}</li>)}</ul>}
          {dia && dia.solicitudes.length > 0
            ? <SolicitudesDelDia dia={dia} onError={onError} onOk={onOk} recargar={recargar} />
            : <p className="as-ayuda">No hay solicitudes de corrección pendientes este día.</p>}
        </div>
      ),
    },
    { id: 'pago', etiqueta: 'Pago del período', persistente: false, contenido: <PagoDelPeriodo partyId={Number(fila.partyId)} fecha={fila.fecha} /> },
  ];
  return {
    titulo: `${fila.nombre} · ${etiquetaDia(fila.fecha)}`,
    subtitulo: <>{fila.rol}{fila.turno ? ` · Horario ${fila.turno.entrada}–${fila.turno.salida}` : ' · Sin horario'} <Insignia variante="neutro">{ETIQUETA_ESTADO[fila.estado] ?? fila.estado}</Insignia></>,
    pestanas,
  };
}

function ResumenDia({ fila }: { fila: FilaCal }) {
  const datos: Array<[string, string]> = [
    ['Horario', fila.turno ? `${fila.turno.entrada}–${fila.turno.salida}` : 'Sin horario'],
    ['Entrada', fila.entrada ?? '—'],
    ['Salida a almorzar', fila.almuerzoSalida ?? '—'],
    ['Vuelta del almuerzo', fila.almuerzoVuelta ?? '—'],
    ['Salida', fila.salida ?? '—'],
    ['Trabajado', hh(fila.trabajadaMin)],
    ['Tardanza', fila.tardanzaMin ? `${fila.tardanzaMin} min` : '—'],
    ['Extra', fila.extraMin ? `${fila.extraMin} min` : '—'],
    ['Estado', ETIQUETA_ESTADO[fila.estado] ?? fila.estado],
  ];
  return (
    <div className="ca-detalle-sec">
      <dl className="ca-resumen-dl">
        {datos.map(([t, v]) => <div key={t}><dt>{t}</dt><dd>{v}</dd></div>)}
      </dl>
      {fila.inconsistencias.length > 0 && <ul className="cr-alertas">{fila.inconsistencias.map((t, i) => <li key={i}>⚠ {t}</li>)}</ul>}
    </div>
  );
}

/** Cuánto lleva ganado y descontado en el período (semana o mes) de esa persona: sale de su planilla. */
function PagoDelPeriodo({ partyId, fecha }: { partyId: number; fecha: string }) {
  const [d, setD] = useState<DetallePlanilla | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    detallePlanilla(partyId, fecha, [])
      .then((r) => { if (vivo) setD(r); })
      .catch((e) => { if (vivo) setError(mensajeDe(e, 'No pudimos cargar su pago del período.')); });
    return () => { vivo = false; };
  }, [partyId, fecha]);
  if (error) return <p role="alert" className="as-ayuda">{error}</p>;
  if (!d) return <Cargando mensaje="Cargando su pago del período" />;
  const r = d.resultado;
  const penal = r.penalidadTardanza ?? 0;
  const filas: Array<[string, string, boolean?]> = [
    ['Ganado', soles(r.ganado)],
    ...(r.adicional ? [['Adicional (bonos)', `+ ${soles(r.adicional)}`] as [string, string]] : []),
    ['Penalidad por tardanza', `− ${soles(penal)}`],
    ['Consumos del personal cobrados', `− ${soles(r.consumosCobrados)}`],
    ['Descuentos, cuotas y servicios', `− ${soles(r.descuentos)}`],
    ['Adelantos', `− ${soles(r.adelantos)}`],
    ['Neto', soles(r.neto), true],
  ];
  return (
    <div className="ca-detalle-sec">
      <p className="as-ayuda">
        Período {d.periodo.desde} a {d.periodo.hasta} · {d.estado === 'PAGADO' ? 'Pagado' : 'Estimado hasta que se marque pagado'}
      </p>
      <ul className="pl-filas">
        {filas.map(([t, v, fuerte]) => <li key={t} className={`pl-fila${fuerte ? ' pl-fila--total' : ''}`}><span>{t}</span><span className="as-num">{v}</span></li>)}
      </ul>
      {!!d.consumosAnterioresPendiente && <small className="as-nota">Consumos de períodos anteriores sin cobrar: {soles(d.consumosAnterioresPendiente)}</small>}
      <small className="as-ayuda">Para pagar o ajustar, abre Planilla.</small>
    </div>
  );
}

/** «Madrugada» (antes de las 04:00 Lima) es del día calendario siguiente: la jornada cierra a las 04:00. */
const momentoDe = (fecha: string, hora: string) => `${hora < '04:00' ? sumarDias(fecha, 1) : fecha}T${hora}:00-05:00`;

/**
 * El ADMIN fija el ingreso y la salida del día (aunque no haya marcado) o corrige ambas de una vez. Motivo obligatorio; las marcas
 * originales quedan anuladas en el historial con quién y el motivo, y las horas, tardanza, extras y el sueldo se recalculan.
 */
export function AjustarIngresoSalida({ fila, onCambio, onError, onOk }: { fila: FilaCal; onCambio: () => Promise<void>; onError: Avisar; onOk: Avisar }) {
  const [entrada, setEntrada] = useState(fila.entrada ?? '');
  const [salida, setSalida] = useState(fila.salida ?? '');
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const cambioE = !!entrada && entrada !== (fila.entrada ?? '');
  const cambioS = !!salida && salida !== (fila.salida ?? '');
  const ordenMal = !!entrada && !!salida && momentoDe(fila.fecha, salida) <= momentoDe(fila.fecha, entrada);
  const valido = (cambioE || cambioS) && !ordenMal && motivo.trim().length >= 10;
  const guardar = async () => {
    setOcupado(true);
    try {
      await ajustarDia({
        partyId: Number(fila.partyId), jornada: fila.fecha, motivo: motivo.trim(),
        ...(cambioE ? { entrada: momentoDe(fila.fecha, entrada) } : {}),
        ...(cambioS ? { salida: momentoDe(fila.fecha, salida) } : {}),
      });
      onError(null);
      onOk('Horas del día ajustadas. Las marcas originales quedan anuladas en el historial y la planilla se recalcula.');
      setMotivo('');
      await onCambio();
    } catch (e) {
      onError(mensajeDe(e, 'No se pudieron ajustar las horas.'));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <fieldset className="ca-correccion" aria-label="Ajustar ingreso y salida del día">
      <legend>Ajustar ingreso y salida del día (administrador)</legend>
      <div className="as-form">
        <label className="as-campo">Hora de ingreso
          <input type="time" value={entrada} onChange={(e) => setEntrada(e.target.value)} />
        </label>
        <label className="as-campo">Hora de salida
          <input type="time" value={salida} onChange={(e) => setSalida(e.target.value)} />
        </label>
        <label className="as-campo">Motivo (mínimo 10 caracteres)
          <input value={motivo} maxLength={300} aria-label="Motivo del ajuste de horas" onChange={(e) => setMotivo(e.target.value)} />
        </label>
      </div>
      <p className="as-ayuda" data-testid="vista-previa-ajuste">
        Ingreso {fila.entrada ?? 'sin marca'} → {entrada || '—'} · Salida {fila.salida ?? 'sin marca'} → {salida || '—'}
      </p>
      {ordenMal && <small role="alert" className="as-nota">La salida debe ser posterior al ingreso.</small>}
      <div className="as-acciones">
        <Boton type="button" disabled={!valido || ocupado} onClick={() => void guardar()}>{ocupado ? 'Guardando…' : 'Guardar horas del día'}</Boton>
        <small className="as-ayuda">Funciona también si no marcó. Se guarda quién lo cambió, el motivo y la hora original; si el período ya está pagado, reábrelo primero.</small>
      </div>
    </fieldset>
  );
}

function CorreccionManual({ fila, onCambio, onError, onOk }: { fila: FilaCal; onCambio: () => Promise<void>; onError: Avisar; onOk: Avisar }) {
  const [tipo, setTipo] = useState<TipoMarca>('ENTRADA');
  const [hora, setHora] = useState('');
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const valido = !!hora && motivo.trim().length >= 10;
  const registrar = async () => {
    setOcupado(true);
    try {
      // Antes de las 04:00 la hora ya es del día calendario siguiente (la jornada cierra a las 04:00 Lima)
      const dia = hora < '04:00' ? sumarDias(fila.fecha, 1) : fila.fecha;
      await corregirMarca({ partyId: Number(fila.partyId), jornada: fila.fecha, tipo, momento: `${dia}T${hora}:00-05:00`, motivo: motivo.trim() });
      onError(null);
      onOk('Corrección registrada. La marca original no se modificó.');
      setHora('');
      setMotivo('');
      await onCambio();
    } catch (e) {
      onError(mensajeDe(e, 'No se pudo registrar la corrección.'));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <fieldset className="ca-correccion">
      <legend>Agregar una marca que falta (corrección manual)</legend>
      <div className="as-form">
        <label className="as-campo">Tipo de marca
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoMarca)}>
            {(Object.keys(ETIQUETA_TIPO) as TipoMarca[]).map((t) => <option key={t} value={t}>{ETIQUETA_TIPO[t]}</option>)}
          </select>
        </label>
        <label className="as-campo">Hora real
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </label>
        <label className="as-campo">Motivo (mínimo 10 caracteres)
          <input value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} />
        </label>
      </div>
      <div className="as-acciones">
        <Boton type="button" disabled={!valido || ocupado} onClick={() => void registrar()}>Registrar corrección</Boton>
        <small className="as-ayuda">Queda como registro nuevo, con motivo. La marca original no se modifica.</small>
      </div>
    </fieldset>
  );
}
