import { useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { SubirVoucherMozo } from '../vouchers/SubirVoucherMozo';
import { pedidosApi, PedidoPorCobrar } from './pedidosApi';
import { medioDigitalVoucher } from './mediosPago';
import { AvisoDeliverySinUbicacion } from './AvisoDeliverySinUbicacion';
import { MENSAJE_DELIVERY_SIN_UBICACION, deliverySinUbicacion } from './ubicacionDelivery';

export interface ModalCoordinarPagoProps {
  pedido: PedidoPorCobrar;
  alCerrar: () => void;
  alCoordinado: () => void;
  /** Se ubicó el pedido desde el aviso (por defecto solo cierra) */
  alActualizarPedido?: () => void;
}

/**
 * Marca el pago como coordinado. En un medio digital (Yape, Plin, transferencia) la foto del comprobante es
 * opcional: sin ella queda «Pagado sin captura» y se puede subir después.
 */
export function ModalCoordinarPago({ pedido, alCerrar, alCoordinado, alActualizarPedido }: ModalCoordinarPagoProps) {
  const sinUbicar = deliverySinUbicacion(pedido);
  const medio = pedido.pago_preferido || pedido.pago_metodo || '';
  const medioVoucher = medioDigitalVoucher(medio);

  // Solo una foto legible cuenta; el aviso «No se lee» lo muestra SubirVoucherMozo (ofrecerExcepcion)
  const [voucherListo, setVoucherListo] = useState<boolean>(false);
  const [confirmando, setConfirmando] = useState<boolean>(false);
  const [enviando, setEnviando] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const usaExcepcion = Boolean(medioVoucher) && !voucherListo;
  const listo = !sinUbicar;

  const ejecutar = async () => {
    setConfirmando(false);
    setEnviando(true);
    setError('');
    try {
      await pedidosApi.marcarPagoCoordinado(
        pedido.id,
        usaExcepcion ? { motivo: 'sin captura', sinCaptura: true } : undefined,
      );
      alCoordinado();
    } catch (err: any) {
      setError(err?.message || 'No se pudo marcar el pago coordinado');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <div
        onClick={alCerrar}
        style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(11, 44, 62, 0.55)' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Marcar pago coordinado"
        style={{
          position: 'fixed',
          zIndex: 80,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(560px, calc(100% - 24px))',
          maxHeight: 'calc(100% - 24px)',
          overflowY: 'auto',
          background: 'var(--cp-cream, #FBF4EC)',
          borderRadius: 20,
          boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--cp-navy, #0B2C3E)' }}>
          Pago coordinado {pedido.codigo}
        </div>

        <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
          Medio: <b>{medio || 'sin medio'}</b> · Total S/ {Number(pedido.total).toFixed(2)}
        </div>

        {sinUbicar && (
          <AvisoDeliverySinUbicacion
            pedidoId={String(pedido.id)}
            codigo={pedido.codigo}
            direccion={pedido.entrega_direccion}
            alActualizar={alActualizarPedido ?? alCerrar}
          />
        )}

        {medioVoucher ? (
          <div
            data-testid="seccion-coordinar-comprobante"
            style={{
              border: '1.5px solid var(--cp-navy, #0B2C3E)',
              borderRadius: 12,
              padding: 12,
              background: 'var(--cp-white, #FFFFFF)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 14 }}>Comprobante del pago digital ({medioVoucher}, opcional)</div>

            {!voucherListo && (
              <>
                <SubirVoucherMozo
                  pedidoId={pedido.id}
                  medio={medioVoucher}
                  ofrecerExcepcion
                  alVoucherValido={(info) => setVoucherListo(info.legible)}
                />
                <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
                  Puedes marcarlo sin la captura: queda «Pagado sin captura». Pídesela al cliente con amabilidad.
                </div>
              </>
            )}

            {voucherListo && (
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-green, #2F7A45)' }}>
                Foto guardada y enlazada al pedido.
              </div>
            )}

          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
            Este medio no lleva foto del comprobante.
          </div>
        )}

        {error && (
          <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            disabled={!listo || enviando}
            title={sinUbicar ? MENSAJE_DELIVERY_SIN_UBICACION : undefined}
            onClick={() => setConfirmando(true)}
            style={{
              flex: 1,
              minHeight: 52,
              border: 0,
              borderRadius: 12,
              background: 'var(--cp-orange, #E67929)',
              color: 'var(--cp-navy, #0B2C3E)',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: 15,
              cursor: !listo || enviando ? 'not-allowed' : 'pointer',
              opacity: !listo || enviando ? 0.6 : 1,
            }}
          >
            {enviando ? 'Guardando...' : 'Marcar coordinado'}
          </button>
          <button
            type="button"
            onClick={alCerrar}
            disabled={enviando}
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
        abierto={confirmando}
        titulo={`¿Marcar coordinado el pago de ${pedido.codigo}?`}
        mensaje={
          usaExcepcion ? 'Se marca pagado sin captura.' : 'El pago queda coordinado con el cliente.'
        }
        textoSi="Sí, marcar"
        textoNo="No"
        cargando={enviando}
        alConfirmar={ejecutar}
        alCancelar={() => setConfirmando(false)}
      />
    </>
  );
}
