import { IconoMedioPago } from '../../comun/IconoMedioPago';
import { nombreMedio } from './planPago';

/**
 * Medio de pago con su ícono. Si llegó por Culqi se rotula «Yape · Culqi» / «Tarjeta · Culqi» y lleva además el
 * ícono de pago en línea: así no se confunde con el Yape manual del local ni con la tarjeta del POS.
 */
export function EtiquetaMedio({ medio, culqi = false, tamano = 15 }: { medio: string; culqi?: boolean; tamano?: number }) {
  return (
    <>
      <IconoMedioPago medio={medio} tamano={tamano} ariaHidden />
      <span>{culqi ? `${nombreMedio(medio)} · Culqi` : nombreMedio(medio)}</span>
      {culqi && <IconoMedioPago medio="PAGO_EN_LINEA" tamano={tamano} ariaHidden data-testid="icono-culqi" />}
    </>
  );
}

/** Texto plano del medio (para columnas de texto y la lista): «Yape · Culqi» si vino por la pasarela. */
export const textoMedio = (medio: string, culqi: boolean) => (culqi ? `${nombreMedio(medio)} · Culqi` : nombreMedio(medio));
