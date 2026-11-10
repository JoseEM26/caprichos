import { useCallback, useEffect, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { Insignia } from '../../comun/Insignia';
import {
  PrestamoApi,
  RecurrenteApi,
  anularPrestamo,
  crearPrestamo,
  crearRecurrente,
  editarRecurrente,
  listarPrestamos,
  soles,
} from './planillaApi';

const mensajeDe = (e: unknown, fallback: string) => (e as any)?.mensaje ?? (e as any)?.message ?? fallback;
const hoyLima = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
const CAJA = { border: '1px solid var(--cp-line)', borderRadius: 12, padding: 12, display: 'grid', gap: 10, margin: 0 } as const;
const ESTADO_CUOTA = { PENDIENTE: 'Pendiente', DESCONTADA: 'Descontada', OMITIDA: 'Omitida (pasó al final)' } as const;
type Datos = { netflixSemanalDefecto: number; prestamos: PrestamoApi[]; recurrentes: RecurrenteApi[] };
type Msg = { ok: boolean; texto: string } | null;

/** Carga préstamos y servicios extra de una persona y ejecuta acciones con aviso. */
function usarDatos(partyId: number, alCambiar: () => void) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [ocupado, setOcupado] = useState(false);
  const cargar = useCallback(async () => {
    try {
      setDatos(await listarPrestamos(partyId));
    } catch (e) {
      setMsg({ ok: false, texto: mensajeDe(e, 'No pudimos cargar los datos.') });
    }
  }, [partyId]);
  useEffect(() => { void cargar(); }, [cargar]);
  const ejecutar = async (fn: () => Promise<unknown>, ok: string) => {
    setOcupado(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, texto: ok });
      await cargar();
      alCambiar();
    } catch (e) {
      setMsg({ ok: false, texto: mensajeDe(e, 'No se pudo completar la acción.') });
    } finally {
      setOcupado(false);
    }
  };
  const aviso = msg && <div role={msg.ok ? 'status' : 'alert'} className={`as-aviso ${msg.ok ? 'as-aviso--ok' : 'as-aviso--alerta'}`}>{msg.texto}</div>;
  return { datos, ocupado, ejecutar, aviso };
}

