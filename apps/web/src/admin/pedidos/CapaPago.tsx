import { useMemo, useState } from 'react';
import { useSesion } from '../../comun/sesion';
import {
  SelectorComprobante,
  aPayloadComprobante,
  errorValorComprobante,
  etiquetaComprobante,
  type TipoComprobanteSel,
  type ValorComprobante,
} from './SelectorComprobante';
import { Confirmar } from '../../comun/Confirmar';
import { pedidosApi, montoPorCobrar, type Pedido } from './pedidosApi';
import { SeccionVouchersPedido } from './SeccionVouchersPedido';
import { CapturasPlanDigital } from './CapturasPlanDigital';
import { InsigniaCambioCobro } from './PanelCambioCobro';
import { digitalesDelPlan, faltanCapturas, medioDigitalVoucher } from './mediosPago';
import { nombreMedio } from './planPago';
import { BotonCambiarPago, MarcaPagoModificado } from './CambiarPago';
import type { VoucherPagoItem } from '../vouchers/tipos';

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

/** Comprobante guardado en el pedido como valor del selector. Sin simple, boleta ni factura guardada (nota de venta antigua), sin elegir. */
function valorDelPedido(pedido: Pedido): ValorComprobante {
  const t = String(pedido.comprobante_tipo ?? '').toUpperCase();
  const tipo: TipoComprobanteSel | null = t === 'SIMPLE' || t === 'BOLETA' || t === 'FACTURA' ? t : null;
  return {
    tipo,
    doc: tipo === null ? '' : pedido.comprobante_doc ?? '',
    razon: pedido.comprobante_razon ?? '',
    direccion: pedido.comprobante_direccion ?? '',
  };
}

/** Efectivo a cobrar (del plan, o todo el total si paga solo en efectivo) y vuelto. Sin efectivo, null. */
export function calcularVuelto(pedido: Pedido): { efectivo: number; pagaCon: number; vuelto: number } | null {
  const total = montoPorCobrar(pedido);
  const plan = pedido.planPago ?? [];
  let efectivo = 0;
  if (plan.length > 0) {
    efectivo = plan.filter((f) => String(f.medio).toUpperCase() === 'EFECTIVO').reduce((a, f) => a + Number(f.monto || 0), 0);
  } else {
    const medios = String(pedido.pago_metodo || pedido.pago_preferido || pedido.cobroMozo?.medio || '').toUpperCase();
    efectivo = medios.includes('EFECTIVO') ? total : 0;
  }
  if (efectivo <= 0) return null;
  const pagaCon = Number(pedido.paga_con ?? pedido.cobroMozo?.recibido ?? 0) || 0;
  const vuelto = pagaCon > efectivo ? Math.round((pagaCon - efectivo) * 100) / 100 : 0;
  return { efectivo, pagaCon, vuelto };
}

export interface CapaPagoProps {
  pedido: Pedido;
  esMesa: boolean;
  estaPagado: boolean;
  cambioCobroPendiente: boolean;
  alRechazarCobroMozo: () => void;
  alExito: (mensaje: string) => void;
  alActualizar: () => void;
}

