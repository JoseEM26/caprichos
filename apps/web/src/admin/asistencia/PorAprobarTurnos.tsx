import { useCallback, useEffect, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';
import { useSesion } from '../../comun/sesion';
import { ChipsAprobacion } from './AprobacionTurno';
import { NOMBRE_PARTE, parteQuePuedoAprobar, textoAprobacion, type QuienMira } from './aprobacionTurno';
import { aprobarTurno, rechazarTurnoAdmin, turnosPorAprobar, type SolicitudTurno } from './turnosApi';
import './turnos.css';

const mensajeDe = (e: unknown, f: string) => (e as any)?.mensaje ?? (e as any)?.message ?? f;

/** Quién mira: su partyId y roles de la sesión (sin sesión, nadie puede firmar). */
function usarQuienMira(): QuienMira {
  try {
    const u = useSesion().usuario;
    return { partyId: u?.partyId ?? '', roles: u?.roles ?? (u?.rol ? [u.rol] : []) };
  } catch {
    return { partyId: '', roles: [] };
  }
}

/**
 * Reemplazos y cambios de turno que ya aceptó la otra persona y esperan la aprobación de Supervisión y de Administración.
 * Cada parte la firma una persona distinta; los botones aparecen solo si falta la parte de quien mira.
 */
export function PorAprobarTurnos({ alCambiar }: { alCambiar?: () => void }) {
  const quien = usarQuienMira();
  const [datos, setDatos] = useState<{ toleranciaMin: number; solicitudes: SolicitudTurno[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [aprobando, setAprobando] = useState<SolicitudTurno | null>(null);
  const [rechazando, setRechazando] = useState<SolicitudTurno | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await turnosPorAprobar());
      setError(null);
    } catch (e) {
      setError(mensajeDe(e, 'No pudimos cargar los pedidos de turno.'));
    }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  /** `accion` puede devolver un mensaje propio (p. ej. «falta la otra parte»); si no, sirve `mensajeOk`. */
  const ejecutar = async (accion: () => Promise<string | undefined>, mensajeOk: string, cerrar: () => void) => {
    setOcupado(true);
    setErrorAccion(null);
    try {
      const msg = await accion();
      cerrar();
      setMotivo('');
      setOk(msg ?? mensajeOk);
      await cargar();
      alCambiar?.();
    } catch (e) {
      setErrorAccion(mensajeDe(e, 'No se pudo completar.'));
      // si las condiciones cambiaron, la lista ya no refleja la realidad
      void cargar();
    } finally {
      setOcupado(false);
    }
  };

  const lista = datos?.solicitudes ?? [];
  const parteAprobando = aprobando ? parteQuePuedoAprobar(aprobando, quien) : null;
  return (
    <section className="tu-seccion" aria-label="Reemplazos y cambios por aprobar">
      <h3 className="as-sub">Reemplazos y cambios de turno por aprobar{lista.length > 0 ? ` (${lista.length})` : ''}</h3>
      {error && <div role="alert" className="as-aviso as-aviso--error">{error}</div>}
      {ok && <div role="status" className="as-aviso as-aviso--ok">{ok}</div>}
      {datos && lista.length === 0 && <p className="tu-vacio">No hay pedidos esperando aprobación.</p>}
      {lista.map((s) => {
        const parte = parteQuePuedoAprobar(s, quien);
        return (
          <article key={s.id} className="ma-card tu-card" aria-label={`Pedido de ${s.solicitante.nombre}`}>
            <div className="tu-cab">
              <b>{s.solicitante.nombre} → {s.reemplazo.nombre}</b>
              <Insignia variante="acento">{s.tipo === 'CAMBIO_TURNO' ? 'Cambio de turno' : 'Reemplazo'}</Insignia>
            </div>
            <div>{s.etiqueta} · {s.desde} a {s.hasta}{s.devolucion ? <> y a cambio {s.devolucion.etiqueta} · {s.devolucion.desde} a {s.devolucion.hasta}</> : null}</div>
            <small>Motivo: «{s.motivo}» · Área: {s.area}</small>
            <ChipsAprobacion s={s} />
            <small className="tu-avance">{textoAprobacion(s)}</small>
            <ul className="tu-chips" aria-label="Validación">
              {s.validacion?.areaYRol.map((m) => <li key={m}><Insignia variante="exito">{m}</Insignia></li>)}
              <li>
                {s.validacion?.ok
                  ? <Insignia variante="exito">Horario libre</Insignia>
                  : <Insignia variante="peligro">{s.validacion?.problema ?? 'Sin validar'}</Insignia>}
              </li>
              <li><Insignia variante="neutro">Tolerancia para marcar: {datos?.toleranciaMin} min</Insignia></li>
            </ul>
            {parte && (
              <div className="tu-acciones">
                <Boton type="button" disabled={s.validacion?.ok === false} onClick={() => { setErrorAccion(null); setAprobando(s); }}>Aprobar</Boton>
                <Boton type="button" variante="peligro" onClick={() => { setErrorAccion(null); setMotivo(''); setRechazando(s); }}>Rechazar</Boton>
              </div>
            )}
          </article>
        );
      })}

      <Confirmar
        abierto={aprobando !== null}
        titulo="¿Aprobar este pedido?"
        mensaje={aprobando ? `${aprobando.reemplazo.nombre} cubrirá a ${aprobando.solicitante.nombre} el ${aprobando.etiqueta}. Tu aprobación cuenta como ${parteAprobando ? NOMBRE_PARTE[parteAprobando] : ''}. Si falta la otra parte, el turno queda cubierto cuando también la firme.` : ''}
        textoSi="Sí, aprobar"
        textoNo="No"
        cargando={ocupado}
        error={errorAccion}
        alConfirmar={() => ejecutar(
          async () => ((await aprobarTurno(aprobando!.id))?.completa === false ? 'Tu aprobación quedó registrada. Falta la otra parte.' : undefined),
          'Pedido aprobado.',
          () => setAprobando(null),
        )}
        alCancelar={() => setAprobando(null)}
      />
      <Confirmar
        abierto={rechazando !== null}
        titulo="¿Rechazar este pedido?"
        mensaje={rechazando ? `Pedido de ${rechazando.solicitante.nombre} del ${rechazando.etiqueta}.` : ''}
        textoSi="Sí, rechazar"
        textoNo="No"
        peligro
        cargando={ocupado}
        error={errorAccion}
        deshabilitarConfirmar={motivo.trim().length < 5}
        alConfirmar={() => ejecutar(async () => { await rechazarTurnoAdmin(rechazando!.id, motivo.trim()); return undefined; }, 'Pedido rechazado.', () => setRechazando(null))}
        alCancelar={() => setRechazando(null)}
      >
        <label className="as-campo">Motivo (mínimo 5 letras)
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} />
        </label>
      </Confirmar>
    </section>
  );
}
