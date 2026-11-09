import { useMemo, useState } from 'react';
import { PAGOS_EJEMPLO, maquetarEtiqueta, type TamanoEtiquetaPc } from '@caprichos/compartido';
import { EtiquetaSvg, TicketPagoPrevia } from '../../pedidos/EtiquetaPrevia';
import { MUESTRA_AREA, MUESTRA_BEBIDA, MUESTRA_GENERAL, MUESTRA_PAGO } from '../mapa/VistaPiezaEjemplo';
import { nombreAleatorio } from './logicaListado';

export type TipoPrevia = 'area' | 'bebida' | 'general' | 'ticket';

export const TITULO_PREVIA: Record<TipoPrevia, string> = {
  area: 'sticker de área',
  bebida: 'sticker de bebida',
  general: 'sticker general',
  ticket: 'ticket de pago',
};

/**
 * Cómo se ve el papel de verdad: dibuja las MISMAS primitivas de la maqueta compartida que el programa de la PC
 * convierte a TSPL (marca CAPRICHOS, logo, bloque de pago...), con un nombre de ejemplo al azar y el tamaño de esa PC.
 */
export function VistaPreviaSticker({ tipo, tamano }: { tipo: TipoPrevia; tamano: TamanoEtiquetaPc }) {
  const [nombre, setNombre] = useState(() => nombreAleatorio());
  const [zoom, setZoom] = useState(1);

  const maqueta = useMemo(() => {
    if (tipo === 'ticket') return null;
    if (tipo === 'bebida') return maquetarEtiqueta('ETIQUETA_BEBIDA', { ...MUESTRA_BEBIDA, persona: nombre, who: `Para: ${nombre}` }, tamano);
    if (tipo === 'general') {
      const pago = PAGOS_EJEMPLO.efectivoVuelto;
      return maquetarEtiqueta('ETIQUETA_GENERAL', { ...MUESTRA_GENERAL, who: nombre, total: pago.total, pago }, tamano);
    }
    return maquetarEtiqueta('ETIQUETA_AREA', { ...MUESTRA_AREA, who: nombre });
  }, [tipo, nombre, tamano.anchoMm, tamano.altoMm, tamano.margenMm]);

  return (
    <div className="ie-vp" data-testid={`vp-${tipo}`}>
      <div className="ie-vp-barra">
        <button type="button" className="ie-chip" data-testid={`vp-otro-${tipo}`} onClick={() => setNombre(nombreAleatorio(nombre))}>
          🔀 Otro nombre
        </button>
        {maqueta && (
          <span role="group" aria-label="Zoom" className="ie-vp-zoom">
            {[1, 2].map((z) => (
              <button key={z} type="button" className="ie-chip" aria-pressed={zoom === z} onClick={() => setZoom(z)}>
                {z}×
              </button>
            ))}
          </span>
        )}
        <span className="if-sub" data-testid={`vp-nombre-${tipo}`}>
          Ejemplo con «{nombre}»{maqueta && tipo !== 'area' ? ` · ${String(tamano.anchoMm).replace('.', ',')} × ${String(tamano.altoMm).replace('.', ',')} mm` : ''}
        </span>
      </div>
      <div className="ie-vp-papel">
        {maqueta ? <EtiquetaSvg maqueta={maqueta} etiqueta={TITULO_PREVIA[tipo]} zoom={zoom} /> : <TicketPagoPrevia datos={{ ...MUESTRA_PAGO, who: nombre }} sinCabecera />}
      </div>
    </div>
  );
}
