import { redondearMonto } from '@caprichos/compartido';
import { BotonAccion } from '../puerto/whatsapp-mensajeria.puerto';
import { estaVigente } from '../../ofertas/ofertas.util';
import { TEXTOS_BOT } from './textos-bot';

export interface InfoProductoCierre {
  id: string | number | bigint;
  nombre: string;
  categoriaId?: string | number | bigint;
  categoria_id?: string | number | bigint;
  precio?: number | string | any;
  precioBase?: number | string | any;
  descripcion?: string | null;
  disponible?: boolean;
  tamanos?: Array<{
    id?: string | number | bigint;
    nombre: string;
    precio: number | string | any;
  }>;
  grupos?: any[];
  sabores?: any[];
}

export interface OfertaEncajada {
  ofertaId: string;
  nombre: string;
  tipo: 'COMBO' | 'LLEVA_PAGA' | 'DESCUENTO' | 'CUPON';
  precioRegular: number;
  precioFinal: number;
  ahorro: number;
  lineaBeneficio: string;
  sugerenciaVentaAdicional?: string;
  complementoNombre?: string;
}

export const TITULO_BOTON_PEDIR_ESTE = 'Pedir este producto'; // 19 caracteres (<= 20)
export const TITULO_BOTON_VER_PROMO = 'Ver la promo'; // 12 caracteres (<= 20)
export const TITULO_BOTON_VER_PROMOS = 'Ver promociones'; // 15 caracteres (<= 20)
export const TITULO_BOTON_VOLVER_MENU = 'Volver al menú'; // 15 caracteres (<= 20)
export const TITULO_BOTON_HABLAR_PERSONA = 'Hablar con persona'; // 18 caracteres (<= 20)
export const TITULO_BOTON_VER_CARTA = 'Ver la carta'; // 12 caracteres (<= 20)
export const TITULO_BOTON_HACER_PEDIDO = 'Hacer un pedido'; // 15 caracteres (<= 20)

export const FRASES_CIERRE_ROTATIVAS = [
  '¿Te animas a pedirlo?',
  '¿Te gustaría pedirlo ahora?',
  '¿Te provoca probarlo hoy?',
];

/**
 * Formatea montos en soles con cálculo determinista redondeado a 2 decimales.
 * Si es entero se muestra 'S/ 37' o 'S/ 37.00' si se requiere centavos.
 */
export function formatearMontoSoles(monto: number): string {
  const redondeado = redondearMonto(monto);
  if (Number.isInteger(redondeado)) {
    return `S/ ${redondeado}`;
  }
  return `S/ ${redondeado.toFixed(2)}`;
}

/**
 * Formatea montos estrictamente con 2 decimales siempre (ej. 'S/ 16.50').
 */
export function formatearMontoDecimal(monto: number): string {
  const redondeado = redondearMonto(monto);
  return `S/ ${redondeado.toFixed(2)}`;
}

/**
 * Limpia cualquier texto pasivo o inventado de la IA sobre botones o menú.
 */
