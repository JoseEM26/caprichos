import { useEffect, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { ETIQUETA_METODO, guardarSueldo, MEDIOS_PAGO, MetodoValorHora, Modalidad, obtenerSueldo, soles, sueldoEquivalente } from '../asistencia/planillaApi';

const ENTRADA = { minHeight: 44, width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1.5px solid var(--cp-line)', padding: '0 8px' } as const;

/** Sueldo de la persona (solo ADMIN): modalidad, monto, cómo se calcula el valor hora y a dónde se le paga. */
export function SeccionSueldo({ partyId, deshabilitado, celularSugerido }: { partyId: string; deshabilitado?: boolean; /** Celular (9 dígitos) que el admin acaba de escribir en el modal y aún no guarda; tiene prioridad sobre el guardado. */ celularSugerido?: string | null }) {
  const [modalidad, setModalidad] = useState<Modalidad>('MENSUAL');
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState<MetodoValorHora>('DIAS_HORAS');
  const [diasMes, setDiasMes] = useState('');
  const [horasDia, setHorasDia] = useState('');
  const [tarifa, setTarifa] = useState('');
  const [pagoCelular, setPagoCelular] = useState('');
  const [pagoMedio, setPagoMedio] = useState('');
  const [celularGuardado, setCelularGuardado] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    obtenerSueldo(Number(partyId))
      .then((r) => {
        if (!vivo) return;
        setCelularGuardado(r.celularUsuario ?? '');
        if (!r.sueldo) return;
        setMetodo(r.sueldo.metodo ?? 'PROGRAMADAS');
        setDiasMes(r.sueldo.diasMes ? String(r.sueldo.diasMes) : '');
        setHorasDia(r.sueldo.horasDia ? String(r.sueldo.horasDia) : '');
        setTarifa(r.sueldo.tarifaHora ? String(r.sueldo.tarifaHora) : '');
        setPagoCelular(r.pago?.celular ?? '');
        setPagoMedio(r.pago?.medio ?? '');
        setModalidad(r.sueldo.modalidad);
        setMonto(String(r.sueldo.modalidad === 'SEMANAL' ? r.sueldo.semanal : r.sueldo.mensual));
      })
      .catch(() => undefined);
    return () => { vivo = false; };
  }, [partyId]);

  const sugerido = (celularSugerido || celularGuardado || '').replace(/\D/g, '');
  const mostrarSugerencia = sugerido.length === 9 && pagoCelular.replace(/\D/g, '') !== sugerido;

  const porHora = metodo === 'TARIFA_HORA';
  const n = porHora ? 0 : Number(monto);
  const t = Number(tarifa);
  const valido = porHora ? t > 0 : monto !== '' && Number.isFinite(n) && n >= 0;
  const eq = valido && !porHora ? sueldoEquivalente(modalidad, n) : null;
  // Referencia: lo mismo que calcula el servidor (mensual ÷ días ÷ horas)
  const vhRef = metodo === 'DIAS_HORAS' && eq ? eq.mensual / (Number(diasMes) > 0 ? Number(diasMes) : 24) / (Number(horasDia) > 0 ? Number(horasDia) : 9) : null;

  const guardar = async () => {
    setGuardando(true);
    setMsg(null);
    try {
      await guardarSueldo(Number(partyId), modalidad, n, {
        metodo,
        diasMes: diasMes ? Number(diasMes) : null,
        horasDia: horasDia ? Number(horasDia) : null,
        tarifaHora: porHora ? t : null,
        pagoCelular: pagoCelular.trim(),
        pagoMedio,
      });
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
      <label style={{ fontSize: 12, fontWeight: 700 }}>
        Valor hora
        <select value={metodo} disabled={deshabilitado || guardando} onChange={(e) => setMetodo(e.target.value as MetodoValorHora)} style={ENTRADA}>
          {(Object.keys(ETIQUETA_METODO) as MetodoValorHora[]).map((m) => <option key={m} value={m}>{ETIQUETA_METODO[m]}</option>)}
        </select>
      </label>
      {metodo === 'DIAS_HORAS' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <label style={{ flex: '1 1 140px', fontSize: 12, fontWeight: 700 }}>Días del mes (vacío = 24)
            <input type="number" inputMode="numeric" min="1" max="31" step="1" value={diasMes} disabled={deshabilitado || guardando} onChange={(e) => setDiasMes(e.target.value)} style={ENTRADA} />
          </label>
          <label style={{ flex: '1 1 140px', fontSize: 12, fontWeight: 700 }}>Horas por día (vacío = 9)
            <input type="number" inputMode="decimal" min="1" max="24" step="0.5" value={horasDia} disabled={deshabilitado || guardando} onChange={(e) => setHorasDia(e.target.value)} style={ENTRADA} />
          </label>
        </div>
      )}
      {porHora && (
        <label style={{ fontSize: 12, fontWeight: 700 }}>Tarifa por hora (S/)
          <input type="number" inputMode="decimal" min="0.01" step="0.01" value={tarifa} disabled={deshabilitado || guardando} onChange={(e) => setTarifa(e.target.value)} style={ENTRADA} />
        </label>
      )}
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
        {!porHora && <label style={{ flex: '1 1 140px', fontSize: 12, fontWeight: 700 }}>
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
        </label>}
      </div>
      <div role="status" style={{ fontSize: 13 }}>
        {porHora ? 'Se paga por hora trabajada, sin sueldo mensual.' : eq ? <>Semanal: <strong>{soles(eq.semanal)}</strong> · Mensual: <strong>{soles(eq.mensual)}</strong>{vhRef ? <> · Valor hora: <strong>{soles(Math.round(vhRef * 100) / 100)}</strong></> : null}</> : 'Escribe el monto para ver el equivalente.'}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <label style={{ flex: '1 1 140px', fontSize: 12, fontWeight: 700 }}>Celular de pago (Yape / Plin)
          <input type="tel" inputMode="tel" maxLength={20} autoComplete="off" value={pagoCelular} disabled={deshabilitado || guardando} onChange={(e) => setPagoCelular(e.target.value)} style={ENTRADA} />
          {mostrarSugerencia && (
            <button
              type="button"
              aria-label="Usar el celular del usuario como celular de pago"
              disabled={deshabilitado || guardando}
              onClick={() => setPagoCelular(sugerido)}
              style={{ marginTop: 4, minHeight: 44, width: '100%', borderRadius: 8, border: '1.5px dashed var(--cp-line)', background: 'transparent', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              Usar el celular del usuario (···{sugerido.slice(-3)})
            </button>
          )}
        </label>
        <label style={{ flex: '1 1 140px', fontSize: 12, fontWeight: 700 }}>Medio de pago
          <select value={pagoMedio} disabled={deshabilitado || guardando} onChange={(e) => setPagoMedio(e.target.value)} style={ENTRADA}>
            <option value="">Sin indicar</option>
            {MEDIOS_PAGO.map((m) => <option key={m} value={m}>{m.charAt(0) + m.slice(1).toLowerCase()}</option>)}
          </select>
        </label>
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
