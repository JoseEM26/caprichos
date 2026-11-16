import { useState } from 'react';
import { pedidosApi, type Pedido } from './pedidosApi';
import { fechaLarga, horaProgramado, paraCuandoDe, textoPagoProgramado } from './programado';
import { cargosLibres } from './ProgramadoInfo';
import { claveModalidad } from './InsigniaModalidad';
import { MOD } from './columnasCaja';
import { errorParaCuando, programadoParaIso, type ParaCuando } from '../salon/componentes/paraCuando';
import './programado.css';

const soles = (n: number | string) => `S/ ${Number(n || 0).toFixed(2)}`;

/** Bloque grande «PARA CUÁNDO» del detalle: fecha larga, hora, cuenta regresiva, modalidad y pago; con «Reprogramar» si sigue programado. */
export function BloqueParaCuando({ pedido, puedeReprogramar, alActualizar, ahora }: { pedido: Pedido; puedeReprogramar: boolean; alActualizar: () => void; ahora?: Date }) {
  const pc = paraCuandoDe(pedido, ahora);
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  if (!pc) return null;
  const pago = textoPagoProgramado(pedido);

  const guardar = async () => {
    const v: ParaCuando = { modo: 'OTRA', fecha, hora };
    const e = errorParaCuando(v, ahora ?? new Date());
    if (e) return setError(e);
    setGuardando(true);
    try {
      await pedidosApi.reprogramar(pedido.id, programadoParaIso(v) as string);
      setAbierto(false);
      setError('');
      alActualizar();
    } catch (err: any) {
      setError(err?.message || 'No se pudo reprogramar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="pg-cuando" data-testid="bloque-para-cuando" data-nivel={pc.nivel} aria-label="Para cuándo es el pedido">
      <h3 className="pg-cuando-rotulo">📅 PARA CUÁNDO</h3>
      <p className="pg-cuando-fecha" data-testid="para-cuando-fecha">{fechaLarga(pc.fecha)}</p>
      <p className="pg-cuando-hora" data-testid="para-cuando-hora">{horaProgramado(pc.fecha)}</p>
      {pc.faltan && (
        <p className="pg-cuando-faltan" data-testid="para-cuando-faltan">
          {pc.nivel === 'vencido' ? '⚠️ Ya pasó la hora pactada · ' : pc.nivel === 'cerca' ? '⏰ ' : ''}
          {pc.faltan}
        </p>
      )}
      <dl className="pg-cuando-datos">
        <div><dt>Modalidad</dt><dd data-testid="para-cuando-modalidad">{MOD[claveModalidad(pedido.modalidad)]}</dd></div>
        <div><dt>Cliente</dt><dd>{pedido.cliente_nombre?.trim() || 'Cliente'}{pedido.cliente_telefono ? ` · ${pedido.cliente_telefono}` : ''}</dd></div>
        {pago && <div><dt>Pago</dt><dd data-testid="para-cuando-pago">{pago}</dd></div>}
        <div><dt>Total</dt><dd>{soles(pedido.total as number)}</dd></div>
      </dl>
      {pc.programado && puedeReprogramar && (
        <div className="pg-reprog">
          {!abierto ? (
            <button type="button" className="dp-btn" onClick={() => setAbierto(true)}>Reprogramar</button>
          ) : (
            <div className="pg-reprog-form">
              <label>Nueva fecha <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
              <label>Nueva hora <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></label>
              <button type="button" className="dp-btn" disabled={guardando} onClick={() => void guardar()}>Guardar nueva fecha</button>
              <button type="button" className="dp-btn" onClick={() => { setAbierto(false); setError(''); }}>Cancelar</button>
              {error && <p role="alert" className="pg-error">{error}</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const cuando = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: 'numeric', minute: '2-digit', timeZone: 'America/Lima' }) : null;

/** Bloque «Servicio / encargo»: la descripción completa en letra grande y seleccionable, el monto y quién lo agregó. */
export function BloqueServicioEncargo({ pedido }: { pedido: Pedido }) {
  const cargos = cargosLibres(pedido.lineas ?? []);
  if (cargos.length === 0) return null;
  return (
    <section className="pg-servicio" data-testid="bloque-servicio-encargo" aria-label="Servicio o encargo">
      <h3 className="pg-servicio-rotulo">🎂 SERVICIO / ENCARGO</h3>
      {cargos.map((l, i) => (
        <div key={String(l.id ?? i)} className="pg-servicio-item">
          <p className="pg-servicio-texto" data-testid="servicio-texto">{l.cantidad > 1 ? `${l.cantidad}× ` : ''}{l.nombre}</p>
          <p className="pg-servicio-meta">
            <strong>{soles(l.subtotal)}</strong>
            {l.agregadoPor ? ` · Agregado por ${l.agregadoPor}` : ''}
            {cuando(l.agregadoEn) ? ` · ${cuando(l.agregadoEn)}` : ''}
          </p>
        </div>
      ))}
    </section>
  );
}