export function limpiarFrasesPasivasIa(texto: string): string {
  if (!texto) return '';

  return texto
    .replace(/Si deseas pedirlo,?\s*recuerda hacerlo a trav[eé]s del men[uú] de botones\.?\s*(¡?Buen provecho!?|Gracias)?/gi, '')
    .replace(/recuerda (hacerlo|que el pedido se realiza|pedirlo) a trav[eé]s del men[uú] de botones\.?/gi, '')
    .replace(/hazlo a trav[eé]s del men[uú] de botones\.?/gi, '')
    .replace(/recuerda pedir por el men[uú] de botones\.?/gi, '')
    .replace(/p[ií]delo a trav[eé]s de los botones del men[uú]\.?/gi, '')
    .replace(/el pedido se realiza mediante los botones del men[uú]\.?/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Busca ofertas vigentes en el canal WhatsApp que apliquen al producto o su categoría.
 * Solo utiliza datos reales del módulo de ofertas.
 */
export function buscarOfertaParaProducto(
  producto: InfoProductoCierre,
  ofertas: any[] = [],
  catalogo: any[] = [],
  ahora: Date = new Date(),
): OfertaEncajada | null {
  if (!producto || !ofertas || ofertas.length === 0) {
    return null;
  }

  const prodIdStr = String(producto.id);
  const catIdStr = String(producto.categoriaId ?? producto.categoria_id ?? '');
  const precioProd = redondearMonto(Number(producto.precio ?? producto.precioBase ?? 0));

  for (const o of ofertas) {
    // 1. Verificar activo
    if (o.activo === false) continue;

    // 2. Verificar vigencia estricta por horario, fecha y canal WHATSAPP
    if (!estaVigente(o, 'WHATSAPP', ahora)) {
      continue;
    }

    const tipo = String(o.tipo || '').toUpperCase();
    const alcanceProdId = o.alcance_producto_id ? String(o.alcance_producto_id) : (o.alcanceProductoId ? String(o.alcanceProductoId) : null);
    const alcanceCatIds: string[] = o.alcance_categoria_ids?.length
      ? o.alcance_categoria_ids.map(String)
      : o.alcanceCategoriaIds?.length
        ? o.alcanceCategoriaIds.map(String)
        : o.alcance_categoria_id
          ? [String(o.alcance_categoria_id)]
          : o.alcanceCategoriaId
            ? [String(o.alcanceCategoriaId)]
            : [];

    // Caso A: COMBO
    if (tipo === 'COMBO') {
      const partes = o.combosParte || o.combos_parte || [];
      const parteProducto = partes.find((p: any) => {
        const prods = (p.productos || []).map((id: any) => String(id));
        const cats = (p.categorias || []).map((id: any) => String(id));
        return prods.includes(prodIdStr) || (catIdStr && cats.includes(catIdStr));
      });

      if (parteProducto) {
        // Encontrar complemento en otra parte del combo
        const otraParte = partes.find((p: any) => p !== parteProducto);
        let complementoNombre: string | undefined;
        let precioComplemento = 0;

        if (otraParte) {
          const complementosIds = (otraParte.productos || []).map((id: any) => String(id));
          const complementosCats = (otraParte.categorias || []).map((id: any) => String(id));

          // Buscar el producto en el catálogo (sin saldo: quedan 0 o agotado, no se ofrece como complemento)
          for (const cat of catalogo) {
            const prodComp = (cat.productos || []).find((cp: any) =>
              (complementosIds.includes(String(cp.id)) || complementosCats.includes(String(cat.id))) &&
              cp.disponible !== false &&
              cp.quedan !== 0,
            );
            if (prodComp) {
              complementoNombre = prodComp.nombre;
              precioComplemento = redondearMonto(Number(prodComp.precio ?? prodComp.precioBase ?? 0));
              break;
            }
          }
        }

        // Obtener precio del combo
        const precioComboRaw = o.combosPrecio?.[0]?.precio ?? o.precio ?? o.descuento_valor ?? null;
        if (precioComboRaw !== null && precioComboRaw !== undefined) {
          const precioFinal = redondearMonto(Number(precioComboRaw));
          const precioRegular = redondearMonto(precioProd + (precioComplemento > 0 ? precioComplemento : 0));
          const ahorro = redondearMonto(precioRegular - precioFinal);

          if (ahorro > 0) {
            const lineaBeneficio = `Con el ${o.nombre} pagas ${formatearMontoSoles(precioFinal)} en vez de ${formatearMontoSoles(precioRegular)} (ahorras ${formatearMontoSoles(ahorro)})`;
            let sugerenciaVentaAdicional: string | undefined;
            if (complementoNombre) {
              sugerenciaVentaAdicional = `Combínalo con ${complementoNombre} y ahorras ${formatearMontoSoles(ahorro)}`;
            }

            return {
              ofertaId: String(o.id),
              nombre: o.nombre,
              tipo: 'COMBO',
              precioRegular,
              precioFinal,
              ahorro,
              lineaBeneficio,
              sugerenciaVentaAdicional,
              complementoNombre,
            };
          }
        }
      }
    }

    // Caso B: LLEVA_PAGA
    if (tipo === 'LLEVA_PAGA' || /^\d+x\d+$/i.test(tipo)) {
      const coincide =
        (alcanceProdId && alcanceProdId === prodIdStr) ||
        (alcanceCatIds.length > 0 && alcanceCatIds.includes(catIdStr)) ||
        (!alcanceProdId && !alcanceCatIds.length);

      if (coincide && precioProd > 0) {
        const lleva = Number(o.lleva || 2);
        const paga = Number(o.paga || 1);
        if (lleva > paga) {
          const precioRegular = redondearMonto(lleva * precioProd);
          const precioFinal = redondearMonto(paga * precioProd);
          const ahorro = redondearMonto(precioRegular - precioFinal);

          return {
            ofertaId: String(o.id),
            nombre: o.nombre || `${lleva}x${paga}`,
            tipo: 'LLEVA_PAGA',
            precioRegular,
            precioFinal,
            ahorro,
            lineaBeneficio: `Con ${o.nombre || `${lleva}x${paga}`} pagas ${formatearMontoSoles(precioFinal)} en vez de ${formatearMontoSoles(precioRegular)} (ahorras ${formatearMontoSoles(ahorro)})`,
          };
        }
      }
    }

    // Caso C: DESCUENTO
    if (tipo === 'DESCUENTO') {
      const coincide =
        (alcanceProdId && alcanceProdId === prodIdStr) ||
        (alcanceCatIds.length > 0 && alcanceCatIds.includes(catIdStr)) ||
        (!alcanceProdId && !alcanceCatIds.length);

      if (coincide && precioProd > 0) {
        const tipoDesc = String(o.descuentoTipo || o.descuento_tipo || 'PORCENTAJE').toUpperCase();
        const valorDesc = Number(o.descuentoValor || o.descuento_valor || 0);

        if (valorDesc > 0) {
          let ahorro = 0;
          if (tipoDesc === 'PORCENTAJE') {
            ahorro = redondearMonto(precioProd * (valorDesc / 100));
          } else {
            ahorro = redondearMonto(Math.min(precioProd, valorDesc));
          }

          const precioFinal = redondearMonto(precioProd - ahorro);
          if (ahorro > 0) {
            return {
              ofertaId: String(o.id),
              nombre: o.nombre,
              tipo: 'DESCUENTO',
              precioRegular: precioProd,
              precioFinal,
              ahorro,
              lineaBeneficio: `Con ${o.nombre} pagas ${formatearMontoSoles(precioFinal)} en vez de ${formatearMontoSoles(precioProd)} (ahorras ${formatearMontoSoles(ahorro)})`,
            };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Valida los precios en el texto de la IA contra los del catálogo real del producto.
 * Si el modelo alucina un precio diferente, se reemplaza por la ficha determinista.
 */
export function validarYCorregirPreciosIa(
  textoIa: string,
  producto: InfoProductoCierre,
  cartaUrl?: string | null,
): { texto: string; corregido: boolean } {
  if (!textoIa || !producto) {
    return { texto: textoIa, corregido: false };
  }

  // Precios válidos permitidos para el producto (base y tamaños)
  const preciosValidos = new Set<number>();
  const pBase = redondearMonto(Number(producto.precio ?? producto.precioBase ?? 0));
  if (pBase > 0) preciosValidos.add(pBase);

  if (producto.tamanos && producto.tamanos.length > 0) {
    for (const t of producto.tamanos) {
      const pTam = redondearMonto(Number(t.precio ?? 0));
      if (pTam > 0) preciosValidos.add(pTam);
    }
  }

  if (preciosValidos.size === 0) {
    return { texto: textoIa, corregido: false };
  }

  // Buscar todas las menciones de precio tipo 'S/ 18.00', 'S/ 18', 's/ 18.50'
  const regexPrecio = /[sS]\/\s*(\d+(?:\.\d{1,2})?)/g;
  let match: RegExpExecArray | null;
  let hayPrecioDivergente = false;

  while ((match = regexPrecio.exec(textoIa)) !== null) {
    const montoMencionado = redondearMonto(parseFloat(match[1]));
    if (!preciosValidos.has(montoMencionado)) {
      hayPrecioDivergente = true;
      break;
    }
  }

  if (hayPrecioDivergente) {
    // Si la IA inventó un precio no coincidente, reemplazar por la ficha determinista
    const fichaDeterminista = TEXTOS_BOT.detalleProducto(producto as any, cartaUrl);
    return { texto: fichaDeterminista, corregido: true };
  }

  return { texto: textoIa, corregido: false };
}

/**
 * Genera el cierre comercial con botones y frase rotativa para WhatsApp.
 */
export function generarCierreComercial(params: {
  producto?: InfoProductoCierre;
  productosRecomendados?: InfoProductoCierre[];
  oferta?: OfertaEncajada | null;
  funcionesActivas?: { pedido?: boolean; [key: string]: any };
  indiceVariante?: number;
  yaEnPedido?: boolean;
}): {
  fraseCierre: string;
  lineaOferta?: string;
  sugerenciaAdicional?: string;
  botones: BotonAccion[];
} {
  const {
    producto,
    productosRecomendados = [],
    oferta,
    funcionesActivas,
    indiceVariante = 0,
    yaEnPedido = false,
  } = params;

  const pedidoHabilitado = funcionesActivas?.pedido !== false;

  // Frase rotativa (2-3 variantes sobrias)
  const idx = Math.abs(indiceVariante) % FRASES_CIERRE_ROTATIVAS.length;
  const fraseCierre = FRASES_CIERRE_ROTATIVAS[idx];

  // Caso 1: Varios productos recomendados (sin uno específico)
  if (!producto && productosRecomendados.length > 1) {
    const botones: BotonAccion[] = [];
    if (pedidoHabilitado) {
      botones.push({ id: 'pedir', titulo: TITULO_BOTON_HACER_PEDIDO });
    }
    botones.push({ id: 'carta', titulo: TITULO_BOTON_VER_CARTA });
    if (!pedidoHabilitado || botones.length < 3) {
      botones.push({ id: 'btn_persona', titulo: TITULO_BOTON_HABLAR_PERSONA });
    }

    return {
      fraseCierre,
      botones: botones.slice(0, 3),
    };
  }

  // Caso 2: Si ya está en flujo de pedido de este producto, no repetir cierre
  if (yaEnPedido) {
    return {
      fraseCierre: '',
      botones: [],
    };
  }

  const botones: BotonAccion[] = [];

  // Botón 1: Pedir este producto (si pedido está activo)
  if (pedidoHabilitado && producto) {
    botones.push({
      id: `ped_prod_${producto.id}`,
      titulo: TITULO_BOTON_PEDIR_ESTE,
    });
  }

  // Botón 2: Ver la promo (si aplica oferta)
  if (oferta) {
    botones.push({
      id: `btn_promo_${oferta.ofertaId}`,
      titulo: TITULO_BOTON_VER_PROMO,
    });
  }

  // Botón 3 o fallback: Volver al menú
  botones.push({
    id: 'btn_menu',
    titulo: TITULO_BOTON_VOLVER_MENU,
  });

  // Si pedido está apagado o falta espacio para 'Hablar con persona'
  if (!pedidoHabilitado || botones.length < 3) {
    botones.push({
      id: 'btn_persona',
      titulo: TITULO_BOTON_HABLAR_PERSONA,
    });
  }

  // Meta WhatsApp Cloud API admite máximo 3 botones por mensaje interactivo
  const botonesFinales = botones.slice(0, 3);

  // Asegurar que cada título sea <= 20 caracteres
  for (const b of botonesFinales) {
    if (b.titulo.length > 20) {
      b.titulo = b.titulo.slice(0, 20);
    }
  }

  return {
    fraseCierre,
    lineaOferta: oferta?.lineaBeneficio,
    sugerenciaAdicional: oferta?.sugerenciaVentaAdicional,
    botones: botonesFinales,
  };
}

/**
 * Adjunta de forma limpia y legible el cierre comercial al mensaje de respuesta.
 */
export function adjuntarCierreComercial(
  textoBase: string,
  cierre: {
    fraseCierre: string;
    lineaOferta?: string;
    sugerenciaAdicional?: string;
  },
): string {
  const limpio = limpiarFrasesPasivasIa(textoBase);
  const bloques: string[] = [limpio];

  // Máximo 1 oferta por mensaje
  if (cierre.lineaOferta) {
    bloques.push(`🏷 ${cierre.lineaOferta}`);
  } else if (cierre.sugerenciaAdicional) {
    bloques.push(`💡 ${cierre.sugerenciaAdicional}`);
  }

  // Frase corta y amable invitando a comprar
  if (cierre.fraseCierre) {
    bloques.push(cierre.fraseCierre);
  }

  return bloques.filter(Boolean).join('\n\n').trim().slice(0, 1024);
}
