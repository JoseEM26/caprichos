import { useCallback, useEffect, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { Insignia } from '../../comun/Insignia';
import { ETIQUETA_ESTADO, ETIQUETA_TIPO, TipoMarca, corregirMarca } from './asistenciaApi';
import { ETIQUETA_TIPO_CAL, type FilaCal } from './calendarioApi';
import { Cronograma, cronograma } from './correccionesApi';
import { LineaTiempo, etiquetaDia, sumarDias } from './CronogramaTab';

type Avisar = (m: string | null) => void;
const mensajeDe = (e: unknown, fallback: string) => (e as any)?.mensaje ?? (e as any)?.message ?? fallback;

/**
 * «Detalle del día de la persona»: línea de tiempo con sus marcas (aprobar, anular, separar, reasignar, selfie),
 * solicitudes de corrección (aprobar o rechazar) y corrección manual del admin (queda como registro nuevo, con motivo).
 */
export function DetalleDiaPersona({ fila, onCerrar, onCambio, onError, onOk }: { fila: FilaCal; onCerrar: () => void; onCambio: () => void; onError: Avisar; onOk: Avisar }) {
  const [data, setData] = useState<Cronograma | null>(null);
  const [cargando, setCargando] = useState(true);
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

  return (
    <section className="ca-detalle" aria-label={`Detalle del día de ${fila.nombre}`} data-testid="detalle-dia">
      <header className="ca-detalle-cab">
        <div>
          <h3 className="as-sub">{fila.nombre} · {etiquetaDia(fila.fecha)}</h3>
          <small className="as-ayuda">{fila.rol}{fila.turno ? ` · Horario ${fila.turno.entrada}–${fila.turno.salida}` : ' · Sin horario'}</small>
        </div>
        <Insignia variante="neutro">{ETIQUETA_ESTADO[fila.estado] ?? fila.estado}</Insignia>
        <Boton type="button" variante="secundario" tamano="pequeno" onClick={onCerrar}>Cerrar detalle</Boton>
      </header>
      {fila.inconsistencias.length > 0 && (
        <ul className="cr-alertas">{fila.inconsistencias.map((t, i) => <li key={i}>⚠ {t}</li>)}</ul>
      )}
      <ol className="ca-marcas-lista" aria-label="Marcas del día">
        {fila.marcas.length === 0 && <li>Sin marcas este día.</li>}
        {fila.marcas.map((m) => (
          <li key={m.id}>
            <b>{m.hora}</b> {m.tipo ? ETIQUETA_TIPO_CAL[m.tipo] : 'Marca sin tipo'}
            <small> · {m.origen === 'CORRECCION' ? 'corrección del admin' : m.origen === 'WEB' ? 'usuario y contraseña' : m.origen === 'MANUAL' ? 'manual (solo GPS)' : 'QR en el celular'}{m.estado === 'A_REVISAR' ? ' · por revisar' : ''}</small>
          </li>
        ))}
      </ol>
      {cargando ? <Cargando mensaje="Cargando línea de tiempo" /> : dia && persona ? (
        <LineaTiempo persona={persona} dia={dia} seleccionada={null} alElegir={() => undefined} onError={onError} onOk={onOk} recargar={recargar} />
      ) : <p className="as-ayuda">No hay línea de tiempo para este día.</p>}
      <CorreccionManual fila={fila} onCambio={recargar} onError={onError} onOk={onOk} />
    </section>
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
