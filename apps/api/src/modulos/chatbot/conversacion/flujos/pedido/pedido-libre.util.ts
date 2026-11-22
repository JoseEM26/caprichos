import { normalizarTexto } from '../../normalizador-entrada.util';

/**
 * Entiende un pedido escrito en una sola frase («2 frappé moka grande para llevar, pago con 50»).
 * Solo reconoce lo que está en la carta: producto, tamaño y opciones; cantidad, modalidad y con cuánto paga.
 * Lo que no entiende no se inventa: queda en `ambiguos` (varios productos posibles) o `sinProducto`.
 */
export interface LineaLibre {
  producto: any;
  categoria: any;
  cantidad: number;
  tamano?: any;
  /** Opciones que el cliente ya dijo (p. ej. «leche de almendra»). */
  opciones: Array<{ grupo: any; opcion: any }>;
}

export interface PedidoLibre {
  lineas: LineaLibre[];
  modalidad?: 'DELIVERY' | 'RECOGER';
  pagaCon?: number;
  medio?: 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA';
  /** Trozos con varios productos posibles: se le pregunta cuál. */
  ambiguos: Array<{ texto: string; candidatos: Array<{ producto: any; categoria: any }> }>;
  /** Trozos con pinta de pedido pero sin producto de la carta. */
  sinProducto: string[];
  /** Productos de la carta que ahora no se pueden pedir (agotados, ocultos). */
  agotados: string[];
}

const NUMEROS: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, medio: 1 };
/** Palabras que no distinguen un producto de otro. */
const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'y', 'en', 'al', 'a', 'oz', 'sin', 'para', 'tu', 'mi']);
const RELLENO = /\b(hola|buenas( tardes| noches| dias)?|quiero|quisiera|queria|quiere|me das|me dan|me pones|me ponen|me regalas|dame|denme|ponme|pon|pido|pedir|necesito|deseo|porfa|porfavor|por favor|xfa|gracias|un pedido|mi pedido|ordenar|agrega|agregame|agregar|anota|anotame|tambien|ademas|unos|unas)\b/g;
const RE_DELIVERY = /\b(delivery|a domicilio|domicilio|que me lo envien|que me lo traigan|envio)\b/;
const RE_RECOGER = /\b(para llevar|llevar|para recoger|recoger|recojo|retiro|retirar|paso a recoger|paso por)\b/;
const RE_PAGA = /\b(?:pago|pagare|pagar|pagaria|paga|billete) (?:con|de) (?:s ?\/? ?)?(\d{1,4})\b/;
const RE_MEDIO: Array<[RegExp, PedidoLibre['medio']]> = [
  [/\b(?:pago|pagare|pagar|con) (?:con |por )?yape\b/, 'YAPE'],
  [/\b(?:pago|pagare|pagar|con) (?:con |por )?plin\b/, 'PLIN'],
  [/\b(?:pago|pagare|pagar|con) (?:con |por )?tarjeta\b/, 'TARJETA'],
  [/\b(?:pago|pagare|pagar) (?:en )?efectivo\b/, 'EFECTIVO'],
];

const raiz = (t: string) => (t.length > 4 ? t.replace(/(es|s)$/, '') : t);
const tokens = (t: string) => normalizarTexto(t).split(' ').filter((x) => x && !VACIAS.has(x)).map(raiz);

/** Frase de pregunta o consulta: no es un pedido aunque nombre un producto. */
export function esPregunta(textoNormalizado: string, textoOriginal = ''): boolean {
  return (
    /\?/.test(textoOriginal) ||
    /^(hay|tienen|tiene|tienes|cuanto|cuesta|cuestan|precio|que |cual|cuales|como|a que|donde|cuando|puedo|se puede|venden|sirven|es |son |hasta|ya |llega|todavia|aun )/.test(textoNormalizado) ||
    /\b(cuanto cuesta|cuanto sale|que precio|tienen|hay )\b/.test(textoNormalizado)
  );
}

function tamanoDe(prod: any, segmento: Set<string>, texto: string): any | undefined {
  const tamanos: any[] = prod.tamanos || [];
  if (tamanos.length < 2) return undefined;
  // 1) por el nombre del tamaño tal cual está en la carta («regular», «mediano»)
  const porNombre = tamanos.filter((t) => {
    const k = tokens(t.nombre).filter((x) => !/^\d+$/.test(x));
    return k.length > 0 && k.every((x) => segmento.has(x));
  });
  if (porNombre.length === 1) return porNombre[0];
  // 2) por palabras corrientes: chico/pequeño abajo, grande/extra arriba, mediano en medio
  const orden = [...tamanos].sort((a, b) => Number(a.precio) - Number(b.precio));
  if (/\b(chico|chica|pequeno|pequena|small|personal)\b/.test(texto)) return orden[0];
  if (/\b(grande|large|gigante|xl)\b/.test(texto)) return orden[orden.length - 1];
  if (/\b(mediano|mediana|medio|medium|regular)\b/.test(texto) && orden.length === 3) return orden[1];
  return undefined;
}

