import type { CSSProperties } from 'react';
import efectivoSvg from './iconos-pago/efectivo.svg';
import yapeSvg from './iconos-pago/yape.svg';
import plinSvg from './iconos-pago/plin.svg';
import tarjetaSvg from './iconos-pago/tarjeta.svg';
import transferenciaSvg from './iconos-pago/transferencia.svg';
import pagoEnLineaSvg from './iconos-pago/pago-en-linea.svg';
import culqiSvg from './iconos-pago/culqi.svg';
import billeteraSvg from './iconos-pago/billetera.svg';

export type TipoMedioPago =
  | 'EFECTIVO'
  | 'YAPE'
  | 'PLIN'
  | 'TARJETA'
  | 'TRANSFERENCIA'
  | 'CULQI'
  | 'PAGO_EN_LINEA';

export interface IconoMedioPagoProps {
  medio: TipoMedioPago | string;
  tamano?: number;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
  /** Si debe ocultarse para lectores de pantalla cuando el texto vecino ya dice el nombre */
  ariaHidden?: boolean;
}

interface InfoMedio {
  src: string;
  etiqueta: string;
  ratio: number;
}

const MAPA_MEDIOS: Record<string, InfoMedio> = {
  EFECTIVO: { src: efectivoSvg, etiqueta: 'Efectivo', ratio: 40 / 26 },
  YAPE: { src: yapeSvg, etiqueta: 'Yape', ratio: 46 / 28 },
  PLIN: { src: plinSvg, etiqueta: 'Plin', ratio: 46 / 28 },
  TARJETA: { src: tarjetaSvg, etiqueta: 'Tarjeta', ratio: 54 / 26 },
  TRANSFERENCIA: { src: transferenciaSvg, etiqueta: 'Transferencia', ratio: 32 / 28 },
  CULQI: { src: culqiSvg, etiqueta: 'Pago en línea', ratio: 36 / 28 },
  PAGO_EN_LINEA: { src: pagoEnLineaSvg, etiqueta: 'Pago en línea', ratio: 36 / 28 },
};

/**
 * Componente común para renderizar el logo/icono SVG local del medio de pago.
 * Muestra Yape, Plin, Tarjeta (Visa + Mastercard juntos), Efectivo, Transferencia o Pago en línea (Culqi).
 */
export function IconoMedioPago({
  medio,
  tamano = 32,
  className,
  style,
  'data-testid': testId,
  ariaHidden,
}: IconoMedioPagoProps) {
  const clave = String(medio || '').toUpperCase().trim();
  const info = MAPA_MEDIOS[clave] ?? {
    src: billeteraSvg,
    etiqueta: medio || 'Medio de pago',
    ratio: 32 / 28,
  };

  const ancho = Math.round(tamano * info.ratio);

  return (
    <img
      src={info.src}
      alt={ariaHidden ? '' : info.etiqueta}
      aria-label={ariaHidden ? undefined : info.etiqueta}
      aria-hidden={ariaHidden ? true : undefined}
      width={ancho}
      height={tamano}
      className={className}
      data-testid={testId}
      style={{
        height: `${tamano}px`,
        width: 'auto',
        maxHeight: `${tamano}px`,
        objectFit: 'contain',
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
