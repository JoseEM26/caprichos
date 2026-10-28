import { useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { CampoCodigoSupervisor } from '../../comun/CampoCodigoSupervisor';
import { SubirVoucherMozo } from '../vouchers/SubirVoucherMozo';
import { pedidosApi, PedidoPorCobrar } from './pedidosApi';
import { medioDigitalVoucher } from './mediosPago';

const MOTIVO_MINIMO = 5;

export interface ModalCoordinarPagoProps {
  pedido: PedidoPorCobrar;
  alCerrar: () => void;
  alCoordinado: () => void;
}

/**
 * Marca el pago como coordinado. En un medio digital (Yape, Plin, transferencia) hace falta la foto
 * legible del comprobante o, en su defecto, el motivo y el código del supervisor.
 */
export function ModalCoordinarPago({ pedido, alCerrar, alCoordinado }: ModalCoordinarPagoProps) {
  const medio = pedido.pago_preferido || pedido.pago_metodo || '';
  const medioVoucher = medioDigitalVoucher(medio);

  // Solo una foto legible cuenta; el aviso «No se lee» lo muestra SubirVoucherMozo (ofrecerExcepcion)
  const [voucherListo, setVoucherListo] = useState<boolean>(false);
  const [sinVoucher, setSinVoucher] = useState<boolean>(false);
  const [motivo, setMotivo] = useState<string>('');
  const [pinSupervisor, setPinSupervisor] = useState<string>('');
  const [confirmando, setConfirmando] = useState<boolean>(false);
  const [enviando, setEnviando] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const excepcionLista =
    sinVoucher && motivo.trim().length >= MOTIVO_MINIMO && pinSupervisor.length === 6;
  const usaExcepcion = Boolean(medioVoucher) && !voucherListo && sinVoucher;
  const listo = !medioVoucher || voucherListo || excepcionLista;

  const ejecutar = async () => {
    setConfirmando(false);
    setEnviando(true);
    setError('');
    try {
      await pedidosApi.marcarPagoCoordinado(
        pedido.id,
        usaExcepcion ? { motivo: motivo.trim(), pinSupervisor } : undefined,
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
            <div style={{ fontWeight: 800, fontSize: 14 }}>Comprobante del pago digital ({medioVoucher})</div>

            {!voucherListo && !sinVoucher && (
              <>
                <SubirVoucherMozo
                  pedidoId={pedido.id}
                  medio={medioVoucher}
                  ofrecerExcepcion
                  alVoucherValido={(info) => setVoucherListo(info.legible)}
                />
                <button
                  type="button"
                  data-testid="btn-coordinar-sin-voucher"
                  onClick={() => setSinVoucher(true)}
                  style={{
                    minHeight: 44,
                    border: '1.5px dashed var(--cp-rust, #B2500F)',
                    borderRadius: 10,
                    background: 'transparent',
                    color: 'var(--cp-rust, #B2500F)',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  No hay foto: marcar sin comprobante (con supervisor)
                </button>
              </>
            )}

            {voucherListo && (
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-green, #2F7A45)' }}>
                Foto guardada y enlazada al pedido.
              </div>
            )}

            {sinVoucher && !voucherListo && (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
                  Sin comprobante: solo con motivo escrito y el código del supervisor. Queda auditado.
                </div>
                <label htmlFor="motivo-coordinar" style={{ fontWeight: 700, fontSize: 13 }}>
                  Motivo (mínimo {MOTIVO_MINIMO} letras)
                </label>
                <textarea
                  id="motivo-coordinar"
                  rows={2}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    borderRadius: 10,
                    border: '1.5px solid var(--cp-line, #E3D6C6)',
                    background: 'var(--cp-white, #FFFFFF)',
                    padding: 10,
                    fontSize: 14,
                    fontFamily: 'inherit',
                  }}
                />
                <CampoCodigoSupervisor valor={pinSupervisor} onChange={setPinSupervisor} />
                <button
                  type="button"
                  onClick={() => {
                    setSinVoucher(false);
                    setMotivo('');
                    setPinSupervisor('');
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
                  Volver a pedir la foto
                </button>
              </>
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
          usaExcepcion
            ? 'Se marca sin comprobante, con el motivo y la autorización del supervisor.'
            : 'El pago queda coordinado con el cliente.'
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
