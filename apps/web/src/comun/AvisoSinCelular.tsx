/** Avisos de pedido sin celular (el celular es opcional salvo en delivery, pero sin él no hay boleta por WhatsApp ni puntos). */
export const TEXTO_SIN_CELULAR_FORMULARIO = 'Sin celular no recibirá su boleta por WhatsApp ni sumará puntos';
export const TEXTO_SIN_CELULAR_PEDIDO = 'Este pedido no tiene celular: la boleta no llegará por WhatsApp';

/** Un celular real: 9 dígitos que empiezan con 9 (no el relleno 999999999). */
export const tieneCelularReal = (t?: string | null): boolean => {
  const d = String(t ?? '').replace(/\D/g, '').replace(/^51(?=9\d{8}$)/, '');
  return /^9\d{8}$/.test(d) && d !== '999999999';
};

export function AvisoSinCelular({ texto = TEXTO_SIN_CELULAR_FORMULARIO, children }: { texto?: string; children?: React.ReactNode }) {
  return (
    <div
      role="status"
      data-testid="aviso-sin-celular"
      style={{ fontSize: 12, lineHeight: '16px', fontWeight: 700, color: 'var(--cp-rust, #B2500F)', background: 'var(--cp-sand, #F3E6D6)', borderRadius: 8, padding: '6px 10px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
    >
      <span>{texto}</span>
      {children}
    </div>
  );
}
