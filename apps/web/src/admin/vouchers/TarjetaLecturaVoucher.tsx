import { VoucherResumenChat, SemaforoVoucher } from './tipos';
import { usePideCodigo } from '../../comun/usePideCodigo';

export interface TarjetaLecturaVoucherProps {
  voucher?: VoucherResumenChat | null;
  pedido?: {
    total?: number | string | null;
    medio?: string | null;
  } | null;
  puedeVer?: boolean;
}

const CONFIG_SEMAFORO: Record<
  SemaforoVoucher,
  { label: string; color: string; bg: string; border: string }
> = {
  CONFIABLE: {
    label: 'Confiable',
    color: '#2F7A45', // verde
    bg: '#E8F5E9',
    border: '#2F7A45',
  },
  OBSERVADO: {
    label: 'Observado',
    color: '#D99E39', // dorado
    bg: '#FFF9E6',
    border: '#D99E39',
  },
  RARO: {
    label: 'Raro',
    color: '#B2500F', // rust
    bg: '#FFF0E6',
    border: '#B2500F',
  },
  ILEGIBLE: {
    label: 'Ilegible',
    color: '#607D8B', // gris
    bg: '#ECEFF1',
    border: '#607D8B',
  },
  SIN_LECTURA: {
    label: 'Sin lectura',
    color: '#78909C', // gris
    bg: '#ECEFF1',
    border: '#78909C',
  },
};

