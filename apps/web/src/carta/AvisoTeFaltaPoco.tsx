import { OfertaItem } from '../admin/ofertas/ofertasApi';
import { CategoriaCarta, DatosLocalCarta, LineaCarrito } from './tipos';
import { calcularValorBeneficio } from './useBeneficiosCarta';

export interface AvisoTeFaltaPocoInfo {
  tipo: 'LLEVA_PAGA' | 'DESCUENTO' | 'ENVIO_GRATIS';
  texto: string;
  productoIdParaAgregar?: string;
}

export interface AvisoTeFaltaPocoProps {
  lineas: LineaCarrito[];
  subtotal: number;
  ofertas?: OfertaItem[];
  categorias?: CategoriaCarta[];
  datosLocal?: DatosLocalCarta | null;
  onAgregarProducto?: (productoId: string) => void;
}

/**
 * Determina el aviso de «te falta poco» más relevante para el carrito.
 * Reglas:
 * - Solo muestra uno (el más relevante).
 * - Nunca para combos.
 * - No aparece si el beneficio ya aplica.
 */
export function obtenerAvisoTeFaltaPoco(params: {
  lineas: LineaCarrito[];
  subtotal: number;
  ofertas?: OfertaItem[];
  categorias?: CategoriaCarta[];
  datosLocal?: DatosLocalCarta | null;
}): AvisoTeFaltaPocoInfo | null {
  const { lineas, subtotal, ofertas = [], categorias = [], datosLocal } = params;
  if (!lineas || lineas.length === 0 || subtotal <= 0) {
    return null;
  }

  // 1. Evaluar LLEVA_PAGA
  const ofertasLlevaPaga = ofertas.filter(
    (o) =>
      o.activo !== false &&
      o.vigenteAhora === true &&
      o.tipo === 'LLEVA_PAGA' &&
      !o.noSumaBeneficios,
  );

  let candidatoLlevaPaga: AvisoTeFaltaPocoInfo | null = null;
  let mejorPuntajeLlevaPaga = -1;

  for (const o of ofertasLlevaPaga) {
    const lleva = o.lleva || 2;
    const paga = o.paga || 1;

    let matchingLines: LineaCarrito[] = [];
    if (o.alcanceProductoId) {
      matchingLines = lineas.filter(
        (l) => String(l.productoId) === String(o.alcanceProductoId),
      );
    } else if (o.alcanceCategoriaId) {
      const cat = categorias.find((c) => String(c.id) === String(o.alcanceCategoriaId));
      const prodsEnCat = new Set((cat?.productos || []).map((p) => String(p.id)));
      matchingLines = lineas.filter((l) => prodsEnCat.has(String(l.productoId)));
    }

    const totalUnidades = matchingLines.reduce((acc, l) => acc + l.cantidad, 0);

    // Solo si tiene lleva - 1 unidades (le falta 1 para el beneficio) y no aplica aún
    if (totalUnidades > 0 && totalUnidades === lleva - 1) {
      const puntaje = calcularValorBeneficio(o);
      if (puntaje > mejorPuntajeLlevaPaga) {
        mejorPuntajeLlevaPaga = puntaje;
        const nombreItem =
          matchingLines[0]?.nombre || o.productoNombre || o.categoriaNombre || 'producto';
        const promoEtiqueta = lleva === 2 && paga === 1 ? '2x1' : `Lleva ${lleva} paga ${paga}`;

        // Botón 'Agregar' cuando es un solo producto (alcanceProductoId o una sola línea coincidente)
        const prodId =
          o.alcanceProductoId ||
          (matchingLines.length === 1 ? matchingLines[0]?.productoId : undefined);

        candidatoLlevaPaga = {
          tipo: 'LLEVA_PAGA',
          texto: `Agrega 1 ${nombreItem} y llevas el ${promoEtiqueta}`,
          productoIdParaAgregar: prodId,
        };
      }
    }
  }

  if (candidatoLlevaPaga) {
    return candidatoLlevaPaga;
  }

  // 2. Evaluar DESCUENTO con compra mínima
  const ofertasDescuento = ofertas.filter(
    (o) =>
      o.activo !== false &&
      o.vigenteAhora === true &&
      o.tipo === 'DESCUENTO' &&
      typeof o.compraMinima === 'number' &&
      o.compraMinima > 0 &&
      !o.noSumaBeneficios,
  );

  let candidatoDescuento: AvisoTeFaltaPocoInfo | null = null;
  let menorFalta = Infinity;

  for (const o of ofertasDescuento) {
    const min = o.compraMinima!;
    // Si ya alcanzó la compra mínima, el descuento ya aplica
    if (subtotal >= min) continue;

    const falta = Number((min - subtotal).toFixed(2));
    // Umbral de «falta poco» (hasta S/ 25 o 50% de la compra mínima)
    if (falta > 0 && (falta <= 25 || falta <= min * 0.5) && falta < menorFalta) {
      menorFalta = falta;
      const textoDesc =
        o.descuentoTipo === 'PORCENTAJE'
          ? `${o.descuentoValor || 0} %`
          : `S/ ${o.descuentoValor || 0}`;
      const faltaTexto = Number.isInteger(falta) ? String(falta) : falta.toFixed(2);
      candidatoDescuento = {
        tipo: 'DESCUENTO',
        texto: `Agrega S/ ${faltaTexto} y activas el ${textoDesc} de descuento`,
      };
    }
  }

  if (candidatoDescuento) {
    return candidatoDescuento;
  }

  // 3. Evaluar ENVÍO GRATIS
  if (datosLocal?.envioGratisDesde && datosLocal.envioGratisDesde > 0) {
    const envioMin = datosLocal.envioGratisDesde;
    const modo = datosLocal.envioGratisModo || 'mas_de';

    const yaAplica = modo === 'desde' ? subtotal >= envioMin : subtotal > envioMin;
    if (!yaAplica && subtotal > 0) {
      const falta = Number((envioMin - subtotal).toFixed(2));
      // Umbral de «falta poco» para envío gratis (hasta S/ 20 o 30% del monto mínimo)
      if (falta > 0 && (falta <= 20 || falta <= envioMin * 0.3)) {
        const faltaTexto = Number.isInteger(falta) ? String(falta) : falta.toFixed(2);
        return {
          tipo: 'ENVIO_GRATIS',
          texto: `Te faltan S/ ${faltaTexto} para envío gratis`,
        };
      }
    }
  }

  return null;
}

