import { Icono } from '../comun/Icono';
import type { EstadoVoucherSeguimiento, VoucherSeguimiento } from './seguimiento';

const MEDIO_NOMBRE: Record<string, string> = { YAPE: 'Yape', PLIN: 'Plin', TRANSFERENCIA: 'transferencia' };

const PRESENTACION: Record<EstadoVoucherSeguimiento, { icono: string; color: string; fondo: string }> = {
  SIN_VOUCHER: { icono: 'alerta', color: 'var(--cp-navy)', fondo: 'var(--cp-cream)' },
  EN_REVISION: { icono: 'reloj', color: 'var(--cp-navy)', fondo: 'var(--cp-cream)' },
  VERIFICADO: { icono: 'check', color: '#2F7A45', fondo: '#EAF5EC' },
  RECHAZADO: { icono: 'alerta', color: 'var(--cp-rust, #B2500F)', fondo: '#FBEDE4' },
};

// La hora viene de la API como fecha ISO; si no se puede leer, no se muestra
export function formatearHoraVoucher(iso: string | null): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  return fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

/** Texto del estado del voucher, sin datos de la captura. */
export function textoEstadoVoucher(voucher: VoucherSeguimiento): string {
  const medio = voucher.medio ? MEDIO_NOMBRE[voucher.medio] ?? voucher.medio : null;
  switch (voucher.estado) {
    case 'SIN_VOUCHER':
      return 'Aún no recibimos tu voucher. Envíalo por WhatsApp para que revisemos tu pago';
    case 'EN_REVISION':
      return 'Recibimos tu voucher y lo estamos revisando';
    case 'VERIFICADO': {
      const hora = formatearHoraVoucher(voucher.actualizadoEn);
      const detalle = [medio, hora].filter(Boolean).join(', ');
      return detalle ? `Pago verificado ✓ (${detalle})` : 'Pago verificado ✓';
    }
    case 'RECHAZADO':
      return voucher.motivo
        ? `No pudimos leer tu voucher: ${voucher.motivo}. Envíanos otra foto por WhatsApp`
        : 'No pudimos leer tu voucher. Envíanos otra foto por WhatsApp';
  }
}

/** Tarjeta del estado del voucher en el seguimiento. Sin bloque de voucher (efectivo) no muestra nada. */
export function EstadoVoucherPedido({ voucher }: { voucher?: VoucherSeguimiento | null }) {
  if (!voucher) return null;
  const { icono, color, fondo } = PRESENTACION[voucher.estado];

  return (
    <div
      role="status"
      data-testid="estado-voucher"
      data-estado={voucher.estado}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 14px',
        borderRadius: '14px',
        backgroundColor: fondo,
        border: `1px solid ${color}`,
        color,
        textAlign: 'left',
        fontSize: '13px',
        fontWeight: 700,
        lineHeight: '18px',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '28px',
          height: '28px',
          minWidth: '28px',
          borderRadius: '14px',
          backgroundColor: color,
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icono nombre={icono} tamano={16} />
      </span>
      <span>{textoEstadoVoucher(voucher)}</span>
    </div>
  );
}
