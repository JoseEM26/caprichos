import { useMemo, useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { PlanPagoEditor } from '../salon/componentes/PlanPagoEditor';
import { MEDIOS_PLAN, aPlan, errorPlan, montoEfectivoPlan, nombreMedio, planInicial, type FilaPlan, type MedioPlan } from './planPago';
import { pedidosApi, type Pedido } from './pedidosApi';

const soles = (n: number) => `S/ ${n.toFixed(2)}`;
const esMedio = (m: string): m is MedioPlan => MEDIOS_PLAN.some((x) => x.id === m);

/** Venta + propina: lo que el plan debe sumar (igual que el servidor). */
export const totalCobrablePedido = (p: Pick<Pedido, 'total' | 'propina'>) => Math.round((Number(p.total || 0) + Number(p.propina ?? 0)) * 100) / 100;

/** Plan que tiene hoy el pedido, como filas editables. Un cobro «MIXTO» sin renglones arranca en Efectivo por el total. */
function filasActuales(pedido: Pedido, total: number): FilaPlan[] {
  const plan = pedido.planPago ?? [];
  if (plan.length > 0) return plan.map((f) => ({ medio: String(f.medio).toUpperCase() as MedioPlan, monto: Number(f.monto).toFixed(2) }));
  const m = String(pedido.pago_metodo || pedido.pago_preferido || 'EFECTIVO').toUpperCase();
  return planInicial(esMedio(m) ? m : 'EFECTIVO', total);
}

const textoFilas = (filas: Array<{ medio: string; monto: number | string }>) =>
  filas.map((f) => `${nombreMedio(f.medio)} ${soles(Number(f.monto))}`).join(' + ');

/**
 * «Cambiar método de pago» / «Agregar otro método»: siempre disponible para quien ve Caja (y el repartidor o mozo en sus
 * pedidos) mientras el pedido no esté anulado. Sin código de supervisor ni aprobación; el motivo es opcional.
 */
export function BotonCambiarPago({
  pedido,
  variante = 'detalle',
  alExito,
  permitido,
}: {
  pedido: Pedido;
  /** tiene('pedidos/ajustar_pago'): lo decide quien lo pinta (la tarjeta no usa la sesión) */
  permitido: boolean;
  variante?: 'detalle' | 'tarjeta';
  alExito?: (mensaje: string) => void;
}) {
  const [modo, setModo] = useState<'cambiar' | 'agregar' | null>(null);
  const [filas, setFilas] = useState<FilaPlan[]>([]);
  const [pagaCon, setPagaCon] = useState('');
  const [motivo, setMotivo] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState('');

  const total = totalCobrablePedido(pedido);
  const antes = useMemo(() => textoFilas(filasActuales(pedido, total)), [pedido, total]);
  const plan = aPlan(filas);
  const falla = errorPlan(total, filas);
  const efectivo = montoEfectivoPlan(plan);
  const pagaConMalo = efectivo > 0 && pagaCon !== '' && !(Number(pagaCon) >= efectivo);

  if (String(pedido.estado).toUpperCase() === 'ANULADO' || !permitido) return null;

  const abrir = (m: 'cambiar' | 'agregar') => {
    const actual = filasActuales(pedido, total);
    const usados = new Set(actual.map((f) => f.medio));
    const libre = MEDIOS_PLAN.find((x) => !usados.has(x.id))?.id ?? 'YAPE';
    setFilas(m === 'agregar' && actual.length < MEDIOS_PLAN.length ? [...actual, { medio: libre, monto: '' }] : actual);
    setPagaCon(pedido.paga_con != null ? String(pedido.paga_con) : '');
    setMotivo('');
    setError('');
    setHecho('');
    setModo(m);
  };

  const confirmar = async () => {
    setEnviando(true);
    setError('');
    try {
      const r = await pedidosApi.ajustarPago(pedido.id, { plan, pagaCon: efectivo > 0 && pagaCon !== '' ? Number(pagaCon) : null, ...(motivo.trim() ? { motivo: motivo.trim() } : {}) });
      const msg = [r.mensaje || 'Pago actualizado', ...(r.avisos ?? [])].join('. ');
      setConfirmando(false);
      setModo(null);
      setHecho(msg);
      alExito?.(msg);
    } catch (err: any) {
      setConfirmando(false);
      setError(err?.message || 'No se pudo cambiar el pago');
    } finally {
      setEnviando(false);
    }
  };

  const estilo = variante === 'tarjeta' ? { minHeight: 44, fontSize: 13, background: 'transparent', border: '1px solid var(--cp-line, #E3D6C6)', borderRadius: 10, color: 'var(--cp-soft, #2C4C5D)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: '0 12px' } : undefined;

  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className={variante === 'detalle' ? 'dp-btn' : undefined} style={estilo} data-testid="btn-cambiar-pago-caja" onClick={() => abrir('cambiar')}>
          Cambiar método de pago
        </button>
        {variante === 'detalle' && (
          <button type="button" className="dp-btn" data-testid="btn-agregar-metodo" onClick={() => abrir('agregar')}>
            Agregar otro método
          </button>
        )}
      </div>
      {hecho && (
        <div role="status" style={{ fontSize: 13, fontWeight: 700, color: '#1F5C33' }}>
          {hecho}
        </div>
      )}
      {modo && (
        <>
          <div onClick={() => setModo(null)} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(11, 44, 62, 0.55)' }} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Elegir método de pago"
            style={{ position: 'fixed', zIndex: 80, left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(560px, calc(100% - 24px))', maxHeight: 'calc(100% - 24px)', overflowY: 'auto', background: 'var(--cp-cream, #FBF4EC)', borderRadius: 20, padding: 18, display: 'flex', flexDirection: 'column', gap: 12, boxSizing: 'border-box' }}
          >
            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--cp-navy)' }}>
              {modo === 'agregar' ? 'Agregar otro método' : 'Cambiar método de pago'} · {pedido.codigo}
            </div>
            <div style={{ fontSize: 13 }}>
              Total a cobrar: <strong>{soles(total)}</strong>. Se aplica al instante, sin código de supervisor.
            </div>
            <PlanPagoEditor total={total} filas={filas} onChange={setFilas} pagaCon={pagaCon} onPagaCon={setPagaCon} />
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 700 }}>
              Motivo (opcional)
              <input
                value={motivo}
                maxLength={120}
                onChange={(e) => setMotivo(e.target.value)}
                style={{ minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-line, #E3D6C6)', padding: '0 12px', fontFamily: 'inherit', fontSize: 15 }}
              />
            </label>
            {pagaConMalo && (
              <div role="alert" style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
                Con cuánto paga debe ser al menos {soles(efectivo)}
              </div>
            )}
            {error && (
              <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="dp-btn" style={{ flex: 1 }} onClick={() => setModo(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="dp-btn"
                data-testid="continuar-cambio-pago"
                disabled={!!falla || pagaConMalo}
                style={{ flex: 1, background: 'var(--cp-navy, #0B2C3E)', color: 'var(--cp-cream, #FBF4EC)' }}
                onClick={() => setConfirmando(true)}
              >
                Continuar
              </button>
            </div>
          </div>
        </>
      )}
      <Confirmar
        abierto={confirmando}
        titulo="Confirmar cambio de pago"
        mensaje={`Antes: ${antes} → Ahora: ${textoFilas(plan)}. ¿Confirmas el cambio?`}
        textoSi="Sí, cambiar"
        textoNo="No"
        cargando={enviando}
        alConfirmar={confirmar}
        alCancelar={() => setConfirmando(false)}
      />
    </>
  );
}

/** Marca discreta «Pago modificado por <usuario> · hora» con el antes → ahora (viene del historial del pedido). */
export function MarcaPagoModificado({ pedido }: { pedido: Pedido }) {
  const a = pedido.ajustePago;
  if (!a) return null;
  const hora = new Date(a.en).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });
  const repartidor = a.texto.startsWith('Pago modificado por el repartidor');
  return (
    <div data-testid="marca-pago-modificado" style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
      {repartidor ? `Cambio de pago hecho por el repartidor${a.por ? ` ${a.por}` : ''}` : `Pago modificado${a.por ? ` por ${a.por}` : ''}`} · {hora}
      <div>{a.texto.replace(/^Pago modificado( por el repartidor)?: /, '')}</div>
    </div>
  );
}
