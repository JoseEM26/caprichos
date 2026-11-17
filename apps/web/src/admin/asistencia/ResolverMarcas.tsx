import { useId, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { type CronoDia, ETIQUETA_ROL, resolverMarcas } from './correccionesApi';
import { entreElegidas, type Otras, seleccionInicial, vistaPrevia } from './resolverMarcas';

type Avisar = (m: string | null) => void;
const mensajeDe = (e: unknown, fallback: string) => (e as any)?.mensaje ?? (e as any)?.message ?? fallback;

/**
 * Panel «Resolver con tu criterio»: el día tiene varias entradas, varias salidas o una doble marca. El admin elige cuál es la
 * entrada, cuál la salida y qué hacer con las demás (ignorarlas o usarlas como break). Al guardar, el servidor recalcula el día.
 */
export function ResolverMarcas({ partyId, fecha, dia, onError, onOk, recargar }: {
  partyId: string; fecha: string; dia: CronoDia; onError: Avisar; onOk: Avisar; recargar: () => Promise<void>;
}) {
  const uid = useId();
  const inicial = seleccionInicial(dia.marcas);
  const [entradaId, setEntradaId] = useState<number | null>(inicial.entradaId);
  const [salidaId, setSalidaId] = useState<number | null>(inicial.salidaId);
  const [otras, setOtras] = useState<Otras>('IGNORAR');
  const [motivo, setMotivo] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const marcas = [...dia.marcas].sort((a, b) => a.minutos - b.minutos);
  const entre = entreElegidas(dia.marcas, entradaId, salidaId);
  const hayOtras = marcas.some((m) => m.id !== entradaId && m.id !== salidaId);
  const breakPosible = entre.length === 2;
  const modo: Otras = otras === 'BREAK' && !breakPosible ? 'IGNORAR' : otras;
  const vista = entradaId !== null && salidaId !== null ? vistaPrevia(dia, entradaId, salidaId) : null;
  const valido = vista !== null && motivo.trim().length >= 10;

  // Una marca no puede ser entrada y salida a la vez: al elegirla de un lado se quita del otro.
  const elegir = (rol: 'ENTRADA' | 'SALIDA', id: number) => {
    if (rol === 'ENTRADA') {
      setEntradaId(id);
      if (salidaId === id) setSalidaId(null);
    } else {
      setSalidaId(id);
      if (entradaId === id) setEntradaId(null);
    }
  };

  const guardar = async () => {
    setConfirmando(false);
    if (entradaId === null || salidaId === null) return;
    setOcupado(true);
    try {
      await resolverMarcas({ partyId: Number(partyId), jornada: fecha, entradaMarcaId: entradaId, salidaMarcaId: salidaId, otras: modo, motivo: motivo.trim() });
      onError(null);
      onOk('Listo: el día se recalculó.');
      setMotivo('');
      await recargar();
    } catch (e) {
      onError(mensajeDe(e, 'No se pudo guardar el criterio.'));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <fieldset className="ca-correccion" aria-label="Resolver con tu criterio">
      <legend>Resolver con tu criterio (administrador)</legend>
      <p className="as-ayuda">
        Este día tiene {dia.marcas.length} marcas y no está claro cuál es la entrada y cuál la salida. Elige tú: las que no elijas
        no cuentan, o son break si lo indicas.
      </p>
      <ul className="tm-lista" aria-label="Marcas para elegir">
        {marcas.map((m) => (
          <li key={m.id} className="tm-tarjeta">
            <div className="tm-fila">
              <div className="tm-datos">
                <b className="tm-hora">{m.hora}</b>
                <small className="tm-origen">Interpretada como: {m.rol ? ETIQUETA_ROL[m.rol] : 'sin rol'}{m.duplicada ? ' (doble marca)' : ''}</small>
              </div>
              <label className="as-campo">
                <input type="radio" name={`${uid}-entrada`} aria-label={`Cuenta como ENTRADA: ${m.hora}`}
                  checked={entradaId === m.id} onChange={() => elegir('ENTRADA', m.id)} /> Cuenta como ENTRADA
              </label>
              <label className="as-campo">
                <input type="radio" name={`${uid}-salida`} aria-label={`Cuenta como SALIDA: ${m.hora}`}
                  checked={salidaId === m.id} onChange={() => elegir('SALIDA', m.id)} /> Cuenta como SALIDA
              </label>
            </div>
          </li>
        ))}
      </ul>
      {hayOtras && (
        <fieldset className="as-campo">
          <legend>Las demás marcas</legend>
          <label><input type="radio" name={`${uid}-otras`} checked={modo === 'IGNORAR'} onChange={() => setOtras('IGNORAR')} /> Ignorarlas (no cuentan)</label>
          <label>
            <input type="radio" name={`${uid}-otras`} checked={modo === 'BREAK'} disabled={!breakPosible} onChange={() => setOtras('BREAK')} /> Usarlas como break
          </label>
          {!breakPosible && <small className="as-ayuda">Para usarlas como break deben quedar exactamente 2 entre la entrada y la salida.</small>}
        </fieldset>
      )}
      <p className="as-ayuda" role="status" data-testid="vista-previa-resolver">
        {vista ?? 'Elige una entrada y una salida posterior a ella.'}
      </p>
      {vista && <small className="as-ayuda">Sin descontar la tolerancia: el sueldo exacto se recalcula al guardar.</small>}
      <label className="as-campo">Motivo (mínimo 10 caracteres)
        <input value={motivo} maxLength={300} aria-label="Motivo del criterio" onChange={(e) => setMotivo(e.target.value)} />
      </label>
      <div className="as-acciones">
        <Boton type="button" disabled={!valido || ocupado} onClick={() => setConfirmando(true)}>{ocupado ? 'Guardando…' : 'Guardar criterio'}</Boton>
        <small className="as-ayuda">Queda registrado quién lo decidió y por qué; las marcas originales no se borran.</small>
      </div>
      <Confirmar
        abierto={confirmando}
        titulo="Guardar el criterio de este día"
        mensaje="Las marcas que no elegiste dejan de contar y el día se recalcula. ¿Continuar?"
        textoSi="Sí, guardar"
        alConfirmar={guardar}
        alCancelar={() => setConfirmando(false)}
      />
    </fieldset>
  );
}
