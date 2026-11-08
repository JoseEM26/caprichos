import {
  BIENVENIDA_ANTIGUA_PRODUCTO_DEL_MES,
  LIMITE_CUERPO_TEXTO,
  TEXTOS_BOT_DEFECTO,
} from '../configuracion/chatbot-configuracion.tipos';

/** Fuente única de la bienvenida: la usan el menú, el saludo de «solo menús» y la IA. */
export const NOMBRE_LOCAL_BOT = 'Caprichos';

export interface DatosBienvenidaLocal {
  abierta?: boolean;
  abre?: string | null;
  textoEstado?: string | null;
  pausaAltaDemanda?: boolean;
  motivoPausa?: string | null;
  altaDemandaMinutosExtra?: number;
}

export interface OpcionesBienvenida {
  /** Textos guardados en Configuración (los que falten usan el defecto). */
  textos?: Record<string, string> | null;
  /** Líneas de promociones vigentes ya armadas (ver `lineasPromosVigentes`). */
  promos?: string[];
  linkCarta?: string | null;
  local?: string;
}

/** Texto efectivo de un mensaje: el guardado, o el defecto si falta, está vacío o es la bienvenida antigua. */
export function textoBot(textos: Record<string, string> | null | undefined, clave: keyof typeof TEXTOS_BOT_DEFECTO): string {
  const v = textos?.[clave];
  if (typeof v !== 'string' || !v.trim() || v.trim() === BIENVENIDA_ANTIGUA_PRODUCTO_DEL_MES) return TEXTOS_BOT_DEFECTO[clave];
  return v.trim();
}

/** Reemplaza {variable}; las desconocidas se dejan tal cual. Limpia espacios antes de signos si una variable quedó vacía. */
export function interpolar(texto: string, vars: Record<string, string>): string {
  return texto
    .replace(/\{([^{}]*)\}/g, (m, k) => (k in vars ? vars[k] : m))
    .replace(/[ \t]+([!,.¡?:])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ');
}

const soles = (n: number) => `S/ ${Number.isInteger(n) ? n : n.toFixed(2)}`;

/** Una línea «nombre + beneficio» de una oferta; null si no hay nada que decir. */
export function lineaPromo(o: any): string | null {
  const nombre = String(o?.nombre ?? '').trim();
  if (!nombre) return null;
  let beneficio = '';
  if (o.tipo === 'COMBO') {
    const precios: number[] = (o.combosPrecio ?? []).map((c: any) => Number(c.precio)).filter((n: number) => n > 0);
    if (precios.length) beneficio = `${precios.length > 1 ? 'desde ' : ''}${soles(Math.min(...precios))}`;
  } else if (o.tipo === 'LLEVA_PAGA' && o.lleva && o.paga) {
    beneficio = `lleva ${o.lleva}, paga ${o.paga}`;
  } else if (o.tipo === 'ENVIO_GRATIS' || o.descuentoTipo === 'ENVIO_GRATIS') {
    beneficio = 'envío gratis';
  } else if (o.descuentoValor) {
    beneficio = o.descuentoTipo === 'MONTO' ? `${soles(Number(o.descuentoValor))} de descuento` : `${Number(o.descuentoValor)} % de descuento`;
  }
  return `• ${nombre}${beneficio ? ` — ${beneficio}` : ''}`.slice(0, 90);
}

/**
 * Promociones para la bienvenida: vigentes ahora, activas, visibles en la carta, combos armables.
 * Orden del panel (prioridad), y a igual prioridad la de mayor descuento. Máx. `max` (1 a 5).
 */
export function lineasPromosVigentes(ofertas: any[] | null | undefined, max = 3): string[] {
  const tope = Math.min(5, Math.max(1, Math.floor(Number(max)) || 3));
  return (ofertas ?? [])
    .filter((o) => o && o.activo !== false && o.vigenteAhora === true && o.visibleCarta !== false && !(o.tipo === 'COMBO' && o.disponible === false))
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || Number(b.descuentoValor ?? 0) - Number(a.descuentoValor ?? 0))
    .map(lineaPromo)
    .filter((l): l is string => !!l)
    .slice(0, tope);
}

