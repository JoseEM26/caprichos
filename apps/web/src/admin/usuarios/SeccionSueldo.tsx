import { useEffect, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { guardarSueldo, Modalidad, obtenerSueldo, soles, sueldoEquivalente } from '../asistencia/planillaApi';

/** Sueldo de la persona (solo ADMIN): modalidad y monto; el otro se calcula y se muestran ambos. */
export function SeccionSueldo({ partyId, deshabilitado }: { partyId: string; deshabilitado?: boolean }) {
  const [modalidad, setModalidad] = useState<Modalidad>('MENSUAL');
  const [monto, setMonto] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    obtenerSueldo(Number(partyId))
      .then((r) => {
        if (!vivo || !r.sueldo) return;
        setModalidad(r.sueldo.modalidad);
        setMonto(String(r.sueldo.modalidad === 'SEMANAL' ? r.sueldo.semanal : r.sueldo.mensual));
      })
      .catch(() => undefined);
    return () => { vivo = false; };
  }, [partyId]);

  const n = Number(monto);
  const valido = monto !== '' && Number.isFinite(n) && n >= 0;
  const eq = valido ? sueldoEquivalente(modalidad, n) : null;

  const guardar = async () => {
    setGuardando(true);
    setMsg(null);
    try {
      await guardarSueldo(Number(partyId), modalidad, n);
      setMsg({ ok: true, texto: 'Sueldo guardado.' });
    } catch (e) {
      setMsg({ ok: false, texto: (e as any)?.message || 'No se pudo guardar el sueldo.' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <fieldset style={{ border: '1px solid var(--cp-line)', borderRadius: 12, padding: 12, display: 'grid', gap: 10, margin: 0 }}>
      <legend style={{ fontWeight: 800, fontSize: 14 }}>Sueldo (planilla)</legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <label style={{ flex: '1 1 140px', fontSize: 12, fontWeight: 700 }}>
          Se paga
          <select
            value={modalidad}
            disabled={deshabilitado || guardando}
            onChange={(e) => setModalidad(e.target.value as Modalidad)}
            style={{ minHeight: 44, width: '100%', borderRadius: 8, border: '1.5px solid var(--cp-line)', padding: '0 8px' }}
          >
            <option value="SEMANAL">Semanal (lunes a domingo)</option>
            <option value="MENSUAL">Mensual (mes calendario)</option>
          </select>
        </label>
        <label style={{ flex: '1 1 140px', fontSize: 12, fontWeight: 700 }}>
          Monto {modalidad === 'SEMANAL' ? 'semanal' : 'mensual'} (S/)
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={monto}
            disabled={deshabilitado || guardando}
            onChange={(e) => setMonto(e.target.value)}
            style={{ minHeight: 44, width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1.5px solid var(--cp-line)', padding: '0 8px' }}
          />
        </label>
      </div>
      <div role="status" style={{ fontSize: 13 }}>
        {eq ? <>Semanal: <strong>{soles(eq.semanal)}</strong> · Mensual: <strong>{soles(eq.mensual)}</strong></> : 'Escribe el monto para ver el equivalente.'}
      </div>
      <small style={{ color: 'var(--cp-soft)' }}>Semanal = mensual × 12 ÷ 52. Mensual = semanal × 52 ÷ 12.</small>
      <div>
        <Boton type="button" variante="secundario" disabled={!valido || deshabilitado || guardando} onClick={() => void guardar()}>
          Guardar sueldo
        </Boton>
      </div>
      {msg && <div role={msg.ok ? 'status' : 'alert'} style={{ fontWeight: 700, fontSize: 13, color: msg.ok ? 'var(--cp-green)' : 'var(--cp-rust)' }}>{msg.texto}</div>}
    </fieldset>
  );
}