/** Préstamos con cuotas fijas e interés mensual opcional (0 = sin intereses). Solo ADMIN (planilla/administrar). */
export function PrestamosPersona({ partyId, alCambiar }: { partyId: number; alCambiar: () => void }) {
  const { datos, ocupado, ejecutar, aviso } = usarDatos(partyId, alCambiar);
  const [nuevo, setNuevo] = useState({ monto: '', numCuotas: '4', periodicidad: 'SEMANAL' as 'SEMANAL' | 'MENSUAL', fechaInicio: hoyLima(), motivo: '', interes: '0' });
  const [anulando, setAnulando] = useState<{ id: number; motivo: string } | null>(null);

  if (!datos) return <Cargando mensaje="Cargando préstamos" />;
  const monto = Number(nuevo.monto);
  const cuotas = Number(nuevo.numCuotas);
  const interes = Number(nuevo.interes || 0);
  const valido = monto > 0 && Number.isInteger(cuotas) && cuotas >= 1 && cuotas <= 120 && interes >= 0 && interes <= 100;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {aviso}
      <fieldset style={CAJA}>
        <legend style={{ fontWeight: 800, fontSize: 14 }}>Nuevo préstamo</legend>
        <div className="as-form">
          <label className="as-campo">Monto (S/) <input type="number" min="0.01" step="0.01" inputMode="decimal" value={nuevo.monto} onChange={(e) => setNuevo({ ...nuevo, monto: e.target.value })} /></label>
          <label className="as-campo">Cuotas <input type="number" min="1" max="120" step="1" inputMode="numeric" value={nuevo.numCuotas} onChange={(e) => setNuevo({ ...nuevo, numCuotas: e.target.value })} /></label>
          <label className="as-campo">Una cuota cada
            <select value={nuevo.periodicidad} onChange={(e) => setNuevo({ ...nuevo, periodicidad: e.target.value as 'SEMANAL' | 'MENSUAL' })}>
              <option value="SEMANAL">Semana</option>
              <option value="MENSUAL">Mes</option>
            </select>
          </label>
          <label className="as-campo">Interés mensual (%) <input type="number" min="0" max="100" step="0.1" inputMode="decimal" value={nuevo.interes} onChange={(e) => setNuevo({ ...nuevo, interes: e.target.value })} /><small>0 = sin intereses.</small></label>
          <label className="as-campo">Empieza <input type="date" value={nuevo.fechaInicio} onChange={(e) => setNuevo({ ...nuevo, fechaInicio: e.target.value })} /></label>
        </div>
        <label className="as-campo">Motivo (opcional) <input value={nuevo.motivo} maxLength={300} onChange={(e) => setNuevo({ ...nuevo, motivo: e.target.value })} /></label>
        {valido && (
          <small className="as-nota">
            {interes > 0
              ? 'Las cuotas son fijas: el sistema calcula el interés y la cuota al registrar el préstamo.'
              : `Sin intereses. Cuota: ${soles(Math.round((monto / cuotas) * 100) / 100)}.`}{' '}
            Entra sola como descuento «Préstamo» en cada pago; al pagar se puede saltar una cuota y pasa al final.
          </small>
        )}
        <div>
          <Boton
            type="button"
            disabled={ocupado || !valido}
            onClick={() => void ejecutar(async () => { await crearPrestamo({ partyId, monto, numCuotas: cuotas, periodicidad: nuevo.periodicidad, fechaInicio: nuevo.fechaInicio || undefined, motivo: nuevo.motivo.trim() || undefined, ...(interes > 0 ? { interesPctMensual: interes } : {}) }); setNuevo({ ...nuevo, monto: '', motivo: '', interes: '0' }); }, 'Préstamo registrado.')}
          >
            Registrar préstamo
          </Boton>
        </div>
      </fieldset>

      {datos.prestamos.length === 0 ? <EstadoVacio titulo="Sin préstamos" descripcion="Esta persona no tiene préstamos registrados." /> : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
          {datos.prestamos.map((p) => {
            const tasa = p.interesPctMensual ?? 0;
            return (
              <li key={p.id} style={{ ...CAJA, opacity: p.estado === 'ANULADO' ? 0.65 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <span>
                    <strong>{soles(p.capital ?? p.monto)}</strong> en {p.numCuotas} cuotas ({p.periodicidad === 'SEMANAL' ? 'semanales' : 'mensuales'}) desde {p.fechaInicio}{' '}
                    <Insignia variante={p.estado === 'ACTIVO' ? 'aviso' : p.estado === 'SALDADO' ? 'exito' : 'neutro'}>{p.estado === 'ACTIVO' ? 'Activo' : p.estado === 'SALDADO' ? 'Saldado' : 'Anulado'}</Insignia>{' '}
                    <Insignia variante={tasa > 0 ? 'acento' : 'neutro'}>{tasa > 0 ? `Interés ${tasa} % mensual` : 'Sin intereses'}</Insignia>
                  </span>
                  <strong>Saldo {soles(p.saldo)}</strong>
                </div>
                <dl className="pl-cifras" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))' }}>
                  <div><dt>Capital</dt><dd>{soles(p.capital ?? p.monto)}</dd></div>
                  <div><dt>Interés</dt><dd>{soles(p.interesTotal ?? 0)}</dd></div>
                  <div><dt>Cuota</dt><dd>{soles(p.cuota ?? p.montoCuota)}</dd></div>
                  <div><dt>Saldo</dt><dd>{soles(p.saldo)}</dd></div>
                </dl>
                {p.motivo && <small>{p.motivo}</small>}
                {p.anuladoMotivo && <small className="as-nota">Anulado: {p.anuladoMotivo}</small>}
                <div className="as-tabla-wrap">
                  <table className="as-tabla">
                    <thead><tr><th>Cuota</th><th>Monto</th><th>Estado</th><th>Período</th></tr></thead>
                    <tbody>
                      {p.cuotas.map((c) => (
                        <tr key={c.id}>
                          <td className="as-num">{c.numero}{c.reprogramada ? ' (reprogramada)' : ''}</td>
                          <td className="as-num">{soles(c.monto)}</td>
                          <td>{ESTADO_CUOTA[c.estado]}</td>
                          <td className="as-num">{c.periodoDesde ? `${c.periodoDesde} a ${c.periodoHasta}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {p.estado === 'ACTIVO' && (
                  anulando?.id === p.id ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      <label className="as-campo">Motivo de la anulación <input value={anulando.motivo} onChange={(e) => setAnulando({ id: p.id, motivo: e.target.value })} /></label>
                      <div className="as-acciones">
                        <Boton type="button" variante="secundario" tamano="pequeno" onClick={() => setAnulando(null)}>Cancelar</Boton>
                        <Boton type="button" variante="peligro" tamano="pequeno" disabled={ocupado || anulando.motivo.trim().length < 3} onClick={() => void ejecutar(async () => { await anularPrestamo(p.id, anulando.motivo.trim()); setAnulando(null); }, 'Préstamo anulado. Los períodos ya pagados no cambian.')}>Anular préstamo</Boton>
                      </div>
                    </div>
                  ) : <Boton type="button" variante="texto" tamano="pequeno" onClick={() => setAnulando({ id: p.id, motivo: '' })}>Anular préstamo</Boton>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const ETIQUETA_PERIODO = { SEMANAL: 'por semana', MENSUAL: 'por mes' } as const;

/** Servicios extra (Netflix y otros pagos adicionales): check por persona, monto y periodicidad. */
export function ServiciosExtraPersona({ partyId, alCambiar }: { partyId: number; alCambiar: () => void }) {
  const { datos, ocupado, ejecutar, aviso } = usarDatos(partyId, alCambiar);
  const [otro, setOtro] = useState({ nombre: '', monto: '', periodicidad: 'MENSUAL' as 'SEMANAL' | 'MENSUAL' });
  if (!datos) return <Cargando mensaje="Cargando servicios extra" />;
  const tieneNetflix = datos.recurrentes.some((r) => r.tipo === 'NETFLIX');
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {aviso}
      <small className="as-nota">Pagos adicionales que se descuentan solos en cada pago (por semana o por mes). Desmarca para dejar de cobrarlos a esta persona.</small>
      {datos.recurrentes.length === 0 && <EstadoVacio titulo="Sin servicios extra" descripcion="Esta persona no tiene pagos adicionales." />}
      {datos.recurrentes.map((r) => (
        <label key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}>
          <input type="checkbox" checked={r.activo} disabled={ocupado} aria-label={`Cobrar ${r.nombre}`} onChange={(e) => void ejecutar(() => editarRecurrente(r.id, { activo: e.target.checked }), e.target.checked ? 'Se cobrará.' : 'Ya no se cobra.')} />
          <span style={{ flex: 1 }}>{r.nombre}</span>
          <strong className="as-num">{soles(r.monto)} {ETIQUETA_PERIODO[r.periodicidad ?? 'SEMANAL']}</strong>
        </label>
      ))}
      {!tieneNetflix && (
        <div>
          <Boton type="button" variante="secundario" disabled={ocupado} onClick={() => void ejecutar(() => crearRecurrente({ partyId, tipo: 'NETFLIX' }), 'Netflix agregado.')}>Cobrar Netflix ({soles(datos.netflixSemanalDefecto)} por semana)</Boton>
        </div>
      )}
      <fieldset style={CAJA}>
        <legend style={{ fontWeight: 800, fontSize: 14 }}>Agregar otro servicio</legend>
        <div className="as-form">
          <label className="as-campo">Nombre <input placeholder="Ej. Plan de celular" value={otro.nombre} maxLength={80} onChange={(e) => setOtro({ ...otro, nombre: e.target.value })} /></label>
          <label className="as-campo">Monto (S/) <input type="number" min="0.01" step="0.01" inputMode="decimal" value={otro.monto} onChange={(e) => setOtro({ ...otro, monto: e.target.value })} /></label>
          <label className="as-campo">Se cobra cada
            <select value={otro.periodicidad} onChange={(e) => setOtro({ ...otro, periodicidad: e.target.value as 'SEMANAL' | 'MENSUAL' })}>
              <option value="SEMANAL">Semana</option>
              <option value="MENSUAL">Mes</option>
            </select>
          </label>
        </div>
        <div>
          <Boton type="button" variante="secundario" disabled={ocupado || otro.nombre.trim().length < 2 || !(Number(otro.monto) > 0)} onClick={() => void ejecutar(async () => { await crearRecurrente({ partyId, tipo: 'OTRO', nombre: otro.nombre.trim(), monto: Number(otro.monto), periodicidad: otro.periodicidad }); setOtro({ ...otro, nombre: '', monto: '' }); }, 'Servicio agregado.')}>Agregar servicio</Boton>
        </div>
      </fieldset>
    </div>
  );
}
