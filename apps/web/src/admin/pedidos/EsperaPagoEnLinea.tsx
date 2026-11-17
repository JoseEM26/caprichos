import { IconoMedioPago } from '../../comun/IconoMedioPago';

export const TEXTO_ESPERA_PAGO_EN_LINEA = 'Esperando pago en línea (Culqi)';
export const TITULO_ESPERA_PAGO_EN_LINEA = 'El cliente está pagando con tarjeta/Yape; pasa a cocina solo cuando pague.';

/** Pedido de «Tarjeta / Yape en línea» que todavía no se paga. Anulado ya no espera nada. */
export function esperaPagoEnLinea(p: { estado?: string | null; pago_estado?: string | null }): boolean {
  const estado = String(p.estado || '').toUpperCase();
  if (estado === 'ANULADO') return false;
  return estado === 'POR_PAGAR' || String(p.pago_estado || '').toUpperCase() === 'PENDIENTE_ONLINE';
}

/** Ícono de Culqi + «Esperando pago en línea (Culqi)», con su explicación en el título. */
export function EtiquetaEsperaPagoEnLinea({ tamano = 14 }: { tamano?: number }) {
  return (
    <span data-testid="espera-pago-en-linea" title={TITULO_ESPERA_PAGO_EN_LINEA} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <IconoMedioPago medio="CULQI" tamano={tamano} ariaHidden />
      {TEXTO_ESPERA_PAGO_EN_LINEA}
    </span>
  );
}