/** Capa 2: estado del cobro, plan de pago, vuelto, comprobante, cobro por mozo y la captura del pago en una fila corta. */
export function CapaPago({ pedido, esMesa, estaPagado, cambioCobroPendiente, alRechazarCobroMozo, alExito, alActualizar }: CapaPagoProps) {
  const { tiene } = useSesion();
  const est = String(pedido.estado || '').toUpperCase();
  const tipoComp = pedido.comprobante_tipo ? etiquetaComprobante(pedido.comprobante_tipo) : 'Sin elegir';
  const total = montoPorCobrar(pedido);
  const plan = pedido.planPago ?? [];
  const medioTxt = pedido.pago_metodo || pedido.pago_preferido || 'Efectivo';
  const digitales = useMemo(() => digitalesDelPlan(plan), [plan]);
  const medioDigital = medioDigitalVoucher(pedido.pago_metodo || pedido.pago_preferido);
  const [vouchers, setVouchers] = useState<VoucherPagoItem[] | null>(null);
  const faltan = useMemo(() => (vouchers ? faltanCapturas(digitales, vouchers) : []), [digitales, vouchers]);
  const v = calcularVuelto(pedido);

  // Cambiar comprobante: solo antes de cobrar y sin comprobante emitido (la API lo rechaza si no)
  const [cambiandoComp, setCambiandoComp] = useState(false);
  const [valorCambio, setValorCambio] = useState<ValorComprobante>(() => valorDelPedido(pedido));
  const [confirmarCambio, setConfirmarCambio] = useState(false);
  const [guardandoComp, setGuardandoComp] = useState(false);
  const [errorComp, setErrorComp] = useState<string | null>(null);

  return (
    <div className="dp-grid dp-grid-2">
      <div className="dp-col">
        <section className="dp-sec" aria-label="Estado del cobro">
          <h3 className="dp-sec-titulo">Cómo se paga</h3>
          <div className="dp-fila">
            <span>Estado del pago</span>
            <span
              className="dp-chip"
              style={{ background: estaPagado ? 'var(--cp-greenbg, #DFF3E3)' : '#FFF0E6', color: estaPagado ? '#1F5C33' : 'var(--cp-rust, #B2500F)' }}
            >
              {estaPagado ? 'PAGADO' : 'PENDIENTE'}
            </span>
          </div>
          {cambioCobroPendiente && (
            <div className="dp-fila">
              <span>Cambio de cobro</span>
              <InsigniaCambioCobro />
            </div>
          )}
          {plan.length > 0 ? (
            plan.map((f, i) => {
              const m = String(f.medio).toUpperCase();
              const digital = medioDigitalVoucher(m) !== null;
              const falta = digital && faltan.includes(m);
              return (
                <div key={i} className="dp-medio" data-testid={`plan-${m.toLowerCase()}`}>
                  <span style={{ fontWeight: 800, fontSize: 16 }}>{nombreMedio(m)}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span
                      className="dp-chip"
                      style={{
                        background: !digital ? 'var(--cp-line, #E3D6C6)' : falta ? '#FFF0E6' : '#DFF3E3',
                        color: !digital ? 'var(--cp-soft, #2C4C5D)' : falta ? 'var(--cp-rust, #B2500F)' : '#1F5C33',
                      }}
                    >
                      {!digital ? 'Sin captura' : vouchers === null ? 'Cargando captura' : falta ? 'Falta captura' : 'Captura subida'}
                    </span>
                    <strong style={{ fontSize: 17 }}>{soles(Number(f.monto || 0))}</strong>
                  </span>
                </div>
              );
            })
          ) : (
            <div className="dp-fila">
              <span>Medio de pago</span>
              <strong>{medioTxt}</strong>
            </div>
          )}
          {plan.length > 0 && (
            <div className="dp-fila" style={{ fontSize: 14 }}>
              <span>Medio de pago</span>
              <strong>{medioTxt}</strong>
            </div>
          )}

          {/* Cambiar o agregar medio de pago: siempre, para todo pedido no anulado (sin código ni aprobación) */}
          {est === 'ANULADO' ? (
            <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>Pedido anulado: no se puede cambiar el pago.</div>
          ) : (
            <BotonCambiarPago permitido={tiene('pedidos/ajustar_pago')} pedido={pedido} alExito={(m) => { alExito(m); alActualizar(); }} />
          )}
          <MarcaPagoModificado pedido={pedido} />

          {/* Comprobante */}
          <div className="dp-fila" style={{ fontSize: 14 }}>
            <span>Comprobante</span>
            <strong>{tipoComp}</strong>
          </div>
          {tiene('caja/cobrar') && !estaPagado && est !== 'ANULADO' && !cambiandoComp && (
            <button
              type="button"
              className="dp-btn"
              onClick={() => {
                setValorCambio(valorDelPedido(pedido));
                setErrorComp(null);
                setCambiandoComp(true);
              }}
            >
              Cambiar comprobante
            </button>
          )}
          {cambiandoComp && (
            <div aria-label="Cambiar comprobante" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <SelectorComprobante idPrefijo="pd-comp" valor={valorCambio} onChange={setValorCambio} total={total} />
              {errorComp && (
                <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
                  {errorComp}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="dp-btn"
                  style={{ flex: '1 1 140px', background: 'var(--cp-navy, #0B2C3E)', color: 'var(--cp-cream, #FBF4EC)' }}
                  onClick={() => {
                    const err = errorValorComprobante(valorCambio);
                    if (err) {
                      setErrorComp(err.mensaje);
                      document.getElementById(`pd-comp-${err.campo}`)?.focus();
                      return;
                    }
                    setErrorComp(null);
                    setConfirmarCambio(true);
                  }}
                >
                  Guardar comprobante
                </button>
                <button type="button" className="dp-btn" style={{ flex: '1 1 140px' }} onClick={() => setCambiandoComp(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </section>

        {v && (
          <section
            data-testid="vuelto"
            aria-label="Vuelto"
            className={`dp-vuelto${v.vuelto > 0 ? ' dp-vuelto-si' : ''}`}
          >
            <div className="dp-vuelto-rotulo">Vuelto</div>
            <div className="dp-vuelto-valor">
              {v.vuelto > 0 ? `SÍ lleva vuelto: ${soles(v.vuelto)}` : v.pagaCon > 0 ? 'NO lleva vuelto' : 'No indicó con cuánto paga'}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
              {v.pagaCon > 0 ? `Paga con ${soles(v.pagaCon)} · efectivo ${soles(v.efectivo)}` : `Efectivo ${soles(v.efectivo)}`}
            </div>
          </section>
        )}

        {pedido.cobroMozo && (
          <section className="dp-sec" aria-label="Cobro por mozo">
            <h3 className="dp-sec-titulo">Cobro por mozo</h3>
            <span style={{ fontSize: 14, color: 'var(--cp-soft, #2C4C5D)' }}>
              Mozo: {pedido.cobroMozo.mozo || 'sin nombre'} · a las{' '}
              {new Date(pedido.cobroMozo.en).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })}
            </span>
            {pedido.cobroMozo.recibido != null && (
              <span style={{ fontSize: 14, fontWeight: 700 }}>
                Recibió S/ {Number(pedido.cobroMozo.recibido).toFixed(2)} · vuelto S/ {Number(pedido.cobroMozo.vuelto ?? 0).toFixed(2)}
              </span>
            )}
            {tiene('caja/cobrar') && pedido.pago_estado !== 'PAGADO' && (
              <button type="button" className="dp-btn dp-btn-rust" style={{ alignSelf: 'flex-start' }} onClick={alRechazarCobroMozo}>
                Rechazar cobro del mozo
              </button>
            )}
          </section>
        )}

        <section className="dp-sec" aria-label="Total a cobrar">
          {esMesa && (
            <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
              La mesa se libera al cobrar. Un mozo o caja también puede liberarla a mano en Nuevo pedido, En el local. La precuenta está en la barra de abajo.
            </div>
          )}
          <div className="dp-fila">
            <span style={{ fontWeight: 800, color: 'var(--cp-navy, #0B2C3E)' }}>Total</span>
            <span className="dp-total-grande">{soles(total)}</span>
          </div>
        </section>
      </div>

      <section className="dp-sec" aria-label="Capturas de pago" style={{ minWidth: 0 }}>
        <h3 className="dp-sec-titulo">Capturas de pago</h3>
        {digitales.length >= 2 && (
          <CapturasPlanDigital pedidoId={pedido.id} planPago={plan} alCambiar={() => undefined} />
        )}
        <SeccionVouchersPedido
          pedidoId={pedido.id}
          recargarClave={pedido.pago_estado}
          total={montoPorCobrar(pedido)}
          medio={pedido.pago_metodo || pedido.pago_preferido || null}
          alCargar={setVouchers}
          compacto
          ofrecerSubida={digitales.length < 2 && (digitales.length === 1 || medioDigital !== null)}
        />
      </section>

      <Confirmar
        abierto={confirmarCambio}
        titulo="Cambiar comprobante"
        mensaje={`¿Cambiar el comprobante del pedido a ${valorCambio.tipo ? etiquetaComprobante(valorCambio.tipo) : ''}${valorCambio.tipo !== 'SIMPLE' && valorCambio.doc.trim() ? ` (${valorCambio.tipo === 'FACTURA' ? 'RUC' : 'DNI'} ${valorCambio.doc.trim()})` : ''}? ${valorCambio.tipo === 'SIMPLE' ? 'No se envía a SUNAT.' : 'Caja lo emitirá al cobrar.'}`}
        textoSi="Sí, cambiar"
        textoNo="No"
        cargando={guardandoComp}
        alConfirmar={async () => {
          setGuardandoComp(true);
          setErrorComp(null);
          try {
            const dto = aPayloadComprobante(valorCambio);
            if (!dto) throw new Error('Elige comprobante simple, boleta o factura');
            await pedidosApi.cambiarComprobante(pedido.id, dto);
            setConfirmarCambio(false);
            setCambiandoComp(false);
            alExito('Comprobante cambiado');
            alActualizar();
          } catch (err: any) {
            setConfirmarCambio(false);
            setErrorComp(err?.message || 'No se pudo cambiar el comprobante');
          } finally {
            setGuardandoComp(false);
          }
        }}
        alCancelar={() => setConfirmarCambio(false)}
      />
    </div>
  );
}