/** Si se muestran las promociones y cuántas (1 a 5). */
export function ajustesPromos(textos: Record<string, string> | null | undefined): { mostrar: boolean; max: number } {
  return {
    mostrar: textoBot(textos, 'chatbot_promos_mostrar').toLowerCase() !== 'no',
    max: Math.min(5, Math.max(1, parseInt(textoBot(textos, 'chatbot_promos_max'), 10) || 3)),
  };
}

/** Arma la bienvenida completa (≤ 1024 caracteres: cuerpo de lista/botones de WhatsApp). */
export function armarBienvenida(nombre: string | null | undefined, datos: DatosBienvenidaLocal | null | undefined, op: OpcionesBienvenida = {}): string {
  const t = (k: keyof typeof TEXTOS_BOT_DEFECTO) => textoBot(op.textos, k);
  const link = String(op.linkCarta ?? '').trim();
  const local = op.local || NOMBRE_LOCAL_BOT;
  const base = { nombre: String(nombre ?? '').trim(), local, link_carta: link };

  if (datos?.pausaAltaDemanda) {
    const saludo = interpolar(t('chatbot_texto_bienvenida'), { ...base, promociones: '' }).trim();
    return `${saludo}\n\nPor el momento no estamos recibiendo pedidos (${datos.motivoPausa || 'alta demanda de pedidos'}). Un asesor te atiende por este chat.`.slice(0, LIMITE_CUERPO_TEXTO);
  }

  // Cerrado: dice la hora de apertura y NO invita a pedir (sin promociones ni «más descuento»)
  if (datos && datos.abierta === false) {
    const saludo = interpolar(t('chatbot_texto_bienvenida'), { ...base, promociones: '' }).trim();
    const apertura = datos.abre ? `Abrimos hoy a las ${datos.abre}.` : 'Abrimos en nuestro próximo horario regular.';
    const cerrado = interpolar(t('chatbot_texto_fuera_horario'), {
      ...base,
      horario: datos.textoEstado || '',
      hora_apertura: datos.abre || 'nuestro próximo horario',
      apertura,
    });
    return `${saludo}\n\n${cerrado}`.slice(0, LIMITE_CUERPO_TEXTO);
  }

  const { mostrar, max } = ajustesPromos(op.textos);
  const lineas = mostrar ? (op.promos ?? []).slice(0, max) : [];
  const masDescuento = link ? interpolar(t('chatbot_texto_mas_descuento'), base) : '';
  const extra =
    datos?.altaDemandaMinutosExtra && datos.altaDemandaMinutosExtra > 0
      ? `Hoy tenemos muchos pedidos: la entrega está tardando unos ${25 + datos.altaDemandaMinutosExtra} minutos.`
      : '';

  const componer = (n: number): string => {
    const bloque = n > 0 ? `${interpolar(t('chatbot_texto_promos_encabezado'), base)}\n${lineas.slice(0, n).join('\n')}` : '';
    const plantilla = t('chatbot_texto_bienvenida');
    const lleva = plantilla.includes('{promociones}');
    const saludo = interpolar(plantilla, { ...base, promociones: bloque }).trim();
    return [saludo, lleva ? '' : bloque, masDescuento, extra].filter(Boolean).join('\n\n');
  };

  // Si no entra en 1024, se quitan promociones desde la última (nunca se corta una línea a la mitad)
  for (let n = lineas.length; n >= 0; n--) {
    const texto = componer(n);
    if (texto.length <= LIMITE_CUERPO_TEXTO) return texto;
  }
  return componer(0).slice(0, LIMITE_CUERPO_TEXTO);
}