export function TarjetaLecturaVoucher({
  voucher,
  pedido,
  puedeVer = true,
}: TarjetaLecturaVoucherProps) {
  const pideCodigo = usePideCodigo();
  // Solo con permiso vouchers/ver (CAJERO, ADMIN)
  if (!puedeVer || !voucher) {
    return null;
  }

  const semaforoKey: SemaforoVoucher =
    voucher.semaforo in CONFIG_SEMAFORO ? voucher.semaforo : 'SIN_LECTURA';
  const cfg = CONFIG_SEMAFORO[semaforoKey];

  const extraido = voucher.extraido;
  const montoPedido =
    pedido?.total !== undefined && pedido?.total !== null
      ? Number(pedido.total)
      : voucher.pedidoTotal !== undefined && voucher.pedidoTotal !== null
      ? Number(voucher.pedidoTotal)
      : null;

  const montoExtraido =
    extraido?.monto !== undefined && extraido?.monto !== null
      ? Number(extraido.monto)
      : null;

  const coincideMonto =
    montoPedido !== null && montoExtraido !== null
      ? Math.abs(montoPedido - montoExtraido) < 0.01
      : null;

  const medioPedido = pedido?.medio || voucher.medio || null;
  const medioDetectado = extraido?.medioDetectado || null;
  const coincideMedio =
    medioPedido && medioDetectado && medioDetectado !== 'OTRO'
      ? medioPedido.toUpperCase() === medioDetectado.toUpperCase()
      : null;

  return (
    <div
      data-testid="tarjeta-lectura-voucher"
      style={{
        margin: '6px 0',
        padding: '12px 14px',
        background: 'var(--cp-white, #FFFFFF)',
        border: `1.5px solid ${cfg.border}`,
        borderRadius: '12px',
        fontFamily: 'Montserrat, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxShadow: '0 2px 6px rgba(11, 44, 62, 0.06)',
      }}
    >
      {/* Cabecera con título y semáforo */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            fontWeight: 800,
            fontSize: '13.5px',
            color: 'var(--cp-navy, #0B2C3E)',
          }}
        >
          Lectura del voucher
        </div>

        <div
          data-testid="badge-semaforo-voucher"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 10px',
            borderRadius: '9999px',
            background: cfg.bg,
            color: cfg.color,
            border: `1px solid ${cfg.border}`,
            fontSize: '12px',
            fontWeight: 800,
            letterSpacing: '0.3px',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: cfg.color,
            }}
          />
          {cfg.label}
        </div>
      </div>

      {/* Aviso específico de voucher ilegible */}
      {semaforoKey === 'ILEGIBLE' && (
        <div
          role="alert"
          data-testid="alerta-voucher-ilegible"
          style={{
            background: '#FFF0E6',
            border: '1.5px solid var(--cp-rust, #B2500F)',
            borderRadius: '8px',
            padding: '8px 10px',
            color: 'var(--cp-rust, #B2500F)',
            fontSize: '12px',
            fontWeight: 700,
            lineHeight: 1.4,
          }}
        >
          {pideCodigo
            ? 'No se lee: sube otra foto o confirma sin comprobante con código del supervisor.'
            : 'No se lee: sube otra foto o confirma sin comprobante con motivo.'}
        </div>
      )}

      {/* Lista de motivos informativos del semáforo */}
      {voucher.motivos && voucher.motivos.length > 0 && (
        <div
          data-testid="lista-motivos-voucher"
          style={{
            fontSize: '12px',
            color: cfg.color,
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          }}
        >
          {voucher.motivos.map((motivo, idx) => (
            <div key={idx} style={{ fontWeight: 600 }}>
              • {motivo}
            </div>
          ))}
        </div>
      )}

      {/* Comparación de datos extraídos contra el pedido */}
      {extraido && (
        <div
          style={{
            background: 'var(--cp-cream, #FBF4EC)',
            borderRadius: '8px',
            padding: '8px 10px',
            fontSize: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
          }}
        >
          {/* Monto */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--cp-soft, #2C4C5D)', fontWeight: 600 }}>
              Monto:
            </span>
            <span style={{ fontWeight: 700 }}>
              {montoExtraido !== null ? `S/ ${montoExtraido.toFixed(2)}` : 'No visible'}
              {coincideMonto !== null && (
                <span
                  style={{
                    marginLeft: '6px',
                    fontSize: '11px',
                    fontWeight: 800,
                    color: coincideMonto ? '#2F7A45' : '#B2500F',
                  }}
                >
                  ({coincideMonto ? 'coincide' : 'no coincide'})
                </span>
              )}
            </span>
          </div>

          {/* Medio de pago */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--cp-soft, #2C4C5D)', fontWeight: 600 }}>
              Medio detectado:
            </span>
            <span style={{ fontWeight: 700 }}>
              {extraido.medioDetectado || 'No detectado'}
              {coincideMedio !== null && (
                <span
                  style={{
                    marginLeft: '6px',
                    fontSize: '11px',
                    fontWeight: 800,
                    color: coincideMedio ? '#2F7A45' : '#D99E39',
                  }}
                >
                  ({coincideMedio ? 'coincide' : 'no coincide'})
                </span>
              )}
            </span>
          </div>

          {/* Operación */}
          {extraido.operacion && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ color: 'var(--cp-soft, #2C4C5D)', fontWeight: 600 }}>
                Operación:
              </span>
              <span style={{ fontWeight: 700 }}>{extraido.operacion}</span>
            </div>
          )}

          {/* Titular */}
          {extraido.titular && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ color: 'var(--cp-soft, #2C4C5D)', fontWeight: 600 }}>
                Titular:
              </span>
              <span style={{ fontWeight: 700 }}>{extraido.titular}</span>
            </div>
          )}

          {/* Destino / Número */}
          {extraido.destinoNumero && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ color: 'var(--cp-soft, #2C4C5D)', fontWeight: 600 }}>
                Destino:
              </span>
              <span style={{ fontWeight: 700 }}>{extraido.destinoNumero}</span>
            </div>
          )}

          {/* Fecha / Hora */}
          {(extraido.fecha || extraido.hora) && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ color: 'var(--cp-soft, #2C4C5D)', fontWeight: 600 }}>
                Fecha / Hora:
              </span>
              <span style={{ fontWeight: 700 }}>
                {[extraido.fecha, extraido.hora].filter(Boolean).join(' · ')}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Regla de oro fija obligatoria por contrato:
          "mensaje fijo 'La IA solo lee la foto. Tu decides: Aprobar el pago o Rechazar.'" */}
      <div
        data-testid="mensaje-fijo-regla-oro"
        style={{
          fontSize: '11px',
          color: 'var(--cp-soft, #2C4C5D)',
          lineHeight: 1.35,
          borderTop: '1px dashed var(--cp-line, #E3D6C6)',
          paddingTop: '6px',
        }}
      >
        La IA solo lee la foto. Tu decides: Aprobar el pago o Rechazar.
      </div>
    </div>
  );
}
