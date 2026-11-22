import { CARTA, Simulador } from './simulador-pedido';

/**
 * Cliente simulado: contesta lo que el bot pregunta para llegar a su objetivo por el camino guiado. Sirve para medir
 * cuántos mensajes necesita el bot, sin importar cómo esté construido por dentro.
 */
export interface Objetivo {
  /** Productos que quiere, en orden (texto que se busca en el nombre de la opción). */
  items: Array<{ producto: string; tamano?: string; cantidad?: number; opcion?: string }>;
  modalidad: 'RECOGER' | 'DELIVERY';
  pago: 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA';
  paga?: number;
  nombre?: string;
  ubicacion?: { latitud: number; longitud: number };
  comprobante?: 'simple' | 'boleta' | 'factura';
  /** Escribe el título de la opción en vez de su número (así contestan muchos clientes reales). */
  escribeTitulos?: boolean;
}

export const sinTildes = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Un turno del cliente dócil. Devuelve false si ya no sabe qué contestar. */
export function turnoDocil(s: Simulador, o: Objetivo): boolean {
  const txt = sinTildes(s.ultimo);
  const ops = (s.menu?.opciones ?? []).map((x) => ({ ...x, t: sinTildes(x.titulo) }));
  const hechos = s.carrito?.items?.length ?? 0;
  const q = o.items[Math.min(hechos, o.items.length - 1)];
  const pend = hechos < o.items.length;
  const pick = (...res: RegExp[]) => {
    for (const re of res) {
      const op = ops.find((x) => re.test(x.t));
      if (op) { s.decir(o.escribeTitulos ? op.titulo : String(op.n)); return true; }
    }
    return false;
  };
  const sinMenuVivo = !ops.length || !/👉 responde/.test(txt);
  // Preguntas de texto libre
  if (/ubicacion actual|envianos tu ubicacion/.test(txt) && o.ubicacion) { s.decir({ tipo: 'location', ubicacion: o.ubicacion }); return true; }
  if (/nombre para el envase|nombre del envase/.test(txt) && sinMenuVivo) { s.decir(o.nombre ?? 'Ana'); return true; }
  if (/escribe tu nombre completo/.test(txt)) { s.decir(o.nombre ?? 'Ana Torres'); return true; }
  if (/celular de 9 digitos/.test(txt)) { s.decir('987654321'); return true; }
  if (!ops.length) return false;
  // Menús con opciones
  if (/con cuanto pagas/.test(txt)) return pick(o.paga ? new RegExp(`\\b${o.paga}\\b`) : /exacto/, /exacto/, /./);
  if (ops.some((x) => /^confirmar pedido/.test(x.t))) return pick(/^confirmar pedido/);
  if (ops.some((x) => /delivery/.test(x.t)) && ops.some((x) => /recoger/.test(x.t))) return pick(o.modalidad === 'DELIVERY' ? /delivery/ : /recoger/);
  if (/como pagaras/.test(txt)) return pick(new RegExp(o.pago === 'TARJETA' ? 'tarjeta' : o.pago.toLowerCase()));
  if (ops.some((x) => /comprobante simple/.test(x.t))) return pick(new RegExp(o.comprobante ?? 'simple'));
  if (ops.some((x) => /^si/.test(x.t)) && /correcto|confirmas|usamos/.test(txt)) return pick(/^si/);
  if (ops.some((x) => /usar este numero/.test(x.t))) return pick(/usar este numero/);
  if (/propina/.test(txt)) return pick(/sin propina/);
  if (ops.some((x) => /(continuar|agregar producto)/.test(x.t))) {
    // La cantidad ya no se pregunta (se asume 1): si quiere otra, la corrige una vez con «mejor que sean N»
    const ultimo = s.carrito?.items?.[hechos - 1];
    const quiere = o.items[hechos - 1]?.cantidad ?? 1;
    const yaCorrigio: Set<number> = ((s as any)._corrigioCantidad ??= new Set<number>());
    if (ultimo && ultimo.cantidad !== quiere && !yaCorrigio.has(hechos)) {
      yaCorrigio.add(hechos);
      s.decir(`mejor que sean ${quiere}`);
      return true;
    }
    return pend ? pick(/agregar producto/) : pick(/continuar/);
  }
  if (/cuantas unidades|cuantas quieres/.test(txt)) {
    const n = q?.cantidad ?? 1;
    if (pick(new RegExp(`^${n} unidad`))) return true;
    s.decir(String(n));
    return true;
  }
  if (q && ops.some((x) => /^(chico|mediano|grande)/.test(x.t))) return pick(new RegExp(`^${sinTildes(q.tamano ?? 'chico')}`));
  if (/obligatorio|opcional|personalizar/.test(txt) && q) return pick(new RegExp(sinTildes(q.opcion ?? 'entera')), /ninguno|sin |no,/, /./);
  if (q) {
    const cat = CARTA.find((c) => c.productos.some((p) => sinTildes(p.nombre).includes(sinTildes(q.producto))));
    if (cat && ops.some((x) => x.t.startsWith(sinTildes(cat.nombre)))) return pick(new RegExp(`^${sinTildes(cat.nombre)}`));
    if (pick(new RegExp(sinTildes(q.producto)))) return true;
  }
  return pick(/continuar/, /confirmar/, /./);
}

/** Corre al cliente dócil hasta que se cree el pedido o se pase el tope de turnos. */
export function correrDocil(s: Simulador, o: Objetivo, tope = 40): void {
  for (let i = 0; i < tope && s.pedidos.length === 0; i++) if (!turnoDocil(s, o)) break;
}

export interface Metricas {
  botMensajes: number;
  turnosCliente: number;
  repetidosSeguidos: number;
  repetidosEnConversacion: number;
  seEnreda: number;
  pedidoCreado: boolean;
}

export function metricas(s: Simulador): Metricas {
  const t = s.botTextos;
  let seguidos = 0;
  for (let i = 1; i < t.length; i++) if (t[i] === t[i - 1]) seguidos++;
  const vistos = new Set<string>();
  let enConv = 0;
  for (const x of t) {
    if (vistos.has(x)) enConv++;
    vistos.add(x);
  }
  const seEnreda = t.filter((x) => /no te entend|no entend/i.test(x)).length;
  return { botMensajes: t.length, turnosCliente: s.turnos.length, repetidosSeguidos: seguidos, repetidosEnConversacion: enConv, seEnreda, pedidoCreado: s.pedidos.length > 0 };
}