export function AvisoTeFaltaPoco({
  lineas,
  subtotal,
  ofertas = [],
  categorias = [],
  datosLocal = null,
  onAgregarProducto,
}: AvisoTeFaltaPocoProps) {
  const aviso = obtenerAvisoTeFaltaPoco({
    lineas,
    subtotal,
    ofertas,
    categorias,
    datosLocal,
  });

  if (!aviso) return null;

  return (
    <div
      data-testid="aviso-te-falta-poco"
      role="status"
      style={{
        backgroundColor: 'var(--cp-sand)',
        border: '1.5px solid var(--cp-orange)',
        borderRadius: '12px',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        fontSize: '13px',
        lineHeight: '17px',
        color: 'var(--cp-navy)',
        fontFamily: 'Montserrat, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'var(--cp-orange)',
            flex: 'none',
          }}
          aria-hidden="true"
        />
        <span style={{ fontWeight: 600 }}>{aviso.texto}</span>
      </div>

      {aviso.productoIdParaAgregar && onAgregarProducto && (
        <button
          type="button"
          data-testid="btn-agregar-falta-poco"
          onClick={() => onAgregarProducto(aviso.productoIdParaAgregar!)}
          aria-label="Agregar 1 unidad más"
          style={{
            backgroundColor: 'var(--cp-navy)',
            color: 'var(--cp-cream)',
            border: 0,
            borderRadius: '9999px',
            padding: '4px 12px',
            fontSize: '12px',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 700,
            cursor: 'pointer',
            flex: 'none',
          }}
        >
          Agregar
        </button>
      )}
    </div>
  );
}
