import { useCallback, useEffect, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { Insignia } from '../../comun/Insignia';
import {
  AVISO_CONTRATO_TEMPORAL,
  ETIQUETA_VINCULO,
  MAX_CONTRATO_BYTES,
  TipoMovimiento,
  TipoVinculo,
  VinculoCompleto,
  anularVacaciones,
  guardarVinculo,
  obtenerVinculo,
  registrarVacaciones,
  subirContrato,
  verContrato,
} from './vinculoApi';
import { soles } from './planillaApi';

type Msg = { ok: boolean; texto: string } | null;
const mensajeDe = (e: unknown, fallback: string) => (e as any)?.mensaje ?? (e as any)?.message ?? fallback;
const hoyLima = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
const CAJA = { border: '1px solid var(--cp-line)', borderRadius: 12, padding: 12, display: 'grid', gap: 10, margin: 0 } as const;
const ENTRADA = { minHeight: 44, width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1.5px solid var(--cp-line)', padding: '0 8px' } as const;

/** Carga el vínculo y las vacaciones de una persona; `recargar` vuelve a pedirlos. */
export function useVinculo(partyId: number, activo = true) {
  const [datos, setDatos] = useState<VinculoCompleto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recargar = useCallback(async () => {
    try {
      setDatos(await obtenerVinculo(partyId));
      setError(null);
    } catch (e) {
      setError(mensajeDe(e, 'No pudimos cargar el vínculo.'));
    }
  }, [partyId]);
  useEffect(() => { if (activo) void recargar(); }, [recargar, activo]);
  return { datos, error, recargar };
}

type Hook = ReturnType<typeof useVinculo>;

/** Vínculo de la persona: planilla o contrato temporal, fechas, régimen de vacaciones y contrato PDF. */
export function PanelVinculo({ partyId, deshabilitado, hook }: { partyId: number; deshabilitado?: boolean; hook?: Hook }) {
  const propio = useVinculo(partyId, !hook);
  const { datos, error, recargar } = hook ?? propio;
  const [tipo, setTipo] = useState<TipoVinculo>('PLANILLA');
  const [ingreso, setIngreso] = useState('');
  const [fin, setFin] = useState('');
  const [regimen, setRegimen] = useState<30 | 15>(30);
  const [notas, setNotas] = useState('');
  const [msg, setMsg] = useState<Msg>(null);
  const [ocupado, setOcupado] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);

  const v = datos?.vigente;
  useEffect(() => {
    if (!datos) return;
    if (v) {
      setTipo(v.tipo);
      setIngreso(v.fechaIngreso);
      setFin(v.fechaFin ?? '');
      setRegimen(v.regimenVacaciones ?? 30);
      setNotas(v.notas ?? '');
    }
  }, [datos, v]);

  if (!datos) return error ? <div role="alert" className="as-aviso as-aviso--alerta">{error}</div> : <Cargando mensaje="Cargando vínculo" />;

  const ejecutar = async (fn: () => Promise<unknown>, ok: string) => {
    setOcupado(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, texto: ok });
      await recargar();
    } catch (e) {
      setMsg({ ok: false, texto: mensajeDe(e, 'No se pudo completar la acción.') });
    } finally {
      setOcupado(false);
    }
  };

  const guardar = () => ejecutar(
    () => guardarVinculo(partyId, { tipo, fechaIngreso: ingreso, fechaFin: tipo === 'CONTRATO_TEMPORAL' && fin ? fin : null, regimenVacaciones: tipo === 'PLANILLA' ? regimen : undefined, notas: notas.trim() || undefined }),
    v && v.tipo !== tipo ? 'Vínculo cambiado. El anterior quedó en el historial.' : 'Vínculo guardado.',
  );

  const elegirArchivo = (f: File | null) => {
    setMsg(null);
    if (f && (f.type !== 'application/pdf' || f.size > MAX_CONTRATO_BYTES)) {
      setArchivo(null);
      setMsg({ ok: false, texto: 'El contrato debe ser un PDF de máximo 5 MB.' });
      return;
    }
    setArchivo(f);
  };

  const abrirContrato = async (vinculoId?: number) => {
    try {
      window.open(await verContrato(partyId, vinculoId), '_blank', 'noopener');
    } catch (e) {
      setMsg({ ok: false, texto: mensajeDe(e, 'No pudimos abrir el contrato.') });
    }
  };

  const bloqueado = deshabilitado || ocupado;
  return (
    <fieldset style={CAJA}>
      <legend style={{ fontWeight: 800, fontSize: 14 }}>Vínculo con el local</legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <label style={{ flex: '1 1 160px', fontSize: 12, fontWeight: 700 }}>
          Tipo de vínculo
          <select value={tipo} disabled={bloqueado} onChange={(e) => setTipo(e.target.value as TipoVinculo)} style={ENTRADA}>
            <option value="PLANILLA">{ETIQUETA_VINCULO.PLANILLA}</option>
            <option value="CONTRATO_TEMPORAL">{ETIQUETA_VINCULO.CONTRATO_TEMPORAL}</option>
          </select>
        </label>
        <label style={{ flex: '1 1 140px', fontSize: 12, fontWeight: 700 }}>
          Fecha de ingreso
          <input type="date" value={ingreso} disabled={bloqueado} onChange={(e) => setIngreso(e.target.value)} style={ENTRADA} />
        </label>
        {tipo === 'CONTRATO_TEMPORAL' ? (
          <label style={{ flex: '1 1 140px', fontSize: 12, fontWeight: 700 }}>
            Fecha de fin (opcional)
            <input type="date" value={fin} min={ingreso || undefined} disabled={bloqueado} onChange={(e) => setFin(e.target.value)} style={ENTRADA} />
          </label>
        ) : (
          <label style={{ flex: '1 1 160px', fontSize: 12, fontWeight: 700 }}>
            Vacaciones al año
            <select value={regimen} disabled={bloqueado} onChange={(e) => setRegimen(Number(e.target.value) as 30 | 15)} style={ENTRADA}>
              <option value={30}>30 días (2.5 por mes)</option>
              <option value={15}>15 días (1.25 por mes)</option>
            </select>
          </label>
        )}
      </div>
      {tipo === 'CONTRATO_TEMPORAL' && <div role="note" className="as-aviso as-aviso--alerta">{AVISO_CONTRATO_TEMPORAL}.</div>}
      <label style={{ fontSize: 12, fontWeight: 700 }}>
        Notas (opcional)
        <textarea value={notas} maxLength={500} rows={2} disabled={bloqueado} onChange={(e) => setNotas(e.target.value)} style={{ ...ENTRADA, padding: 8, minHeight: 60 }} />
      </label>
      <div>
        <Boton type="button" variante="secundario" disabled={bloqueado || !ingreso} onClick={() => void guardar()}>Guardar vínculo</Boton>
      </div>
      {v && (
        <div style={{ display: 'grid', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>
            Contrato firmado (PDF, máx. 5 MB)
            <input type="file" accept="application/pdf" disabled={bloqueado} onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)} style={{ display: 'block', minHeight: 44, width: '100%' }} />
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Boton type="button" variante="secundario" tamano="pequeno" disabled={bloqueado || !archivo} onClick={() => void ejecutar(async () => { await subirContrato(partyId, archivo!); setArchivo(null); }, 'Contrato adjuntado.')}>Subir contrato</Boton>
            {v.tieneContrato ? <Boton type="button" variante="secundario" tamano="pequeno" onClick={() => void abrirContrato()}>Ver contrato actual</Boton> : <small className="as-nota">Sin contrato adjunto.</small>}
          </div>
        </div>
      )}
      {(datos.historial?.length ?? 0) > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>Historial de vínculos ({datos.historial.length})</summary>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
            {datos.historial.map((h) => (
              <li key={h.id}>
                {ETIQUETA_VINCULO[h.tipo]}: {h.fechaIngreso}{h.fechaFin ? ` a ${h.fechaFin}` : ''} (cerrado el {h.vigenteHasta?.slice(0, 10)})
                {h.tieneContrato && <> · <button type="button" style={{ background: "none", border: 0, padding: 0, color: "var(--cp-navy)", textDecoration: "underline", cursor: "pointer", minHeight: 24 }} onClick={() => void abrirContrato(h.id)}>Ver contrato</button></>}
              </li>
            ))}
          </ul>
        </details>
      )}
      {msg && <div role={msg.ok ? 'status' : 'alert'} style={{ fontWeight: 700, fontSize: 13, color: msg.ok ? 'var(--cp-green)' : 'var(--cp-rust)' }}>{msg.texto}</div>}
    </fieldset>
  );
}