function opcionesDe(prod: any, segmento: Set<string>): Array<{ grupo: any; opcion: any }> {
  const res: Array<{ grupo: any; opcion: any }> = [];
  for (const g of prod.grupos || []) {
    const elegidas = (g.opciones || [])
      .filter((o: any) => o.disponible !== false)
      .filter((o: any) => {
        const k = tokens(o.nombre).filter((x) => x !== 'leche' && x !== 'bebida');
        return k.length > 0 && k.every((x) => segmento.has(x));
      });
    // Solo si no hay duda: una opción para el grupo (o hasta su máximo)
    const tope = Math.max(1, Number(g.maximo) || 1);
    if (elegidas.length > 0 && elegidas.length <= tope) for (const o of elegidas) res.push({ grupo: g, opcion: o });
  }
  return res;
}

/**
 * Interpreta la frase. Devuelve null si no hay nada que parezca pedido de la carta.
 * `vendible` deja fuera lo que el bot no vende (agotados, ocultos, combos que se arman paso a paso).
 */
export function interpretarPedidoLibre(texto: string, categorias: any[], vendible: (p: any) => boolean): PedidoLibre | null {
  // Los separadores (coma, punto y coma, salto de línea) se usan antes de normalizar, que los borra
  const crudos = String(texto ?? '').split(/[,;\n+]+/).map((x) => normalizarTexto(x)).filter(Boolean);
  let t = crudos.join(' , ');
  if (!t) return null;
  const res: PedidoLibre = { lineas: [], ambiguos: [], sinProducto: [], agotados: [] };

  const paga = RE_PAGA.exec(t);
  if (paga) { res.pagaCon = Number(paga[1]); res.medio = 'EFECTIVO'; t = t.replace(paga[0], ' '); }
  for (const [re, medio] of RE_MEDIO) {
    const m = re.exec(t);
    if (m) { res.medio = medio; t = t.replace(m[0], ' '); }
  }
  if (RE_DELIVERY.test(t)) res.modalidad = 'DELIVERY';
  else if (RE_RECOGER.test(t)) res.modalidad = 'RECOGER';
  t = t.replace(RE_DELIVERY, ' ').replace(RE_RECOGER, ' ').replace(RELLENO, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return null;

  const todos: Array<{ producto: any; categoria: any; k: string[] }> = [];
  for (const categoria of categorias || []) {
    for (const producto of categoria.productos || []) {
      const k = [...new Set(tokens(producto.nombre))];
      if (k.length) todos.push({ producto, categoria, k });
    }
  }

  // Un trozo por producto: separados por coma, « y », « mas » o «+»
  const trozos = t.split(/\s*(?:,|\by\b|\bmas\b)\s*|\s+(?=(?:\d{1,2}|un|una|uno|dos|tres|cuatro|cinco|seis)\s+[a-z])/).map((x) => x.trim()).filter(Boolean);
  for (const trozo of trozos) {
    const palabras = trozo.split(' ');
    let cantidad = 1;
    const primera = palabras[0];
    if (/^\d{1,2}$/.test(primera) && Number(primera) > 0) cantidad = Number(primera);
    else if (NUMEROS[primera] && primera !== 'medio') cantidad = NUMEROS[primera];
    const x = /\bx ?(\d{1,2})\b/.exec(trozo);
    if (x) cantidad = Number(x[1]);
    const seg = new Set(tokens(trozo));

    // Puntaje: parte del nombre del producto que aparece en el trozo; gana el que más cubre
    const puntajes = todos
      .map((c) => ({ ...c, n: c.k.filter((w) => seg.has(w)).length }))
      .filter((c) => c.n > 0 && c.n >= Math.ceil(c.k.length / 2));
    if (!puntajes.length) {
      if (seg.size) res.sinProducto.push(trozo);
      continue;
    }
    const mejor = Math.max(...puntajes.map((c) => c.n / c.k.length));
    const ganadores = puntajes.filter((c) => c.n / c.k.length === mejor);
    // Entre empatados, el que cubre más palabras exactas del trozo
    const maxN = Math.max(...ganadores.map((c) => c.n));
    const finales = ganadores.filter((c) => c.n === maxN);
    const vendibles = finales.filter((c) => vendible(c.producto));
    if (finales.length > 1 && vendibles.length !== 1) {
      res.ambiguos.push({ texto: trozo, candidatos: vendibles.map((c) => ({ producto: c.producto, categoria: c.categoria })) });
      continue;
    }
    const g = finales.length > 1 ? vendibles[0] : finales[0];
    if (!vendible(g.producto)) {
      res.agotados.push(g.producto.nombre);
      continue;
    }
    const tamano = tamanoDe(g.producto, seg, trozo);
    res.lineas.push({ producto: g.producto, categoria: g.categoria, cantidad: Math.min(cantidad, 99), tamano, opciones: opcionesDe(g.producto, seg) });
  }

  if (!res.lineas.length && !res.ambiguos.length && !res.sinProducto.length && !res.agotados.length) return null;
  return res;
}

/** «sí», «ok», «dale», «está bien»…: cualquier forma corriente de aceptar (texto ya normalizado). */
const RE_SI = /^(si+|sip|sep|ok+|okey|oki|dale|daleee*|ya|ya pues|listo|claro|correcto|esta bien|de acuerdo|perfecto|vale|bueno|confirmo|confirmar|confirmado|adelante|eso es|asi es|todo bien|yes)( (gracias|por favor|porfa|xfa|nomas|confirmar|confirmo|correcto))*$/;
export const esSi = (textoNormalizado: string): boolean => RE_SI.test(textoNormalizado.trim());
