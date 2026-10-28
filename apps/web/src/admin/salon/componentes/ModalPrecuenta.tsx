import { useState } from 'react';
import { Confirmar } from '../../../comun/Confirmar';
import { CampoCodigoSupervisor } from '../../../comun/CampoCodigoSupervisor';
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
  pedidoId?: string | number;
  alCobrar?: (
    medio: string,
    voucherId?: string | number,
    sinVoucher?: { motivo: string; pinSupervisor: string },
  ) => Promise<void> | void;
}

const MEDIOS_COBRO_SALON = ['Efectivo', 'Yape', 'Plin', 'Tarjeta'] as const;
const MOTIVO_MINIMO = 5;

export function ModalPrecuenta({
  abierto,
  alCerrar,
  mesa,
  lineas,
  total,
  copias = 0,
  alImprimir,
  pedidoId,
  alCobrar,
}: ModalPrecuentaProps) {
  const [confirmarImprimir, setConfirmarImprimir] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [copiasLocales, setCopiasLocales] = useState(copias);

  // Cobro del mozo en mesa
  const [medioSeleccionado, setMedioSeleccionado] = useState<string>('Efectivo');
  const [voucherId, setVoucherId] = useState<string | number | undefined>(undefined);
  const [voucherLegible, setVoucherLegible] = useState<boolean>(false);
  const [confirmarCobrar, setConfirmarCobrar] = useState<boolean>(false);
  const [cobrando, setCobrando] = useState<boolean>(false);
  const [cobroExitoso, setCobroExitoso] = useState<boolean>(false);
  const [avisoEnviado, setAvisoEnviado] = useState<boolean>(false);
  // Cobro digital sin foto legible: motivo escrito + código del supervisor (lo dicta, el mozo no lo genera)
  const [sinVoucher, setSinVoucher] = useState<boolean>(false);
  const [motivoSinVoucher, setMotivoSinVoucher] = useState<string>('');
  const [pinSupervisor, setPinSupervisor] = useState<string>('');

  if (!abierto) return null;

  const esDigital = medioSeleccionado === 'Yape' || medioSeleccionado === 'Plin';
  const excepcionLista =
    sinVoucher && motivoSinVoucher.trim().length >= MOTIVO_MINIMO && pinSupervisor.length === 6;
  const conExcepcion = esDigital && !voucherLegible && sinVoucher;
  const puedeConfirmarCobro = !esDigital || voucherLegible || excepcionLista;

  // El mozo no cobra (el cajero cobra). Sin «alCobrar» no hay botón de cobro: no se simula un cobro.
  const handleAvisarSinFoto = async () => {
    if (pedidoId === undefined) return;
    try {
      await vouchersApi.avisarSinFoto(pedidoId);
      setAvisoEnviado(true);
    } catch {
      // se puede volver a tocar el botón
    }
  };

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

  const handleEjecutarCobro = async () => {
    try {
      setCobrando(true);
      if (alCobrar) {
        if (conExcepcion && excepcionLista) {
          await alCobrar(medioSeleccionado, undefined, {
            motivo: motivoSinVoucher.trim(),
            pinSupervisor,
          });
        } else {
          await alCobrar(medioSeleccionado, voucherId);
        }
      }
      setCobroExitoso(true);
    } finally {
      setCobrando(false);
      setConfirmarCobrar(false);
    }
  };

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

          {/* Sección de Cobro en Mesa por el Mozo */}
          <div
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
              {MEDIOS_COBRO_SALON.map((m) => {
                const activo = medioSeleccionado === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMedioSeleccionado(m);
                      setSinVoucher(false);
                      setMotivoSinVoucher('');
                      setPinSupervisor('');
                      if (m !== 'Yape' && m !== 'Plin') {
                        setVoucherLegible(true);
                      } else {
                        setVoucherLegible(false);
                        setVoucherId(undefined);
                      }
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
                      cursor: 'pointer',
                    }}
                  >
                    {m}
                  </button>
                );
              })}
            </div>

            {/* Foto del voucher para Yape o Plin: queda enlazada al pedido como prueba para Caja */}
            {esDigital && pedidoId !== undefined && (
              <SubirVoucherMozo
                pedidoId={pedidoId}
                medio={medioSeleccionado.toUpperCase() as 'YAPE' | 'PLIN'}
                ofrecerExcepcion
                alVoucherValido={(info) => {
                  // Un voucher ilegible no cuenta: el mozo debe subir otra foto o usar la excepción
                  setVoucherLegible(info.legible);
                  setVoucherId(info.legible ? info.id : undefined);
                }}
              />
            )}

            {/* Cobro digital: la foto va con el pedido y Caja registra el cobro */}
            {esDigital && (
              <div
                data-testid="aviso-cobro-digital-caja"
                style={{ fontSize: '12px', lineHeight: '16px', color: '#2C4C5D' }}
              >
                El cobro digital lo registra Caja con la foto del voucher.
                {!voucherLegible && pedidoId !== undefined && (
                  <button
                    type="button"
                    onClick={handleAvisarSinFoto}
                    disabled={avisoEnviado}
                    data-testid="btn-avisar-caja-sin-foto"
                    style={{
                      marginTop: '6px',
                      width: '100%',
                      minHeight: '40px',
                      border: '1.5px solid var(--cp-navy, #0B2C3E)',
                      borderRadius: '10px',
                      background: 'transparent',
                      color: 'var(--cp-navy, #0B2C3E)',
                      fontWeight: 700,
                      cursor: avisoEnviado ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {avisoEnviado ? 'Caja avisada: no hay foto todavía' : 'No hay foto: avisar a Caja'}
                  </button>
                )}
              </div>
            )}

            {/* Excepción: cobro digital sin foto legible, con código que dicta el supervisor presente */}
            {esDigital && !voucherLegible && pedidoId !== undefined && !sinVoucher && (
              <button
                type="button"
                onClick={() => setSinVoucher(true)}
                data-testid="btn-mozo-sin-comprobante"
                style={{
                  marginTop: '6px',
                  width: '100%',
                  minHeight: '40px',
                  border: '1.5px dashed var(--cp-rust, #B2500F)',
                  borderRadius: '10px',
                  background: 'transparent',
                  color: 'var(--cp-rust, #B2500F)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cobrar sin comprobante
              </button>
            )}

            {conExcepcion && pedidoId !== undefined && (
              <div
                data-testid="panel-mozo-sin-comprobante"
                style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}
              >
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
                  Sin comprobante: solo con motivo escrito y el código del supervisor. Queda auditado.
                </div>
                <label htmlFor="motivo-mozo-sin-voucher" style={{ fontWeight: 700, fontSize: '12px' }}>
                  Motivo (mínimo {MOTIVO_MINIMO} letras)
                </label>
                <textarea
                  id="motivo-mozo-sin-voucher"
                  data-testid="motivo-mozo-sin-voucher"
                  rows={2}
                  value={motivoSinVoucher}
                  onChange={(e) => setMotivoSinVoucher(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-line, #E3D6C6)',
                    background: 'var(--cp-white, #FFFFFF)',
                    padding: '10px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                  }}
                />
                <CampoCodigoSupervisor
                  id="codigo-supervisor-mozo"
                  valor={pinSupervisor}
                  onChange={setPinSupervisor}
                />
                <button
                  type="button"
                  onClick={() => {
                    setSinVoucher(false);
                    setMotivoSinVoucher('');
                    setPinSupervisor('');
                  }}
                  style={{
                    minHeight: '40px',
                    border: '1.5px solid var(--cp-navy, #0B2C3E)',
                    borderRadius: '10px',
                    background: 'transparent',
                    color: 'var(--cp-navy, #0B2C3E)',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Volver a pedir la foto
                </button>
              </div>
            )}

            {/* Botón de cobro: solo si el padre entrega «alCobrar» (hoy ninguna vista lo hace; el cajero cobra) */}
            {alCobrar && (
              <button
                type="button"
                disabled={!puedeConfirmarCobro || cobrando || cobroExitoso}
                onClick={() => setConfirmarCobrar(true)}
                data-testid="btn-confirmar-cobro-mozo"
                style={{
                  marginTop: '10px',
                  width: '100%',
                  minHeight: '44px',
                  border: 0,
                  borderRadius: '10px',
                  background: puedeConfirmarCobro && !cobroExitoso
                    ? 'var(--cp-green, #2F7A45)'
                    : '#B0BEC5',
                  color: '#FFFFFF',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  cursor: puedeConfirmarCobro && !cobroExitoso ? 'pointer' : 'not-allowed',
                }}
              >
                {cobroExitoso
                  ? 'Cobro registrado'
                  : !puedeConfirmarCobro
                  ? 'Sube el voucher para cobrar'
                  : `Confirmar cobro (${medioSeleccionado})`}
              </button>
            )}
          </div>

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
        abierto={confirmarCobrar}
        titulo={`¿Confirmar cobro de ${mesa}?`}
        mensaje={`Queda registrado el cobro de S/ ${Number(total || 0).toFixed(2)} mediante ${medioSeleccionado}${conExcepcion && excepcionLista ? ' sin comprobante (con código del supervisor)' : ''}.`}
        textoConfirmar="Sí, registrar cobro"
        textoNo="No, cancelar"
        cargando={cobrando}
        alConfirmar={handleEjecutarCobro}
        alCancelar={() => setConfirmarCobrar(false)}
      />
    </>
  );
}
