import { useState } from 'react';
import { usePideCodigo } from '../../comun/usePideCodigo';
import { Confirmar } from '../../comun/Confirmar';
import { pedidosApi, Pedido } from './pedidosApi';
import { SubirVoucherMozo } from '../vouchers/SubirVoucherMozo';
import { SeccionVouchersPedido } from './SeccionVouchersPedido';
import { digitalesDelPlan, medioDigitalVoucher, mismoMedio } from './mediosPago';
import { CapturasPlanDigital, ExcepcionSinVoucher } from './CapturasPlanDigital';
import type { VoucherPagoItem } from '../vouchers/tipos';
import { useConfirmarImpresion } from '../impresion/useConfirmarImpresion';
import { BotonAbrirChatCliente } from '../mensajes/BotonAbrirChatCliente';

export interface ModalConfirmarPagoProps {
  pedido: Pedido;
  alCerrar: () => void;
  alConfirmarExitoso: () => void;
}

const MEDIOS_PC = ['Yape', 'Plin', 'Efectivo', 'Tarjeta', 'Transferencia'] as const;

const MOTIVO_MINIMO = 5;

export function ModalConfirmarPago({ pedido, alCerrar, alConfirmarExitoso }: ModalConfirmarPagoProps) {
  const { pedir: pedirImpresion, dialogo: dialogoImpresion } = useConfirmarImpresion();
  const [contactado, setContactado] = useState(false);
  const [medio, setMedio] = useState<string>(pedido.pago_metodo || pedido.pago_preferido || 'Yape');
  const [montoPagaCon, setMontoPagaCon] = useState(pedido.paga_con ? String(pedido.paga_con) : '');
  const [codigoOp, setCodigoOp] = useState('');
  // Vouchers ya enlazados al pedido (cualquier origen) y la foto que acaba de subir esta ventana
  const [vouchersPedido, setVouchersPedido] = useState<VoucherPagoItem[]>([]);
  const [voucherSubido, setVoucherSubido] = useState<string | number | null>(null);
  const [msg, setMsg] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [confirmandoSiNo, setConfirmandoSiNo] = useState(false);
  // Excepción «Confirmar sin comprobante»: motivo escrito + código rotativo del supervisor
  const [sinVoucher, setSinVoucher] = useState(false);
  const [motivoSinVoucher, setMotivoSinVoucher] = useState('');
  const [pinSupervisor, setPinSupervisor] = useState('');
  const pideCodigo = usePideCodigo();

  const esEfectivo = mismoMedio(medio, 'Efectivo');
  const esTarjeta = mismoMedio(medio, 'Tarjeta');
  const esDigital = !esEfectivo && !esTarjeta;
  const medioVoucher = medioDigitalVoucher(medio);
  // Pago dividido con 2 o más medios digitales: una captura por medio (igual que el servidor)
  const mediosPlanDigital = digitalesDelPlan(pedido.planPago);
  const multiples = mediosPlanDigital.length >= 2;
  // Medios digitales del plan sin captura; hasta que cargue, todos cuentan como faltantes
  const [faltanCapturas, setFaltanCapturas] = useState<string[]>(mediosPlanDigital);
  // Un voucher ilegible no cuenta como comprobante; cualquier otro del pedido sí (la IA solo informa)
  const comprobanteListo = multiples
    ? faltanCapturas.length === 0
    : voucherSubido !== null || vouchersPedido.some((v) => v.semaforo !== 'ILEGIBLE');
  const esDelivery = (pedido.modalidad || '').toUpperCase() === 'DELIVERY';
  const tieneUbicacion =
    (pedido.entrega_lat != null && pedido.entrega_lng != null) || Boolean(pedido.zona);

  const handleConfirmar = () => {
    if (!contactado) {
      setMsg('Marca la casilla confirmando que hablaste con el cliente.');
      return;
    }
    if (esDelivery && !tieneUbicacion) {
      setMsg('Para delivery primero ubica la dirección en el mapa (calcula la zona y el envío).');
      return;
    }
    if ((esDigital || multiples) && !comprobanteListo) {
      if (!sinVoucher) {
        setMsg('Sube el comprobante del pago para continuar.');
        return;
      }
      if (motivoSinVoucher.trim().length < MOTIVO_MINIMO) {
        setMsg(`El motivo debe tener al menos ${MOTIVO_MINIMO} caracteres`);
        return;
      }
      if (pideCodigo && pinSupervisor.length !== 6) {
        setMsg('El código del supervisor son 6 dígitos');
        return;
      }
    }
    setMsg('');
    setConfirmandoSiNo(true);
  };

  // Solo viaja la excepción si el pago digital sigue sin comprobante útil
  const excepcionSinVoucher =
    (esDigital || multiples) && !comprobanteListo && sinVoucher
      ? { motivo: motivoSinVoucher.trim(), pinSupervisor: pideCodigo ? pinSupervisor : undefined }
      : undefined;

  const ejecutarConfirmacion = async () => {
    setEnviando(true);
    setMsg('');
    try {
      await pedidosApi.registrarPago(
        pedido.id,
        medio.toUpperCase(),
        esDigital ? 'PAGADO' : 'COORDINADO',
        excepcionSinVoucher,
      );
      if (String(pedido.estado).toUpperCase() === 'NUEVO') {
        await pedidosApi.cambiarEstado(
          pedido.id,
          'COLA',
          'Confirmado con cliente y pago verificado',
        );
      }
      setConfirmandoSiNo(false);
      alConfirmarExitoso();
    } catch (err: any) {
      setConfirmandoSiNo(false);
      setMsg(err?.message || 'Error al confirmar el pedido');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <div
        onClick={alCerrar}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          background: 'rgba(11,44,62,0.55)',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confirmar pedido y pago"
        style={{
          position: 'fixed',
          zIndex: 60,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: 'min(670px,calc(100% - 24px))',
          maxHeight: 'calc(100% - 24px)',
          overflowY: 'auto',
          background: 'var(--cp-cream, #FBF4EC)',
          borderRadius: 20,
          boxShadow: '0 20px 50px rgba(11,44,62,0.4)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'Montserrat,sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--cp-navy, #0B2C3E)' }}>
            Confirmar {pedido.codigo}
          </div>
          <button
            onClick={alCerrar}
            aria-label="Cerrar"
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              border: '1.5px solid var(--cp-navy, #0B2C3E)',
              background: 'transparent',
              color: 'var(--cp-navy, #0B2C3E)',
              fontSize: 20,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ fontSize: 13, lineHeight: '18px', color: 'var(--cp-soft, #2C4C5D)' }}>
          Habla con el cliente por WhatsApp para confirmar que todo esté bien y verificar el pago. Solo después de confirmar pasa a las pantallas de cocina.
        </div>

        {/* 1. Contacto con el cliente */}
        <div style={{ border: '1.5px solid var(--cp-navy, #0B2C3E)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontWeight: 800 }}>1. Contacto con el cliente</div>
          <div style={{ fontSize: 13 }}>
            Cliente: <b>{pedido.cliente_nombre || 'Cliente'}</b> · {pedido.cliente_telefono || 'Sin teléfono'}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--cp-soft, #2C4C5D)',
              background: 'var(--cp-white, #FFFFFF)',
              border: '1px solid var(--cp-line, #E3D6C6)',
              borderRadius: 8,
              padding: '8px 10px',
              whiteSpace: 'pre-line',
              maxHeight: 200,
              overflowY: 'auto',
            }}
          >
            {pedido.lineas && pedido.lineas.length > 0
              ? pedido.lineas.map((l) => `${l.cantidad}× ${l.nombre}`).join('\n')
              : `Total a cobrar: S/ ${Number(pedido.total).toFixed(2)}`}
          </div>

          <BotonAbrirChatCliente telefono={pedido.cliente_telefono} />

          <button
            type="button"
            onClick={() => {
              setContactado(!contactado);
              setMsg('');
            }}
            role="checkbox"
            aria-checked={contactado}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              textAlign: 'left',
              minHeight: 44,
              padding: '4px 0',
              border: 0,
              background: 'transparent',
              color: 'var(--cp-navy, #0B2C3E)',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                flex: 'none',
                width: 24,
                height: 24,
                borderRadius: 6,
                border: '2px solid var(--cp-navy, #0B2C3E)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                background: contactado ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
                color: contactado ? 'var(--cp-cream, #FBF4EC)' : 'transparent',
              }}
            >
              ✓
            </span>
            <span>Ya hablé con el cliente y el pedido está bien</span>
          </button>
        </div>

        {/* Comprobantes ya enlazados al pedido (carta, WhatsApp, mozo): con su lectura, no obligan a subir otra */}
        <SeccionVouchersPedido
          pedidoId={pedido.id}
          recargarClave={voucherSubido}
          total={pedido.total}
          medio={medio}
          alCargar={setVouchersPedido}
        />

        {/* 2. Medio de pago */}
        <div style={{ border: '1.5px solid var(--cp-navy, #0B2C3E)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontWeight: 800 }}>2. Medio de pago</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {MEDIOS_PC.map((m) => {
              const activo = mismoMedio(medio, m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMedio(m);
                    setMsg('');
                  }}
                  style={{
                    minHeight: 42,
                    padding: '0 14px',
                    borderRadius: 9999,
                    border: '1.5px solid var(--cp-navy, #0B2C3E)',
                    background: activo ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
                    color: activo ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-navy, #0B2C3E)',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {m}
                </button>
              );
            })}
          </div>

          {esEfectivo && (
            <div>
              <label htmlFor="pc-m" style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>
                ¿Con cuánto paga? (para el vuelto, opcional)
              </label>
              <input
                id="pc-m"
                type="text"
                value={montoPagaCon}
                onChange={(e) => setMontoPagaCon(e.target.value)}
                placeholder="s/"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 44,
                  borderRadius: 10,
                  border: '1.5px solid var(--cp-line, #E3D6C6)',
                  background: 'var(--cp-white, #FFFFFF)',
                  padding: '0 12px',
                  fontSize: 14,
                }}
              />
              <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)', marginTop: 4 }}>
                El efectivo se cobra al entregar o al recoger. No hace falta comprobante.
              </div>
            </div>
          )}

          {esTarjeta && (
            <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
              La tarjeta se cobra al entregar o al recoger. No hace falta comprobante.
            </div>
          )}

          {esDigital && (
            <div>
              <label htmlFor="pc-r" style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>
                Código de operación (opcional)
              </label>
              <input
                id="pc-r"
                type="text"
                value={codigoOp}
                onChange={(e) => setCodigoOp(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 44,
                  borderRadius: 10,
                  border: '1.5px solid var(--cp-line, #E3D6C6)',
                  background: 'var(--cp-white, #FFFFFF)',
                  padding: '0 12px',
                  fontSize: 14,
                }}
              />
              {!multiples && !comprobanteListo && medioVoucher && !sinVoucher && (
                <>
                  <div style={{ fontWeight: 700, fontSize: 13, marginTop: 8, marginBottom: 4 }}>
                    Comprobante del pago (obligatorio)
                  </div>
                  {/* Mismo camino que el cobro en caja: la foto se guarda como voucher del pedido y la IA solo informa */}
                  <SubirVoucherMozo
                    key={medioVoucher}
                    pedidoId={pedido.id}
                    medio={medioVoucher}
                    ofrecerExcepcion
                    alVoucherValido={(info) => {
                      if (info.legible) setVoucherSubido(info.id);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSinVoucher(true);
                      setMsg('');
                    }}
                    style={{
                      minHeight: 44,
                      marginTop: 8,
                      border: '1.5px solid var(--cp-navy, #0B2C3E)',
                      borderRadius: 10,
                      background: 'transparent',
                      color: 'var(--cp-navy, #0B2C3E)',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Confirmar sin comprobante
                  </button>
                </>
              )}
              {!multiples && !comprobanteListo && medioVoucher && sinVoucher && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  <ExcepcionSinVoucher
                    motivo={motivoSinVoucher}
                    onMotivo={setMotivoSinVoucher}
                    pin={pinSupervisor}
                    onPin={setPinSupervisor}
                    alVolver={() => {
                      setSinVoucher(false);
                      setMotivoSinVoucher('');
                      setPinSupervisor('');
                      setMsg('');
                    }}
                  />
                </div>
              )}
              {comprobanteListo && (
                <div data-testid="voucher-listo-confirmar" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-green, #2F7A45)', marginTop: 8 }}>
                  Comprobante del pedido listo para confirmar.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pago dividido con 2 o más medios digitales: una captura por cada uno (el servidor exige cada una) */}
        {multiples && (
          <div style={{ border: '1.5px solid var(--cp-navy, #0B2C3E)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 800 }}>Comprobantes de los pagos digitales</div>
            <CapturasPlanDigital pedidoId={pedido.id} planPago={pedido.planPago ?? []} alCambiar={setFaltanCapturas} />
            {!comprobanteListo && !sinVoucher && (
              <button
                type="button"
                onClick={() => {
                  setSinVoucher(true);
                  setMsg('');
                }}
                style={{
                  minHeight: 44,
                  border: '1.5px solid var(--cp-navy, #0B2C3E)',
                  borderRadius: 10,
                  background: 'transparent',
                  color: 'var(--cp-navy, #0B2C3E)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Confirmar sin comprobante
              </button>
            )}
            {!comprobanteListo && sinVoucher && (
              <ExcepcionSinVoucher
                motivo={motivoSinVoucher}
                onMotivo={setMotivoSinVoucher}
                pin={pinSupervisor}
                onPin={setPinSupervisor}
                alVolver={() => {
                  setSinVoucher(false);
                  setMotivoSinVoucher('');
                  setPinSupervisor('');
                  setMsg('');
                }}
              />
            )}
            {comprobanteListo && (
              <div data-testid="voucher-listo-confirmar" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-green, #2F7A45)' }}>
                Todas las capturas están subidas. Listo para confirmar.
              </div>
            )}
          </div>
        )}

        {msg && (
          <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
            {msg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={enviando}
            style={{
              flex: 1,
              minHeight: 52,
              border: 0,
              borderRadius: 12,
              background: 'var(--cp-orange, #E67929)',
              color: 'var(--cp-navy, #0B2C3E)',
              fontFamily: 'Montserrat,sans-serif',
              fontWeight: 800,
              fontSize: 15,
              cursor: enviando ? 'not-allowed' : 'pointer',
            }}
          >
            {enviando ? 'Confirmando...' : 'Confirmar y enviar a cocina'}
          </button>
          <button
            type="button"
            onClick={alCerrar}
            style={{
              flex: 1,
              minHeight: 52,
              border: '1.5px solid var(--cp-navy, #0B2C3E)',
              borderRadius: 12,
              background: 'transparent',
              color: 'var(--cp-navy, #0B2C3E)',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </div>

      <Confirmar
        abierto={confirmandoSiNo}
        titulo={`¿Confirmar el pedido ${pedido.codigo} y enviarlo a cocina?`}
        mensaje={`Se registrará el medio de pago (${medio}) y el pedido pasará a las pantallas de cocina.${excepcionSinVoucher ? (pideCodigo ? ' Se registra sin comprobante, con el motivo y la autorización del supervisor.' : ' Se registra sin comprobante, con el motivo.') : ''}`}
        textoConfirmar="Sí, confirmar"
        textoNo="No"
        cargando={enviando}
        alConfirmar={() => pedirImpresion(ejecutarConfirmacion)}
        alCancelar={() => setConfirmandoSiNo(false)}
      />
      {dialogoImpresion}
    </>
  );
}
