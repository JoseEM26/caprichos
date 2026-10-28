import { useState } from 'react';
import { Confirmar } from '../../../comun/Confirmar';
import { SubirVoucherMozo } from '../../vouchers/SubirVoucherMozo';
import { vouchersApi } from '../../vouchers/vouchersApi';

export interface LineaPrecuenta {
  cantidad: number;
  nombre: string;
  detalle: string;
}

export interface ModalPrecuentaProps {
  abierto: boolean;
  alCerrar: () => void;
  mesa: string;
  lineas: LineaPrecuenta[];
  total: number;
  copias?: number;
  alImprimir?: () => Promise<void> | void;
  /** Con pedido, el mozo puede enviar el cobro a Caja (no lo cobra él). */
  pedidoId?: string | number;
}

type MedioEnvio = 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TRANSFERENCIA';

const MEDIOS_ENVIO: ReadonlyArray<{ id: MedioEnvio; nombre: string }> = [
  { id: 'EFECTIVO', nombre: 'Efectivo' },
  { id: 'YAPE', nombre: 'Yape' },
  { id: 'PLIN', nombre: 'Plin' },
  { id: 'TRANSFERENCIA', nombre: 'Transferencia' },
];

export function ModalPrecuenta({
  abierto,
  alCerrar,
  mesa,
  lineas,
  total,
  copias = 0,
  alImprimir,
  pedidoId,
}: ModalPrecuentaProps) {
  const [confirmarImprimir, setConfirmarImprimir] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [copiasLocales, setCopiasLocales] = useState(copias);

  // Envío del cobro a Caja: el mozo elige el medio y, si es digital, toma la foto del voucher
  const [medio, setMedio] = useState<MedioEnvio>('EFECTIVO');
  const [voucherLegible, setVoucherLegible] = useState<boolean>(false);
  const [confirmarEnvio, setConfirmarEnvio] = useState<boolean>(false);
  const [enviando, setEnviando] = useState<boolean>(false);
  const [enviado, setEnviado] = useState<boolean>(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  if (!abierto) return null;

  const esDigital = medio !== 'EFECTIVO';
  const nombreMedio = MEDIOS_ENVIO.find((m) => m.id === medio)?.nombre ?? medio;

  const handleConfirmarImpresion = async () => {
    try {
      setImprimiendo(true);
      if (alImprimir) {
        await alImprimir();
      }
      setCopiasLocales((c) => c + 1);
    } finally {
      setImprimiendo(false);
      setConfirmarImprimir(false);
    }
  };

  // El mozo no cierra el cobro: Caja revisa el voucher y es quien cobra
  const handleEnviarCaja = async () => {
    if (pedidoId === undefined) return;
    try {
      setEnviando(true);
      setErrorEnvio(null);
      await vouchersApi.enviarACaja(pedidoId, medio);
      setEnviado(true);
    } catch (err: any) {
      setErrorEnvio(err?.message || 'No se pudo enviar a Caja. Intenta de nuevo.');
    } finally {
      setEnviando(false);
      setConfirmarEnvio(false);
    }
  };

  const mensajeEnvio = !esDigital
    ? `Caja cobrará S/ ${Number(total || 0).toFixed(2)} en efectivo. Tú no cierras el cobro.`
    : voucherLegible
      ? `Caja revisará la foto del voucher de ${nombreMedio} y cobrará S/ ${Number(total || 0).toFixed(2)}. Tú no cierras el cobro.`
      : `No hay foto legible de ${nombreMedio}: Caja pedirá la foto o resolverá el cobro.`;

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Precuenta"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          onClick={alCerrar}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            zIndex: 50,
            background: 'rgba(11, 44, 62, 0.55)',
          }}
        />
        <div
          style={{
            position: 'relative',
            zIndex: 60,
            width: 'min(420px, calc(100% - 24px))',
            maxHeight: 'calc(100% - 24px)',
            overflowY: 'auto',
            background: 'var(--cp-white)',
            borderRadius: '10px',
            boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
            padding: '18px',
            fontFamily: "'Courier New', monospace",
            fontSize: '13px',
            lineHeight: '18px',
            color: '#111',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '16px' }}>
            PRECUENTA
          </div>
          <div style={{ textAlign: 'center' }}>{mesa || 'Mesa'}</div>
          <div style={{ textAlign: 'center' }}>------------------------------</div>
          {lineas.map((l, i) => (
            <div key={i}>
              <b>
                {l.cantidad} x {l.nombre}
              </b>
              <br />
              <span style={{ paddingLeft: '14px' }}>{l.detalle}</span>
            </div>
          ))}
          <div style={{ textAlign: 'center' }}>------------------------------</div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 700,
              fontSize: '15px',
            }}
          >
            <span>TOTAL</span>
            <span>S/ {Number(total || 0).toFixed(2)}</span>
          </div>
          <div
            style={{
              margin: '8px auto',
              width: '96px',
              height: '96px',
              border: '2px solid #111',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
            }}
          >
            QR
          </div>
          <div style={{ textAlign: 'center' }}>
            Paga con Yape o Plin al 9XX XXX XXX o entrega el efectivo al mozo;
            el cajero cobra y emite el comprobante.
          </div>
          <div style={{ textAlign: 'center', fontSize: '12px' }}>
            La precuenta no es un comprobante de pago.
          </div>
          {copiasLocales > 0 && (
            <div style={{ textAlign: 'center', fontSize: '12px' }}>
              Copias impresas: {copiasLocales}
            </div>
          )}

          {/* Envío del cobro a Caja: el mozo toma la foto y Caja revisa y cobra */}
          {pedidoId !== undefined && (
            <div
              data-testid="seccion-envio-caja-mozo"
              style={{
                borderTop: '1px dashed #111',
                marginTop: '10px',
                paddingTop: '10px',
                fontFamily: 'Montserrat, sans-serif',
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  color: 'var(--cp-navy, #0B2C3E)',
                  marginBottom: '6px',
                }}
              >
                Medio de pago en mesa:
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {MEDIOS_ENVIO.map((m) => {
                  const activo = medio === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={enviado}
                      onClick={() => {
                        setMedio(m.id);
                        setVoucherLegible(false);
                      }}
                      style={{
                        minHeight: '38px',
                        padding: '0 12px',
                        borderRadius: '9999px',
                        border: '1.5px solid var(--cp-navy, #0B2C3E)',
                        background: activo ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
                        color: activo ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-navy, #0B2C3E)',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: enviado ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {m.nombre}
                    </button>
                  );
                })}
              </div>

              {/* Digital: la foto se lee al instante; el mozo solo ve si se lee o no */}
              {esDigital && (
                <SubirVoucherMozo
                  key={medio}
                  pedidoId={pedidoId}
                  medio={medio as 'YAPE' | 'PLIN' | 'TRANSFERENCIA'}
                  bloqueado={enviado}
                  alVoucherValido={(info) => setVoucherLegible(info.legible)}
                />
              )}

              {!esDigital && (
                <div data-testid="aviso-efectivo-caja" style={{ fontSize: '12px', lineHeight: '16px', color: '#2C4C5D', marginTop: '6px' }}>
                  Efectivo: no hace falta foto. Caja cobra y da el vuelto.
                </div>
              )}

              {esDigital && !voucherLegible && (
                <div style={{ fontSize: '12px', lineHeight: '16px', color: '#2C4C5D', marginTop: '6px' }}>
                  Si no hay foto o no se lee, Caja lo revisa y resuelve el cobro.
                </div>
              )}

              {!enviado && (
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() => setConfirmarEnvio(true)}
                  data-testid="btn-enviar-caja"
                  style={{
                    marginTop: '10px',
                    width: '100%',
                    minHeight: '44px',
                    border: 0,
                    borderRadius: '10px',
                    background: 'var(--cp-green, #2F7A45)',
                    color: '#FFFFFF',
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 800,
                    cursor: enviando ? 'not-allowed' : 'pointer',
                  }}
                >
                  Enviar a Caja
                </button>
              )}

              {enviado && (
                <div
                  role="status"
                  data-testid="aviso-enviado-caja"
                  style={{
                    marginTop: '10px',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: '#E8F5E9',
                    border: '1px solid var(--cp-green, #2F7A45)',
                    color: 'var(--cp-green, #2F7A45)',
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 800,
                    fontSize: '13px',
                  }}
                >
                  Enviado a Caja, ellos lo revisan.
                </div>
              )}

              {errorEnvio && (
                <div role="alert" style={{ marginTop: '8px', color: 'var(--cp-rust, #B2500F)', fontWeight: 700, fontSize: '12px' }}>
                  {errorEnvio}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setConfirmarImprimir(true)}
            style={{
              marginTop: '6px',
              minHeight: '44px',
              border: 0,
              borderRadius: '10px',
              background: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Imprimir precuenta
          </button>
          <button
            type="button"
            onClick={alCerrar}
            style={{
              marginTop: '4px',
              minHeight: '44px',
              border: '1.5px solid var(--cp-navy)',
              borderRadius: '10px',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>

      <Confirmar
        abierto={confirmarImprimir}
        titulo="¿Imprimir precuenta?"
        mensaje={`¿Imprimir la precuenta de ${mesa}? Sale en la ticketera de salón. No es un comprobante.`}
        textoConfirmar="Sí, imprimir"
        textoNo="No, cancelar"
        cargando={imprimiendo}
        alConfirmar={handleConfirmarImpresion}
        alCancelar={() => setConfirmarImprimir(false)}
      />

      <Confirmar
        abierto={confirmarEnvio}
        titulo={`¿Enviar a Caja el cobro de ${mesa}?`}
        mensaje={mensajeEnvio}
        textoConfirmar="Sí, enviar a Caja"
        textoNo="No, cancelar"
        cargando={enviando}
        alConfirmar={handleEnviarCaja}
        alCancelar={() => setConfirmarEnvio(false)}
      />
    </>
  );
}
