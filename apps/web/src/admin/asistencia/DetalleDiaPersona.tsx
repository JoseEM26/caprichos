import { useCallback, useEffect, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { Insignia } from '../../comun/Insignia';
import { ModalConPestanas, type PestanaModal } from '../../comun/ModalConPestanas';
import { ETIQUETA_ESTADO, ETIQUETA_TIPO, TipoMarca, corregirMarca } from './asistenciaApi';
import { ETIQUETA_TIPO_CAL, type FilaCal } from './calendarioApi';
import { Cronograma, cronograma } from './correccionesApi';
import { LineaTiempo, SolicitudesDelDia, etiquetaDia, sumarDias } from './CronogramaTab';
import { DetallePlanilla, detallePlanilla, soles } from './planillaApi';

type Avisar = (m: string | null) => void;
const mensajeDe = (e: unknown, fallback: string) => (e as any)?.mensaje ?? (e as any)?.message ?? fallback;
const hh = (min: number) => (min ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min` : '—');
const ORIGEN: Record<string, string> = { CORRECCION: 'corrección del admin', WEB: 'usuario y contraseña', MANUAL: 'manual (solo GPS)', CELULAR: 'QR en el celular' };

/**
 * Detalle de UNA persona en UN día, como modal con pestañas (partes que no dependen entre sí):
 * Resumen · Marcas (línea de tiempo, aprobar/anular/separar/reasignar, selfie, corrección manual) · Solicitudes · Pago del período.
 * Se abre apilado sobre el modal del día (al cerrarlo, el foco vuelve a la lista).
 */
export function DetalleDiaPersona({ fila, onCerrar, onCambio, onError, onOk, volverAlDia = false }: {
  fila: FilaCal; onCerrar: () => void; onCambio: () => void; onError: Avisar; onOk: Avisar; volverAlDia?: boolean;
}) {
  const [data, setData] = useState<Cronograma | null>(null);
  const [cargando, setCargando] = useState(true);
  const [seleccionada, setSeleccionada] = useState<number | null>(null);
  const cargar = useCallback(async () => {
    try {
      setData(await cronograma(fila.fecha, fila.fecha));
    } catch (e) {
      onError(mensajeDe(e, 'No pudimos cargar el detalle del día.'));
    } finally {
      setCargando(false);
    }
  }, [fila.fecha, onError]);
  useEffect(() => { setCargando(true); void cargar(); }, [cargar]);
  const persona = data?.personas.find((p) => String(p.partyId) === fila.partyId);
  const dia = persona?.dias.find((d) => d.jornada === fila.fecha);
  const recargar = async () => { await cargar(); onCambio(); };
  const pendientes = dia?.solicitudes.length ?? fila.solicitudes.filter((s) => s.estado === 'PENDIENTE').length;

  const pestanas: PestanaModal[] = [
    { id: 'resumen', etiqueta: 'Resumen', contenido: <ResumenDia fila={fila} /> },
    {
      id: 'marcas', etiqueta: 'Marcas', insignia: fila.marcas.length || null,
      contenido: (
        <div className="ca-detalle-sec">
          <ol className="ca-marcas-lista" aria-label="Marcas del día">
            {fila.marcas.length === 0 && <li>Sin marcas este día.</li>}
            {fila.marcas.map((m) => (
              <li key={m.id}>
                <b>{m.hora}</b> {m.tipo ? ETIQUETA_TIPO_CAL[m.tipo] : 'Marca sin tipo'}
                <small> · {ORIGEN[m.origen] ?? 'QR en el celular'}{m.estado === 'A_REVISAR' ? ' · por revisar' : ''}{m.tieneSelfie ? ' · con selfie' : ''}</small>
              </li>
            ))}
          </ol>
          {cargando ? <Cargando mensaje="Cargando línea de tiempo" /> : dia && persona ? (
            <LineaTiempo persona={persona} dia={dia} seleccionada={seleccionada} alElegir={setSeleccionada} onError={onError} onOk={onOk} recargar={recargar} sinSolicitudes />
          ) : <p className="as-ayuda">No hay línea de tiempo para este día.</p>}
          <small className="as-ayuda">Toca una marca de la línea para ver su detalle, la selfie y aprobarla, anularla o cambiar su rol.</small>
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

  return (
    <ModalConPestanas
      titulo={`${fila.nombre} · ${etiquetaDia(fila.fecha)}`}
      subtitulo={<>{fila.rol}{fila.turno ? ` · Horario ${fila.turno.entrada}–${fila.turno.salida}` : ' · Sin horario'} <Insignia variante="neutro">{ETIQUETA_ESTADO[fila.estado] ?? fila.estado}</Insignia></>}
      pestanas={pestanas}
      alCerrar={onCerrar}
      ancho={820}
      pie={<Boton type="button" variante="secundario" onClick={onCerrar}>{volverAlDia ? '← Volver al día' : 'Cerrar'}</Boton>}
    />
  );
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
