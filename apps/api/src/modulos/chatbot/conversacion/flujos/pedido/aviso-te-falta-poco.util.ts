import { LineaCarritoBot } from './tipos-pedido';

export interface OfertaCalificadaBot {
  id: string;
  nombre: string;
  ahorro: number;
}

export interface OfertaFaltaPocoBot {
  id: string;
  nombre: string;
  faltan: number;
  miss: string[];
  precio: number;
  texto: string;
}

export interface ResultadoEvaluacionOfertas {
  califica?: OfertaCalificadaBot;
  faltaPoco?: OfertaFaltaPocoBot;
}

/**
 * Evalúa las ofertas vigentes contra los productos en el carrito para:
 * 1. Detectar si califica para una promoción de forma automática (LLEVA_PAGA o DESCUENTO).
 * 2. Generar el aviso de «te falta poco» si le faltan 1 o pocos productos para activar el beneficio,
 *    reutilizando fielmente la lógica de la carta y el guion del mockup.
 */
export function evaluarOfertasParaCarrito(params: {
  items: LineaCarritoBot[];
  subtotal: number;
  ofertas?: any[];
  ofertasRechazadas?: string[];
  envioGratisMonto?: number;
  envioGratisModo?: string;
}): ResultadoEvaluacionOfertas {
  const { items, subtotal, ofertas = [], ofertasRechazadas = [], envioGratisMonto = 70, envioGratisModo = 'mas_de' } = params;

  if (!items || items.length === 0 || subtotal <= 0) {
    return {};
  }

  const rechazadasSet = new Set(ofertasRechazadas);

  // 1. Evaluar LLEVA_PAGA (2x1, 3x2, etc.)
  const ofertasLlevaPaga = ofertas.filter(
    (o) =>
      o.activo !== false &&
      (o.tipo === 'LLEVA_PAGA' || /^\d+x\d+$/i.test(String(o.tipo || ''))) &&
      !o.no_suma_beneficios &&
      !rechazadasSet.has(String(o.id)),
  );

  for (const o of ofertasLlevaPaga) {
    const lleva = Number(o.lleva || 2);
    const paga = Number(o.paga || 1);
    if (lleva <= paga || lleva <= 0) continue;

    const alcanceProdId = o.alcance_producto_id ? String(o.alcance_producto_id) : (o.alcanceProductoId ? String(o.alcanceProductoId) : null);
    const alcanceCatId = o.alcance_categoria_id ? String(o.alcance_categoria_id) : (o.alcanceCategoriaId ? String(o.alcanceCategoriaId) : null);

    const matching = items.filter((l) => {
      if (l.noSumaBeneficios) return false;
      if (alcanceProdId) return String(l.productoId) === alcanceProdId;
      if (alcanceCatId) return String(l.categoriaId) === alcanceCatId;
      return true;
    });

    const totalUnidades = matching.reduce((sum, l) => sum + l.cantidad, 0);

    // Caso A: Ya califica para la promoción
    if (totalUnidades >= lleva) {
      // Calcular ahorro: precio unitario de las unidades bonificadas
      const preciosUnidades: number[] = [];
      for (const m of matching) {
        for (let u = 0; u < m.cantidad; u++) {
          preciosUnidades.push(m.precioUnitario);
        }
      }
      preciosUnidades.sort((a, b) => a - b);
      const numGrupos = Math.floor(totalUnidades / lleva);
      const bonificadas = numGrupos * (lleva - paga);
      const ahorro = Number(preciosUnidades.slice(0, bonificadas).reduce((a, b) => a + b, 0).toFixed(2));

      if (ahorro > 0) {
        return {
          califica: {
            id: String(o.id),
            nombre: String(o.nombre || `${lleva}x${paga}`),
            ahorro,
          },
        };
      }
    }

    // Caso B: Le falta poco (exactamente 1 para alcanzar el beneficio del grupo)
    if (totalUnidades > 0 && totalUnidades === lleva - 1) {
      const nombreItem = matching[0]?.productoNombre || o.nombre || 'producto';
      const promoEtiqueta = lleva === 2 && paga === 1 ? '2x1' : `Lleva ${lleva} paga ${paga}`;
      const precioEstimado = matching[0]?.precioUnitario ? matching[0].precioUnitario * paga : 0;

      return {
        faltaPoco: {
          id: String(o.id),
          nombre: String(o.nombre || promoEtiqueta),
          faltan: 1,
          miss: [nombreItem],
          precio: precioEstimado,
          texto: `Agrega 1 ${nombreItem} y activas el ${promoEtiqueta}`,
        },
      };
    }
  }

  // 2. Evaluar DESCUENTO con compra mínima
  const ofertasDescuento = ofertas.filter(
    (o) =>
      o.activo !== false &&
      o.tipo === 'DESCUENTO' &&
      Number(o.compra_minima || o.compraMinima || 0) > 0 &&
      !rechazadasSet.has(String(o.id)),
  );

  for (const o of ofertasDescuento) {
    const min = Number(o.compra_minima || o.compraMinima);
    if (subtotal < min) {
      const falta = Number((min - subtotal).toFixed(2));
      if (falta > 0 && (falta <= 25 || falta <= min * 0.5)) {
        const val = Number(o.descuento_valor || o.descuentoValor || 0);
        const tipoDesc = o.descuento_tipo || o.descuentoTipo;
        const textoDesc = tipoDesc === 'PORCENTAJE' ? `${val}%` : `S/ ${val.toFixed(2)}`;
        const faltaTexto = Number.isInteger(falta) ? String(falta) : falta.toFixed(2);

        return {
          faltaPoco: {
            id: String(o.id),
            nombre: String(o.nombre || 'Descuento'),
            faltan: 1,
            miss: [`S/ ${faltaTexto}`],
            precio: subtotal,
            texto: `Agrega S/ ${faltaTexto} y activas el ${textoDesc} de descuento`,
          },
        };
      }
    }
  }

  // 3. Evaluar ENVÍO GRATIS
  if (envioGratisMonto > 0) {
    const yaAplica = envioGratisModo === 'desde' ? subtotal >= envioGratisMonto : subtotal > envioGratisMonto;
    if (!yaAplica) {
      const falta = Number((envioGratisMonto - subtotal).toFixed(2));
      if (falta > 0 && (falta <= 20 || falta <= envioGratisMonto * 0.3)) {
        const faltaTexto = Number.isInteger(falta) ? String(falta) : falta.toFixed(2);
        return {
          faltaPoco: {
            id: 'envio_gratis',
            nombre: 'Envío gratis',
            faltan: 1,
            miss: [`S/ ${faltaTexto}`],
            precio: subtotal,
            texto: `Te faltan S/ ${faltaTexto} para envío gratis`,
          },
        };
      }
    }
  }

  return {};
}