const ETIQUETA_MOV: Record<TipoMovimiento, string> = { TOMADAS: 'Tomadas', PAGADAS: 'Pagadas', AJUSTE: 'Ajuste' };

/** Saldo y movimientos de vacaciones (solo vínculo PLANILLA) con los botones para registrar tomadas, pagadas o ajustes. */
export function PanelVacaciones({ partyId, hook, alCambiar }: { partyId: number; hook: Hook; alCambiar?: () => void }) {
  const { datos, recargar } = hook;
  const [form, setForm] = useState<TipoMovimiento | null>(null);
  const [f, setF] = useState({ desde: hoyLima(), hasta: hoyLima(), dias: '', monto: '', motivo: '' });
  const [anulando, setAnulando] = useState<{ id: number; motivo: string } | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [ocupado, setOcupado] = useState(false);

  if (!datos) return <Cargando mensaje="Cargando vacaciones" />;
  const vac = datos.vacaciones;
  if (!vac) {
    return <div className="as-aviso" role="note">Las vacaciones aplican solo al personal en planilla. {datos.vigente ? 'Esta persona tiene contrato temporal.' : 'Primero guarda el vínculo de la persona.'}</div>;
  }

  const ejecutar = async (fn: () => Promise<unknown>, ok: string) => {
    setOcupado(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, texto: ok });
      setForm(null);
      setAnulando(null);
      await recargar();
      alCambiar?.();
    } catch (e) {
      setMsg({ ok: false, texto: mensajeDe(e, 'No se pudo completar la acción.') });
    } finally {
      setOcupado(false);
    }
  };

  const registrar = () => ejecutar(
    () => registrarVacaciones({
      partyId,
      tipo: form!,
      desde: f.desde,
      hasta: form === 'TOMADAS' ? f.hasta : undefined,
      dias: form === 'TOMADAS' ? undefined : Number(f.dias),
      monto: form === 'PAGADAS' ? Number(f.monto) : undefined,
      motivo: f.motivo.trim() || undefined,
    }),
    'Movimiento registrado.',
  );
  const valido = !!form && !!f.desde && (form === 'TOMADAS' ? !!f.hasta && f.hasta >= f.desde : Number(f.dias) !== 0 && (form !== 'PAGADAS' || Number(f.monto) > 0) && (form !== 'AJUSTE' || f.motivo.trim().length >= 3));

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, margin: 0 }}>
        {[['Ganados', vac.ganados], ['Tomadas', vac.tomadas], ['Pagadas', vac.pagadas], ['Ajustes', vac.ajustes], ['Saldo', vac.saldo]].map(([t, v]) => (
          <div key={t as string} style={{ border: '1px solid var(--cp-line)', borderRadius: 12, padding: '8px 10px' }}>
            <dt style={{ fontSize: 12, color: 'var(--cp-soft)' }}>{t}</dt>
            <dd style={{ margin: 0, fontWeight: t === 'Saldo' ? 900 : 700, fontSize: t === 'Saldo' ? 18 : 14 }}>{v} día(s)</dd>
          </div>
        ))}
      </dl>
      <small className="as-nota">Régimen de {vac.regimen} días al año desde el ingreso ({vac.ingreso}). Las tomadas se pagan al valor normal del día programado; las pagadas entran a la planilla del período como ingreso adicional.</small>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {(['TOMADAS', 'PAGADAS', 'AJUSTE'] as TipoMovimiento[]).map((t) => (
          <Boton key={t} type="button" variante="secundario" tamano="pequeno" disabled={ocupado} aria-pressed={form === t} onClick={() => { setForm(form === t ? null : t); setMsg(null); }}>
            {t === 'TOMADAS' ? 'Registrar vacaciones tomadas' : t === 'PAGADAS' ? 'Registrar vacaciones pagadas' : 'Registrar ajuste'}
          </Boton>
        ))}
      </div>
      {form && (
        <fieldset style={CAJA}>
          <legend style={{ fontWeight: 800, fontSize: 14 }}>{form === 'TOMADAS' ? 'Vacaciones tomadas' : form === 'PAGADAS' ? 'Vacaciones pagadas en dinero' : 'Ajuste de saldo'}</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <label style={{ flex: '1 1 140px', fontSize: 12, fontWeight: 700 }}>
              {form === 'TOMADAS' ? 'Desde' : form === 'PAGADAS' ? 'Fecha (período de planilla)' : 'Fecha'}
              <input type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} style={ENTRADA} />
            </label>
            {form === 'TOMADAS' ? (
              <label style={{ flex: '1 1 140px', fontSize: 12, fontWeight: 700 }}>
                Hasta (inclusive)
                <input type="date" value={f.hasta} min={f.desde} onChange={(e) => setF({ ...f, hasta: e.target.value })} style={ENTRADA} />
              </label>
            ) : (
              <label style={{ flex: '1 1 120px', fontSize: 12, fontWeight: 700 }}>
                {form === 'AJUSTE' ? 'Días (+ suma, − resta)' : 'Días'}
                <input type="number" step="0.5" value={f.dias} onChange={(e) => setF({ ...f, dias: e.target.value })} style={ENTRADA} />
              </label>
            )}
            {form === 'PAGADAS' && (
              <label style={{ flex: '1 1 120px', fontSize: 12, fontWeight: 700 }}>
                Monto pagado (S/)
                <input type="number" inputMode="decimal" min="0" step="0.01" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} style={ENTRADA} />
              </label>
            )}
          </div>
          {form === 'TOMADAS' && <small className="as-nota">Solo cuentan los días con jornada programada: los descansos no gastan vacaciones.</small>}
          <label style={{ fontSize: 12, fontWeight: 700 }}>
            Motivo {form === 'AJUSTE' ? '(obligatorio)' : '(opcional)'}
            <input value={f.motivo} maxLength={300} onChange={(e) => setF({ ...f, motivo: e.target.value })} style={ENTRADA} />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <Boton type="button" disabled={ocupado || !valido} onClick={() => void registrar()}>Registrar</Boton>
            <Boton type="button" variante="secundario" disabled={ocupado} onClick={() => setForm(null)}>Cancelar</Boton>
          </div>
        </fieldset>
      )}
      {msg && <div role={msg.ok ? 'status' : 'alert'} style={{ fontWeight: 700, fontSize: 13, color: msg.ok ? 'var(--cp-green)' : 'var(--cp-rust)' }}>{msg.texto}</div>}
      {vac.movimientos.length === 0 ? <p className="as-ayuda">Aún no hay movimientos de vacaciones.</p> : (
        <div className="as-tabla-wrap">
          <table className="as-tabla as-tabla--tarjetas">
            <thead><tr><th>Tipo</th><th>Fechas</th><th>Días</th><th>Monto</th><th>Motivo</th><th /></tr></thead>
            <tbody>
              {vac.movimientos.map((m) => (
                <tr key={m.id} style={m.anulado ? { opacity: 0.55, textDecoration: 'line-through' } : undefined}>
                  <td data-label="Tipo">{ETIQUETA_MOV[m.tipo]} {m.anulado && <Insignia variante="neutro">Anulado</Insignia>}</td>
                  <td data-label="Fechas" className="as-num">{m.desde === m.hasta ? m.desde : `${m.desde} a ${m.hasta}`}</td>
                  <td data-label="Días" className="as-num">{m.dias}</td>
                  <td data-label="Monto" className="as-num">{m.monto ? soles(m.monto) : '—'}</td>
                  <td data-label="Motivo">{m.anulado ? m.anuladoMotivo : m.motivo || '—'}</td>
                  <td data-label="">
                    {!m.anulado && (anulando?.id === m.id ? (
                      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <input aria-label="Motivo para anular" placeholder="Motivo (mín. 3)" value={anulando.motivo} onChange={(e) => setAnulando({ id: m.id, motivo: e.target.value })} style={{ ...ENTRADA, width: 160 }} />
                        <Boton type="button" variante="peligro" tamano="pequeno" disabled={ocupado || anulando.motivo.trim().length < 3} onClick={() => void ejecutar(() => anularVacaciones(m.id, anulando.motivo.trim()), 'Movimiento anulado.')}>Confirmar</Boton>
                      </span>
                    ) : <Boton type="button" variante="secundario" tamano="pequeno" disabled={ocupado} onClick={() => setAnulando({ id: m.id, motivo: '' })}>Anular</Boton>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Pestaña «Vínculo y vacaciones» del modal de Planilla. */
export function PestanaVinculoVacaciones({ partyId, alCambiar }: { partyId: number; alCambiar?: () => void }) {
  const hook = useVinculo(partyId);
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <PanelVinculo partyId={partyId} hook={hook} />
      <h3 className="as-sub" style={{ margin: 0 }}>Vacaciones</h3>
      <PanelVacaciones partyId={partyId} hook={hook} alCambiar={alCambiar} />
    </div>
  );
}
